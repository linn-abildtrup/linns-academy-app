<script lang="ts">
	import { getContext, onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import type {
		DayExercise,
		Exercise,
		Feedback,
		MikrotraeningFremgang,
		TrainingDay,
		UserProduct
	} from '$lib/content/mikrotraening';
	import { markerDagSomGennemfort, registrerFeedback } from '$lib/content/mikrotraening';
	import {
		gemMikrotraeningFremgang,
		hentExercises,
		hentProgram,
		hentUserProduct,
		type ProgramMedDage
	} from '$lib/firestore/mikrotraening';
	import { getVideoUrl } from '$lib/utils/storage';
	import Icon from '$lib/components/Icon.svelte';

	const PREP_SEC = 10;
	const SWITCH_SEC = 15;

	type Phase = 'prep' | 'work' | 'rest' | 'switch' | 'done';

	const getUser = getContext<() => User | null>('user');
	const user = $derived(getUser());

	const dagNummer = $derived(parseInt(page.params.dag ?? '', 10));

	let userProduct = $state<UserProduct | null>(null);
	let programData = $state<ProgramMedDage | null>(null);
	let exerciseMap = $state<Map<string, Exercise>>(new Map());
	let videoUrls = $state<Map<string, string>>(new Map());
	let loading = $state(true);
	let fejl = $state<string | null>(null);

	let ei = $state(0);
	let si = $state(1);
	let phase = $state<Phase>('prep');
	let rem = $state(PREP_SEC);
	let phaseTotal = $state(PREP_SEC);
	let paused = $state(false);
	let timerHandle: ReturnType<typeof setInterval> | null = null;

	let gemmer = $state(false);
	let gemFejl = $state<string | null>(null);
	let viserFeedback = $state(false);

	const dag = $derived<TrainingDay | null>(
		programData?.dage.find((d) => d.dagNummer === dagNummer) ?? null
	);
	const exercises = $derived<DayExercise[]>(dag?.exercises ?? []);
	const aktuelOvelse = $derived<DayExercise | null>(exercises[ei] ?? null);
	const aktuelExercise = $derived<Exercise | null>(
		aktuelOvelse ? (exerciseMap.get(aktuelOvelse.exerciseId) ?? null) : null
	);
	const naesteOvelse = $derived<DayExercise | null>(exercises[ei + 1] ?? null);
	const naesteExercise = $derived<Exercise | null>(
		naesteOvelse ? (exerciseMap.get(naesteOvelse.exerciseId) ?? null) : null
	);
	const aktuelVideoUrl = $derived<string | null>(
		aktuelExercise ? (videoUrls.get(aktuelExercise.videoPath) ?? null) : null
	);
	const naesteVideoUrl = $derived<string | null>(
		naesteExercise ? (videoUrls.get(naesteExercise.videoPath) ?? null) : null
	);

	const faseLabel = $derived(
		phase === 'prep'
			? 'Gør dig klar'
			: phase === 'work'
				? 'Arbejd'
				: phase === 'rest'
					? 'Hvil'
					: phase === 'switch'
						? 'Næste øvelse'
						: 'Færdig'
	);
	const faseFarve = $derived(
		phase === 'work' ? '#6f9e7e' : phase === 'rest' ? 'var(--terra)' : '#3a2a20'
	);
	const ringRadius = 52;
	const ringOmkreds = 2 * Math.PI * ringRadius;
	const ringOffset = $derived(
		phaseTotal > 0 ? ringOmkreds * (1 - rem / phaseTotal) : 0
	);

	onMount(async () => {
		const u = user;
		if (!u) {
			fejl = 'Du skal være logget ind.';
			loading = false;
			return;
		}
		if (!Number.isFinite(dagNummer) || dagNummer < 1 || dagNummer > 21) {
			fejl = 'Ugyldigt dag-nummer.';
			loading = false;
			return;
		}

		try {
			const up = await hentUserProduct(u.uid, 'kickstart');
			if (!up) {
				fejl = 'Du har ikke adgang til mikrotræning endnu.';
				loading = false;
				return;
			}
			userProduct = up;

			const programId = up.programValg?.mikrotraening;
			if (!programId) {
				fejl = 'Vælg dit mikrotræningsprogram først.';
				loading = false;
				return;
			}

			const data = await hentProgram(programId);
			if (!data) {
				fejl = 'Programmet kunne ikke findes.';
				loading = false;
				return;
			}
			programData = data;

			const exerciseIds = (data.dage.find((d) => d.dagNummer === dagNummer)?.exercises ?? []).map(
				(e) => e.exerciseId
			);
			if (exerciseIds.length === 0) {
				fejl = 'Der er ikke lagt øvelser ind for denne dag endnu.';
				loading = false;
				return;
			}

			exerciseMap = await hentExercises(exerciseIds);

			const urlPar = await Promise.all(
				Array.from(exerciseMap.values()).map(async (ex) => {
					try {
						const url = await getVideoUrl(ex.videoPath);
						return [ex.videoPath, url] as const;
					} catch {
						return [ex.videoPath, ''] as const;
					}
				})
			);
			videoUrls = new Map(urlPar.filter(([, u]) => u));

			startTimer();
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke starte træningen. Prøv igen.';
		} finally {
			loading = false;
		}
	});

	onDestroy(() => {
		stopTimer();
	});

	function startTimer() {
		stopTimer();
		paused = false;
		timerHandle = setInterval(() => {
			if (paused) return;
			rem -= 1;
			if (rem < 0) advance();
		}, 1000);
	}

	function stopTimer() {
		if (timerHandle !== null) {
			clearInterval(timerHandle);
			timerHandle = null;
		}
	}

	function setPhase(ny: Phase, sek: number) {
		phase = ny;
		rem = sek;
		phaseTotal = sek;
	}

	function advance() {
		const ex = aktuelOvelse;
		if (!ex) return;

		if (phase === 'prep') {
			setPhase('work', ex.workSec);
			return;
		}

		if (phase === 'switch') {
			setPhase('work', ex.workSec);
			return;
		}

		if (phase === 'work') {
			const sidsteSet = si >= ex.sets;
			const sidsteOvelse = ei >= exercises.length - 1;
			if (sidsteSet && sidsteOvelse) {
				phase = 'done';
				stopTimer();
				return;
			}
			if (sidsteSet) {
				ei += 1;
				si = 1;
				setPhase('switch', SWITCH_SEC);
			} else {
				setPhase('rest', ex.restSec);
			}
			return;
		}

		if (phase === 'rest') {
			si += 1;
			setPhase('work', ex.workSec);
			return;
		}
	}

	function togglePause() {
		paused = !paused;
	}

	function stopOgForlad() {
		stopTimer();
		goto(`/app/moduler/traening/mikrotraening/${dagNummer}`);
	}

	function huidigFremgang(): MikrotraeningFremgang {
		return (
			(userProduct?.fremgang?.mikrotraening as MikrotraeningFremgang | undefined) ?? {
				gennemforte: [],
				feedback: {}
			}
		);
	}

	async function gemTraening() {
		const u = user;
		if (!u || gemmer) return;
		gemmer = true;
		gemFejl = null;
		try {
			const opdateret = markerDagSomGennemfort(huidigFremgang(), dagNummer);
			await gemMikrotraeningFremgang(u.uid, 'kickstart', opdateret);
			if (userProduct) {
				userProduct = {
					...userProduct,
					fremgang: { ...userProduct.fremgang, mikrotraening: opdateret }
				};
			}
			viserFeedback = true;
		} catch (e) {
			console.error(e);
			gemFejl = 'Kunne ikke gemme træningen. Prøv igen.';
		} finally {
			gemmer = false;
		}
	}

	async function vaelgFeedback(feedback: Feedback) {
		const u = user;
		if (!u || gemmer) return;
		gemmer = true;
		gemFejl = null;
		try {
			const opdateret = registrerFeedback(huidigFremgang(), dagNummer, feedback);
			await gemMikrotraeningFremgang(u.uid, 'kickstart', opdateret);
			goto(`/app/moduler/traening/mikrotraening/${dagNummer}`);
		} catch (e) {
			console.error(e);
			gemFejl = 'Kunne ikke gemme feedback. Prøv igen.';
			gemmer = false;
		}
	}

	function springFeedbackOver() {
		goto(`/app/moduler/traening/mikrotraening/${dagNummer}`);
	}
</script>

<div class="player">
	{#if loading}
		<div class="status-besked">Henter dagens træning...</div>
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
		<button class="tilbage-knap" type="button" onclick={stopOgForlad}>Tilbage</button>
	{:else if phase === 'done'}
		<div class="finish-card">
			<div class="finish-emoji">🎉</div>
			<h2 class="finish-titel">Træning gennemført!</h2>
			<p class="finish-sub">Lidt er bedre end ingenting — du gjorde det.</p>
			{#if gemFejl}
				<div class="status-besked fejl">{gemFejl}</div>
			{/if}
			<button
				class="ctrl primary fuld"
				type="button"
				onclick={gemTraening}
				disabled={gemmer || viserFeedback}
			>
				{#if gemmer}
					Gemmer...
				{:else}
					Gem træning
					<Icon name="check" size={14} color="#fff" />
				{/if}
			</button>
			<button class="ctrl ghost" type="button" onclick={stopOgForlad}>
				Tilbage uden at gemme
			</button>
		</div>

		{#if viserFeedback}
			<div
				class="modal-bag"
				role="dialog"
				aria-modal="true"
				aria-labelledby="feedback-titel"
			>
				<div class="modal">
					<div class="modal-greb"></div>
					<div class="modal-titel" id="feedback-titel">Hvordan føltes træningen?</div>
					<div class="modal-sub">Valgfrit — din feedback hjælper Linn</div>
					{#if gemFejl}
						<div class="status-besked fejl">{gemFejl}</div>
					{/if}
					<div class="feedback-rad">
						<button
							class="fb-knap"
							type="button"
							onclick={() => vaelgFeedback('let')}
							disabled={gemmer}
						>
							<span class="fb-cirkel">😊</span>
							<span class="fb-label">Let</span>
						</button>
						<button
							class="fb-knap"
							type="button"
							onclick={() => vaelgFeedback('tilpas')}
							disabled={gemmer}
						>
							<span class="fb-cirkel">💪</span>
							<span class="fb-label">Tilpas</span>
						</button>
						<button
							class="fb-knap"
							type="button"
							onclick={() => vaelgFeedback('udfordrende')}
							disabled={gemmer}
						>
							<span class="fb-cirkel">🔥</span>
							<span class="fb-label">Udfordrende</span>
						</button>
					</div>
					<button
						class="modal-spring"
						type="button"
						onclick={springFeedbackOver}
						disabled={gemmer}
					>
						Spring over
					</button>
				</div>
			</div>
		{/if}
	{:else if dag && aktuelOvelse && aktuelExercise}
		<div class="video-omraade" class:hviler={phase === 'rest'}>
			{#if aktuelOvelse.bonus}
				<div class="bonus-ribbon">Bonus</div>
			{/if}

			{#if aktuelVideoUrl}
				<video
					class="hovedvideo"
					src={aktuelVideoUrl}
					autoplay
					loop
					muted
					playsinline
				></video>
			{:else}
				<div class="video-fallback">
					<div class="fb-navn">{aktuelExercise.name}</div>
					<div class="fb-hint">Video kan ikke afspilles</div>
				</div>
			{/if}

			{#if phase === 'switch' && naesteExercise}
				<div class="pip-overlay">
					<div class="pip-card">
						{#if naesteVideoUrl}
							<video
								class="pip-video"
								src={naesteVideoUrl}
								autoplay
								loop
								muted
								playsinline
							></video>
						{/if}
						<div class="pip-label">{naesteExercise.name}</div>
					</div>
				</div>
			{/if}

			<div class="fase-badge">{faseLabel}</div>

			<div class="timer-badge">
				<svg viewBox="0 0 120 120">
					<circle
						cx="60"
						cy="60"
						r={ringRadius}
						fill="none"
						stroke="rgba(255,255,255,.25)"
						stroke-width="7"
					/>
					<circle
						cx="60"
						cy="60"
						r={ringRadius}
						fill="none"
						stroke="#fff"
						stroke-width="7"
						stroke-linecap="round"
						stroke-dasharray={ringOmkreds}
						stroke-dashoffset={ringOffset}
						style="transform: rotate(-90deg); transform-origin: center; transition: stroke-dashoffset 1s linear, stroke .3s; stroke: {faseFarve};"
					/>
				</svg>
				<div class="timer-tal">
					<div class="tt-num">{Math.max(0, rem)}</div>
					<div class="tt-unit">sek</div>
				</div>
			</div>

			{#if paused}
				<div class="pause-overlay">
					<Icon name="pause" size={32} color="#fff" />
					<div class="po-label">Pause</div>
					<div class="po-hint">Tryk Fortsæt for at genoptage</div>
				</div>
			{/if}
		</div>

		<div class="info-omraade">
			<div class="info-navn">{aktuelExercise.name}</div>
			<div class="info-meta">
				Øvelse {ei + 1} / {exercises.length} · Sæt {si} / {aktuelOvelse.sets}
			</div>
			{#if aktuelExercise.desc}
				<div class="info-desc">{aktuelExercise.desc}</div>
			{/if}
		</div>

		<div class="ctrl-rad">
			<button class="ctrl stop" type="button" onclick={stopOgForlad}>Stop</button>
			<button class="ctrl primary" type="button" onclick={togglePause}>
				{paused ? 'Fortsæt' : 'Pause'}
			</button>
		</div>
	{/if}
</div>

<style>
	.player {
		min-height: 100vh;
		max-width: 520px;
		margin: 0 auto;
		padding: 12px 12px 100px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.status-besked {
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text2);
		font-size: 13px;
		text-align: center;
	}

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.tilbage-knap {
		align-self: center;
		padding: 10px 20px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 10px;
		font-size: 13px;
		color: var(--text2);
		cursor: pointer;
	}

	.video-omraade {
		position: relative;
		aspect-ratio: 1;
		border-radius: 18px;
		overflow: hidden;
		background: #2a1f17;
	}

	.video-omraade.hviler::after {
		content: '';
		position: absolute;
		inset: 0;
		background: rgba(184, 123, 110, 0.18);
		pointer-events: none;
	}

	.hovedvideo {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.video-fallback {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		color: rgba(255, 255, 255, 0.85);
	}

	.fb-navn {
		font-family: var(--ff-d);
		font-size: 22px;
	}

	.fb-hint {
		font-size: 12px;
		color: rgba(255, 255, 255, 0.6);
	}

	.bonus-ribbon {
		position: absolute;
		top: 14px;
		left: 14px;
		background: var(--terra);
		color: #fff;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		padding: 6px 12px;
		border-radius: 99px;
		z-index: 4;
	}

	.fase-badge {
		position: absolute;
		top: 14px;
		right: 14px;
		background: rgba(0, 0, 0, 0.5);
		color: #fff;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		padding: 6px 12px;
		border-radius: 99px;
		backdrop-filter: blur(6px);
		z-index: 4;
	}

	.timer-badge {
		position: absolute;
		bottom: 14px;
		right: 14px;
		width: 92px;
		height: 92px;
		z-index: 4;
	}

	.timer-badge svg {
		width: 100%;
		height: 100%;
	}

	.timer-tal {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		color: #fff;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
	}

	.tt-num {
		font-family: var(--ff-d);
		font-size: 28px;
		font-weight: 600;
		line-height: 1;
	}

	.tt-unit {
		font-size: 10px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		opacity: 0.85;
		margin-top: 2px;
	}

	.pip-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(42, 31, 23, 0.55);
		backdrop-filter: blur(6px);
		z-index: 3;
	}

	.pip-card {
		width: 60%;
		max-width: 220px;
		aspect-ratio: 1;
		border-radius: 14px;
		overflow: hidden;
		border: 3px solid #fff;
		box-shadow: 0 8px 22px rgba(0, 0, 0, 0.3);
		position: relative;
		background: #2a1f17;
	}

	.pip-video {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.pip-label {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		padding: 8px 10px;
		background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
		color: #fff;
		font-size: 13px;
		font-weight: 600;
		text-align: center;
	}

	.pause-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		background: rgba(42, 31, 23, 0.7);
		backdrop-filter: blur(4px);
		color: #fff;
		z-index: 5;
	}

	.po-label {
		font-family: var(--ff-d);
		font-size: 24px;
	}

	.po-hint {
		font-size: 12px;
		opacity: 0.75;
	}

	.info-omraade {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 14px 16px;
	}

	.info-navn {
		font-family: var(--ff-d);
		font-size: 22px;
		font-weight: 600;
		color: var(--text);
		line-height: 1.1;
	}

	.info-meta {
		font-size: 11.5px;
		color: var(--text3);
		letter-spacing: 0.04em;
		margin-top: 4px;
	}

	.info-desc {
		font-size: 12.5px;
		color: var(--text2);
		line-height: 1.5;
		margin-top: 8px;
	}

	.ctrl-rad {
		display: grid;
		grid-template-columns: 1fr 1.4fr;
		gap: 10px;
	}

	.ctrl {
		padding: 14px;
		font-size: 14px;
		font-weight: 600;
		border-radius: 12px;
		border: none;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.ctrl.stop {
		background: var(--white);
		border: 1px solid var(--border);
		color: var(--text2);
	}

	.ctrl.primary {
		background: var(--terra);
		color: #fff;
	}

	.ctrl.primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.ctrl.fuld {
		grid-column: 1 / -1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
	}

	.ctrl.ghost {
		background: transparent;
		border: none;
		color: var(--text3);
		font-size: 13px;
		font-weight: 500;
	}

	.finish-card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 18px;
		padding: 32px 24px 24px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		margin-top: 18px;
	}

	.finish-emoji {
		font-size: 56px;
		line-height: 1;
		margin-bottom: 4px;
	}

	.finish-titel {
		font-family: var(--ff-d);
		font-size: 26px;
		font-weight: 600;
		color: var(--text);
		margin: 0;
		text-align: center;
		letter-spacing: -0.01em;
	}

	.finish-sub {
		font-size: 13px;
		color: var(--text2);
		text-align: center;
		margin: 0 0 10px;
		max-width: 320px;
		line-height: 1.5;
	}

	.modal-bag {
		position: fixed;
		inset: 0;
		background: rgba(42, 31, 23, 0.45);
		display: flex;
		align-items: flex-end;
		justify-content: center;
		z-index: 600;
		padding: 0;
	}

	.modal {
		background: var(--white);
		border-radius: 20px 20px 0 0;
		padding: 14px 22px 32px;
		width: 100%;
		max-width: 520px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.15);
	}

	.modal-greb {
		width: 38px;
		height: 4px;
		border-radius: 2px;
		background: var(--border2);
		margin-bottom: 4px;
	}

	.modal-titel {
		font-family: var(--ff-d);
		font-size: 18px;
		font-weight: 600;
		color: var(--text);
	}

	.modal-sub {
		font-size: 12.5px;
		color: var(--text3);
		text-align: center;
	}

	.feedback-rad {
		display: flex;
		gap: 14px;
		margin-top: 10px;
	}

	.fb-knap {
		background: none;
		border: none;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 4px 6px;
	}

	.fb-knap:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.fb-cirkel {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: var(--sdim);
		border: 2px solid var(--sage);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 26px;
	}

	.fb-label {
		font-size: 12px;
		font-weight: 500;
		color: var(--text2);
	}

	.modal-spring {
		background: none;
		border: none;
		font-size: 13px;
		color: var(--text3);
		cursor: pointer;
		padding: 6px 12px;
		margin-top: 6px;
	}
</style>
