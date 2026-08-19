<script lang="ts">
	// ============================================================
	// Afspilleren. Bid 4, 15. august 2026.
	//
	// ÉN afspiller til alt. Den gamle app har fire naesten ens paa cirka
	// 1.400 linjer hver. Tilstands-maskinen ligger i content/afspiller3
	// og er testet, saa siden her kun taeller ned og tegner.
	//
	// NAAR HUN GAAR VAEK, SPOERGER VI ALTID. Ja, nej, eller gem hvor jeg
	// er kommet til. Linns krav, og "spoerg altid" var hendes svar ogsaa
	// paa om vi skulle lade vaere efter ti sekunder.
	//
	// Koerer hun traeningen helt faerdig, spoerger vi ikke. Saa er den
	// gennemfoert, og hun kommer tilbage til Mikrotraening.
	// ============================================================

	import { getContext, onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import type { Adgangsbillede, ForlobKilde } from '$lib/content/adgang3';
	import type { DayExercise, Exercise, TrainingDay } from '$lib/content/mikrotraening';
	import { hentExercises } from '$lib/firestore/mikrotraening';
	import { getAudioUrl, getVideoUrl } from '$lib/utils/storage';
	import { rensUdstyr3, udstyrFra } from '$lib/content/traeningKategori3';
	import { dagensMinutter, type Traeningsprogram3 } from '$lib/content/traeningsprogram3';
	import {
		maaByggeEget3,
		programmerForKunde3,
		type KundeKontekst3
	} from '$lib/content/traeningTildeling3';
	import { erEgetProgram3 } from '$lib/content/mineTraeninger3';
	import {
		maaAabnes3,
		naesteTraening3,
		tomFremgang3,
		type Traeningsfremgang3
	} from '$lib/content/traeningFremgang3';
	import {
		faseLaengde3,
		faseTekst3,
		pladsPasser3,
		procentAfTraening3,
		startStilling3,
		stillingFraPlads3,
		tik3,
		vaerdAtGemme3,
		visesOevelse3,
		type GemtPlads3,
		type Stilling3
	} from '$lib/content/afspiller3';
	import { hentKategorier3 } from '$lib/firestore/traeningKategori3';
	import { hentProgrammer3 } from '$lib/firestore/traeningsprogram3';
	import { hentProgramMedTraeninger3 } from '$lib/firestore/mineTraeninger3';
	import { hentMineTildelinger3 } from '$lib/firestore/traeningTildeling3';
	import { gemGennemfoert3, hentFremgang3 } from '$lib/firestore/traeningFremgang3';
	import { gemPlads3, hentPlads3, sletPlads3 } from '$lib/firestore/traeningPlads3';
	import { harAbonnement3, isoDato3 } from '$lib/firestore/traeningKunde3';
	import { logTraening } from '$lib/firestore/traeningHistorik';
	import { formaterHistorikDato } from '$lib/content/traeningHistorik';

	const hentUser = getContext<() => User | null>('user');
	const hentUserDoc = getContext<() => UserDoc | null>('userDoc');
	const hentAdgang = getContext<() => Adgangsbillede>('adgang');
	const hentForlob = getContext<() => ForlobKilde[]>('forlob');

	const user = $derived(hentUser());
	const userDoc = $derived(hentUserDoc());
	const adgang = $derived(hentAdgang());
	const forlob = $derived(hentForlob?.() ?? []);
	const programId = $derived(page.params.programId ?? '');
	const nr = $derived(Number(page.params.nr));

	type Skaerm = 'henter' | 'fejl' | 'klar' | 'fortsaet' | 'spiller' | 'faerdig';

	let skaerm = $state<Skaerm>('henter');
	let fejl = $state('');
	let program = $state<Traeningsprogram3 | null>(null);
	let traening = $state<TrainingDay | null>(null);
	let oevelseKort = $state<Map<string, Exercise>>(new Map());
	let videoUrl = $state<Map<string, string>>(new Map());
	let gemtPlads = $state<GemtPlads3 | null>(null);

	/**
	 * Hendes fremgang i programmet, gemt saa afslutnings-skaermen kan
	 * pege paa den naeste traening uden et nyt opslag.
	 *
	 * Der er INGEN graense for hvor mange traeninger hun maa tage paa en
	 * dag. Linns beslutning 18. august, ordret: principielt uendeligt
	 * mange. Har hun lyst til tre i traek, tager hun tre i traek.
	 */
	let minFremgang = $state<Traeningsfremgang3>(tomFremgang3(''));

	/**
	 * Sat naar traeningen ER skrevet ned.
	 *
	 * "Tag traening 8" maa foerst staa der naar 7 er gemt. Naeste side
	 * laeser fremgangen forfra, og naar hun frem foer gemningen, vil den
	 * mene at 8 ikke er laast op endnu og sende hende tilbage. Det ville
	 * kun ske paa en langsom forbindelse, og det er praecis dér det er
	 * mest irriterende.
	 */
	let gemtFaerdig = $state(false);

	let stilling = $state<Stilling3>(startStilling3());
	let paause = $state(false);
	/** Selve video-elementet, saa pause ogsaa kan fryse billedet. */
	let videoEl = $state<HTMLVideoElement | null>(null);

	// ── Stor visning ───────────────────────────────────────────
	//
	// Videoen er 16:9. Paa en staaende telefon fylder den en femtedel af
	// skaermen, og det er for lidt naar telefonen staar paa gulvet.
	//
	// DER ER TO TING I SPIL, og de maa ikke forveksles:
	//
	//  1. STOR VISNING. Vores egen. Afspilleren laegger sig hen over hele
	//     vinduet med CSS. Det virker paa ALLE telefoner, ogsaa iPhone, og
	//     det er praecis det den gamle app goer. Browserens kant bliver
	//     staaende, men videoen bliver stor.
	//
	//  2. BROWSERENS FULDE SKAERM. Den fjerner ogsaa browserens kant, men
	//     findes ikke paa iPhone i Safari, hvor Apple kun tillader det paa
	//     selve videofilen.
	//
	// Knappen goer BEGGE dele paa én gang, saa hun faar det bedste hendes
	// telefon kan. Gaar nummer 2 ikke, sker der ingenting, og nummer 1
	// virker alligevel. Det var derfor den gamle app kun havde nummer 1.
	//
	// Ligger telefonen ned, taender stor visning af sig selv. Linns oenske
	// 19. august.
	let spillerEl = $state<HTMLDivElement | null>(null);
	let storManuelt = $state(false);
	let erLiggende = $state(false);

	/** Stor visning er taendt, enten fordi hun bad om det eller fordi
	    telefonen ligger ned. */
	const stor = $derived(storManuelt || erLiggende);

	$effect(() => {
		if (typeof window === 'undefined' || !window.matchMedia) return;
		const mq = window.matchMedia('(orientation: landscape)');
		erLiggende = mq.matches;
		const lyt = (e: MediaQueryListEvent) => (erLiggende = e.matches);
		mq.addEventListener('change', lyt);
		return () => mq.removeEventListener('change', lyt);
	});

	function slaaStorTil() {
		storManuelt = true;
		void spillerEl?.requestFullscreen?.().catch(() => undefined);
	}

	function slaaStorFra() {
		storManuelt = false;
		if (typeof document !== 'undefined' && document.fullscreenElement) {
			void document.exitFullscreen().catch(() => undefined);
		}
	}
	let viserAfslut = $state(false);
	let gemmer = $state(false);
	let lydTil = $state(true);

	let ur: ReturnType<typeof setInterval> | null = null;
	let wakeLock: WakeLockSentinel | null = null;
	let musikEl: HTMLAudioElement | null = null;
	let goEl: HTMLAudioElement | null = null;
	let pauseEl: HTMLAudioElement | null = null;
	let sidsteLyd = '';

	const oevelser = $derived<DayExercise[]>(traening?.exercises ?? []);
	const denne = $derived(visesOevelse3(stilling, oevelser));
	const oevelseData = $derived(denne ? (oevelseKort.get(denne.exerciseId) ?? null) : null);
	const video = $derived(oevelseData ? (videoUrl.get(oevelseData.videoPath) ?? null) : null);
	const procent = $derived(procentAfTraening3(stilling, oevelser));
	const laengde = $derived(faseLaengde3(stilling.fase, oevelser[stilling.oevelse]));
	const ringAndel = $derived(laengde > 0 ? stilling.tilbage / laengde : 0);

	const RING = 2 * Math.PI * 52;

	// ── Sådan gør du ───────────────────────────────────────────
	//
	// Teksten kommer fra oevelsen selv, den samme som den gamle app
	// viser. Den folder sig ud FOERSTE gang hun moeder oevelsen og er
	// foldet sammen alle gange derefter. Linns valg 19. august.
	//
	// "Foerste gang" er pr traening og ikke pr kunde. Vi gemmer ikke
	// noget: koerer hun den samme traening igen i morgen, folder den sig
	// ud igen. Det er en bevidst forenkling, for et gemt felt pr oevelse
	// pr kunde er meget maskineri for en lille ting.
	const hjaelpetekst = $derived(oevelseData?.desc?.trim() ?? '');
	const hjaelpetrin = $derived((oevelseData?.how ?? []).filter((t) => t.trim().length > 0));

	let setteOevelser = $state<Set<string>>(new Set());
	let saadanAaben = $state(false);

	$effect(() => {
		const id = denne?.exerciseId;
		if (!id || !hjaelpetekst) return;
		if (setteOevelser.has(id)) {
			saadanAaben = false;
			return;
		}
		setteOevelser = new Set([...setteOevelser, id]);
		saadanAaben = true;
	});

	// ── Klar-skaermen ──────────────────────────────────────────

	/** Videoen fra foerste oevelse, saa hun kan se hvad der venter. */
	const foersteVideo = $derived.by(() => {
		const foerste = oevelser[0];
		if (!foerste) return null;
		const kort = oevelseKort.get(foerste.exerciseId);
		return kort ? (videoUrl.get(kort.videoPath) ?? null) : null;
	});

	/** "Træning 7 af 21 · 6 øvelser · ca. 12 min". */
	const klarMeta = $derived.by(() => {
		const dele: string[] = [];
		if (program && program.antalDage > 0) dele.push(`Træning ${nr} af ${program.antalDage}`);
		const antal = oevelser.length;
		if (antal > 0) dele.push(antal === 1 ? '1 øvelse' : `${antal} øvelser`);
		const min = traening ? dagensMinutter(traening) : 0;
		if (min > 0) dele.push(`ca. ${min} min`);
		return dele.join(' · ');
	});

	/**
	 * Den traening hun kan gaa videre til, naar den her er klaret.
	 *
	 * Der er ingen graense pr dag. Har hun lyst til én mere med det
	 * samme, skal knappen vaere der. Linns beslutning 18. august.
	 */
	const naesteEfter = $derived(
		program ? naesteTraening3(minFremgang, program.antalDage, program.starterForfra) : null
	);

	onMount(async () => {
		const uid = user?.uid;
		if (!uid || !Number.isInteger(nr) || nr < 1) {
			fejl = 'Træningen findes ikke.';
			skaerm = 'fejl';
			return;
		}
		try {
			// Den gemte plads er en tilgift. Kan den ikke hentes, skal
			// traeningen stadig kunne startes forfra. En traening der ikke
			// kan startes er meget vaerre end en glemt plads.
			const [data, alle, kategorier, tildelinger, fremgangKort, plads] = await Promise.all([
				// Henter fra Linns programmer eller fra hendes egne, alt efter
				// hvad id'et siger. Se firestore/mineTraeninger3.
				hentProgramMedTraeninger3(uid, programId),
				hentProgrammer3(),
				hentKategorier3(),
				hentMineTildelinger3(uid),
				hentFremgang3(uid),
				hentPlads3(uid, programId).catch((e) => {
					console.warn('[ny] kunne ikke hente den gemte plads', e);
					return null;
				})
			]);
			if (!data) {
				fejl = 'Programmet findes ikke.';
				skaerm = 'fejl';
				return;
			}

			// Adgangen tjekkes ogsaa her. Ellers kunne en adresse skrevet i
			// haanden aabne et program hun ikke har faaet.
			const kontekst: KundeKontekst3 = {
				uid,
				forlob: adgang.aktiveForlob.map((x) => ({ id: x.forlobId, dag: x.dagNummer })),
				harAbonnement: harAbonnement3(userDoc, forlob, Date.now()),
				udstyr: rensUdstyr3(udstyrFra(userDoc), kategorier),
				idag: isoDato3(Date.now())
			};
			// Hendes egne programmer har ingen tildeling at slaa op. Adgangen
			// er i stedet om hun overhovedet maa bygge sine egne: bliver den
			// ret taget fra hende, kan hun ikke laengere koere dem.
			const maaKoere = erEgetProgram3(programId)
				? maaByggeEget3(tildelinger, kontekst)
				: programmerForKunde3(alle, tildelinger, kategorier, kontekst).find(
						(x) => x.program.id === programId
					)?.vises === true;
			if (!maaKoere) {
				fejl = 'Du har ikke det her program.';
				skaerm = 'fejl';
				return;
			}

			const fremgang: Traeningsfremgang3 = fremgangKort.get(programId) ?? tomFremgang3(programId);
			const naeste = naesteTraening3(fremgang, data.program.antalDage, data.program.starterForfra);
			// Hun maa tage en traening om, men ikke springe frem. Linns valg.
			if (!maaAabnes3(nr, fremgang, naeste)) {
				fejl = 'Den træning er ikke åben endnu. Tag den forrige først.';
				skaerm = 'fejl';
				return;
			}

			const dag = data.dage.find((d) => d.dagNummer === nr) ?? null;
			if (!dag || dag.exercises.length === 0) {
				fejl = 'Der er ikke lagt øvelser ind i den træning endnu.';
				skaerm = 'fejl';
				return;
			}

			program = data.program;
			traening = dag;
			oevelseKort = await hentExercises(dag.exercises.map((e) => e.exerciseId));

			// Videoerne hentes for sig. Kan de ikke hentes, skal traeningen
			// stadig kunne koeres, bare uden billede.
			const par = await Promise.all(
				[...oevelseKort.values()].map(async (e) => {
					try {
						return [e.videoPath, await getVideoUrl(e.videoPath)] as const;
					} catch {
						return [e.videoPath, ''] as const;
					}
				})
			);
			videoUrl = new Map(par.filter(([, u]) => u));

			void hentLyd();

			gemtPlads = plads;
			minFremgang = fremgang;
			if (pladsPasser3(plads, programId, nr, dag.exercises)) {
				skaerm = 'fortsaet';
			} else {
				// KLAR-SKAERMEN, og den er med vilje. Foer gik traeningen i
				// gang i samme sekund siden aabnede. Nu hvor forsiden foerer
				// direkte herind, ville halvdelen af trykkene vaere
				// nysgerrighed, og saa stod hun midt i en oevelse i toget.
				// Hun ser hvad hun siger ja til, og trykker selv. Linns valg
				// 18. august, model D1.
				skaerm = 'klar';
			}
		} catch (e) {
			console.error('[ny] kunne ikke starte traeningen', e);
			fejl = 'Træningen kunne ikke startes. Prøv igen om lidt.';
			skaerm = 'fejl';
		}
	});

	onDestroy(() => {
		stopUr();
		slipWakeLock();
		slaaStorFra();
		for (const el of [musikEl, goEl, pauseEl]) {
			try {
				el?.pause();
			} catch {
				// ligegyldigt
			}
		}
	});

	async function hentLyd() {
		const [musik, go, pause] = await Promise.all([
			getAudioUrl('baggrundsmusik.mp3').catch(() => null),
			getAudioUrl('nedtaelling-go.mp3').catch(() => null),
			getAudioUrl('nedtaelling-pause.mp3').catch(() => null)
		]);
		if (musik) {
			musikEl = new Audio(musik);
			musikEl.loop = true;
			musikEl.volume = 0.35;
		}
		if (go) goEl = new Audio(go);
		if (pause) pauseEl = new Audio(pause);
	}

	function spilLyd(el: HTMLAudioElement | null) {
		if (!lydTil || !el) return;
		try {
			el.currentTime = 0;
			void el.play();
		} catch {
			// Browsere afviser lyd uden en brugerhandling. Det er ikke en fejl.
		}
	}

	function begynd(fra: Stilling3) {
		stilling = fra;
		skaerm = 'spiller';
		paause = false;
		void tagWakeLock();
		if (lydTil && musikEl) void musikEl.play().catch(() => undefined);
		startUr();
	}

	function startUr() {
		stopUr();
		ur = setInterval(() => {
			if (paause || skaerm !== 'spiller') return;
			const foer = stilling.fase;
			stilling = tik3(stilling, oevelser);

			// Lyd tre sekunder foer et skift, saa hun kan naa at reagere.
			const noegle = `${stilling.oevelse}-${stilling.saet}-${stilling.fase}`;
			if (stilling.tilbage === 3 && noegle !== sidsteLyd) {
				sidsteLyd = noegle;
				spilLyd(stilling.fase === 'arbejd' ? pauseEl : goEl);
			}

			if (stilling.fase === 'faerdig' && foer !== 'faerdig') void afslutFaerdig();
		}, 1000);
	}

	function stopUr() {
		if (ur !== null) {
			clearInterval(ur);
			ur = null;
		}
	}

	async function tagWakeLock() {
		if (wakeLock || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
		try {
			wakeLock = await navigator.wakeLock.request('screen');
		} catch {
			wakeLock = null;
		}
	}

	function slipWakeLock() {
		const s = wakeLock;
		wakeLock = null;
		try {
			void s?.release();
		} catch {
			// ligegyldigt
		}
	}

	function skiftLyd() {
		lydTil = !lydTil;
		if (!musikEl) return;
		// Slaar hun lyden til MENS hun holder pause, skal der ikke pludselig
		// komme musik. Den venter til hun fortsaetter.
		if (lydTil && !paause) void musikEl.play().catch(() => undefined);
		else musikEl.pause();
	}

	/**
	 * Hold pause, eller fortsaet.
	 *
	 * ALT skal staa stille, ikke bare uret. Linns oenske 19. august:
	 * musikken stopper OG videoen fryser. Foer koerte oevelsen videre i
	 * ring bag pause-skyen, og det ligner at appen ikke hoerte efter.
	 *
	 * Baade knappen og et tryk paa selve videoen gaar gennem den her.
	 */
	function saetPause(vaerdi: boolean) {
		paause = vaerdi;
		if (vaerdi) {
			musikEl?.pause();
			videoEl?.pause();
			return;
		}
		if (lydTil && musikEl) void musikEl.play().catch(() => undefined);
		// Kan billedet ikke starte igen, er det ikke vaerd at vaelte
		// traeningen over. Uret koerer videre uanset hvad.
		void videoEl?.play().catch(() => undefined);
	}

	/** Traeningen er koert helt igennem. Saa spoerger vi ikke om noget. */
	async function afslutFaerdig() {
		stopUr();
		slipWakeLock();
		musikEl?.pause();
		skaerm = 'faerdig';
		slaaStorFra();
		// Talt med med det samme, saa "Tag den naeste" peger rigtigt selv
		// hvis gemningen nedenfor er langsom.
		if (!minFremgang.gennemfoerte.includes(nr)) {
			minFremgang = { ...minFremgang, gennemfoerte: [...minFremgang.gennemfoerte, nr] };
		}
		const uid = user?.uid;
		if (!uid || !program) return;
		const nu = Date.now();
		try {
			await Promise.all([
				gemGennemfoert3(uid, programId, nr, nu),
				sletPlads3(uid, programId),
				// Historikken deles med den gamle app, saa fluebenet passer
				// uanset hvilken app hun har traenet i. Kilden er sat til
				// mikrotraening, fordi den gamle app kun kender sine egne
				// program-typer og ellers ville bygge et link til ingenting.
				// Minutterne gemmes med, saa Udvikling kan taelle tid og ikke
				// bare dage. Se HANDOVER 9.26. Traeninger logget FOER 18. august
				// har ikke feltet, og det kan ikke laves bagudrettet, fordi
				// entry'en ikke gemmer hvilken dag i programmet hun tog.
				logTraening(uid, {
					dato: formaterHistorikDato(new Date(nu)),
					kilde: 'mikrotraening',
					programNavn: program.navn,
					gennemfoertAt: nu,
					...(traening ? { minutter: dagensMinutter(traening) } : {})
				})
			]);
		} catch (e) {
			console.error('[ny] kunne ikke gemme traeningen', e);
		} finally {
			// Ogsaa naar det gik galt. Kan vi ikke gemme, skal hun stadig
			// kunne gaa videre, og saa er det vaerste der sker at hun bliver
			// sendt tilbage til listen.
			gemtFaerdig = true;
		}
	}

	function bedOmSvar() {
		// Ogsaa her skal alt staa stille mens hun svarer.
		saetPause(true);
		viserAfslut = true;
	}

	/** Ja, den taeller som gennemfoert selv om hun ikke koerte den faerdig. */
	async function svarJa() {
		if (gemmer) return;
		gemmer = true;
		const uid = user?.uid;
		const nu = Date.now();
		try {
			if (uid && program) {
				await Promise.all([
					gemGennemfoert3(uid, programId, nr, nu),
					sletPlads3(uid, programId),
					logTraening(uid, {
						dato: formaterHistorikDato(new Date(nu)),
						kilde: 'mikrotraening',
						programNavn: program.navn,
						...(traening ? { minutter: dagensMinutter(traening) } : {}),
						gennemfoertAt: nu
					})
				]);
			}
		} catch (e) {
			console.error('[ny] kunne ikke gemme traeningen', e);
		}
		forlad();
	}

	/** Nej. Der gemmes ingenting, og traeningen ligger der igen i morgen. */
	async function svarNej() {
		if (gemmer) return;
		gemmer = true;
		const uid = user?.uid;
		try {
			if (uid) await sletPlads3(uid, programId);
		} catch (e) {
			console.warn('[ny] kunne ikke rydde pladsen', e);
		}
		forlad();
	}

	/** Gem hvor jeg er kommet til. Naeste gang fortsaetter hun her. */
	async function svarGem() {
		if (gemmer) return;
		gemmer = true;
		const uid = user?.uid;
		try {
			if (uid) {
				await gemPlads3(uid, {
					programId,
					nr,
					oevelse: stilling.oevelse,
					saet: stilling.saet,
					fase: stilling.fase === 'faerdig' ? 'arbejd' : stilling.fase,
					tilbage: stilling.tilbage,
					gemtAt: Date.now()
				});
			}
		} catch (e) {
			console.error('[ny] kunne ikke gemme pladsen', e);
		}
		forlad();
	}

	function forlad() {
		stopUr();
		slipWakeLock();
		musikEl?.pause();
		void goto('/ny/traening');
	}

	function navnPaa(o: DayExercise | null): string {
		if (!o) return '';
		return oevelseKort.get(o.exerciseId)?.name ?? 'Øvelse';
	}
</script>

<svelte:head><title>Træning {nr}</title></svelte:head>

<!-- I liggende format bliver hele afspilleren til én stor video. Klassen
     styrer det, og resten sker i ny.css. -->
<div class="ny-pad af-side" class:af-spiller={skaerm === 'spiller'} bind:this={spillerEl}>
	{#if skaerm === 'henter'}
		<div class="adm-venter"><Ventetegn variant="lille" /><span>Gør træningen klar</span></div>
	{:else if skaerm === 'fejl'}
		<p class="kort rolig">{fejl}</p>
		<a class="tv-knap af-link" href={`/ny/traening/${programId}`}>Tilbage</a>
	{:else if skaerm === 'klar'}
		<!-- Videoen koerer stille i loekke, saa hun kan se hvad der venter,
		     og saa trykker hun selv. Se kommentaren ved skaerm = 'klar'. -->
		<div class="kl-kort">
			<div class="kl-scene">
				{#if foersteVideo}
					<video class="kl-video" src={foersteVideo} autoplay muted loop playsinline></video>
				{:else}
					<div class="kl-intet" aria-hidden="true">◈</div>
				{/if}
			</div>
			<h1 class="kl-titel">{traening?.titel || `Træning ${nr}`}</h1>
			{#if klarMeta}<p class="kl-meta">{klarMeta}</p>{/if}
			<button type="button" class="tv-knap" onclick={() => begynd(startStilling3())}>
				Start træningen
			</button>
			<a class="kl-link" href={`/ny/traening/${programId}`}>Se de andre træninger</a>
		</div>
	{:else if skaerm === 'fortsaet'}
		<div class="af-kort">
			<h1>Du var i gang</h1>
			<p>
				Du stoppede midt i træning {nr}. Vil du fortsætte hvor du slap, eller starte forfra?
			</p>
			<button
				type="button"
				class="tv-knap"
				onclick={() => begynd(stillingFraPlads3(gemtPlads as GemtPlads3, oevelser))}
			>
				Fortsæt hvor jeg slap
			</button>
			<button type="button" class="tv-knap rolig" onclick={() => begynd(startStilling3())}>
				Start forfra
			</button>
		</div>
	{:else if skaerm === 'faerdig'}
		<div class="af-kort">
			<span class="af-flueben" aria-hidden="true">✓</span>
			<h1>Flot klaret</h1>
			<p>Træning {nr} er gennemført.</p>
			<!-- Har hun lyst til én mere med det samme, skal hun kunne det.
			     Der er ingen graense pr dag. Linns beslutning 18. august. -->
			{#if gemtFaerdig && naesteEfter !== null && naesteEfter !== nr}
				<a class="tv-knap af-link" href={`/ny/traening/${programId}/${naesteEfter}`}>
					Tag træning {naesteEfter}
				</a>
			{/if}
			<a class="tv-knap rolig af-link" href="/ny/traening">Tilbage til Træning</a>
		</div>
	{:else}
		<div class="af-top">
			<div class="af-bar"><i style={`width:${procent}%`}></i></div>
			<div class="af-info">
				<span>Træning {nr}</span>
				<span>Øvelse {stilling.oevelse + 1} af {oevelser.length}</span>
			</div>
		</div>

		<!-- VIDEOEN ER REN. Uret laa foer oven paa den og daekkede en
		     femtedel. Videoen ligger ned, 16:9, saa den er i forvejen lav,
		     og paa en squat var det underkroppen der forsvandt. Uret staar
		     nu under. Linns valg 19. august, model L2.

		     Hele feltet er en knap: et tryk paa videoen holder pause, og
		     et tryk mere fortsaetter. -->
		<button
			type="button"
			class="af-scene"
			class:arbejd={stilling.fase === 'arbejd'}
			class:hvil={stilling.fase === 'hvil'}
			class:paa-pause={paause}
			aria-label={paause ? 'Fortsæt træningen' : 'Hold pause'}
			onclick={() => saetPause(!paause)}
		>
			{#if video}
				<video
					class="af-video"
					bind:this={videoEl}
					src={video}
					autoplay
					muted
					loop
					playsinline
					preload="auto"
				></video>
			{:else}
				<div class="af-intet" aria-hidden="true">◈</div>
			{/if}

			{#if denne?.bonus}
				<span class="af-bonus">Bonus</span>
			{:else}
				<span class="af-mrk">{faseTekst3(stilling.fase)}</span>
			{/if}

			{#if paause}
				<span class="af-pauselag">
					<span class="af-pausetegn" aria-hidden="true">❙❙</span>
					<span class="af-pausetekst">På pause · tryk for at fortsætte</span>
				</span>
			{/if}
		</button>

		<!-- Uret og oevelsen staar samlet, saa oejnene kun skal ét sted
		     efter videoen. -->
		<div class="af-ur-rk">
			<span class="af-ur">
				<svg class="af-ring" viewBox="0 0 120 120" aria-hidden="true">
					<circle class="af-ring-bund" cx="60" cy="60" r="52" />
					<circle
						class="af-ring-top"
						cx="60"
						cy="60"
						r="52"
						stroke-dasharray={RING}
						stroke-dashoffset={RING * (1 - ringAndel)}
					/>
				</svg>
				<span class="af-tal">{stilling.tilbage}</span>
			</span>
			<span class="af-tekst">
				<!-- Fasen staar KUN paa videoen. Den stod baade der og her, og
				     to gange "Arbejd" paa den samme skaerm er stoej. Linns
				     bemaerkning 19. august. -->
				<span class="af-navn">{navnPaa(denne)}</span>
				{#if denne && stilling.fase !== 'skift'}
					<span class="af-saet">Sæt {stilling.saet} af {denne.sets}</span>
				{/if}
			</span>
		</div>

		<!-- Figuren der fortaeller hende at videoen kan blive stor. Den
		     ligger UDEN FOR videoen, fordi videoen selv er en pause-knap og
		     en knap inde i en knap ikke er lovligt.

		     Trykker hun paa den, beder vi om fuld skaerm. Drejer hun bare
		     telefonen, faar hun den liggende visning alligevel, bare med
		     browserens kant omkring. -->
		{#if !stor}
			<button type="button" class="af-drej" onclick={slaaStorTil}>
				<span class="af-drej-i" aria-hidden="true">⤢</span>
				Stor video · eller drej telefonen
			</button>
		{/if}

		<!-- Hvor langt der er igen, uden at hun skal regne. -->
		{#if oevelser.length > 1}
			<div class="af-stribe">
				{#each oevelser as _, i (i)}
					<span
						class="af-prik"
						class:klaret={i < stilling.oevelse}
						class:nu={i === stilling.oevelse}>{i + 1}</span
					>
				{/each}
			</div>
		{/if}

		<!-- SAADAN GOER DU. Beskrivelsen stod i den gamle app, men ingen
		     steder i den nye, saa var hun i tvivl midt i en oevelse kunne
		     hun ikke slaa den op. Den folder sig ud FOERSTE gang hun moeder
		     en oevelse og er foldet sammen derefter. Linns valg 19. august. -->
		{#if hjaelpetekst}
			<details class="af-saadan" bind:open={saadanAaben}>
				<summary>Sådan gør du</summary>
				<p>{hjaelpetekst}</p>
				{#if hjaelpetrin.length > 0}
					<ol>
						{#each hjaelpetrin as trin, i (i)}
							<li>{trin}</li>
						{/each}
					</ol>
				{/if}
			</details>
		{/if}

		<div class="af-knapper">
			<button type="button" class="af-knap" onclick={() => saetPause(!paause)}>
				{paause ? 'Fortsæt' : 'Pause'}
			</button>
			<button type="button" class="af-knap" onclick={skiftLyd}>
				{lydTil ? 'Lyd fra' : 'Lyd til'}
			</button>
			<button type="button" class="af-knap" onclick={bedOmSvar}>Afslut</button>
			<!-- Ligger telefonen ned, er stor visning ikke noget hun har
			     valgt, og saa er der ikke noget at lukke. Saa vender hun den
			     bare tilbage. -->
			{#if stor && !erLiggende}
				<button type="button" class="af-knap" onclick={slaaStorFra}>Mindre</button>
			{/if}
		</div>

		{#if viserAfslut}
			<div class="af-spoerg">
				<div class="af-spoerg-t">Skal træningen tælle som gennemført?</div>
				<button type="button" class="tv-knap" onclick={svarJa} disabled={gemmer}>Ja</button>
				{#if vaerdAtGemme3(stilling)}
					<button type="button" class="tv-knap rolig" onclick={svarGem} disabled={gemmer}>
						Gem hvor jeg er kommet til
					</button>
				{/if}
				<button type="button" class="tv-knap rolig" onclick={svarNej} disabled={gemmer}>Nej</button>
				<button
					type="button"
					class="af-fortryd"
					onclick={() => {
						viserAfslut = false;
						saetPause(false);
					}}
				>
					Jeg vil træne videre
				</button>
			</div>
		{/if}
	{/if}
</div>
