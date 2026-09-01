<script lang="ts">
	// ============================================================
	// Admin: ALLE ingredienser med de naeringstal de regnes med.
	//
	// Linns oenske 1. september 2026: ét sted at kontrollere tallene, i
	// stedet for ét pr opskrift. Olivenolie staar 38 steder i opskrifterne
	// men skal kun ses efter én gang.
	//
	// FOERSTE BID. Siden kan SE og SOEGE, ikke rette. Anden bid er felterne
	// hvor Linn retter et tal, kilde-feltet, omregningen af de opskrifter
	// der bruger varen, og sikkerhedskopien. Bygget i to, fordi en samlet
	// aendring 11. august gav en helt blank app uden at aarsagen kunne
	// findes.
	//
	// SIDEN SKRIVER INGENTING. Den laeser opskrifter, koblinger og
	// foedevarer og regner ved siden af.
	//
	// Naaes fra BEGGE admin-forsider. Der er kun den her ene side, saa de
	// to ikke kan komme til at sige forskellige ting.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import { hentAlleOpskrifter } from '$lib/firestore/opskrifter';
	import { hentFodevarer3 } from '$lib/firestore/fodevarer3';
	import { hentKoblinger } from '$lib/firestore/ingrediensKobling3';
	import type { Fodevare } from '$lib/content/kost';
	import {
		ALLE_KATEGORIER,
		KATEGORI_LABELS,
		type OpskriftKategori
	} from '$lib/content/opskrifter';
	import {
		byggOversigt,
		filtrerOversigt,
		opgoerelse,
		type IngrediensRaekke
	} from '$lib/content/ingrediensOversigt3';
	import type { KoblingsOpslag } from '$lib/content/opskriftMakro3';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import Sidehoved from '$lib/components/ny/Sidehoved.svelte';

	const hentUser = getContext<() => User | null>('user');
	const maaVaereHer = $derived(isAdmin(hentUser()));

	let henter = $state(true);
	let besked = $state('');
	let alle = $state<IngrediensRaekke[]>([]);

	let soeg = $state('');
	let valgteKategorier = $state<OpskriftKategori[]>([]);
	let kunMedFejl = $state(false);
	let aaben = $state('');

	onMount(() => {
		(async () => {
			try {
				const [opskrifter, varerListe, kort] = await Promise.all([
					hentAlleOpskrifter(false),
					hentFodevarer3(),
					hentKoblinger()
				]);
				const varer = new Map<string, Fodevare>(varerListe.map((v) => [v.id, v]));
				const enkel: Record<string, KoblingsOpslag> = {};
				for (const [k, v] of Object.entries(kort)) {
					enkel[k] = { foodId: v.foodId, egenVare: v.egenVare };
				}
				alle = byggOversigt(opskrifter, enkel, varer);
			} catch (e) {
				console.error('[admin] kunne ikke hente ingrediens-tallene', e);
				besked = 'Kunne ikke hente. Prøv at hente siden igen.';
			} finally {
				henter = false;
			}
		})();
	});

	const synlige = $derived(filtrerOversigt(alle, soeg, valgteKategorier, kunMedFejl));
	const tal = $derived(opgoerelse(alle));

	function toggleKategori(k: OpskriftKategori) {
		valgteKategorier = valgteKategorier.includes(k)
			? valgteKategorier.filter((v) => v !== k)
			: [...valgteKategorier, k];
	}

	function etTal(x: number | null): string {
		if (x === null) return '—';
		return (Math.round(x * 10) / 10).toString().replace('.', ',');
	}

	/** Teksten paa en raekke der mangler noget. Aldrig et stille nul. */
	function fejlTekst(r: IngrediensRaekke): string {
		if (r.fejl === 'ingen kobling') return 'Ingen kobling. Tæller ikke med i nogen opskrift';
		if (r.fejl === 'varen findes ikke') return 'Den koblede madvare findes ikke længere';
		if (r.fejl === 'mangler kalorier')
			return 'Mangler kalorietal. Protein og fiber er stadig rigtige';
		return '';
	}
</script>

<svelte:head><title>Ingrediensernes tal · Admin</title></svelte:head>

