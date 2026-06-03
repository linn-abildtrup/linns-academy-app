<script lang="ts">
	import { getContext, onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import type { Exercise } from '$lib/content/mikrotraening';
	import { hentExercises } from '$lib/firestore/mikrotraening';
	import {
		gemSpilPause,
		hentMitProgram,
		hentSpilPause,
		sletSpilPause,
		tilfoejGennemfoersel
	} from '$lib/firestore/mineProgrammer';
	import type {
		CustomProgram,
		CustomProgramOevelse
	} from '$lib/content/mineProgrammer';
	import { logTraening } from '$lib/firestore/traeningHistorik';
	import { formaterHistorikDato } from '$lib/content/traeningHistorik';
	import { getAudioUrl, getVideoUrl } from '$lib/utils/storage';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';

	const PREP_SEC = 10;
	const SWITCH_SEC = 15;

	type Phase = 'prep' | 'work' | 'rest' | 'switch' | 'done';

	const getUser = getContext<() => User | null>('user');
	const user = $derived(getUser());

	const programId = $derived(page.params.id ?? '');
	// For 14-dages programmer: hvilken dag spilles? Læses fra ?dag=N. Hvis
	// ikke sat eller programmet er simpelt (uden dage), bruges hele program.oevelser.
	const dagNummer = $derived.by(() => {
		const v = page.url.searchParams.get('dag');
		if (!v) return null;
		const n = parseInt(v, 10);
		return Number.isFinite(n) && n >= 1 ? n : null;
	});

	let program = $state<CustomProgram | null>(null);
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

	let musikEl = $state<HTMLAudioElement | null>(null);
	let musikUrl = $state<string | null>(null);
	let lydSlaaetTil = $state(true);

	let nedtaellingGoEl = $state<HTMLAudioElement | null>(null);
	let nedtaellingPauseEl = $state<HTMLAudioElement | null>(null);
	let nedtaellingGoUrl = $state<string | null>(null);
	let nedtaellingPauseUrl = $state<string | null>(null);
	let sidsteCountdownNoegle = $state<string | null>(null);
	let unduckTimer: ReturnType<typeof setTimeout> | null = null;

	let wakeSlaaetTil = $state(true);
	let wakeLockSentinel = $state<WakeLockSentinel | null>(null);

	let fuldskaerm = $state(false);
	let hovedvideoEl = $state<HTMLVideoElement | null>(null);

	let resumet = $state(false);
	let traeningGennemfoert = $state(false);

	// Hvis program har dage og en specifik dag er valgt, brug dens øvelser.
	// Ellers fald tilbage til program.oevelser (simpel-mode bagudkompatibilitet).
	const oevelser = $derived.by<CustomProgramOevelse[]>(() => {
		if (!program) return [];
		if (program.dage && dagNummer) {
			const dag = program.dage.find((d) => d.dagNummer === dagNummer);
			if (dag) return dag.oevelser;
		}
		return program.oevelser ?? [];
	});
	const aktuelOvelse = $derived<CustomProgramOevelse | null>(oevelser[ei] ?? null);
	const aktuelExercise = $derived<Exercise | null>(
		aktuelOvelse ? (exerciseMap.get(aktuelOvelse.exerciseId) ?? null) : null
	);
	const naesteOvelse = $derived<CustomProgramOevelse | null>(oevelser[ei + 1] ?? null);
	const naesteExercise = $derived<Exercise | null>(
		naesteOvelse ? (exerciseMap.get(naesteOvelse.exerciseId) ?? null) : null
	);
	const aktuelVideoUrl = $derived<string | null>(
		aktuelExercise ? (videoUrls.get(aktuelExercise.videoPath) ?? null) : null
	);
	const naesteVideoUrl = $derived<string | null>(
		naesteExercise ? (videoUrls.get(naesteExercise.videoPath) ?? null) : null
	);

	// I switch-fasen viser vi den NÆSTE øvelses video direkte i hovedvideoen.
	const vistVideoUrl = $derived<string | null>(
		phase === 'switch' && naesteVideoUrl ? naesteVideoUrl : aktuelVideoUrl
	);
	const vistExercise = $derived<Exercise | null>(
		phase === 'switch' && naesteExercise ? naesteExercise : aktuelExercise
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

		try {
			const p = await hentMitProgram(u.uid, programId);
			if (!p) {
				fejl = 'Programmet findes ikke.';
				loading = false;
				return;
			}
			// For 14-dages programmer ligger øvelserne i dage[N-1].oevelser,
			// ikke i p.oevelser (som er tom for fler-dages). Find dem ud fra
			// ?dag=N eller den valgte dag.
			let aktuelleOevelser = p.oevelser;
			if (p.dage && p.dage.length > 0) {
				const valgtDag = dagNummer ?? 1;
				const dag = p.dage.find((d) => d.dagNummer === valgtDag);
				aktuelleOevelser = dag?.oevelser ?? [];
			}
			if (aktuelleOevelser.length === 0) {
				fejl = 'Programmet har ingen øvelser.';
				loading = false;
				return;
			}
			program = p;

			const exerciseIds = Array.from(new Set(aktuelleOevelser.map((o) => o.exerciseId)));
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

			const [musik, goLyd, pauseLyd] = await Promise.all([
				getAudioUrl('baggrundsmusik.mp3').catch(() => null),
				getAudioUrl('nedtaelling-go.mp3').catch(() => null),
				getAudioUrl('nedtaelling-pause.mp3').catch(() => null)
			]);
			musikUrl = musik;
			nedtaellingGoUrl = goLyd;
			nedtaellingPauseUrl = pauseLyd;

			// Forsøg at genoptage hvor brugeren slap
			try {
				const gemt = await hentSpilPause(u.uid, 'eget', programId);
				if (gemt && erGyldigPause(gemt, p.oevelser)) {
					ei = gemt.ei;
					si = gemt.si;
					phase = gemt.phase;
					rem = gemt.rem;
					phaseTotal = phaseTotalForResume(gemt, p.oevelser);
					resumet = true;
				}
			} catch (e) {
				console.warn('Kunne ikke hente gemt pause:', e);
			}

			document.addEventListener('visibilitychange', onVisibilityChange);
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
		if (unduckTimer !== null) {
			clearTimeout(unduckTimer);
			unduckTimer = null;
		}
		for (const el of [musikEl, nedtaellingGoEl, nedtaellingPauseEl]) {
			if (!el) continue;
			try {
				el.pause();
			} catch {
				// ignorer
			}
		}
		if (typeof document !== 'undefined') {
			document.removeEventListener('visibilitychange', onVisibilityChange);
			document.body.classList.remove('html-fullscreen-aktiv');
		}
		releaseWakeLock();
		if (playRetryTimer) {
			clearTimeout(playRetryTimer);
			playRetryTimer = null;
		}
	});

	function toggleFuldskaerm() {
		fuldskaerm = !fuldskaerm;
	}

	$effect(() => {
		if (typeof document === 'undefined') return;
		if (fuldskaerm) {
			document.body.classList.add('html-fullscreen-aktiv');
		} else {
			document.body.classList.remove('html-fullscreen-aktiv');
		}
	});

	let playRetryTimer: ReturnType<typeof setTimeout> | null = null;

	function tryPlayVideo(v: HTMLVideoElement, attempt: number = 0) {
		if (playRetryTimer) {
			clearTimeout(playRetryTimer);
			playRetryTimer = null;
		}
		if (paused || phase === 'done') return;
		if (!v || !v.getAttribute('src')) return;
		const p = v.play();
		if (p && p.catch) {
			p.catch(() => {
				if (attempt < 10) {
					playRetryTimer = setTimeout(() => tryPlayVideo(v, attempt + 1), 200);
				}
			});
		}
	}

	$effect(() => {
		if (!vistVideoUrl || !hovedvideoEl) return;
		tryPlayVideo(hovedvideoEl);
	});

	$effect(() => {
		if (!hovedvideoEl) return;
		const v = hovedvideoEl;
		const onPause = () => {
			if (paused || phase === 'done') return;
			if (typeof document !== 'undefined' && document.hidden) return;
			tryPlayVideo(v);
		};
		v.addEventListener('pause', onPause);
		return () => v.removeEventListener('pause', onPause);
	});

	$effect(() => {
		if (!paused) return;
		for (const el of [nedtaellingGoEl, nedtaellingPauseEl]) {
			if (!el || el.paused) continue;
			try {
				el.pause();
			} catch {
				// ignorer
			}
		}
	});

	$effect(() => {
		const skalHaveWake = wakeSlaaetTil && !loading && !fejl && phase !== 'done';
		if (skalHaveWake && !wakeLockSentinel) {
			requestWakeLock();
		} else if (!skalHaveWake && wakeLockSentinel) {
			releaseWakeLock();
		}
	});

	$effect(() => {
		const el = musikEl;
		if (!el || !musikUrl) return;
		const skalSpille = lydSlaaetTil && !paused && phase !== 'done' && !loading && !fejl;
		if (skalSpille && el.paused) {
			const p = el.play();
			if (p && p.catch) {
				p.catch((e) => console.warn('Kunne ikke afspille baggrundsmusik:', e));
			}
		} else if (!skalSpille && !el.paused) {
			el.pause();
		}
	});

	function startTimer() {
		stopTimer();
		paused = false;
		timerHandle = setInterval(() => {
			if (paused) return;
			rem -= 1;
			afspilNedtaellingHvisRelevant();
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

	function afspilNedtaellingHvisRelevant() {
		if (!lydSlaaetTil) return;
		if (rem !== 3) return;
		const o = aktuelOvelse;
		if (!o) return;

		let voiceKey: 'go' | 'pause' | null = null;
		if (phase === 'prep' || phase === 'rest' || phase === 'switch') {
			voiceKey = 'go';
		} else if (phase === 'work') {
			const sidsteSet = si >= o.saet;
			const sidsteOvelse = ei >= oevelser.length - 1;
			if (sidsteSet && sidsteOvelse) return;
			voiceKey = 'pause';
		}
		if (!voiceKey) return;

		const noegle = `${phase}-${ei}-${si}`;
		if (sidsteCountdownNoegle === noegle) return;
		sidsteCountdownNoegle = noegle;

		const el = voiceKey === 'go' ? nedtaellingGoEl : nedtaellingPauseEl;
		if (!el) return;

		try {
			el.currentTime = 0;
			duckMusik();
			const p = el.play();
			if (p && p.catch) {
				p.catch((e) => {
					console.warn('Kunne ikke afspille nedtælling:', e);
					unduckMusik();
				});
			}
		} catch (e) {
			console.warn('Nedtælling-afspilning fejlede:', e);
			unduckMusik();
		}
	}

	function duckMusik() {
		if (musikEl) musikEl.volume = 0;
		if (unduckTimer !== null) clearTimeout(unduckTimer);
		unduckTimer = setTimeout(unduckMusik, 5000);
	}

	function unduckMusik() {
		if (musikEl) musikEl.volume = 1;
		if (unduckTimer !== null) {
			clearTimeout(unduckTimer);
			unduckTimer = null;
		}
	}

	async function requestWakeLock() {
		if (!('wakeLock' in navigator)) return;
		if (wakeLockSentinel) return;
		try {
			const sentinel = await navigator.wakeLock.request('screen');
			sentinel.addEventListener('release', () => {
				if (wakeLockSentinel === sentinel) wakeLockSentinel = null;
			});
			wakeLockSentinel = sentinel;
		} catch (e) {
			console.warn('Kunne ikke aktivere wake lock:', e);
			wakeLockSentinel = null;
		}
	}

	async function releaseWakeLock() {
		const sentinel = wakeLockSentinel;
		if (!sentinel) return;
		wakeLockSentinel = null;
		try {
			await sentinel.release();
		} catch {
			// ignorer
		}
	}

	function toggleWake() {
		wakeSlaaetTil = !wakeSlaaetTil;
	}

	function onVisibilityChange() {
		if (
			document.visibilityState === 'visible' &&
			wakeSlaaetTil &&
			!wakeLockSentinel &&
			phase !== 'done' &&
			!loading &&
			!fejl
		) {
			requestWakeLock();
		}
	}

	function advance() {
		const o = aktuelOvelse;
		if (!o) return;

		if (phase === 'prep') {
			setPhase('work', o.arbejdsSec);
			return;
		}

		if (phase === 'switch') {
			const ny = oevelser[ei + 1];
			if (!ny) {
				phase = 'done';
				stopTimer();
				return;
			}
			ei += 1;
			si = 1;
			setPhase('work', ny.arbejdsSec);
			return;
		}

		if (phase === 'work') {
			const sidsteSet = si >= o.saet;
			const sidsteOvelse = ei >= oevelser.length - 1;
			if (sidsteSet && sidsteOvelse) {
				phase = 'done';
				stopTimer();
				return;
			}
			if (sidsteSet) {
				setPhase('switch', SWITCH_SEC);
			} else {
				setPhase('rest', o.pauseSec);
			}
			return;
		}

		if (phase === 'rest') {
			si += 1;
			setPhase('work', o.arbejdsSec);
			return;
		}
	}

	function erGyldigPause(
		gemt: { ei: number; si: number; phase: string; rem: number },
		oev: CustomProgramOevelse[]
	): boolean {
		if (gemt.ei < 0 || gemt.ei >= oev.length) return false;
		if (gemt.si < 1) return false;
		if (gemt.rem < 0) return false;
		return ['prep', 'work', 'rest', 'switch'].includes(gemt.phase);
	}

	function phaseTotalForResume(
		gemt: { phase: string; ei: number },
		oev: CustomProgramOevelse[]
	): number {
		const o = oev[gemt.ei];
		if (gemt.phase === 'prep') return PREP_SEC;
		if (gemt.phase === 'switch') return SWITCH_SEC;
		if (gemt.phase === 'work') return o?.arbejdsSec ?? 30;
		if (gemt.phase === 'rest') return o?.pauseSec ?? 15;
		return PREP_SEC;
	}

	function gemAktivPause() {
		const u = user;
		if (!u) return;
		if (phase === 'done' || traeningGennemfoert) return;
		if (loading || fejl) return;
		void gemSpilPause(u.uid, {
			kilde: 'eget',
			programId,
			ei,
			si,
			phase: phase as 'prep' | 'work' | 'rest' | 'switch',
			rem: Math.max(0, rem),
			savedAt: Date.now()
		}).catch((e) => console.warn('Kunne ikke gemme pause:', e));
	}

	function startForfra() {
		const u = user;
		if (u) {
			void sletSpilPause(u.uid, 'eget', programId).catch((e) =>
				console.warn('Kunne ikke slette pause:', e)
			);
		}
		ei = 0;
		si = 1;
		phase = 'prep';
		rem = PREP_SEC;
		phaseTotal = PREP_SEC;
		paused = false;
		resumet = false;
		sidsteCountdownNoegle = null;
	}

	// Gem pause-state ved phase-skift
	$effect(() => {
		void phase;
		void ei;
		void si;
		gemAktivPause();
	});

	// Når træningen er done: slet pause, tilføj gennemførsel, log historik
	$effect(() => {
		if (phase !== 'done' || traeningGennemfoert) return;
		const u = user;
		if (!u) return;
		traeningGennemfoert = true;
		void sletSpilPause(u.uid, 'eget', programId).catch(() => undefined);
		void tilfoejGennemfoersel(u.uid, 'eget', programId, undefined, dagNummer ?? undefined).catch(
			(e) => console.warn('Kunne ikke gemme gennemførsel:', e)
		);
		void logTraening(u.uid, {
			dato: formaterHistorikDato(new Date()),
			kilde: 'eget',
			programId,
			programNavn: program?.navn ?? 'Eget program',
			gennemfoertAt: Date.now()
		}).catch((e) => console.warn('Kunne ikke logge træning-historik:', e));
	});

	function togglePause() {
		paused = !paused;
	}

	function toggleLyd() {
		lydSlaaetTil = !lydSlaaetTil;
	}

	function stopOgForlad() {
		stopTimer();
		goto(`/app/moduler/traening/byg-eget/${programId}/lav`);
	}
</script>

<div class="player">
	{#if musikUrl}
		<audio bind:this={musikEl} src={musikUrl} loop preload="auto"></audio>
	{/if}
	{#if nedtaellingGoUrl}
		<audio bind:this={nedtaellingGoEl} src={nedtaellingGoUrl} preload="auto"></audio>
	{/if}
	{#if nedtaellingPauseUrl}
		<audio bind:this={nedtaellingPauseEl} src={nedtaellingPauseUrl} preload="auto"></audio>
	{/if}

	{#if loading}
		<Loading tekst="Henter dit program..." />
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
		<button class="tilbage-knap" type="button" onclick={stopOgForlad}>Tilbage</button>
	{:else if phase === 'done'}
		<div class="finish-card">
			<div class="finish-emoji">🎉</div>
			<h2 class="finish-titel">Træning gennemført!</h2>
			<p class="finish-sub">Godt arbejde med {program?.navn}.</p>
			<button class="ctrl primary fuld" type="button" onclick={stopOgForlad}>
				Tilbage til oversigten
				<Icon name="check" size={14} color="#fff" />
			</button>
		</div>
	{:else if aktuelOvelse && aktuelExercise && program}
		{#if resumet && !fuldskaerm}
			<div class="resume-banner">
				<span>Du fortsætter hvor du slap.</span>
				<button class="resume-link" type="button" onclick={startForfra}>Start forfra</button>
			</div>
		{/if}
		<div
			class="video-omraade"
			class:hviler={phase === 'rest'}
			class:fuldskaerm
			class:switch={phase === 'switch'}
		>
			{#if vistVideoUrl}
				{#key vistVideoUrl}
					<video
						class="hovedvideo"
						bind:this={hovedvideoEl}
						src={vistVideoUrl}
						autoplay
						loop
						muted
						playsinline
					></video>
				{/key}
			{:else if vistExercise}
				<div class="video-fallback">
					<div class="fb-navn">{vistExercise.name}</div>
					<div class="fb-hint">Video kan ikke afspilles</div>
				</div>
			{/if}

			{#if phase === 'switch' && vistExercise}
				<div class="naeste-overlay">
					<div class="naeste-eyebrow">Næste øvelse</div>
					<div class="naeste-navn">{vistExercise.name}</div>
				</div>
			{/if}

			<div class="fase-badge">{faseLabel}</div>

			{#if fuldskaerm && phase !== 'switch'}
				<div class="navn-overlay">
					<div class="navn-overlay-titel">{aktuelExercise.name}</div>
					<div class="navn-overlay-meta">
						Øvelse {ei + 1} / {oevelser.length} · Sæt {si} / {aktuelOvelse.saet}
					</div>
				</div>
			{/if}

			<button
				class="fs-knap"
				type="button"
				onclick={toggleFuldskaerm}
				aria-label={fuldskaerm ? 'Forlad fuldskærm' : 'Vis i fuldskærm'}
				aria-pressed={fuldskaerm}
			>
				{#if fuldskaerm}
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M9 4H4v5"></path>
						<path d="M15 4h5v5"></path>
						<path d="M4 15v5h5"></path>
						<path d="M20 15v5h-5"></path>
					</svg>
				{:else}
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M3 9V3h6"></path>
						<path d="M21 9V3h-6"></path>
						<path d="M3 15v6h6"></path>
						<path d="M21 15v6h-6"></path>
					</svg>
				{/if}
			</button>

			<div class="toggle-stak">
				<button
					class="rund-knap"
					type="button"
					onclick={toggleLyd}
					aria-label={lydSlaaetTil ? 'Slå lyd fra' : 'Slå lyd til'}
					aria-pressed={lydSlaaetTil}
				>
					{#if lydSlaaetTil}
						<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
							<path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
							<path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
						</svg>
					{:else}
						<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
							<line x1="23" y1="9" x2="17" y2="15"></line>
							<line x1="17" y1="9" x2="23" y2="15"></line>
						</svg>
					{/if}
				</button>
				<button
					class="rund-knap"
					type="button"
					onclick={toggleWake}
					aria-label={wakeSlaaetTil ? 'Tillad skærmen at slukke' : 'Hold skærmen tændt'}
					aria-pressed={wakeSlaaetTil}
				>
					{#if wakeSlaaetTil}
						<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<circle cx="12" cy="12" r="4"></circle>
							<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path>
						</svg>
					{:else}
						<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
						</svg>
					{/if}
				</button>
			</div>

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

		{#if !fuldskaerm}
			<div class="info-omraade">
				<div class="info-navn">{aktuelExercise.name}</div>
				<div class="info-meta">
					Øvelse {ei + 1} / {oevelser.length} · Sæt {si} / {aktuelOvelse.saet}
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

			<button
				class="markeer-knap"
				type="button"
				onclick={() => {
					phase = 'done';
					rem = 0;
					paused = false;
				}}
			>
				Tryk her for at markere træningen gennemført
			</button>

			<button class="fs-bund-knap" type="button" onclick={toggleFuldskaerm}>
				<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M3 9V3h6"></path>
					<path d="M21 9V3h-6"></path>
					<path d="M3 15v6h6"></path>
					<path d="M21 15v6h-6"></path>
				</svg>
				Fuldskærm
			</button>
		{/if}
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
		font-size: calc(13px * var(--fs-scale, 1));
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
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		cursor: pointer;
	}

	.resume-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 10px 14px;
		background: var(--tdim);
		border: 1px solid var(--border);
		border-radius: 12px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--text2);
	}

	.resume-link {
		background: none;
		border: none;
		font-size: calc(12.5px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--terra);
		cursor: pointer;
		padding: 4px 8px;
		font-family: var(--ff-b);
	}

	.resume-link:hover {
		text-decoration: underline;
	}

	.video-omraade {
		position: relative;
		aspect-ratio: 16 / 9;
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

	.video-omraade.switch {
		background: #1a1006;
	}

	.video-omraade.switch .hovedvideo {
		transform: scale(0.65);
		border-radius: 14px;
		border: 3px solid #fff;
		box-shadow: 0 8px 22px rgba(0, 0, 0, 0.4);
	}

	.hovedvideo {
		transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1),
			border-radius 0.5s ease, box-shadow 0.5s ease;
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
		background: #2a1f17;
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
		font-size: calc(22px * var(--fs-scale, 1));
	}

	.fb-hint {
		font-size: calc(12px * var(--fs-scale, 1));
		color: rgba(255, 255, 255, 0.6);
	}

	.fase-badge {
		position: absolute;
		top: 14px;
		right: 14px;
		background: rgba(0, 0, 0, 0.5);
		color: #fff;
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		padding: 6px 12px;
		border-radius: 99px;
		backdrop-filter: blur(6px);
		z-index: 4;
	}

	.toggle-stak {
		position: absolute;
		bottom: 14px;
		left: 14px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		z-index: 4;
	}

	.fs-knap {
		position: absolute;
		top: 14px;
		left: 14px;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.45);
		backdrop-filter: blur(6px);
		border: none;
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		padding: 0;
		z-index: 5;
	}

	.fs-knap:hover {
		background: rgba(0, 0, 0, 0.6);
	}

	.navn-overlay {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 14px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		text-align: center;
		padding: 0 80px;
		z-index: 3;
		pointer-events: none;
	}

	.navn-overlay-titel {
		font-family: var(--ff-d);
		font-size: calc(22px * var(--fs-scale, 1));
		font-weight: 600;
		color: #fff;
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
		line-height: 1.2;
	}

	.navn-overlay-meta {
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 500;
		color: rgba(255, 255, 255, 0.85);
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
		letter-spacing: 0.04em;
	}

	.fs-bund-knap {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		justify-content: center;
		padding: 11px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 500;
		border-radius: 12px;
		cursor: pointer;
		font-family: var(--ff-b);
		align-self: stretch;
	}

	.fs-bund-knap:hover {
		border-color: var(--terra);
		color: var(--terra);
	}

	.markeer-knap {
		display: block;
		width: 100%;
		padding: 12px 16px;
		margin-top: 8px;
		background: var(--sage);
		color: #fff;
		border: none;
		border-radius: 12px;
		font-family: var(--ff-b);
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		cursor: pointer;
	}

	.markeer-knap:hover {
		filter: brightness(0.95);
	}

	.video-omraade.fuldskaerm {
		position: fixed;
		inset: 0;
		z-index: 100;
		aspect-ratio: auto;
		border-radius: 0;
	}

	.video-omraade.fuldskaerm .hovedvideo {
		object-fit: contain;
	}

	.rund-knap {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.45);
		backdrop-filter: blur(6px);
		border: none;
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		padding: 0;
	}

	.rund-knap[aria-pressed='false'] {
		background: rgba(0, 0, 0, 0.65);
		color: rgba(255, 255, 255, 0.55);
	}

	.rund-knap:active {
		transform: scale(0.94);
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
		font-size: calc(28px * var(--fs-scale, 1));
		font-weight: 600;
		line-height: 1;
	}

	.tt-unit {
		font-size: calc(10px * var(--fs-scale, 1));
		letter-spacing: 0.12em;
		text-transform: uppercase;
		opacity: 0.85;
		margin-top: 2px;
	}

	.naeste-overlay {
		position: absolute;
		left: 50%;
		bottom: 14px;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		text-align: center;
		padding: 10px 18px;
		background: rgba(42, 31, 23, 0.7);
		backdrop-filter: blur(6px);
		border-radius: 999px;
		z-index: 3;
		max-width: calc(100% - 40px);
		pointer-events: none;
	}

	.naeste-eyebrow {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.85);
	}

	.naeste-navn {
		font-family: var(--ff-d);
		font-size: calc(16px * var(--fs-scale, 1));
		font-weight: 600;
		color: #fff;
		line-height: 1.2;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
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
		font-size: calc(24px * var(--fs-scale, 1));
	}

	.po-hint {
		font-size: calc(12px * var(--fs-scale, 1));
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
		font-size: calc(22px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		line-height: 1.1;
	}

	.info-meta {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		letter-spacing: 0.04em;
		margin-top: 4px;
	}

	.info-desc {
		font-size: calc(12.5px * var(--fs-scale, 1));
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
		font-size: calc(14px * var(--fs-scale, 1));
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
		font-size: calc(56px * var(--fs-scale, 1));
		line-height: 1;
		margin-bottom: 4px;
	}

	.finish-titel {
		font-family: var(--ff-d);
		font-size: calc(26px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		margin: 0;
		text-align: center;
		letter-spacing: -0.01em;
	}

	.finish-sub {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		text-align: center;
		margin: 0 0 10px;
		max-width: 320px;
		line-height: 1.5;
	}
</style>
