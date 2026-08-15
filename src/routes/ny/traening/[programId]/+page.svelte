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
		programmerForKunde3,
		type KundeKontekst3,
		type Traeningstildeling3
	} from '$lib/content/traeningTildeling3';
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
	import { hentProgram3, hentProgrammer3 } from '$lib/firestore/traeningsprogram3';
	import { hentMineTildelinger3 } from '$lib/firestore/traeningTildeling3';
	import { hentFremgang3 } from '$lib/firestore/traeningFremgang3';
	import { harAbonnement3, isoDato3 } from '$lib/firestore/traeningKunde3';

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
	const naeste = $derived(
		program ? naesteTraening3(fremgang, antal, program.starterForfra) : null
	);
	const procent = $derived(procentKlaret3(fremgang, antal));
	const faerdig = $derived(erFaerdig3(fremgang, antal));

	const undertekst = $derived.by(() => {
		if (!program) return '';
		const kategori = kategoriNavn3(program.kategoriId, kategorier);
		const minutter = dage.length > 0 ? dagensMinutter(dage[0]) : 0;
		return [kategori, `${antal} træninger`, minutter > 0 ? `ca. ${minutter} min hver` : '']
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
				hentProgram3(programId),
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
			const svar = programmerForKunde3(alle, t as Traeningstildeling3[], k, kontekst).find(
				(x) => x.program.id === programId
			);
			maaSeDen = svar?.vises === true;
		} catch (e) {
			console.error('[ny] kunne ikke hente programmet', e);
			fejl = 'Programmet kunne ikke hentes lige nu. Prøv igen om lidt.';
		} finally {
			henter = false;
		}
	});

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
	<header class="side-top" style="padding-left:0;padding-right:0">
		<a class="tr-tilbage" href="/ny/traening">‹ Mikrotræning</a>
		<h1>{program?.navn ?? 'Træning'}</h1>
		{#if program && maaSeDen}
			<p class="mt-under">{undertekst}</p>
		{/if}
	</header>

	{#if henter}
		<div class="adm-venter"><Ventetegn variant="lille" /><span>Henter</span></div>
	{:else if fejl}
		<p class="kort rolig">{fejl}</p>
	{:else if !program || !maaSeDen}
		<p class="kort rolig">Du har ikke det her program. Gå tilbage til Mikrotræning.</p>
	{:else}
		<div class="mt-prog igang">
			<div class="mt-fremgang">
				{#if faerdig && naeste === null}
					Alle {antal} træninger er klaret
				{:else if faerdig}
					Alle {antal} træninger er klaret
				{:else}
					Træning {naeste ?? 1} af {antal}
				{/if}
			</div>
			<div class="mt-bar"><i style={`width:${procent}%`}></i></div>
			<div class="mt-meta">
				{#if faerdig && naeste === null}
					Programmet er færdigt
				{:else if faerdig}
					Programmet starter forfra
				{:else}
					{klaret === 1 ? '1 træning klaret' : `${klaret} træninger klaret`}
				{/if}
			</div>
			{#if naeste !== null}
				<a class="mt-knap" href={`/ny/traening/${programId}/${naeste}`}>
					Start træning {naeste}
				</a>
			{/if}
		</div>

		<div class="lab"><h2>Træningerne</h2></div>
		{#each dage as dag (dag.dagNummer)}
			{@const tilstand = traeningstilstand3(dag.dagNummer, fremgang, naeste)}
			{@const aaben = maaAabnes3(dag.dagNummer, fremgang, naeste)}
			<svelte:element
				this={aaben ? 'a' : 'div'}
				class="mt-traening"
				class:venter={!aaben}
				href={aaben ? `/ny/traening/${programId}/${dag.dagNummer}` : undefined}
			>
				<span class="mt-cirkel" class:naeste={tilstand === 'naeste'} class:vent={tilstand === 'venter'}>
					{tilstand === 'klaret' ? '✓' : dag.dagNummer}
				</span>
				<span class="mt-tt">
					Træning {dag.dagNummer}
					{#if dag.titel}<span class="mt-titel">{dag.titel}</span>{/if}
					<span class="mt-ts">
						{oevelsesTekst(dag)}{tilstand === 'klaret' ? ' · klaret' : ''}
					</span>
				</span>
			</svelte:element>
		{/each}
	{/if}
</div>
