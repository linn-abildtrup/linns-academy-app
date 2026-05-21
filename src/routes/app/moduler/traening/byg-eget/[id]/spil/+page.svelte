<script lang="ts">
	import { getContext, onMount, onDestroy } from 'svelte';
	import type { User } from 'firebase/auth';
	import { page } from '$app/state';
	import Icon from '$lib/components/Icon.svelte';
	import type { Exercise } from '$lib/content/mikrotraening';
	import { hentExercises } from '$lib/firestore/mikrotraening';
	import { hentMitProgram } from '$lib/firestore/mineProgrammer';
	import type { CustomProgram } from '$lib/content/mineProgrammer';
	import { getVideoUrl } from '$lib/utils/storage';

	type Fase = 'arbejde' | 'pause' | 'gennemfort';

	const getUser = getContext<() => User | null>('user');
	const user = $derived(getUser());

	const programId = $derived(page.params.id ?? '');

	let program = $state<CustomProgram | null>(null);
	let exerciseMap = $state<Map<string, Exercise>>(new Map());
	let videoUrls = $state<Map<string, string>>(new Map());
	let indlaeser = $state(true);
	let fejl = $state<string | null>(null);

	// Workout state
	let oevelseIndeks = $state(0); // hvilken øvelse vi er på
	let saetNr = $state(1); // hvilket sæt vi er på (1-indekseret)
	let fase = $state<Fase>('arbejde');
	let pauseRem = $state(0); // sekunder tilbage af pause
	let pauseTotal = $state(0);
	let timerId: ReturnType<typeof setInterval> | null = null;

	const aktuelOevelse = $derived(program?.oevelser[oevelseIndeks] ?? null);
	const aktuelExercise = $derived(
		aktuelOevelse ? (exerciseMap.get(aktuelOevelse.exerciseId) ?? null) : null
	);
	const aktuelVideoUrl = $derived(
		aktuelExercise?.videoPath ? (videoUrls.get(aktuelExercise.videoPath) ?? null) : null
	);
	const totalOevelser = $derived(program?.oevelser.length ?? 0);
	const erSidsteSaet = $derived(
		aktuelOevelse ? saetNr >= aktuelOevelse.saet : false
	);
	const erSidsteOevelse = $derived(oevelseIndeks >= totalOevelser - 1);

	onMount(async () => {
		if (!user) {
			fejl = 'Du skal være logget ind.';
			indlaeser = false;
			return;
		}
		try {
			const p = await hentMitProgram(user.uid, programId);
			if (!p) {
				fejl = 'Programmet findes ikke.';
				indlaeser = false;
				return;
			}
			if (p.oevelser.length === 0) {
				fejl = 'Programmet har ingen øvelser.';
				indlaeser = false;
				return;
			}
			program = p;
			const exerciseIds = Array.from(new Set(p.oevelser.map((o) => o.exerciseId)));
			exerciseMap = await hentExercises(exerciseIds);

			const urls = new Map<string, string>();
			await Promise.all(
				Array.from(exerciseMap.values()).map(async (ex) => {
					if (!ex.videoPath) return;
					try {
						urls.set(ex.videoPath, await getVideoUrl(ex.videoPath));
					} catch (e) {
						console.warn('Kunne ikke hente video for', ex.id, e);
					}
				})
			);
			videoUrls = urls;
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente programmet.';
		} finally {
			indlaeser = false;
		}
	});

	onDestroy(() => {
		stopTimer();
	});

	function stopTimer() {
		if (timerId !== null) {
			clearInterval(timerId);
			timerId = null;
		}
	}

	function startPauseTimer(sekunder: number) {
		stopTimer();
		pauseTotal = sekunder;
		pauseRem = sekunder;
		if (sekunder <= 0) {
			naesteSaet();
			return;
		}
		timerId = setInterval(() => {
			pauseRem -= 1;
			if (pauseRem <= 0) {
				stopTimer();
				naesteSaet();
			}
		}, 1000);
	}

	function saetFaerdig() {
		if (!aktuelOevelse) return;
		if (erSidsteSaet) {
			// Sidste sæt af denne øvelse — gå til næste øvelse eller gennemført
			if (erSidsteOevelse) {
				fase = 'gennemfort';
			} else {
				gaaTilNaesteOevelse();
			}
		} else {
			// Start pause før næste sæt
			fase = 'pause';
			startPauseTimer(aktuelOevelse.pauseSec);
		}
	}

	function naesteSaet() {
		saetNr += 1;
		fase = 'arbejde';
	}

	function gaaTilNaesteOevelse() {
		stopTimer();
		oevelseIndeks += 1;
		saetNr = 1;
		fase = 'arbejde';
	}

	function springPauseOver() {
		stopTimer();
		naesteSaet();
	}

	function springOevelseOver() {
		if (erSidsteOevelse) {
			fase = 'gennemfort';
			return;
		}
		gaaTilNaesteOevelse();
	}

	function formaterTid(sec: number): string {
		const m = Math.floor(sec / 60);
		const s = sec % 60;
		if (m === 0) return `${s}s`;
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	function oevelseNavn(o: { exerciseId: string }): string {
		return exerciseMap.get(o.exerciseId)?.name ?? o.exerciseId;
	}

	const naesteOevelse = $derived(program?.oevelser[oevelseIndeks + 1] ?? null);
</script>

<div class="page">
	{#if fejl}
		<header class="page-header">
			<a class="back" href={`/app/moduler/traening/byg-eget/${programId}/lav`}>
				<Icon name="arrow-l" size={14} color="var(--text2)" />
				<span>Tilbage</span>
			</a>
		</header>
		<div class="besked fejl">{fejl}</div>
	{:else if indlaeser}
		<header class="page-header">
			<a class="back" href={`/app/moduler/traening/byg-eget/${programId}/lav`}>
				<Icon name="arrow-l" size={14} color="var(--text2)" />
				<span>Tilbage</span>
			</a>
		</header>
		<div class="besked">Henter programmet…</div>
	{:else if fase === 'gennemfort'}
		<div class="gennemfort">
			<div class="gennemfort-emoji">🎉</div>
			<h1>Træning gennemført</h1>
			<p>Godt arbejde med {program?.navn}!</p>
			<a class="primary-link" href="/app/moduler/traening">Tilbage til træning</a>
		</div>
	{:else if aktuelOevelse && aktuelExercise && program}
		<header class="page-header kompakt">
			<a class="back" href={`/app/moduler/traening/byg-eget/${programId}/lav`}>
				<Icon name="arrow-l" size={14} color="var(--text2)" />
				<span>Afslut</span>
			</a>
			<div class="fremgang">
				Øvelse {oevelseIndeks + 1} af {totalOevelser}
			</div>
		</header>

		{#if fase === 'arbejde'}
			<div class="oevelse-omslag">
				{#if aktuelVideoUrl}
					<video
						class="hovedvideo"
						src={aktuelVideoUrl}
						autoplay
						muted
						loop
						playsinline
						preload="auto"
					></video>
				{:else}
					<div class="hovedvideo-tom">
						<Icon name="flame" size={40} color="var(--text3)" />
					</div>
				{/if}

				<div class="oevelse-info">
					<h1>{aktuelExercise.name}</h1>
					<div class="saet-info">
						<div class="saet-tal">
							<span class="stor">{saetNr}</span>
							<span class="sub">af {aktuelOevelse.saet} sæt</span>
						</div>
						<div class="saet-skille"></div>
						<div class="saet-tal">
							<span class="stor">{aktuelOevelse.reps}</span>
							<span class="sub">reps</span>
						</div>
					</div>

					{#if aktuelExercise.how && aktuelExercise.how.length > 0}
						<details class="how">
							<summary>Sådan gør du</summary>
							<ol>
								{#each aktuelExercise.how as h, i (i)}
									<li>{h}</li>
								{/each}
							</ol>
						</details>
					{/if}

					<button type="button" class="primary-knap" onclick={saetFaerdig}>
						{erSidsteSaet && erSidsteOevelse
							? 'Færdig med træningen'
							: erSidsteSaet
								? 'Næste øvelse'
								: 'Sæt færdig'}
					</button>

					{#if !erSidsteOevelse}
						<button type="button" class="sekundaer-knap" onclick={springOevelseOver}>
							Spring øvelsen over
						</button>
					{/if}
				</div>
			</div>
		{:else if fase === 'pause'}
			<div class="pause-omslag">
				<div class="pause-eyebrow">Pause</div>
				<div class="pause-tid">{formaterTid(pauseRem)}</div>
				<div class="pause-progress">
					<div
						class="pause-progress-fyld"
						style="width: {pauseTotal > 0 ? ((pauseTotal - pauseRem) / pauseTotal) * 100 : 0}%"
					></div>
				</div>
				<div class="naeste-info">
					Næste: {oevelseNavn(aktuelOevelse)} — Sæt {saetNr + 1} af {aktuelOevelse.saet}
				</div>
				<button type="button" class="primary-knap" onclick={springPauseOver}>
					Spring pause over
				</button>
			</div>
		{/if}
	{/if}
</div>

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 520px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 14px;
	}

	.page-header.kompakt {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
		text-decoration: none;
	}

	.fremgang {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.besked {
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
		text-align: center;
	}

	.besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.oevelse-omslag {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 16px;
		overflow: hidden;
	}

	.hovedvideo {
		display: block;
		width: 100%;
		aspect-ratio: 1 / 1;
		object-fit: cover;
		background: #000;
	}

	.hovedvideo-tom {
		width: 100%;
		aspect-ratio: 1 / 1;
		background: var(--bg2);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.oevelse-info {
		padding: 18px;
	}

	.oevelse-info h1 {
		font-family: var(--ff-d);
		font-size: calc(24px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 0;
		line-height: 1.15;
		color: var(--text);
	}

	.saet-info {
		display: flex;
		align-items: center;
		gap: 16px;
		margin: 16px 0;
		padding: 16px;
		background: var(--bg2);
		border-radius: 12px;
	}

	.saet-tal {
		flex: 1;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.saet-tal .stor {
		font-family: var(--ff-d);
		font-size: calc(36px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		line-height: 1;
	}

	.saet-tal .sub {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 4px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		font-weight: 600;
	}

	.saet-skille {
		width: 1px;
		height: 40px;
		background: var(--border);
	}

	.how {
		margin: 12px 0;
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
	}

	.how summary {
		cursor: pointer;
		font-weight: 600;
		color: var(--terra);
		padding: 4px 0;
	}

	.how ol {
		margin: 8px 0 0;
		padding-left: 20px;
		line-height: 1.5;
	}

	.how li {
		margin-bottom: 4px;
	}

	.primary-knap {
		display: block;
		width: 100%;
		padding: 14px 18px;
		background: var(--terra);
		color: #fff;
		border: none;
		border-radius: 12px;
		font-size: calc(15px * var(--fs-scale, 1));
		font-weight: 600;
		cursor: pointer;
		font-family: var(--ff-b);
		margin-top: 12px;
	}

	.primary-knap:hover {
		opacity: 0.93;
	}

	.sekundaer-knap {
		display: block;
		width: 100%;
		padding: 12px;
		background: transparent;
		color: var(--text2);
		border: 1px solid var(--border);
		border-radius: 10px;
		font-size: calc(13px * var(--fs-scale, 1));
		cursor: pointer;
		font-family: var(--ff-b);
		margin-top: 8px;
	}

	.sekundaer-knap:hover {
		background: var(--bg2);
	}

	.pause-omslag {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 16px;
		padding: 32px 22px;
		text-align: center;
	}

	.pause-eyebrow {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.pause-tid {
		font-family: var(--ff-d);
		font-size: calc(64px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--terra);
		line-height: 1;
		margin: 14px 0 22px;
		letter-spacing: -0.02em;
	}

	.pause-progress {
		height: 6px;
		background: var(--bg2);
		border-radius: 99px;
		overflow: hidden;
		margin-bottom: 20px;
	}

	.pause-progress-fyld {
		height: 100%;
		background: var(--terra);
		border-radius: 99px;
		transition: width 0.95s linear;
	}

	.naeste-info {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		margin-bottom: 16px;
		line-height: 1.4;
	}

	.gennemfort {
		text-align: center;
		padding: 60px 20px;
	}

	.gennemfort-emoji {
		font-size: calc(56px * var(--fs-scale, 1));
		margin-bottom: 14px;
	}

	.gennemfort h1 {
		font-family: var(--ff-d);
		font-size: calc(28px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		margin: 0 0 8px;
	}

	.gennemfort p {
		font-size: calc(14px * var(--fs-scale, 1));
		color: var(--text2);
		margin: 0 0 24px;
	}

	.primary-link {
		display: inline-block;
		padding: 12px 22px;
		background: var(--terra);
		color: #fff;
		border-radius: 10px;
		text-decoration: none;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		font-family: var(--ff-b);
	}

	.primary-link:hover {
		opacity: 0.93;
	}
</style>
