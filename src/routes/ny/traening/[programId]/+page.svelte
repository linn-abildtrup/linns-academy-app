<script lang="ts">
	// ============================================================
	// Ét traeningsprogram, set af kunden. Bid 3, 15. august 2026.
	//
	// Traeningerne, og hvor langt hun er. Hun maa tage en traening om,
	// men hun maa ikke springe frem. Linns valg 15. august: ellers
	// betyder "hvor langt er jeg" ingenting.
	//
	// Adgangen tjekkes her ogsaa, ikke kun paa listen. Ellers kunne en
	// adresse skrevet i haanden aabne et program hun ikke har faaet.
	//
	// Traeningerne er links naar hun maa aabne dem. De graa kan ikke
	// trykkes, og derfor er de et div og ikke et link. En slukket knap
	// man alligevel kan trykke paa er vaerre end ingen knap.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import type { Adgangsbillede, ForlobKilde } from '$lib/content/adgang3';
	import type { TrainingDay } from '$lib/content/mikrotraening';
	import {
		kategoriNavn3,
		rensUdstyr3,
		udstyrFra,
		type TraeningKategori3
	} from '$lib/content/traeningKategori3';
	import { dagensMinutter, type Traeningsprogram3 } from '$lib/content/traeningsprogram3';
	import {
		maaByggeEget3,
		programmerForKunde3,
		type KundeKontekst3,
		type Traeningstildeling3
	} from '$lib/content/traeningTildeling3';
	import { erEgetProgram3 } from '$lib/content/mineTraeninger3';
	import {
		antalKlaret3,
		antalTraeninger3,
		erFaerdig3,
		maaAabnes3,
		naesteTraening3,
		procentKlaret3,
		tomFremgang3,
		traeningstilstand3,
		type Traeningsfremgang3
	} from '$lib/content/traeningFremgang3';
	import { hentKategorier3 } from '$lib/firestore/traeningKategori3';
	import { hentProgrammer3 } from '$lib/firestore/traeningsprogram3';
	import { hentProgramMedTraeninger3 } from '$lib/firestore/mineTraeninger3';
	import { hentMineTildelinger3 } from '$lib/firestore/traeningTildeling3';
	import { hentFremgang3 } from '$lib/firestore/traeningFremgang3';
	import { harAbonnement3, isoDato3 } from '$lib/firestore/traeningKunde3';
	import Sidehoved from '$lib/components/ny/Sidehoved.svelte';

	const hentUser = getContext<() => User | null>('user');
	const hentUserDoc = getContext<() => UserDoc | null>('userDoc');
	const hentAdgang = getContext<() => Adgangsbillede>('adgang');
	const hentForlob = getContext<() => ForlobKilde[]>('forlob');

	const user = $derived(hentUser());
	const userDoc = $derived(hentUserDoc());
	const adgang = $derived(hentAdgang());
	const forlob = $derived(hentForlob?.() ?? []);
	const programId = $derived(page.params.programId ?? '');

	let henter = $state(true);
	let fejl = $state('');
	let program = $state<Traeningsprogram3 | null>(null);
	let dage = $state<TrainingDay[]>([]);
	let kategorier = $state<TraeningKategori3[]>([]);
	let fremgang = $state<Traeningsfremgang3>(tomFremgang3(''));
	let maaSeDen = $state(false);

	const nu = Date.now();

	const antal = $derived(program ? antalTraeninger3(program) : 0);
	const klaret = $derived(antalKlaret3(fremgang, antal));
	const naeste = $derived(program ? naesteTraening3(fremgang, antal, program.starterForfra) : null);
	const procent = $derived(procentKlaret3(fremgang, antal));
	const faerdig = $derived(erFaerdig3(fremgang, antal));

	const undertekst = $derived.by(() => {
		if (!program) return '';
		const kategori = program.egen
			? 'Dit eget program'
			: kategoriNavn3(program.kategoriId, kategorier);
		const minutter = dage.length > 0 ? dagensMinutter(dage[0]) : 0;
		return [
			kategori,
			antal === 1 ? '1 træning' : `${antal} træninger`,
			minutter > 0 ? `ca. ${minutter} min hver` : ''
		]
			.filter(Boolean)
			.join(' · ');
	});

	onMount(async () => {
		const uid = user?.uid;
		if (!uid) {
			henter = false;
			return;
		}
		try {
			const [data, alle, k, t, f] = await Promise.all([
				// Henter fra Linns programmer eller fra hendes egne, alt efter
				// hvad id'et siger. Se firestore/mineTraeninger3.
				hentProgramMedTraeninger3(uid, programId),
				hentProgrammer3(),
				hentKategorier3(),
				hentMineTildelinger3(uid),
				hentFremgang3(uid)
			]);
			kategorier = k;
			fremgang = f.get(programId) ?? tomFremgang3(programId);
			if (!data) {
				fejl = 'Programmet findes ikke.';
				return;
			}
			program = data.program;
			dage = data.dage;

			const kontekst: KundeKontekst3 = {
				uid,
				forlob: adgang.aktiveForlob.map((x) => ({ id: x.forlobId, dag: x.dagNummer })),
				harAbonnement: harAbonnement3(userDoc, forlob, nu),
				udstyr: rensUdstyr3(udstyrFra(userDoc), k),
				idag: isoDato3(nu)
			};
			// Hendes egne har ingen tildeling. Adgangen er om hun maa bygge
			// sine egne overhovedet. Bliver den ret taget fra hende, bliver
			// programmet skjult, men det bliver ikke slettet.
			maaSeDen = erEgetProgram3(programId)
				? maaByggeEget3(t as Traeningstildeling3[], kontekst)
				: programmerForKunde3(alle, t as Traeningstildeling3[], k, kontekst).find(
						(x) => x.program.id === programId
					)?.vises === true;
		} catch (e) {
			console.error('[ny] kunne ikke hente programmet', e);
			fejl = 'Programmet kunne ikke hentes lige nu. Prøv igen om lidt.';
		} finally {
			henter = false;
		}
	});

	/** Den traening hun skal nu, til kortet oeverst. */
	const naesteDag = $derived(
		naeste === null ? null : (dage.find((d) => d.dagNummer === naeste) ?? null)
	);

	function oevelsesTekst(dag: TrainingDay): string {
		const antalOevelser = dag.exercises.length;
		if (antalOevelser === 0) return 'Ingen øvelser';
		const minutter = dagensMinutter(dag);
		const o = antalOevelser === 1 ? '1 øvelse' : `${antalOevelser} øvelser`;
		return minutter > 0 ? `${o} · ca. ${minutter} min` : o;
	}