<div class="it-side">
	{#if !maaVaereHer}
		<p class="it-tom">Siden er kun for admin.</p>
	{:else if henter}
		<Ventetegn />
	{:else}
		<Sidehoved
			titel="Ingrediensernes tal"
			tilbage="/ny/admin"
			tilbageTekst="Admin"
			under="Alle ingredienser der indgår i opskrifterne, med de næringstal de regnes med. Tallene er pr 100 gram. Siden skriver ingenting endnu."
			kant={false}
		/>

		<div class="it-top">
			<div class="it-tal">
				<div class="it-tal-boks"><strong>{tal.ialt}</strong> ingredienser</div>
				<div class="it-tal-boks"><strong>{tal.medTal}</strong> med tal</div>
				<div class="it-tal-boks" class:advarsel={tal.udenKobling > 0}>
					<strong>{tal.udenKobling}</strong> uden kobling
				</div>
				<div class="it-tal-boks" class:advarsel={tal.manglerKalorier > 0}>
					<strong>{tal.manglerKalorier}</strong> mangler kalorier
				</div>
			</div>
			<p class="it-note">
				En ingrediens står kun én gang, uanset hvor mange opskrifter den er i. Retter du tallet
				her, gælder det dem alle. Tør og kogt står hver for sig, for tallene ligger langt fra
				hinanden.
			</p>
		</div>

		{#if besked}<p class="it-besked">{besked}</p>{/if}

		<input
			type="search"
			class="it-soeg"
			placeholder="Søg ingrediens eller madvare..."
			bind:value={soeg}
		/>

		<div class="it-chips">
			{#each ALLE_KATEGORIER as k (k)}
				<button
					type="button"
					class="it-chip"
					class:paa={valgteKategorier.includes(k)}
					onclick={() => toggleKategori(k)}
				>
					{KATEGORI_LABELS[k]}
				</button>
			{/each}
			<button
				type="button"
				class="it-chip mangler"
				class:paa={kunMedFejl}
				onclick={() => (kunMedFejl = !kunMedFejl)}
			>
				Mangler noget
			</button>
		</div>

		<p class="it-antal">
			{#if synlige.length === alle.length}
				Viser alle {alle.length}
			{:else}
				Viser {synlige.length} af {alle.length}
			{/if}
		</p>

		{#if synlige.length === 0}
			<p class="it-tom">Ingen ingredienser matcher.</p>
		{:else}
			<div class="it-liste">
				{#each synlige as r (r.kerne)}
					<article class="it-kort" class:mangler={r.fejl !== null}>
						<button
							type="button"
							class="it-hoved"
							onclick={() => (aaben = aaben === r.kerne ? '' : r.kerne)}
						>
							<div class="it-h-navn">
								<h2>{r.kerne}</h2>
								<span class="it-brug">
									{r.antalOpskrifter}
									{r.antalOpskrifter === 1 ? 'opskrift' : 'opskrifter'}
								</span>
							</div>

							{#if r.naering}
								<div class="it-vare">
									{r.varenavn}
									{#if r.egneTal}<span class="it-mrk egen">Egne tal</span>{/if}
								</div>
								<div class="it-naering">
									<span><strong>{etTal(r.naering.protein)}</strong> protein</span>
									<span><strong>{etTal(r.naering.fiber)}</strong> fiber</span>
									<span><strong>{etTal(r.naering.kh)}</strong> kulhydrat</span>
									<span><strong>{etTal(r.naering.fedt)}</strong> fedt</span>
									<span><strong>{etTal(r.naering.kalorier)}</strong> kcal</span>
								</div>
							{/if}

							{#if r.fejl}
								<div class="it-fejl">{fejlTekst(r)}</div>
								{#if r.fejl === 'ingen kobling'}
									<div class="it-hjaelp">
										Ret enten teksten på ingrediensen i opskriften, eller kobl navnet til en
										madvare. Begge dele får rækken til at forsvinde herfra af sig selv.
									</div>
								{/if}
							{/if}
						</button>

						{#if aaben === r.kerne}
							<div class="it-detalje">
								{#if r.naering}
									<div class="it-d-linje">
										<span class="it-d-mrk">Kilde</span>
										<span>{r.kilde}</span>
									</div>
								{/if}
								<div class="it-d-linje">
									<span class="it-d-mrk">Skrevet som</span>
									<span>{r.varianter.join(' · ')}</span>
								</div>
								<div class="it-d-linje">
									<span class="it-d-mrk">Bruges i</span>
									<!-- Links ind i opskriften, hvor selve teksten paa ingrediensen
									     staar. Det er DER en raekke uden kobling rettes, og saa
									     forsvinder den af sig selv herfra. Redigeringen ligger i den
									     gamle admin, som er det ene sted opskrifterne kan rettes. -->
									<span class="it-retter">
										{#each r.opskrifter as o (o.id)}
											<a class="it-ret-link" href="/app/admin/opskrifter/{o.id}">{o.titel}</a>
										{/each}
									</span>
								</div>
								<div class="it-d-linje">
									<span class="it-d-mrk">Madtyper</span>
									<span>
										{r.kategorier.map((k) => KATEGORI_LABELS[k]).join(', ') || 'Ingen'}
									</span>
								</div>
								<a class="it-vej" href="/ny/admin/ingredienser">Ret koblingen</a>
							</div>
						{/if}
					</article>
				{/each}
			</div>
		{/if}

		<p class="it-fod">
			Tallene kommer fra Den Danske Fødevaredatabase fra DTU Fødevareinstituttet, undtagen dem
			der står med Egne tal. Kunden ser aldrig hvor tallet kommer fra, kun selve tallet.
		</p>
	{/if}
</div>

<style>
	.it-side {
		padding: 0 0 40px;
	}

	.it-tom,
	.it-besked {
		padding: 16px 17px;
		font-size: calc(14px * var(--fs-scale, 1));
		color: var(--ink-2);
	}

	.it-top {
		padding: 0 17px 4px;
	}

	.it-tal {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.it-tal-boks {
		flex: 1 1 auto;
		padding: 8px 11px;
		background: var(--paper);
		border: 1px solid var(--line);
		border-radius: 12px;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--ink-2);
		white-space: nowrap;
	}

	.it-tal-boks strong {
		display: block;
		font-size: calc(17px * var(--fs-scale, 1));
		color: var(--espresso);
	}

	.it-tal-boks.advarsel strong {
		color: var(--ler-tekst);
	}

	.it-note {
		margin: 8px 0 0;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--ink-3);
		line-height: 1.45;
	}

	.it-soeg {
		display: block;
		width: calc(100% - 34px);
		margin: 12px 17px 8px;
		padding: 11px 13px;
		background: var(--paper);
		border: 1px solid var(--line);
		border-radius: 12px;
		color: var(--espresso);
		font-size: calc(13.5px * var(--fs-scale, 1));
		font-family: inherit;
		box-sizing: border-box;
	}

	.it-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding: 0 17px;
	}

	/* Baggrunden staar eksplicit. Nulstillingen i .ny-app er vaegtloes, saa
	   en knap uden egen baggrund faar browserens graa. Se fael­den 10. august. */
	.it-chip {
		padding: 7px 13px;
		background: var(--paper);
		border: 1px solid var(--line);
		border-radius: 99px;
		color: var(--ink-2);
		font-size: calc(12.5px * var(--fs-scale, 1));
		font-family: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.it-chip.paa {
		background: var(--plum);
		border-color: var(--plum);
		color: #fff;
	}

	.it-antal {
		margin: 10px 0 6px;
		padding: 0 17px;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--ink-3);
	}

	.it-liste {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 0 17px;
	}

	.it-kort {
		background: var(--paper);
		border: 1px solid var(--line);
		border-radius: 14px;
		overflow: hidden;
	}

	/* En raekke der mangler noget skal kunne SES ved at skimme. */
	.it-kort.mangler {
		border-left: 3px solid var(--honey);
	}

	.it-hoved {
		display: block;
		width: 100%;
		padding: 11px 13px;
		background: none;
		border: none;
		text-align: left;
		cursor: pointer;
		font-family: inherit;
	}

	.it-h-navn {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
	}

	.it-h-navn h2 {
		margin: 0;
		font-size: calc(14.5px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--espresso);
	}

	.it-brug {
		flex-shrink: 0;
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--ink-3);
	}

	.it-vare {
		margin-top: 3px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--ink-2);
	}

	.it-mrk {
		display: inline-block;
		margin-left: 6px;
		padding: 1px 7px;
		border-radius: 99px;
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 700;
		letter-spacing: 0.04em;
	}

	.it-mrk.egen {
		background: var(--plum);
		color: #fff;
	}

	.it-naering {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
		margin-top: 6px;
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--ink-3);
	}

	.it-naering strong {
		color: var(--espresso);
		font-size: calc(12.5px * var(--fs-scale, 1));
	}

	.it-fejl {
		margin-top: 6px;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--ler-tekst);
		font-weight: 600;
		line-height: 1.4;
	}

	.it-detalje {
		padding: 0 13px 12px;
		border-top: 1px solid var(--line);
		padding-top: 10px;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--ink-2);
		line-height: 1.5;
	}

	.it-d-linje {
		margin-bottom: 6px;
	}

	.it-d-mrk {
		display: block;
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 700;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--ink-3);
	}

	.it-hjaelp {
		margin-top: 4px;
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--ink-3);
		line-height: 1.45;
	}

	.it-retter {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 8px;
		margin-top: 2px;
	}

	.it-ret-link {
		color: var(--plum);
		font-weight: 600;
		text-decoration: underline;
	}

	.it-vej {
		display: inline-block;
		margin-top: 4px;
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--plum);
	}

	.it-fod {
		margin: 18px 0 0;
		padding: 0 17px;
		font-size: calc(10.5px * var(--fs-scale, 1));
		color: var(--ink-3);
		line-height: 1.5;
	}
</style>
