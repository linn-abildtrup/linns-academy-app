<script lang="ts">
	// ============================================================
	// Mikrotraening. Kundens egen side. Bid 3, 15. august 2026.
	//
	// Hun ser de programmer hun har faaet, filtreret efter det udstyr
	// hun har valgt. Det hun sidst traenede ligger oeverst.
	//
	// INGEN VAELG-KNAP. Hun skal ikke foerst udpege et program og saa
	// starte det, det er to trin til det samme.
	//
	// Filtreringen bruger programmerForKunde3, altsaa NOEJAGTIG den
	// samme funktion som admin-opslaget i bid 2. To udgaver af den regel
	// ville drive fra hinanden, og saa ville admin sige noget andet end
	// kunden oplever.
	//
	// TRAENINGENS FORSIDE, 19. august. Siden har faaet sin egen fane
	// forneden, og saa er den ikke laengere bare en liste over
	// programmer. Den er der hvor hun starter.
	//
	// Oeverst staar det hun skal goere nu, som ét moerkt kort med en
	// Start-knap der foerer direkte ind i traeningen. Under staar
	// programmerne som rolige raekker, med en prik ved det hun foelger.
	//
	// TO DOERE, TO FORMAAL. Flisen paa forsiden foerer LIGE ind i
	// traeningen, uden om den her side. Fanen forneden foerer hertil, hvor
	// hun kan se paa det, skifte program og vaelge en anden dag. Den ene
	// er "kom i gang", den anden er "lad mig se".
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import type { Adgangsbillede, ForlobKilde } from '$lib/content/adgang3';
	import {
		kategoriNavn3,
		rensUdstyr3,
		udstyrFra,
		udstyrTekst3,
		type TraeningKategori3
	} from '$lib/content/traeningKategori3';
	import type { Traeningsprogram3 } from '$lib/content/traeningsprogram3';
	import {
		maaByggeEget3,
		programmerForKunde3,
		type KundeKontekst3
	} from '$lib/content/traeningTildeling3';
	import { tilProgram3, type MinTraening3 } from '$lib/content/mineTraeninger3';
	import {
		antalTraeninger3,
		fremgangTekst3,
		kundeProgrammer3,
		type KundeProgram3,
		type Traeningsfremgang3
	} from '$lib/content/traeningFremgang3';
	import { hentKategorier3 } from '$lib/firestore/traeningKategori3';
	import { hentProgrammer3 } from '$lib/firestore/traeningsprogram3';
	import { hentMineTildelinger3 } from '$lib/firestore/traeningTildeling3';
	import { hentFremgang3 } from '$lib/firestore/traeningFremgang3';
	import { hentMineTraeninger3 } from '$lib/firestore/mineTraeninger3';
	import { harAbonnement3, isoDato3 } from '$lib/firestore/traeningKunde3';
	import type { Traeningstildeling3 } from '$lib/content/traeningTildeling3';

	const hentUser = getContext<() => User | null>('user');
	const hentUserDoc = getContext<() => UserDoc | null>('userDoc');
	const hentAdgang = getContext<() => Adgangsbillede>('adgang');
	const hentForlob = getContext<() => ForlobKilde[]>('forlob');

	const user = $derived(hentUser());
	const userDoc = $derived(hentUserDoc());
	const adgang = $derived(hentAdgang());
	const forlob = $derived(hentForlob?.() ?? []);

	let henter = $state(true);
	let fejl = $state('');
	let kategorier = $state<TraeningKategori3[]>([]);
	let programmer = $state<Traeningsprogram3[]>([]);
	let tildelinger = $state<Traeningstildeling3[]>([]);
	let fremgang = $state<Map<string, Traeningsfremgang3>>(new Map());
	let mine3 = $state<MinTraening3[]>([]);

	const nu = Date.now();

	const kontekst = $derived<KundeKontekst3>({
		uid: user?.uid ?? '',
		forlob: adgang.aktiveForlob.map((f) => ({ id: f.forlobId, dag: f.dagNummer })),
		harAbonnement: harAbonnement3(userDoc, forlob, nu),
		udstyr: rensUdstyr3(udstyrFra(userDoc), kategorier),
		idag: isoDato3(nu)
	});

	const fraLinn = $derived(
		programmerForKunde3(programmer, tildelinger, kategorier, kontekst)
			.filter((x) => x.vises)
			.map((x) => x.program)
	);

	// Hendes egne filtreres IKKE paa udstyr. Hun har selv valgt oevelserne,
	// saa der er ingen kategori at filtrere paa.
	const maaBygge = $derived(maaByggeEget3(tildelinger, kontekst));
	const egne = $derived(maaBygge ? mine3.map(tilProgram3) : []);

	const liste = $derived<KundeProgram3[]>(kundeProgrammer3([...fraLinn, ...egne], fremgang));
	const iGang = $derived(liste.filter((k) => k.iGang));
	const oevrige = $derived(liste.filter((k) => !k.iGang));

	/**
	 * Det program hun foelger.
	 *
	 * Der findes ikke noget gemt valg, og det er med vilje: hun VAELGER et
	 * program ved at begynde paa det. Har hun kun ét, er det hendes. Har
	 * hun flere og er ikke begyndt paa nogen, er der ikke noget at
	 * fortsaette, og saa staar kortet oeverst ikke.
	 *
	 * Samme regel som forsiden bruger, se traeningForside3.
	 */
	const valgt = $derived<KundeProgram3 | null>(iGang[0] ?? (liste.length === 1 ? liste[0] : null));

	/** "Træning 7 af 21 · ca. 12 min", altsaa det hun skal nu. */
	const naesteTekst = $derived.by(() => {
		if (!valgt || valgt.naeste === null) return '';
		const antal = antalTraeninger3(valgt.program);
		return antal > 0 ? `Træning ${valgt.naeste} af ${antal}` : `Træning ${valgt.naeste}`;
	});

	/**
	 * Har hendes eget udstyrsvalg skjult noget.
	 *
	 * Uden det her bliver siden bare tom, og hun faar ingen anelse om at
	 * det er hendes eget flueben der goer det. Set 18. august.
	 */
	const skjultAfUdstyr = $derived(
		programmerForKunde3(programmer, tildelinger, kategorier, kontekst).filter(
			(x) => x.afvisning === 'udstyr'
		).length
	);

	/**
	 * Hendes udstyr skrevet med ord, til raekken "Sådan træner jeg".
	 *
	 * Raekken laa under Din side indtil 19. august og flyttede hertil paa
	 * Linns oenske: det er en traenings-indstilling og ikke noget om
	 * hendes konto.
	 */
	const udstyrTekst = $derived(
		kategorier.length === 0 ? 'Vælg det udstyr du har' : udstyrTekst3(kontekst.udstyr, kategorier)
	);

	const udstyrNavne = $derived(
		kontekst.udstyr
			.map((id) => kategoriNavn3(id, kategorier))
			.filter(Boolean)
			.join(' og ')
	);

	onMount(async () => {
		const uid = user?.uid;
		if (!uid) {
			henter = false;
			return;
		}
		try {
			const [k, p, t, f, egneRaa] = await Promise.all([
				hentKategorier3(),
				hentProgrammer3(),
				hentMineTildelinger3(uid),
				hentFremgang3(uid),
				// Hendes egne er en tilgift. Kan de ikke hentes, skal Linns
				// programmer stadig kunne vises.
				hentMineTraeninger3(uid).catch((e) => {
					console.warn('[ny] kunne ikke hente egne programmer', e);
					return [];
				})
			]);
			kategorier = k;
			programmer = p;
			tildelinger = t;
			fremgang = f;
			mine3 = egneRaa;
		} catch (e) {
			console.error('[ny] kunne ikke hente traeningen', e);
			fejl = 'Din træning kunne ikke hentes lige nu. Prøv igen om lidt.';
		} finally {
			henter = false;
		}
	});

	function undertekst(k: KundeProgram3): string {
		const kategori = k.program.egen ? '' : kategoriNavn3(k.program.kategoriId, kategorier);
		const antal = antalTraeninger3(k.program);
		const dele = [kategori, antal === 1 ? '1 træning' : `${antal} træninger`].filter(Boolean);
		return dele.join(' · ');
	}
