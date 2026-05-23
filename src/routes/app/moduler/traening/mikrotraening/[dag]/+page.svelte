<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import type {
		Exercise,
		MikrotraeningFremgang,
		TrainingDay,
		UserProduct
	} from '$lib/content/mikrotraening';
	import { harGennemfortDag } from '$lib/content/mikrotraening';
	import {
		hentExercises,
		hentForlobsProgram,
		hentUserProduct,
		type ProgramMedDage
	} from '$lib/firestore/mikrotraening';
	import { hentAktivProduktType } from '$lib/firestore/forlob';
	import { getVideoUrl } from '$lib/utils/storage';
	import { onDestroy } from 'svelte';
	import type { UserDoc } from '$lib/types';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';

	const getUser = getContext<() => User | null>('user');
	const getUserDoc = getContext<() => UserDoc | null>('userDoc');
	const user = $derived(getUser());
	const userDoc = $derived(getUserDoc());

	const dagNummer = $derived(parseInt(page.params.dag ?? '', 10));

	let userProduct = $state<UserProduct | null>(null);
	let programData = $state<ProgramMedDage | null>(null);

	// Preview-state: når klienten trykker på play-ikonet ud for en øvelse,
	// åbner vi en overlay med video + beskrivelse + how-to-steps.
	let aabenPreview = $state<Exercise | null>(null);
	let previewVideoUrl = $state<string | null>(null);
	let previewLoading = $state(false);

	async function aabnPreview(ex: Exercise) {
		aabenPreview = ex;
		previewVideoUrl = null;
		if (typeof document !== 'undefined') {
			document.body.classList.add('html-fullscreen-aktiv');
		}
		if (!ex.videoPath) return;
		previewLoading = true;
		try {
			previewVideoUrl = await getVideoUrl(ex.videoPath);
		} catch (e) {
			console.warn('Kunne ikke hente video for', ex.id, e);
		} finally {
			previewLoading = false;
		}
	}

	function lukPreview() {
		aabenPreview = null;
		previewVideoUrl = null;
		if (typeof document !== 'undefined') {
			document.body.classList.remove('html-fullscreen-aktiv');
		}
	}

	onDestroy(() => {
		if (typeof document !== 'undefined') {
			document.body.classList.remove('html-fullscreen-aktiv');
		}
	});
	let exerciseMap = $state<Map<string, Exercise>>(new Map());
	let loading = $state(true);
	let fejl = $state<string | null>(null);

	const fremgang = $derived<MikrotraeningFremgang>(
		(userProduct?.fremgang?.mikrotraening as MikrotraeningFremgang | undefined) ?? {
			gennemforte: [],
			feedback: {}
		}
	);
	const dag = $derived<TrainingDay | null>(
		programData?.dage.find((d) => d.dagNummer === dagNummer) ?? null
	);
	const erGennemfort = $derived(harGennemfortDag(fremgang, dagNummer));
	const antalDage = $derived(programData?.program.antalDage ?? 21);
	const harOvelser = $derived((dag?.exercises.length ?? 0) > 0);

	onMount(async () => {
		const u = user;
		if (!u) {
			fejl = 'Du skal være logget ind.';
			loading = false;
			return;
		}

		if (!Number.isFinite(dagNummer) || dagNummer < 1 || dagNummer > 100) {
			fejl = 'Ugyldigt dag-nummer.';
			loading = false;
			return;
		}

		try {
			const produktType = await hentAktivProduktType(userDoc?.forlobIds ?? []);
			const up = await hentUserProduct(u.uid, produktType);
			if (!up) {
				fejl = 'Du har ikke adgang til mikrotræning endnu.';
				loading = false;
				return;
			}
			userProduct = up;

			const programId = up.programValg?.mikrotraening;
			if (!programId) {
				goto('/app/moduler/traening/mikrotraening/onboarding');
				return;
			}

			const forlobId = (up as UserProduct & { forlobId?: string }).forlobId;
			if (!forlobId) {
				fejl = 'Du er ikke tilknyttet et forløb endnu.';
				loading = false;
				return;
			}

			const data = await hentForlobsProgram(forlobId, programId);
			if (!data) {
				fejl = 'Programmet kunne ikke findes.';
				loading = false;
				return;
			}
			programData = data;

			const exerciseIds = (data.dage.find((d) => d.dagNummer === dagNummer)?.exercises ?? []).map(
				(e) => e.exerciseId
			);
			if (exerciseIds.length > 0) {
				exerciseMap = await hentExercises(exerciseIds);
			}
		} catch (e) {
			fejl = 'Kunne ikke hente data. Prøv igen.';
			console.error(e);
		} finally {
			loading = false;
		}
	});
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Forside</span>
		</a>
		<div class="eyebrow">Dag {dagNummer} af {antalDage}</div>
		<h1>Dagens øvelser</h1>
		{#if dag?.indledning}
			<p class="page-sub">{dag.indledning}</p>
		{:else}
			<p class="page-sub">Tryk på en øvelse for at se den. Tryk Start træning for at gå i gang.</p>
		{/if}
	</header>

	{#if loading}
		<Loading tekst="Henter dagens øvelser..." />
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if !dag}
		<div class="status-besked fejl">Dag {dagNummer} kunne ikke findes.</div>
	{:else if !harOvelser}
		<div class="status-besked">
			Der er ikke lagt øvelser ind for denne dag endnu. Kig forbi senere.
		</div>
	{:else}
		<div class="ovelse-liste">
			{#each dag.exercises as ex, i (i)}
				{@const exercise = exerciseMap.get(ex.exerciseId)}
				<article class="ovelse-row" class:bonus={ex.bonus}>
					<div class="ovelse-num">{i + 1}</div>
					<div class="ovelse-tekst">
						<div class="ovelse-navn">
							{exercise?.name ?? ex.exerciseId}
							{#if ex.bonus}
								<span class="bonus-badge">Bonus</span>
							{/if}
						</div>
						<div class="ovelse-meta">
							{ex.sets} sæt · {ex.workSec}s arbejde · {ex.restSec}s hvile
						</div>
						{#if exercise?.catLabel}
							<div class="ovelse-cat">{exercise.catLabel}</div>
						{/if}
					</div>
					{#if exercise}
						<button
							class="preview-knap"
							type="button"
							onclick={() => aabnPreview(exercise)}
							aria-label="Se hvordan {exercise.name} udføres"
							title="Se øvelsen"
						>
							<Icon name="play" size={14} color="#fff" filled />
						</button>
					{/if}
				</article>
			{/each}
		</div>

		{#if erGennemfort}
			<div class="done-banner">
				<Icon name="check" size={14} color="#6f9e7e" />
				<span>Denne dag er allerede gennemført — du er velkommen til at køre den igen.</span>
			</div>
		{/if}

		<a class="start-knap" href="/app/moduler/traening/mikrotraening/{dagNummer}/spil">
			{erGennemfort ? 'Kør træningen igen' : 'Start træning'}
			<Icon name="arrow" size={14} color="#fff" />
		</a>
	{/if}
</div>

{#if aabenPreview}
	<div class="preview-overlay" role="dialog" aria-modal="true">
		<header class="preview-head">
			<button class="preview-luk" type="button" onclick={lukPreview}>
				<Icon name="arrow-l" size={14} color="var(--text)" />
				<span>Tilbage</span>
			</button>
			<div class="preview-titel-top">{aabenPreview.name}</div>
		</header>

		<div class="preview-video">
			{#if previewLoading}
				<Loading tekst="Henter video..." kompakt />
			{:else if previewVideoUrl}
				<video
					src={previewVideoUrl}
					autoplay
					muted
					loop
					playsinline
					preload="auto"
				></video>
			{:else}
				<div class="preview-fallback">
					<div class="preview-fallback-navn">{aabenPreview.name}</div>
					<div class="preview-fallback-hint">Video følger snart</div>
				</div>
			{/if}
		</div>

		<div class="preview-scroll">
			<div class="preview-card">
				<div class="preview-navn">{aabenPreview.name}</div>
				{#if aabenPreview.desc}
					<p class="preview-desc">{aabenPreview.desc}</p>
				{/if}

				{#if aabenPreview.how && aabenPreview.how.length > 0}
					<div class="preview-divider"></div>
					<div class="preview-how-label">Sådan udfører du øvelsen</div>
					<ol class="preview-how-liste">
						{#each aabenPreview.how as trin (trin)}
							<li>{trin}</li>
						{/each}
					</ol>
				{/if}

				{#if aabenPreview.tags && aabenPreview.tags.length > 0}
					<div class="preview-divider"></div>
					<div class="preview-tags">
						{#each aabenPreview.tags as tag (tag)}
							<span class="preview-tag">{tag}</span>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 520px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 18px;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
		text-decoration: none;
		margin-bottom: 12px;
	}

	.back:hover {
		color: var(--text);
	}

	.eyebrow {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text3);
	}

	h1 {
		font-family: var(--ff-d);
		font-size: calc(28px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 4px 0 0;
		line-height: 1.05;
		color: var(--text);
	}

	.page-sub {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		margin: 6px 0 0;
		line-height: 1.4;
	}

	.status-besked {
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
		text-align: center;
	}

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.ovelse-liste {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 14px;
	}

	.ovelse-row {
		display: flex;
		align-items: center;
		gap: 12px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 12px 14px;
	}

	.ovelse-row.bonus {
		border-color: #e5d6c8;
		background: #fdf8f2;
	}

	.ovelse-num {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: var(--bg2);
		color: var(--text2);
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 600;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.ovelse-tekst {
		flex: 1;
		min-width: 0;
	}

	.ovelse-navn {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.bonus-badge {
		font-size: calc(9px * var(--fs-scale, 1));
		letter-spacing: 0.1em;
		text-transform: uppercase;
		background: var(--terra2);
		color: #fff;
		padding: 2px 7px;
		border-radius: 99px;
	}

	.ovelse-meta {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.ovelse-cat {
		font-size: calc(10.5px * var(--fs-scale, 1));
		color: var(--text4);
		margin-top: 2px;
		letter-spacing: 0.04em;
	}

	.done-banner {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 14px;
		background: #eef5ef;
		border: 1px solid #d6e6da;
		border-radius: 12px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: #4a6b54;
		margin-bottom: 14px;
	}

	.start-knap {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 14px;
		background: var(--terra);
		color: #fff;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 12px;
		border: none;
		text-decoration: none;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.start-knap:hover {
		filter: brightness(0.95);
	}

	.preview-knap {
		flex-shrink: 0;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: none;
		background: var(--terra);
		color: #fff;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--ff-b);
		padding: 0;
	}

	.preview-knap:hover {
		filter: brightness(1.05);
	}

	.preview-knap:active {
		transform: scale(0.95);
	}

	.preview-overlay {
		position: fixed;
		inset: 0;
		z-index: 100;
		background: var(--bg);
		display: flex;
		flex-direction: column;
		padding-top: env(safe-area-inset-top);
		padding-bottom: env(safe-area-inset-bottom);
	}

	.preview-head {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 14px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
		background: var(--white);
	}

	.preview-luk {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		border-radius: 8px;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text);
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 500;
		cursor: pointer;
		font-family: var(--ff-b);
		flex-shrink: 0;
	}

	.preview-titel-top {
		flex: 1;
		font-family: var(--ff-d);
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.preview-video {
		flex-shrink: 0;
		width: 100%;
		aspect-ratio: 16 / 9;
		background: #000;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.preview-video video {
		width: 100%;
		height: 100%;
		object-fit: contain;
		background: #000;
	}

	.preview-scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 14px;
		-webkit-overflow-scrolling: touch;
	}

	.preview-fallback {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		text-align: center;
		padding: 20px;
	}

	.preview-fallback-navn {
		font-family: var(--ff-d);
		font-size: calc(22px * var(--fs-scale, 1));
		font-style: italic;
		color: var(--text3);
	}

	.preview-fallback-hint {
		font-size: calc(10px * var(--fs-scale, 1));
		color: var(--text4);
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.preview-card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 18px;
		display: flex;
		flex-direction: column;
		gap: 11px;
	}

	.preview-navn {
		font-family: var(--ff-d);
		font-size: calc(22px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		line-height: 1.2;
	}

	.preview-desc {
		font-size: calc(14px * var(--fs-scale, 1));
		line-height: 1.6;
		color: var(--text2);
		margin: 0;
	}

	.preview-divider {
		height: 1px;
		background: var(--border);
		margin: 4px 0;
	}

	.preview-how-label {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 500;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--terra);
	}

	.preview-how-liste {
		margin: 0;
		padding-left: 20px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		font-size: calc(14px * var(--fs-scale, 1));
		line-height: 1.6;
		color: var(--text);
	}

	.preview-how-liste li {
		padding-left: 4px;
	}

	.preview-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 7px;
	}

	.preview-tag {
		font-size: calc(11px * var(--fs-scale, 1));
		padding: 4px 10px;
		border-radius: 999px;
		background: var(--tdim);
		color: var(--terra);
	}
</style>
