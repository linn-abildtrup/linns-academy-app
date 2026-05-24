<script lang="ts">
	import { getContext, onMount, onDestroy } from 'svelte';
	import { beforeNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import type {
		DayExercise,
		Exercise,
		MikrotraeningFremgang,
		TrainingDay,
		UserProduct
	} from '$lib/content/mikrotraening';
	import { markerDagSomGennemfort } from '$lib/content/mikrotraening';
	import {
		gemMikrotraeningFremgang,
		gemPause,
		hentExercises,
		hentForlobsProgram,
		hentForlobsProgrammer,
		hentPause,
		hentUserProduct,
		sletPause,
		type ProgramMedDage
	} from '$lib/firestore/mikrotraening';
	import { logTraening } from '$lib/firestore/traeningHistorik';
	import { formaterHistorikDato } from '$lib/content/traeningHistorik';
	import { hentAktivProduktType } from '$lib/firestore/forlob';
	import { getAudioUrl, getVideoUrl } from '$lib/utils/storage';
	import { KICKSTART_PRODUCT_ID, type ForlobProduct, type UserDoc } from '$lib/types';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';

	const PREP_SEC = 10;
	const SWITCH_SEC = 15;

	type Phase = 'prep' | 'work' | 'rest' | 'switch' | 'done';

	const getUser = getContext<() => User | null>('user');
	const getUserDoc = getContext<() => UserDoc | null>('userDoc');
	const user = $derived(getUser());
	const userDoc = $derived(getUserDoc());

	const dagNummer = $derived(parseInt(page.params.dag ?? '', 10));

	let produktType = $state<ForlobProduct>(KICKSTART_PRODUCT_ID);
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

	let programId = $state<string | null>(null);
	let resumet = $state(false);
	let traeningGennemfort = $state(false);
	let fuldskaerm = $state(false);
	let hovedvideoEl = $state<HTMLVideoElement | null>(null);

	// Auto-gem træningen så snart phase = 'done' (uanset om brugeren færdiggjorde
	// den naturligt eller trykkede "marker som gennemført"). Effekten kører kun
	// én gang fordi traeningGennemfort sættes til true inde i gemTraening.
	$effect(() => {
		if (phase === 'done' && !traeningGennemfort && !gemmer && !gemFejl) {
			void gemTraening();
		}
	});

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

	// I switch-fasen viser vi den NÆSTE øvelses video direkte i hovedvideoen
	// (i stedet for to konkurrerende videoer der ofte fejler at afspille
	// samtidig på iOS Safari). Når switch slutter er videoen allerede den
	// rigtige — ingen src-skift, ingen pause-glitch. Samme mønster som
	// reference-appens mtEnterSwitch.
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
		if (!Number.isFinite(dagNummer) || dagNummer < 1 || dagNummer > 21) {
			fejl = 'Ugyldigt dag-nummer.';
			loading = false;
			return;
		}

		try {
			produktType = await hentAktivProduktType(userDoc?.forlobIds ?? []);
			const up = await hentUserProduct(u.uid, produktType);
			// Admin i klient-mode har ikke noedvendigvis et userProduct.
			// Faldt tilbage til adminKlientForlobId + foerste aktive program.
			const adminForlobId = userDoc?.adminKlientForlobId ?? null;
			if (!up && !adminForlobId) {
				fejl = 'Du har ikke adgang til mikrotræning endnu.';
				loading = false;
				return;
			}
			if (up) userProduct = up;

			let valgtProgramId = up?.programValg?.mikrotraening;
			const forlobId =
				(up as UserProduct & { forlobId?: string } | null)?.forlobId ?? adminForlobId;
			if (!forlobId) {
				fejl = 'Du er ikke tilknyttet et forløb endnu.';
				loading = false;
				return;
			}

			if (!valgtProgramId) {
				if (adminForlobId) {
					const programmer = await hentForlobsProgrammer(forlobId);
					const foersteAktive = programmer.find((p) => p.aktiv) ?? programmer[0];
					if (foersteAktive) valgtProgramId = foersteAktive.id;
				}
				if (!valgtProgramId) {
					goto('/app/moduler/traening/mikrotraening/onboarding');
					return;
				}
			}
			programId = valgtProgramId;

			const data = await hentForlobsProgram(forlobId, valgtProgramId);
			if (!data) {
				fejl = 'Programmet kunne ikke findes.';
				loading = false;
				return;
			}
			programData = data;

			const dagData = data.dage.find((d) => d.dagNummer === dagNummer);
			const exerciseIds = (dagData?.exercises ?? []).map((e) => e.exerciseId);
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

			const [musik, goLyd, pauseLyd] = await Promise.all([
				getAudioUrl('baggrundsmusik.mp3').catch((e) => {
					console.warn('Kunne ikke hente baggrundsmusik:', e);
					return null;
				}),
				getAudioUrl('nedtaelling-go.mp3').catch((e) => {
					console.warn('Kunne ikke hente go-nedtælling:', e);
					return null;
				}),
				getAudioUrl('nedtaelling-pause.mp3').catch((e) => {
					console.warn('Kunne ikke hente pause-nedtælling:', e);
					return null;
				})
			]);
			musikUrl = musik;
			nedtaellingGoUrl = goLyd;
			nedtaellingPauseUrl = pauseLyd;

			try {
				const gemt = await hentPause(u.uid, valgtProgramId, dagNummer);
				if (gemt && erGyldigPause(gemt, dagData?.exercises.length ?? 0)) {
					ei = gemt.currentEx;
					si = gemt.currentSet;
					phase = gemt.phase;
					rem = gemt.rem;
					phaseTotal = phaseTotalForPause(gemt, dagData?.exercises ?? []);
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
				// ignorer — elementet kan være rent dødt
			}
		}
		document.removeEventListener('visibilitychange', onVisibilityChange);
		releaseWakeLock();
		if (playRetryTimer) {
			clearTimeout(playRetryTimer);
			playRetryTimer = null;
		}
		if (typeof document !== 'undefined') {
			document.body.classList.remove('html-fullscreen-aktiv');
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

	// iOS Safari ignorerer ofte autoplay-attributtet selv på et frisk
	// video-element. Når URL'en ændres tvinger vi derfor en eksplicit
	// .play() — både på hovedvideoen og PIP-videoen i switch-fasen.
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
		// Trigger på vistVideoUrl-skift — start retry-loop indtil iOS Safari
		// accepterer .play() (op til 10 forsøg over ~2 sek). Reference-appen
		// bruger samme mønster fordi autoplay-attributtet alene er upålideligt
		// efter src-skift på iOS.
		tryPlayVideo(hovedvideoEl);
	});

	// Hvis iOS Safari pauser videoen uventet (fx ved øvelses-skift, fokus-
	// skift eller power-management), genoptag automatisk så længe vi er
	// i en aktiv fase og brugeren ikke har trykket Pause.
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

	beforeNavigate(() => {
		gemAktivPause();
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

	function erGyldigPause(
		gemt: { currentEx: number; currentSet: number; phase: Phase; rem: number },
		antalOvelser: number
	): boolean {
		if (gemt.currentEx < 0 || gemt.currentEx >= antalOvelser) return false;
		if (gemt.currentSet < 1) return false;
		if (gemt.rem < 0) return false;
		return ['prep', 'work', 'rest', 'switch'].includes(gemt.phase);
	}

	function phaseTotalForPause(
		gemt: { phase: Phase; currentEx: number },
		exs: DayExercise[]
	): number {
		const ex = exs[gemt.currentEx];
		if (gemt.phase === 'prep') return PREP_SEC;
		if (gemt.phase === 'switch') return SWITCH_SEC;
		if (gemt.phase === 'work') return ex?.workSec ?? 30;
		if (gemt.phase === 'rest') return ex?.restSec ?? 10;
		return PREP_SEC;
	}

	function afspilNedtaellingHvisRelevant() {
		if (!lydSlaaetTil) return;
		if (rem !== 3) return;
		const ex = aktuelOvelse;
		if (!ex) return;

		let voiceKey: 'go' | 'pause' | null = null;
		if (phase === 'prep' || phase === 'rest' || phase === 'switch') {
			voiceKey = 'go';
		} else if (phase === 'work') {
			const sidsteSet = si >= ex.sets;
			const sidsteOvelse = ei >= exercises.length - 1;
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
			// ignorer — release må gerne fejle silent
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
		const ex = aktuelOvelse;
		if (!ex) return;

		if (phase === 'prep') {
			setPhase('work', ex.workSec);
			return;
		}

		if (phase === 'switch') {
			const ny = exercises[ei + 1];
			if (!ny) {
				phase = 'done';
				stopTimer();
				return;
			}
			ei += 1;
			si = 1;
			setPhase('work', ny.workSec);
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

	function toggleLyd() {
		lydSlaaetTil = !lydSlaaetTil;
	}

	function gemAktivPause() {
		const u = user;
		if (!u || !programId) return;
		if (phase === 'done' || traeningGennemfort) return;
		if (loading || fejl) return;
		void gemPause(u.uid, {
			productId: produktType,
			elementAlias: 'mikrotraening',
			programId,
			dag: dagNummer,
			currentEx: ei,
			currentSet: si,
			phase,
			rem: Math.max(0, rem)
		}).catch((e) => console.warn('Kunne ikke gemme pause:', e));
	}

	async function stopOgForlad() {
		stopTimer();
		const u = user;
		if (u && programId && phase !== 'done' && !traeningGennemfort) {
			try {
				await gemPause(u.uid, {
					productId: produktType,
					elementAlias: 'mikrotraening',
					programId,
					dag: dagNummer,
					currentEx: ei,
					currentSet: si,
					phase,
					rem: Math.max(0, rem)
				});
			} catch (e) {
				console.warn('Kunne ikke gemme pause ved stop:', e);
			}
		}
		goto(`/app/moduler/traening/mikrotraening/${dagNummer}`);
	}

	async function startForfra() {
		const u = user;
		if (u && programId) {
			try {
				await sletPause(u.uid, programId, dagNummer);
			} catch (e) {
				console.warn('Kunne ikke slette gemt pause:', e);
			}
		}
		ei = 0;
		si = 1;
		setPhase('prep', PREP_SEC);
		paused = false;
		resumet = false;
		sidsteCountdownNoegle = null;
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
			await gemMikrotraeningFremgang(u.uid, produktType, opdateret);
			if (userProduct) {
				userProduct = {
					...userProduct,
					fremgang: { ...userProduct.fremgang, mikrotraening: opdateret }
				};
			}
			traeningGennemfort = true;
			if (programId) {
				try {
					await sletPause(u.uid, programId, dagNummer);
				} catch (e) {
					console.warn('Kunne ikke slette pause efter gennemførsel:', e);
				}
			}
			// Log til den samlede træning-historik så forsiden kan vise det
			// rigtige program når kunden går tilbage til en historisk dato
			const forlobId = (userProduct as UserProduct & { forlobId?: string } | null)?.forlobId;
			void logTraening(u.uid, {
				dato: formaterHistorikDato(new Date()),
				kilde: 'mikrotraening',
				programId: programId ?? undefined,
				programNavn: programData?.program.navn ?? 'Mikrotræning',
				...(forlobId ? { forlobId } : {}),
				gennemfoertAt: Date.now()
			}).catch((e) => console.warn('Kunne ikke logge træning-historik:', e));
		} catch (e) {
			console.error(e);
			gemFejl = 'Kunne ikke gemme træningen. Prøv igen.';
		} finally {
			gemmer = false;
		}
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
		<Loading tekst="Henter dagens træning..." />
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
			<button class="ctrl primary fuld" type="button" onclick={stopOgForlad}>
				Tilbage til oversigten
				<Icon name="check" size={14} color="#fff" />
			</button>
		</div>
	{:else if dag && aktuelOvelse && aktuelExercise}
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
			{#if aktuelOvelse.bonus}
				<div class="bonus-ribbon">Bonus</div>
			{/if}

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
						Øvelse {ei + 1} / {exercises.length} · Sæt {si} / {aktuelOvelse.sets}
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
						<svg
							viewBox="0 0 24 24"
							width="18"
							height="18"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
							<path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
							<path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
						</svg>
					{:else}
						<svg
							viewBox="0 0 24 24"
							width="18"
							height="18"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
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
						<svg
							viewBox="0 0 24 24"
							width="18"
							height="18"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<circle cx="12" cy="12" r="4"></circle>
							<path
								d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
							></path>
						</svg>
					{:else}
						<svg
							viewBox="0 0 24 24"
							width="18"
							height="18"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
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
		border: 1px solid var(--tdim2);
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

	/* PIP-mode i switch-fasen: hovedvideoen skaleres ned til en kort-
	   lignende preview med hvid kant — samme effekt som referenceappens
	   PiP, bare uden et separat video-element (iOS Safari klarer ikke
	   to videoer der spiller samtidig). */
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

	.bonus-ribbon {
		position: absolute;
		top: 14px;
		left: 14px;
		background: var(--terra);
		color: #fff;
		font-size: calc(10px * var(--fs-scale, 1));
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