</script>

<svelte:head><title>{program?.navn ?? 'Træning'}</title></svelte:head>

<div class="ny-pad mt-side">
	<Sidehoved
		titel={program?.navn ?? 'Træning'}
		tilbage="/ny/traening"
		tilbageTekst="Træning"
		under={program && maaSeDen ? undertekst : undefined}
		kant={false}
	/>

	{#if henter}
		<div class="adm-venter"><Ventetegn variant="lille" /><span>Henter</span></div>
	{:else if fejl}
		<p class="kort rolig">{fejl}</p>
	{:else if !program || !maaSeDen}
		<p class="kort rolig">Du har ikke det her program. Gå tilbage til Træning.</p>
	{:else}
		<!-- Det hun skal goere nu, som ét moerkt kort med én knap. Det er
		     det samme kort som "Dit overskud" paa forsiden, og det er broen
		     til traeningsskaermen, der ogsaa er moerk. Linns valg 20.
		     august, model S1. -->
		{#if naeste !== null}
			<a class="mt-naeste" href={`/ny/traening/${programId}/${naeste}`}>
				<span class="mt-n-k">{klaret > 0 ? 'Din næste træning' : 'Din første træning'}</span>
				<span class="mt-n-navn">{naesteDag?.titel || `Træning ${naeste}`}</span>
				<span class="mt-n-s">
					Træning {naeste} af {antal}{#if naesteDag}
						· {oevelsesTekst(naesteDag)}{/if}
				</span>
				{#if klaret > 0}
					<span class="mt-n-bar"><i style={`width:${procent}%`}></i></span>
					<span class="mt-n-f">
						{klaret === 1 ? '1 træning klaret' : `${klaret} træninger klaret`}
					</span>
				{/if}
				<span class="mt-n-knap">{klaret > 0 ? 'Fortsæt' : 'Start'}</span>
			</a>
		{:else}
			<div class="mt-naeste faerdigt">
				<span class="mt-n-k">Færdig</span>
				<span class="mt-n-navn">Alle {antal} træninger er klaret</span>
				<span class="mt-n-s">Du kan tage en af dem om nedenfor, når du har lyst.</span>
			</div>
		{/if}

		<!-- ALLE TRAENINGER SOM FELTER og ikke som raekker. Programmet "Test
		     håndvægte" har 88 traeninger, og som raekker var det en meget
		     lang rulletur uden noget at orientere sig efter. Syv i bredden
		     bliver 88 til tretten linjer, altsaa ét blik.

		     Groen er taget, gul er den hun skal nu, bleg er ikke laast op
		     endnu. Det er den samme stribe som nede i selve traeningen,
		     hvor hun ser hvor langt hun er i dagens oevelser. -->
		<section>
			<div class="lab"><h2>Alle træninger</h2></div>
			<div class="tr-gitter">
				{#each dage as dag (dag.dagNummer)}
					{@const tilstand = traeningstilstand3(dag.dagNummer, fremgang, naeste)}
					{@const aaben = maaAabnes3(dag.dagNummer, fremgang, naeste)}
					<svelte:element
						this={aaben ? 'a' : 'span'}
						class="tr-felt"
						class:klaret={tilstand === 'klaret'}
						class:nu={tilstand === 'naeste'}
						class:laast={!aaben}
						href={aaben ? `/ny/traening/${programId}/${dag.dagNummer}` : undefined}
						aria-label={`Træning ${dag.dagNummer}${dag.titel ? ', ' + dag.titel : ''}${tilstand === 'klaret' ? ', klaret' : !aaben ? ', ikke åbnet endnu' : ''}`}
					>
						{dag.dagNummer}
					</svelte:element>
				{/each}
			</div>
			<p class="tr-noegle">
				<span class="tr-prik klaret" aria-hidden="true"></span> Taget
				<span class="tr-prik nu" aria-hidden="true"></span> Din næste
				<span class="tr-prik laast" aria-hidden="true"></span> Ikke åbnet endnu
			</p>
		</section>

		{#if program.egen}
			<a class="ch-knap sekundaer" href={`/ny/traening/byg-eget/${programId}`}> Ret programmet </a>
		{/if}
	{/if}
</div>
