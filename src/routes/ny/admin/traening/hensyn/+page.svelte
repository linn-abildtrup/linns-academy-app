<script lang="ts">
	// ============================================================
	// Admin: hvad belaster hver oevelse.
	//
	// HVORFOR SIDEN FINDES. Naar en kunde bygger sit eget program, kan
	// hun bede om hensyn: skaan mine knae, skaan min ryg. Det kraever at
	// nogen ved hvilke oevelser der er haarde ved hvad, og det er Linns
	// faglighed og ikke noget kode kan regne ud.
	//
	// DER ER ET FORSLAG AT RETTE I. Alle 62 er sat paa forhaand efter
	// hvad de hedder og hvad de aabenlyst goer. Det er et gaet, ikke en
	// vurdering, og Linns valg vinder. Se FORSLAG3.
	//
	// TALLENE OEVERST ER DET VIGTIGSTE PAA SIDEN. De siger hvor mange
	// oevelser der er tilbage hvis en kunde beder om et hensyn. Maerker
	// hun for mange, staar kunden med et program der gentager de samme
	// faa oevelser, og det opdager man ellers foerst naar det er sket.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import Sidehoved from '$lib/components/ny/Sidehoved.svelte';
	import type { Exercise } from '$lib/content/mikrotraening';
	import { hentAlleExercises } from '$lib/firestore/mikrotraening';
	import {
		FORSLAG3,
		HENSYN3,
		MIN_OEVELSER3,
		filtrerPaaHensyn3,
		hensynFor3,
		nokTilbage3,
		tilbageEfterHensyn3,
		type HensynKort3
	} from '$lib/content/oevelseHensyn3';
	import { gemHensyn3, hentHensyn3 } from '$lib/firestore/oevelseHensyn3';
	import { filtrerOevelser, kategoriAntal } from '$lib/content/oevelsesSoeg3';

	const hentUser = getContext<() => User | null>('user');
	const user = $derived(hentUser());
	const maaVaereHer = $derived(isAdmin(user));

	let henter = $state(true);
	let gemmer = $state(false);
	let fejl = $state('');
	let besked = $state('');
	let bank = $state<Exercise[]>([]);
	let kort = $state<HensynKort3>({});
	let urort = $state(true);

	let soegeord = $state('');
	let valgtKategori = $state<string | null>(null);

	const kategoriValg = $derived(kategoriAntal(filtrerOevelser(bank, { soegeord })));
	const synlige = $derived(
		filtrerOevelser(bank, { soegeord, kategorier: valgtKategori ? [valgtKategori] : [] })
	);

	/** Hvor mange der er tilbage pr hensyn. Se kommentaren i toppen. */
	const tilbage = $derived(tilbageEfterHensyn3(bank, kort));

	/** Alle hensyn paa én gang. Det vaerste tilfaelde, og det skal ses. */
	const alleSamlet = $derived(
		filtrerPaaHensyn3(
			bank,
			kort,
			HENSYN3.map((h) => h.id)
		).length
	);

	function skift(exerciseId: string, hensynId: string) {
		const nu = hensynFor3(kort, exerciseId);
		const ny = nu.includes(hensynId) ? nu.filter((h) => h !== hensynId) : [...nu, hensynId];
		kort = { ...kort, [exerciseId]: ny };
		urort = false;
		besked = '';
	}

	function brugForslaget() {
		kort = { ...FORSLAG3 };
		urort = false;
		besked = 'Forslaget er lagt ind. Ret det du er uenig i, og gem.';
	}

	async function gem() {
		if (gemmer) return;
		gemmer = true;
		fejl = '';
		try {
			await gemHensyn3(kort, user?.uid ?? '');
			urort = true;
			besked = 'Mærkerne er gemt.';
		} catch (e) {
			console.error('[ny] kunne ikke gemme maerkerne', e);
			fejl = 'Kunne ikke gemme. Prøv igen om lidt.';
		} finally {
			gemmer = false;
		}
	}

	onMount(async () => {
		try {
			const [oevelser, gemt] = await Promise.all([hentAlleExercises(), hentHensyn3()]);
			bank = oevelser;
			// Har hun aldrig gemt noget, ligger forslaget klar i skaermen.
			// Det bliver IKKE gemt af sig selv: hun skal se det og trykke.
			kort = Object.keys(gemt).length > 0 ? gemt : { ...FORSLAG3 };
			if (Object.keys(gemt).length === 0) {
				besked = 'Her er et forslag. Ret det du er uenig i, og tryk Gem.';
				urort = false;
			}
		} catch (e) {
			console.error('[ny] kunne ikke hente oevelserne', e);
			fejl = 'Kunne ikke hente øvelserne.';
		} finally {
			henter = false;
		}
	});