</script>

<svelte:head><title>Træning</title></svelte:head>

<div class="ny-pad mt-side">
	<header class="side-top" style="padding-left:0;padding-right:0">
		<h1>Træning</h1>
	</header>

	{#if henter}
		<div class="adm-venter"><Ventetegn variant="lille" /><span>Henter din træning</span></div>
	{:else if fejl}
		<p class="kort rolig">{fejl}</p>
	{:else if liste.length === 0}
		<!-- Ingenting at vise. Der er to helt forskellige grunde, og hun
		     skal vide hvilken, for den ene kan hun selv rette. -->
		<div class="mt-tom">
			{#if skjultAfUdstyr > 0}
				<strong>Der er ikke noget til {udstyrNavne || 'det udstyr du har valgt'} endnu.</strong>
				<p>
					Du har valgt det under "Sådan træner jeg". Vælger du mere udstyr, eller slår det hele fra,
					kommer der {skjultAfUdstyr === 1 ? 'et program' : `${skjultAfUdstyr} programmer`} frem.
				</p>
				<a class="mt-byg" href="/ny/traening/udstyr">Skift dit udstyr</a>
			{:else}
				<strong>Din træning er på vej.</strong>
				<p>Linn lægger den ind når den er klar til dig.</p>
			{/if}
		</div>
		{#if maaBygge}
			<a class="mt-byg" href="/ny/traening/byg-eget">+ Byg dit eget program</a>
		{/if}
	{:else}
		<!-- Det hun skal goere nu, som ét kort. Knappen foerer direkte ind
		     paa selve traeningen og ikke paa en liste over dage. -->
		{#if valgt && valgt.naeste !== null}
			<a class="mt-naeste" href={`/ny/traening/${valgt.program.id}/${valgt.naeste}`}>
				<span class="mt-n-k">Din næste træning</span>
				<span class="mt-n-navn">{valgt.program.navn}</span>
				{#if naesteTekst}<span class="mt-n-s">{naesteTekst}</span>{/if}
				{#if valgt.klaret > 0}
					<span class="mt-n-bar"><i style={`width:${valgt.procent}%`}></i></span>
					<span class="mt-n-f">{fremgangTekst3(valgt)}</span>
				{/if}
				<span class="mt-n-knap">{valgt.klaret > 0 ? 'Fortsæt' : 'Start'}</span>
			</a>
		{:else if liste.length > 1}
			<p class="mt-under">Vælg det program du har lyst til. Du kan skifte når du vil.</p>
		{/if}

		<section>
			<div class="lab"><h2>Dine programmer</h2></div>
			<div class="mt-liste">
				{#each liste as k (k.program.id)}
					{@const erValgt = valgt?.program.id === k.program.id}
					<a class="mt-r" class:valgt={erValgt} href={`/ny/traening/${k.program.id}`}>
						<!-- Prikken viser hvad hun foelger. Der er ikke noget gemt
						     valg: hun vaelger ved at begynde. -->
						<span class="mt-r-prik" class:fyldt={erValgt} aria-hidden="true"></span>
						<span class="mt-r-t">
							<span class="mt-r-navn">
								{k.program.navn}{#if k.program.egen}<span class="mt-egen">Din egen</span>{/if}
							</span>
							<span class="mt-r-s">{undertekst(k)} · {fremgangTekst3(k)}</span>
						</span>
						<span class="mt-r-pil" aria-hidden="true">›</span>
					</a>
				{/each}
			</div>
		</section>

		{#if skjultAfUdstyr > 0}
			<p class="mt-udstyr">
				{skjultAfUdstyr === 1 ? 'Ét program mere' : `${skjultAfUdstyr} programmer mere`} passer ikke til
				det udstyr du har valgt.
				<a href="/ny/traening/udstyr">Skift dit udstyr</a>
			</p>
		{/if}

		<section>
			<div class="lab"><h2>Sådan træner du</h2></div>
			<div class="mt-liste">
				<!-- Oevelserne bor under Din side, fordi de ogsaa skal kunne
				     naas i de 90 dage hvor traeningen ikke findes. Men en
				     kunde midt i et program vil ogsaa slaa en oevelse op, saa
				     der er en vej ind herfra til den samme side. -->
				<a class="mt-r" href="/ny/profil/oevelser">
					<span class="mt-r-t">
						<span class="mt-r-navn">Alle øvelser</span>
						<span class="mt-r-s">Se hvordan hver øvelse laves</span>
					</span>
					<span class="mt-r-pil" aria-hidden="true">›</span>
				</a>
				<a class="mt-r" href="/ny/traening/udstyr">
					<span class="mt-r-t">
						<span class="mt-r-navn">Sådan træner jeg</span>
						<span class="mt-r-s">{udstyrTekst}</span>
					</span>
					<span class="mt-r-pil" aria-hidden="true">›</span>
				</a>
			</div>
		</section>

		{#if maaBygge}
			<a class="mt-byg" href="/ny/traening/byg-eget">+ Byg dit eget program</a>
		{/if}
	{/if}
</div>
