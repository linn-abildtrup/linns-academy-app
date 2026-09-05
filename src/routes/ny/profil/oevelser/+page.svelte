<script lang="ts">
	// ============================================================
	// Alle oevelser, med video og trin-for-trin.
	//
	// HVORFOR SIDEN FINDES. "Træningsøvelser" paa Din side foerte hen til
	// kundens PROGRAMMER, og det er forkert to gange: Traening har sin
	// egen fane nu, og programmer er ikke det hun leder efter naar hun
	// trykker paa noget der hedder oevelser. Den gamle app har en liste
	// over alle oevelser under Bibliotek, og den manglede i 3.0.
	//
	// Den er ogsaa det eneste sted en kunde i sine 90 dage kan slaa en
	// oevelse op uden at have et program i gang. Se SPEC 35.
	//
	// TALT 20. AUGUST: der er 62 oevelser, og alle 62 har baade video, en
	// beskrivelse og en trin-for-trin-vejledning. Ikke én mangler noget,
	// saa siden kunne bygges faerdig med det samme.
	//
	// OPBYGGET SOM OPSKRIFTERNE. Soegefelt, kategorier som knapper, og en
	// liste med en farvet prik. Linns valg, model Ø1: hun har laert
	// moenstret én gang, og saa opfoerer mad og traening sig ens.
	// ============================================================

	import { getContext } from 'svelte';
	import type { User } from 'firebase/auth';

	import {
		antalTekst,
		filtrerOevelser,
		kategoriAntal,
		udstyrAntal,
		udstyrTekst
	} from '$lib/content/oevelsesSoeg3';
	import type { Exercise } from '$lib/content/mikrotraening';
	import { hentAlleExercises } from '$lib/firestore/mikrotraening';
	import { getVideoUrl } from '$lib/utils/storage';
	import Venter from '$lib/components/ny/Venter.svelte';
	import OevelsesArk from '$lib/components/ny/OevelsesArk.svelte';
	import Sidehoved from '$lib/components/ny/Sidehoved.svelte';

	const hentUser = getContext<() => User | null>('user');
	const user = $derived(hentUser());

	let alle = $state<Exercise[]>([]);
	let henter = $state(true);
	let fejl = $state('');

	$effect(() => {
		if (!user?.uid) return;
		let afbrudt = false;
		(async () => {
			henter = true;
			const raa = await hentAlleExercises();
			if (afbrudt) return;
			// Kun de aktive. En oevelse Linn har taget ned skal ikke staa og
			// friste, ligesom en skjult lektion ikke goer det.
			alle = raa.filter((e) => e.aktiv !== false);
			henter = false;
		})().catch((e) => {
			console.error('[ny] kunne ikke hente oevelserne', e);
			fejl = 'Øvelserne kunne ikke hentes lige nu. Prøv igen om lidt.';
			henter = false;
		});
		return () => {
			afbrudt = true;
		};
	});

	// ── Soegning og filtre ─────────────────────────────────────
	let soegeord = $state('');
	let valgtKategori = $state<string | null>(null);
	let valgtUdstyr = $state<string | null>(null);

	/**
	 * Tallene ud for hver knap taelles UDEN knappen selv, saa tallet siger
	 * hvad hun faar hvis hun trykker, og ikke hvad hun allerede har.
	 * Samme regel som paa opskrifterne.
	 */
	const udenKategori = $derived(
		filtrerOevelser(alle, { soegeord, udstyr: valgtUdstyr ? [valgtUdstyr] : [] })
	);
	const udenUdstyr = $derived(
		filtrerOevelser(alle, { soegeord, kategorier: valgtKategori ? [valgtKategori] : [] })
	);

	const kategorier = $derived(kategoriAntal(udenKategori));
	const udstyrsliste = $derived(udstyrAntal(udenUdstyr));

	const resultater = $derived(
		filtrerOevelser(alle, {
			soegeord,
			kategorier: valgtKategori ? [valgtKategori] : [],
			udstyr: valgtUdstyr ? [valgtUdstyr] : []
		})
	);

	const soeger = $derived(soegeord.trim().length > 0);

	/** Linjen over listen. Siger hoejt hvad listen er begraenset til. */
	const overskrift = $derived.by(() => {
		const dele: string[] = [antalTekst(resultater.length)];
		if (soeger) dele.push(`med ${soegeord.trim()}`);
		if (valgtKategori) dele.push(valgtKategori.toLowerCase());
		if (valgtUdstyr) {
			const u = udstyrsliste.find((x) => x.id === valgtUdstyr);
			if (u) dele.push(u.navn.toLowerCase());
		}
		return dele.join(' · ');
	});

	/**
	 * Farven paa prikken. Den siger hvilken slags oevelse det er, saa
	 * listen kan skimmes uden at laese kategorien paa hver linje.
	 */
	function prikklasse(catLabel: string): string {
		const l = (catLabel ?? '').toLowerCase();
		if (l.startsWith('ben')) return 'ben';
		if (l.startsWith('core')) return 'core';
		if (l.startsWith('balance')) return 'balance';
		if (l.startsWith('stabilitet')) return 'stabilitet';
		if (l.startsWith('overkrop')) return 'overkrop';
		return 'andet';
	}

	// ── Den aabne oevelse ──────────────────────────────────────
	let aaben = $state<Exercise | null>(null);
	let aabenVideo = $state<string | null>(null);
	let henterVideo = $state(false);

	async function vis(oevelse: Exercise) {
		aaben = oevelse;
		aabenVideo = null;
		if (!oevelse.videoPath) return;
		henterVideo = true;
		try {
			aabenVideo = await getVideoUrl(oevelse.videoPath);
		} catch (e) {
			// Uden video kan hun stadig laese hvordan oevelsen laves, og det
			// er hovedsagen. Arket siger det selv.
			console.warn('[ny] kunne ikke hente oevelsens video', e);
		} finally {
			henterVideo = false;
		}
	}