</script>

<svelte:head><title>Hensyn · admin</title></svelte:head>

<div class="ny-pad adm">
	{#if !maaVaereHer}
		<div class="adm-kort">Siden er kun for admin.</div>
	{:else if henter}
		<div class="adm-venter"><Ventetegn variant="lille" /><span>Henter</span></div>
	{:else}
		<Sidehoved
			titel="Hensyn"
			tilbage="/ny/admin/traening"
			tilbageTekst="Træning"
			under="Hvad belaster hver øvelse. Kunden bruger det når hun beder om at skåne noget."
			kant={false}
		/>

		{#if besked}<p class="adm-besked">{besked}</p>{/if}
		{#if fejl}<p class="adm-fejl">{fejl}</p>{/if}

		<!-- DET VIGTIGSTE PAA SIDEN. Maerker hun for mange oevelser, staar
		     kunden med et program der gentager de samme faa. Her kan det
		     ses FOER det sker. -->
		<section class="adm-kort hs-tal">
			<h2>Hvad kunden har tilbage</h2>
			{#each tilbage as t (t.hensyn.id)}
				<div class="hs-linje" class:faa={!nokTilbage3(t.tilbage)}>
					<span>{t.hensyn.navn}</span>
					<span class="hs-antal">{t.tilbage} af {bank.length}</span>
				</div>
			{/each}
			<div class="hs-linje hs-alle" class:faa={!nokTilbage3(alleSamlet)}>
				<span>Alle {HENSYN3.length} på én gang</span>
				<span class="hs-antal">{alleSamlet} af {bank.length}</span>
			</div>
			{#if !nokTilbage3(alleSamlet)}
				<p class="adm-hjaelp">
					Under {MIN_OEVELSER3} øvelser kan der ikke bygges et program der er værd at have. Beder en
					kunde om alle hensyn på én gang, får hun besked om at skrive til dig i stedet.
				</p>
			{/if}
		</section>

		<div class="hs-knapper">
			<button type="button" class="ch-knap primaer" onclick={gem} disabled={gemmer || urort}>
				{gemmer ? 'Gemmer' : urort ? 'Alt er gemt' : 'Gem mærkerne'}
			</button>
			<button type="button" class="ch-knap sekundaer" onclick={brugForslaget}>
				Start forfra med forslaget
			</button>
		</div>

		<input
			class="ops-soeg"
			type="search"
			bind:value={soegeord}
			placeholder="Søg efter øvelse"
			aria-label="Søg efter øvelse"
		/>

		{#if kategoriValg.length > 1}
			<div class="oev-chips" role="group" aria-label="Filtrér på kategori">
				<button
					type="button"
					class="oev-chip"
					class:valgt={valgtKategori === null}
					onclick={() => (valgtKategori = null)}
				>
					Alle <span class="oev-tal">{bank.length}</span>
				</button>
				{#each kategoriValg as k (k.navn)}
					<button
						type="button"
						class="oev-chip"
						class:valgt={valgtKategori === k.navn}
						onclick={() => (valgtKategori = valgtKategori === k.navn ? null : k.navn)}
					>
						{k.navn} <span class="oev-tal">{k.antal}</span>
					</button>
				{/each}
			</div>
		{/if}

		{#if synlige.length === 0}
			<p class="adm-tom">Der er ingen der passer. Prøv et andet ord.</p>
		{:else}
			<div class="hs-liste">
				{#each synlige as e (e.id)}
					{@const mine = hensynFor3(kort, e.id)}
					<div class="hs-r">
						<div class="hs-navn">
							{e.name}
							<span class="hs-kat">{e.catLabel}</span>
						</div>
						<div class="hs-m">
							{#each HENSYN3 as h (h.id)}
								<button
									type="button"
									class="hs-chip"
									class:paa={mine.includes(h.id)}
									aria-pressed={mine.includes(h.id)}
									onclick={() => skift(e.id, h.id)}
								>
									{h.adminNavn}
								</button>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<button type="button" class="ch-knap primaer hs-bund" onclick={gem} disabled={gemmer || urort}>
			{gemmer ? 'Gemmer' : urort ? 'Alt er gemt' : 'Gem mærkerne'}
		</button>
	{/if}
</div>
