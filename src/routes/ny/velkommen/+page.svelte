<script lang="ts">
	// ============================================================
	// Onboarding i 3.0. Bid 1, 16. august 2026.
	//
	// Alle beslutninger staar i SPEC-3.0.md afsnit 31, og skaermene er
	// tegnet i v3 app/linns-academy-design/mockups-onboarding.html.
	//
	// FIRE TING DER ER DYRE AT GENOPDAGE:
	//
	// 1. Der er INGEN spring over-knap. Linns beslutning.
	// 2. onboardet3 skrives FOERST naar hun er faerdig. Falder hun ud
	//    midt i, starter hun forfra. Et halvt svar er vaerre end ingen:
	//    en tom udstyrsliste ville saa betyde "hun har svaret" uden at
	//    hun havde.
	// 3. Taelleren regnes ud af HENDES egen liste. En forloebskunde faar
	//    11 trin, et medlem 9. Tallet maa aldrig staa fast i koden.
	// 4. Videoerne er ikke optaget endnu. En tom URL betyder at skaermen
	//    springer afspilleren over og kun viser hilsenen, saa opstarten
	//    virker fuldt ud i mellemtiden. Se VELKOMSTVIDEO_3.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import type { Adgangsbillede } from '$lib/content/adgang3';
	import { kundetypeFor } from '$lib/content/features';
	import { videoEmbedUrl } from '$lib/content/bibliotek';
	import { anvendScale, gemScale } from '$lib/utils/textScale';
	import {
		kortNr3,
		rundvisningskort3,
		slutTekst3,
		taeller3,
		tekstSkalaFra3,
		velkomstvideo3,
		velkomsttekst3,
		SPOERGSMAAL_TRIN_3,
		TEKST_SKALAER_3,
		type TekstSkala3
	} from '$lib/content/onboarding3';
	import { beskedAdgang3 } from '$lib/content/beskedside3';
	import {
		rensUdstyr3,
		udstyrFra,
		valgbareKategorier3,
		type TraeningKategori3
	} from '$lib/content/traeningKategori3';
	import { hentKategorier3 } from '$lib/firestore/traeningKategori3';
	import { gemUdstyr3 } from '$lib/firestore/traeningUdstyr3';
	import { hentDagensTraening3 } from '$lib/firestore/traeningForside3';
	import { hentAdgangsskema, maaSeUdvidetNaering } from '$lib/firestore/featureAdgang3';
	import { gemTekstSkala3, markerOnboardet3 } from '$lib/firestore/onboarding3';
	import UdstyrValg from '$lib/components/ny/UdstyrValg.svelte';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';

	const hentUser = getContext<() => User | null>('user');
	const hentUserDoc = getContext<() => UserDoc | null>('userDoc');
	const hentAdgang = getContext<() => Adgangsbillede>('adgang');
	const hentForlob = getContext<() => import('$lib/content/adgang3').ForlobKilde[]>('forlob');

	const user = $derived(hentUser());
	const userDoc = $derived(hentUserDoc());
	const adgang = $derived(hentAdgang());
	const harAktivtForlob = $derived(adgang.aktiveForlob.length > 0);
	const kundetype = $derived(kundetypeFor(userDoc));
	const fornavn = $derived(userDoc?.firstName?.trim() ?? '');

	let henter = $state(true);
	let harTraening = $state(false);
	let maaSeKalorier = $state(false);
	let kategorier = $state<TraeningKategori3[]>([]);
	let gemmer = $state(false);
	let fejl = $state('');

	/** 1-baseret. 1 til 4 er spoergsmaalene, derefter kortene. */
	let trin = $state(1);
	let faerdig = $state(false);

	// "Gennemgå appen" under Profil springer de fire spoergsmaal over og
	// viser kun rundvisningen. Taelleren taeller saa kun kortene, ellers
	// ville hun lede efter de fire foerste trin.
	const kunGennemgang = $derived(page.url.searchParams.get('kun') === 'gennemgang');

	const kort = $derived(
		rundvisningskort3({
			harAktivtForlob,
			harTraening,
			maaSkriveTilLinn: beskedAdgang3(harAktivtForlob).linn,
			maaSeKalorier
		})
	);

	const tael = $derived(taeller3(trin, kort.length, !kunGennemgang));
	const kortNr = $derived(kortNr3(trin, !kunGennemgang));
	const aktueltKort = $derived(kortNr >= 0 ? (kort[kortNr] ?? null) : null);
	/** Er vi stadig i de fire spoergsmaal. */
	const iSpoergsmaal = $derived(!kunGennemgang && trin <= SPOERGSMAAL_TRIN_3.length);

	// Skriftstoerrelsen spejler det gemte indtil hun roerer noget. Et rent
	// $state ville laase den fast paa den foerste vaerdi, saa hendes gemte
	// valg ikke stod markeret naar userDoc er faerdig med at komme ind.
	let egenSkala = $state<TekstSkala3 | null>(null);
	const skala = $derived(egenSkala ?? tekstSkalaFra3(userDoc));

	const valgtUdstyr = $derived(rensUdstyr3(udstyrFra(userDoc), kategorier));
	const video = $derived(velkomstvideo3(kundetype));
	const videoEmbed = $derived(video ? videoEmbedUrl(video) : null);
	const slut = $derived(slutTekst3(harAktivtForlob));

	onMount(() => void indlaes());

	async function indlaes() {
		const u = user;
		if (!u) return;
		try {
			// Alle fire paa én gang. Ingen af dem maa vaelte skaermen, saa de
			// har hver sit fald tilbage. Onboarding skal kunne gennemfoeres
			// ogsaa paa en daarlig forbindelse.
			const [kat, traening, skema] = await Promise.all([
				hentKategorier3().catch(() => []),
				hentDagensTraening3(
					u.uid,
					userDoc,
					hentForlob(),
					adgang.aktiveForlob.map((f) => ({ forlobId: f.forlobId, dagNummer: f.dagNummer })),
					Date.now(),
					new Date().toISOString().slice(0, 10)
				).catch(() => null),
				hentAdgangsskema().catch(() => null)
			]);
			kategorier = kat;
			harTraening = traening !== null && traening.tilstand !== 'ingen';
			maaSeKalorier = maaSeUdvidetNaering(userDoc, skema);
		} catch (e) {
			console.warn('[ny] kunne ikke hente alt til opstarten', e);
		} finally {
			henter = false;
		}
	}

	function videre() {
		if (trin < tael.ialt) trin += 1;
		else void afslut();
		rulTop();
	}

	function rulTop() {
		document.querySelector('.ny-scroll')?.scrollTo({ top: 0 });
	}

	/** Skriftstoerrelsen virker med det samme, ellers kan hun ikke se hvad hun vaelger. */
	function vaelgSkala(v: TekstSkala3) {
		egenSkala = v;
		anvendScale(v);
		gemScale(v);
	}

	async function gemSkalaOgVidere() {
		const uid = user?.uid;
		if (!uid) return videre();
		gemmer = true;
		try {
			// Gemmes ogsaa paa kontoen, saa valget foelger med til en ny
			// telefon. Den gamle app gemmer kun i browseren.
			await gemTekstSkala3(uid, skala);
		} catch (e) {
			console.warn('[ny] kunne ikke gemme skriftstoerrelsen', e);
		} finally {
			gemmer = false;
		}
		videre();
	}

	async function gemUdstyrOgVidere(markerede: string[]) {
		const uid = user?.uid;
		if (!uid) return videre();
		gemmer = true;
		try {
			const gyldige = new Set(valgbareKategorier3(kategorier).map((k) => k.id));
			await gemUdstyr3(uid, markerede.filter((id) => gyldige.has(id)));
		} catch (e) {
			console.error('[ny] kunne ikke gemme udstyret', e);
			fejl = 'Kunne ikke gemme. Prøv igen.';
			gemmer = false;
			return;
		}
		gemmer = false;
		videre();
	}

	async function afslut() {
		const uid = user?.uid;
		if (!uid || gemmer) return;
		gemmer = true;
		try {
			await markerOnboardet3(uid);
			faerdig = true;
		} catch (e) {
			console.error('[ny] kunne ikke afslutte opstarten', e);
			fejl = 'Noget gik galt. Prøv igen.';
		} finally {
			gemmer = false;
		}
		rulTop();
	}

	async function gaaTil(hvor: string) {
		await goto(hvor);
	}