</script>

<svelte:head><title>Øvelser</title></svelte:head>

<div class="ny-pad oev-side">
	<Sidehoved titel="Øvelser" tilbage="/ny/profil" tilbageTekst="Din side" />

	<input
		class="ops-soeg"
		type="search"
		placeholder="Søg efter øvelse"
		aria-label="Søg efter øvelse"
		bind:value={soegeord}
	/>

	<!-- Kategorierne staar fremme og ikke bag en knap. Der er syv af dem,
	     og de fylder to linjer. Paa opskrifterne er der flere filtre og
	     derfor et ark, her er der plads. -->
	{#if kategorier.length > 1}
		<div class="oev-chips" role="group" aria-label="Filtrér på kategori">
			<button
				class="oev-chip"
				class:valgt={valgtKategori === null}
				onclick={() => (valgtKategori = null)}>Alle</button
			>
			{#each kategorier as k (k.navn)}
				<button
					class="oev-chip"
					class:valgt={valgtKategori === k.navn}
					onclick={() => (valgtKategori = valgtKategori === k.navn ? null : k.navn)}
				>
					{k.navn} <span class="oev-tal">{k.antal}</span>
				</button>
			{/each}
		</div>
	{/if}

	{#if udstyrsliste.length > 1}
		<div class="oev-chips" role="group" aria-label="Filtrér på udstyr">
			{#each udstyrsliste as u (u.id)}
				<button
					class="oev-chip lille"
					class:valgt={valgtUdstyr === u.id}
					onclick={() => (valgtUdstyr = valgtUdstyr === u.id ? null : u.id)}
				>
					{u.navn} <span class="oev-tal">{u.antal}</span>
				</button>
			{/each}
		</div>
	{/if}

	{#if henter}
		<Venter tekst="Henter øvelserne" />
	{:else if fejl}
		<p class="kort rolig">{fejl}</p>
	{:else}
		<p class="ops-overskrift" aria-live="polite">{overskrift}</p>

		{#if resultater.length === 0}
			<div class="kort rolig">
				Der er ingen der passer. Prøv et andet ord, eller slå filtrene fra.
			</div>
		{:else}
			<div class="ops-liste">
				{#each resultater as o (o.id)}
					<button class="ops-r" onclick={() => vis(o)}>
						<span class="ops-prik {prikklasse(o.catLabel)}" aria-hidden="true"></span>
						<span class="ops-t">
							<span class="ops-navn">{o.name}</span>
							<span class="ops-kat">
								{o.catLabel}{#if udstyrTekst(o.udstyr)}
									· {udstyrTekst(o.udstyr)}{/if}
							</span>
						</span>
						<span class="oev-play" aria-hidden="true">▶</span>
					</button>
				{/each}
			</div>
		{/if}
	{/if}
</div>

{#if aaben}
	<OevelsesArk
		oevelse={aaben}
		video={aabenVideo}
		{henterVideo}
		onluk={() => {
			aaben = null;
			aabenVideo = null;
		}}
	/>
{/if}
