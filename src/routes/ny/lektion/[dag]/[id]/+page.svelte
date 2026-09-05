<script lang="ts">
	// ============================================================
	// Lektionsvisning i 3.0.
	//
	// Fire slags indhold: video, lyd, indlejret side og link. Alle fire
	// aabnes her, saa hun aldrig sendes ud af den nye flade.
	//
	// Lektionen markeres taget af sig selv, naar hun har haft den aabne i
	// 80 procent af den tid der staar paa den. Vi kan ikke se ind i Vimeos
	// afspiller uden at hente deres kode ind, saa det er et skoen. Derfor
	// er der ogsaa altid en knap.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import type { Adgangsbillede } from '$lib/content/adgang3';
	import { forlobAdgang } from '$lib/content/lektionsliste3';
	import { dokumentUrl3 } from '$lib/content/dokument3';
	import type { LektionItem } from '$lib/content/forlob';
	import {
		artFor,
		klaretOrd3,
		indlejretUrl,
		sekunderFoerKlaret,
		formaterVarighed
	} from '$lib/content/lektion3';
	import { hentDagensLektioner, hentKlaret, saetKlaret } from '$lib/firestore/forside3';
	import { erSet3, setNoegler3 } from '$lib/content/lektionSet3';
	import { gemLektionNote, hentLektionNote } from '$lib/firestore/lektionNoter';
	import Lydafspiller from '$lib/components/ny/Lydafspiller.svelte';
	import Venter from '$lib/components/ny/Venter.svelte';
	import Fluebe from '$lib/components/ny/Fluebe.svelte';
	import LektionNote from '$lib/components/ny/LektionNote.svelte';

	const hentUser = getContext<() => User | null>('user');
	const hentAdgang = getContext<() => Adgangsbillede>('adgang');
	const hentUserDoc = getContext<() => UserDoc | null>('userDoc');
	const user = $derived(hentUser());
	const adgang = $derived(hentAdgang());
	const userDoc = $derived(hentUserDoc());
	const aktivtForlob = $derived(adgang.aktiveForlob[0] ?? null);

	const dagNummer = $derived(Number(page.params.dag));
	const lektionId = $derived(page.params.id);

	// Kommer hun fra "Dine lektioner", staar forloebet i adressen, fordi
	// lektionen kan hoere til et hold hun forlaengst er faerdig med. Uden
	// det ville vi slaa op i det forloeb der koerer lige nu, og saa kunne
	// en lektion fra et tidligere hold slet ikke findes.
	//
	// Vi tager kun imod et forloeb hun rent faktisk har vaeret paa. Ellers
	// kunne enhver skrive et fremmed forloebs-id i adresselinjen.
	const oensketForlob = $derived(page.url.searchParams.get('forlob'));
	// To ting skal passe: hun skal have vaeret paa forloebet, OG de 90 dages
	// bibliotek-bonus maa ikke vaere loebet ud. Uden det sidste kunne en
	// kunde hvis materiale er lukket stadig aabne en lektion ved at skrive
	// adressen selv. Listen skjuler den, men listen er ikke en laas.
	const maaSes = $derived(
		oensketForlob
			? (adgang.aktiveForlob.some((f) => f.forlobId === oensketForlob) ||
					adgang.gennemfoerte.some((f) => f.forlobId === oensketForlob)) &&
					forlobAdgang(
						adgang.aktiveForlob.some((f) => f.forlobId === oensketForlob),
						{
							harApp: adgang.harApp,
							bonusSlutMs: userDoc?.bonusPeriodEndsAt ?? null,
							nu: Date.now()
						}
					) !== 'lukket'
			: false
	);
	// Beder hun om et forloeb hun ikke maa se, falder vi IKKE tilbage til det
	// aktive. Saa ville hun faa en anden lektion end den hun bad om, med samme
	// id fra et andet hold. Hellere "findes ikke".
	const valgtForlobId = $derived(
		oensketForlob ? (maaSes ? oensketForlob : null) : (aktivtForlob?.forlobId ?? null)
	);

	let lektion = $state<LektionItem | null>(null);
	let henter = $state(true);
	let ikkeFundet = $state(false);
	let erKlaret = $state(false);
	let gemmer = $state(false);

	// Hendes egen note paa lektionen. Ligger i den samme samling som den
	// gamle apps bibliotek bruger, saa de to steder viser det samme.
	let note = $state('');
	let gemmerNote = $state(false);
	let noteGemtLige = $state(false);

	const art = $derived(lektion ? artFor(lektion.url) : 'link');
	// Ordet paa knappen foelger indholdet: lyd hoeres, video ses, en
	// skreven lektion laeses. Se content/lektion3.ts.
	const ord = $derived(klaretOrd3(art));
	const embed = $derived(lektion ? indlejretUrl(lektion.url) : null);

	$effect(() => {
		const uid = user?.uid;
		const forlobId = valgtForlobId;
		const dag = dagNummer;
		const id = lektionId;
		if (!uid || Number.isNaN(dag) || !id) return;
		if (!forlobId) {
			// Enten har hun intet forloeb, eller ogsaa er det hun bad om lukket.
			henter = false;
			ikkeFundet = true;
			return;
		}

		let afbrudt = false;
		(async () => {
			henter = true;
			// Noten maa gerne fejle for sig. Kan vi ikke naa den, skal
			// lektionen stadig kunne ses.
			const [alle, klarede, gemtNote] = await Promise.all([
				hentDagensLektioner(forlobId, dag, Date.now()),
				hentKlaret(uid),
				hentLektionNote(uid, forlobId, id).catch((e) => {
					console.warn('[ny] kunne ikke hente noten', e);
					return null;
				})
			]);
			if (afbrudt) return;
			lektion = alle.find((l) => l.id === id) ?? null;
			ikkeFundet = !lektion;
			// Fluebenet foelger videoen og ikke dagen, saa den samme film paa
			// ugens andre dage staar ogsaa som set. Se HANDOVER 9.37.
			erKlaret = lektion ? erSet3(klarede, lektion) : klarede.has(id);
			note = gemtNote?.tekst ?? '';
			henter = false;
		})().catch((e) => {
			console.error('[ny] kunne ikke hente lektionen', e);
			henter = false;
			ikkeFundet = true;
		});

		return () => {
			afbrudt = true;
		};
	});

	// Tiden hun har haft lektionen aaben. Kun for video og sider: dér kan
	// vi ikke se hvornaar hun er faerdig uden at hente Vimeos egen kode
	// ind. Lyd siger selv til, naar den er spillet til ende.
	onMount(() => {
		let sekunder = 0;
		const id = setInterval(() => {
			if (document.visibilityState !== 'visible') return;
			if (art === 'lyd') return;
			sekunder += 1;
			const graense = sekunderFoerKlaret(lektion?.varighedMin, art);
			if (graense && sekunder >= graense && !erKlaret && !gemmer) {
				void markerKlaret(true);
			}
		}, 1000);
		return () => clearInterval(id);
	});

	async function markerKlaret(klar: boolean) {
		const uid = user?.uid;
		if (!uid || !lektion || gemmer) return;
		gemmer = true;
		const foer = erKlaret;
		erKlaret = klar;
		try {
			await saetKlaret(uid, setNoegler3(lektion), klar);
		} catch (e) {
			console.error('[ny] kunne ikke gemme klaret', e);
			erKlaret = foer;
		} finally {
			gemmer = false;
		}
	}

	async function gemNote(tekst: string) {
		const uid = user?.uid;
		const forlobId = valgtForlobId;
		if (!uid || !forlobId || !lektionId || gemmerNote) return;
		gemmerNote = true;
		const foer = note;
		try {
			await gemLektionNote(uid, forlobId, lektionId, tekst);
			note = tekst;
			noteGemtLige = true;
			setTimeout(() => (noteGemtLige = false), 4000);
		} catch (e) {
			console.error('[ny] kunne ikke gemme noten', e);
			note = foer;
		} finally {
			gemmerNote = false;
		}
	}

	// Tilbage foerer derhen hun kom fra. Kom hun udefra (fx et link),
	// falder vi tilbage til forsiden i stedet for at sende hende ud af appen.
	/**
	 * ET DOKUMENT MARKERES NAAR HUN AABNER DET. Linns beslutning 5.
	 * september.
	 *
	 * Samme regel som guide-lektionerne fik 25. august, og af samme grund:
	 * vi kan ikke se om hun laeser. Dokumentet vises i telefonens egen
	 * laeser inde i rammen, og den fortaeller os ingenting om hvor langt
	 * hun er naaet. At have aabnet det er det taetteste vi kommer.
	 *
	 * Hun kan altid fjerne fluebenet igen inde paa dagen.
	 */
	let harMarkeretDok = false;
	$effect(() => {
		if (art !== 'pdf' || !lektion || erKlaret || harMarkeretDok) return;
		harMarkeretDok = true;
		void markerKlaret(true);
	});

	function tilbage() {
		if (typeof history !== 'undefined' && history.length > 1) {
			history.back();
			return;
		}
		void goto('/ny');
	}