</script>

<svelte:head><title>Velkommen</title></svelte:head>

<div class="ny-pad ob-side">
	{#if henter}
		<div class="adm-venter"><Ventetegn variant="lille" /><span>Et øjeblik</span></div>
	{:else if faerdig}
		<!-- Slut aldrig paa en tak-skaerm. Ét konkret foerste skridt er
		     forskellen paa at have set appen og at have brugt den. -->
		<div class="ob-trin"><div class="ob-bar"><i style="width:100%"></i></div></div>
		<h1 class="ob-titel">{slut.titel}</h1>
		<p class="ob-under">{slut.tekst}</p>
		{#if harAktivtForlob}
			<button class="ob-knap" onclick={() => gaaTil('/ny/maaling')}>Tag din måling</button>
		{:else}
			<button class="ob-knap" onclick={() => gaaTil('/ny/30-30')}>Registrer dagens mad</button>
		{/if}
		<button class="ob-knap rolig" onclick={() => gaaTil('/ny')}>Gå til forsiden</button>
		<p class="ob-hjaelp">Du kan altid se gennemgangen igen under Profil.</p>
	{:else}
		<div class="ob-trin">
			<div class="ob-bar"><i style="width:{Math.round(tael.andel * 100)}%"></i></div>
			<span>{tael.nu} af {tael.ialt}</span>
		</div>

		{#if fejl}<p class="adm-fejl">{fejl}</p>{/if}

		{#if iSpoergsmaal && trin === 1}
			{#if videoEmbed}
				<div class="ob-video">
					<iframe src={videoEmbed} title="Velkommen" allowfullscreen></iframe>
				</div>
			{/if}
			<h1 class="ob-titel">
				{fornavn ? `Velkommen, ${fornavn}` : 'Velkommen'}
			</h1>
			<p class="ob-under">{velkomsttekst3(kundetype)}</p>
			<button class="ob-knap" onclick={videre}>Videre</button>
			{#if fornavn}
				<a class="ob-hjaelp ob-link" href="/ny/profil">Hedder du ikke {fornavn}? Ret dit navn</a>
			{/if}
		{:else if iSpoergsmaal && trin === 2}
			<h1 class="ob-titel">Kan du læse det her?</h1>
			<p class="ob-under">Vælg den størrelse der er behagelig. Hele appen følger med.</p>
			<div class="ob-valg">
				{#each TEKST_SKALAER_3 as t (t.vaerdi)}
					<button
						class="ob-raekke"
						class:valgt={skala === t.vaerdi}
						onclick={() => vaelgSkala(t.vaerdi)}
					>
						<span style="font-size:{t.px}px">{t.navn}</span>
					</button>
				{/each}
			</div>
			<button class="ob-knap" disabled={gemmer} onclick={gemSkalaOgVidere}>
				{gemmer ? 'Gemmer' : 'Videre'}
			</button>
		{:else if iSpoergsmaal && trin === 3}
			<h1 class="ob-titel">Hvad træner du med?</h1>
			<p class="ob-under">
				Så viser jeg dig kun de programmer du kan bruge. Du kan altid ændre det.
			</p>
			{#if kategorier.length === 0}
				<p class="kort rolig">Der er ikke noget at vælge imellem endnu.</p>
				<button class="ob-knap" onclick={videre}>Videre</button>
			{:else}
				<UdstyrValg
					{kategorier}
					valgte={valgtUdstyr}
					{gemmer}
					knapTekst="Videre"
					gem={gemUdstyrOgVidere}
				/>
			{/if}
		{:else if iSpoergsmaal && trin === 4}
			<h1 class="ob-titel">Læg appen på din forside</h1>
			<p class="ob-under">
				Så åbner du den med ét tryk i stedet for at finde den i browseren hver gang.
			</p>
			<div class="ob-valg">
				<div class="ob-raekke tal"><span><b>1.</b> Tryk på del-knappen nederst i browseren</span></div>
				<div class="ob-raekke tal"><span><b>2.</b> Rul ned og vælg "Føj til hjemmeskærm"</span></div>
				<div class="ob-raekke tal"><span><b>3.</b> Tryk Tilføj</span></div>
			</div>
			<p class="ob-hjaelp">
				På en Android-telefon hedder det tre prikker øverst og så "Installer app".
			</p>
			<button class="ob-knap" onclick={videre}>Videre</button>
		{:else if aktueltKort}
			<!-- Mangler skaermbilledet endnu, skjuler vi rammen i stedet for at
			     vise et brudt billede. Saa virker gennemgangen fuldt ud, ogsaa
			     foer billederne er taget. Se scripts/skaermbilleder.ts. -->
			<div class="ob-billede">
				<img
					src="/onboarding/{aktueltKort.billede}.webp"
					alt={aktueltKort.billedeBeskrivelse}
					onerror={(e) => {
						const el = e.currentTarget as HTMLImageElement;
						el.closest('.ob-billede')?.remove();
					}}
				/>
			</div>
			<h1 class="ob-titel">{aktueltKort.titel}</h1>
			<p class="ob-under">{aktueltKort.tekst}</p>
			<button class="ob-knap" disabled={gemmer} onclick={videre}>
				{trin === tael.ialt ? (gemmer ? 'Gemmer' : 'Så er jeg klar') : 'Videre'}
			</button>
		{/if}
	{/if}
</div>