</script>

<div class="lektion-side">
	<!-- Lektionen er en medie-side uden titel, saa den bruger IKKE det
	     faelles sidehoved. Der er kun én vej ud, og et maerke ville vaere
	     stoej oven paa en video. Samme valg som i traeningens afspiller. -->
	<header class="medie-top">
		<button class="tilbage" onclick={tilbage}>‹ Tilbage</button>
	</header>

	{#if henter}
		<Venter tekst="Henter lektionen" />
	{:else if ikkeFundet || !lektion}
		<div class="kort rolig">
			Lektionen findes ikke længere, eller den er ikke åben endnu.
			<a href="/ny">Tilbage til forsiden</a>
		</div>
	{:else}
		<!-- PAA EN LYD-LEKTION staar billedet som en lille rund brik ved
		     siden af titlen. Linns valg 5. september, forslag A: den store
		     plade fyldte 641 px, altsaa mere end hele skaermen, saa
		     afspilleren og knappen laa under kanten og hun skulle rulle for
		     at trykke play. Paa en lyd-lektion er stemmen indholdet, og
		     billedet skal bare minde om hvem der taler. -->
		{#if art === 'lyd'}
			<div class="lektion-hoved">
				<span class="lektion-brik" role="img" aria-label="Linn"></span>
				<div>
					<h1 class="lektion-t">{lektion.titel}</h1>
					<div class="lektion-m">
						Lyd{#if lektion.varighedMin}
							· {formaterVarighed(lektion.varighedMin)}{/if}
					</div>
				</div>
			</div>
		{:else}
			<h1 class="lektion-t">{lektion.titel}</h1>
			{#if lektion.varighedMin}
				<div class="lektion-m">{formaterVarighed(lektion.varighedMin)}</div>
			{/if}
		{/if}

		{#if art === 'video' && embed}
			<div class="video-ramme">
				<iframe
					src={embed}
					title={lektion.titel}
					allow="autoplay; fullscreen; picture-in-picture"
					allowfullscreen
				></iframe>
			</div>
		{:else if art === 'side' && embed}
			<div class="side-ramme">
				<iframe src={embed} title={lektion.titel}></iframe>
			</div>
		{:else if art === 'lyd'}
			<Lydafspiller
				url={lektion.url}
				titel={lektion.titel}
				visPlade={false}
				onfaerdig={() => markerKlaret(true)}
			/>
		{:else}
			<!--
				GUIDEN MARKERES NAAR HUN AABNER DEN. Linns beslutning 25.
				august.

				Den aabner i et nyt vindue, saa uret her kan ikke se at hun
				sidder og laeser: siden er ikke synlig imens, og taelleren
				staar stille. Og af de 43 guide-lektioner paa Kropsro har kun
				6 en varighed sat, saa de 37 andre kunne ALDRIG markere sig
				selv. Dagen foldede sig derfor aldrig sammen for hende.

				At trykke Åbn er en bevidst handling, og hun kan altid fjerne
				fluebenet igen med knappen nedenfor.
			-->
			<a
				class="btn bred"
				href={lektion.url}
				target="_blank"
				rel="noopener noreferrer"
				onclick={() => {
					if (!erKlaret) void markerKlaret(true);
				}}
			>
				Åbn lektionen
			</a>
			<p class="kort rolig">Den åbner i et nyt vindue, og så er du tilbage her bagefter.</p>
		{/if}

		{#if lektion.beskrivelse}
			<p class="lektion-beskrivelse">{lektion.beskrivelse}</p>
		{/if}

		<LektionNote {note} gemmer={gemmerNote} gemtLige={noteGemtLige} ongem={(t) => gemNote(t)} />

		<div class="lektion-fod">
			{#if erKlaret}
				<button class="klar-chip" disabled={gemmer} onclick={() => markerKlaret(false)}>
					<span class="rund-fluebe" aria-hidden="true"><Fluebe /></span>
					{ord.klaret}
				</button>
			{:else}
				<button class="btn" disabled={gemmer} onclick={() => markerKlaret(true)}>
					{ord.knap}
				</button>
			{/if}
		</div>
	{/if}
</div>
