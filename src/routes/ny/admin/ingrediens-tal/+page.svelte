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
	// SIDEN SKRIVER TO STEDER. Et rettet naeringstal skrives paa
	// foedevaren, se ingrediensRettelse3, og fluebenet "gennemgaaet"
	// skrives for sig, se ingrediensGennemgang3. Opskrifterne og
	// koblingerne laeses kun.
	//
	// FLUEBENET er Linns oenske 1. september 2026: hun kunne se hvad der
	// var RETTET, men ikke hvad der var SET EFTER og fundet i orden, og
	// det er dét der afgoer hvor hun fortsaetter i morgen.
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
	import { ALLE_KATEGORIER, KATEGORI_LABELS, type OpskriftKategori } from '$lib/content/opskrifter';
	import {
		byggOversigt,
		filtrerOversigt,
		opgoerelse,
		type IngrediensRaekke
	} from '$lib/content/ingrediensOversigt3';
	import type { KoblingsOpslag } from '$lib/content/opskriftMakro3';
	import {
		valider,
		advarsler,
		talFra,
		noget,
		type Fejl,
		type RettbarVare,
		type RettedeTal
	} from '$lib/content/ingrediensRettelse3';
	import { retFodevare, fortrydRettelse } from '$lib/firestore/ingrediensRettelse3';
	import {
		antalGennemgaaet,
		datoTekst,
		erGennemgaaet,
		fjernGennemgaaet,
		kunIkkeGennemgaaede,
		markerGennemgaaet,
		type Gennemgangskort
	} from '$lib/content/ingrediensGennemgang3';
	import {
		gemGennemgaaet,
		hentGennemgang,
		sletGennemgaaet
	} from '$lib/firestore/ingrediensGennemgang3';
	import type { Opskrift } from '$lib/content/opskrifter';
	import type { Aendring } from '$lib/content/ingrediensRettelse3';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import Sidehoved from '$lib/components/ny/Sidehoved.svelte';

	const hentUser = getContext<() => User | null>('user');
	const maaVaereHer = $derived(isAdmin(hentUser()));

	let henter = $state(true);
	let besked = $state('');
	let alle = $state<IngrediensRaekke[]>([]);

	// Grundlaget bliver liggende, saa en rettelse kan regne opskrifterne om
	// uden at hente 2.268 raekker en gang til.
	let opskrifter: Opskrift[] = [];
	let koblinger: Record<string, KoblingsOpslag> = {};
	let varer = new Map<string, Fodevare>();

	// Rettelsen. Der rettes ÉN ad gangen, med vilje: skaermen skal sige
	// hoejt hvad den ene rettelse goer, og det kan den ikke hvis der ligger
	// fem halve aendringer.
	let retter = $state('');
	let felter = $state<RettedeTal>({ p: null, f: null, kh: null, fedt: null, kcal: null });
	let note = $state('');
	let gemmer = $state(false);
	let gemFejl = $state('');
	let kvittering = $state<{ navn: string; aendrede: Aendring[]; linjerSkrevet: number } | null>(
		null
	);

	let soeg = $state('');
	let valgteKategorier = $state<OpskriftKategori[]>([]);
	let kunMedFejl = $state(false);
	let aaben = $state('');

	// Fluebenene. Skaermen viser markeringen med det samme og skriver
	// bagefter, for det er ét lille felt, og Linn skal kunne klikke sig
	// gennem en lang liste uden at vente paa netvaerket hver gang.
	let gennemgang = $state<Gennemgangskort>({});
	let kunIkkeGennemgaaet = $state(false);
	let markerer = $state('');
	let markerFejl = $state('');

	onMount(() => {
		(async () => {
			try {
				const [opskrifterListe, varerListe, kort, sete] = await Promise.all([
					hentAlleOpskrifter(false),
					hentFodevarer3(),
					hentKoblinger(),
					hentGennemgang()
				]);
				gennemgang = sete;
				varer = new Map<string, Fodevare>(varerListe.map((v) => [v.id, v]));
				const enkel: Record<string, KoblingsOpslag> = {};
				for (const [k, v] of Object.entries(kort)) {
					enkel[k] = { foodId: v.foodId, egenVare: v.egenVare };
				}
				opskrifter = opskrifterListe;
				koblinger = enkel;
				alle = byggOversigt(opskrifterListe, enkel, varer);
			} catch (e) {
				console.error('[admin] kunne ikke hente ingrediens-tallene', e);
				besked = 'Kunne ikke hente. Prøv at hente siden igen.';
			} finally {
				henter = false;
			}
		})();
	});

	const synlige = $derived.by(() => {
		const r = filtrerOversigt(alle, soeg, valgteKategorier, kunMedFejl);
		return kunIkkeGennemgaaet ? kunIkkeGennemgaaede(r, gennemgang) : r;
	});
	const tal = $derived(opgoerelse(alle));
	const seteIalt = $derived(antalGennemgaaet(alle, gennemgang));

	/**
	 * Saetter eller fjerner fluebenet.
	 *
	 * Skaermen opdateres foerst. Gaar skrivningen galt, ruller vi tilbage
	 * og siger det, saa der ikke staar et flueben der kun findes her.
	 */
	async function skiftGennemgaaet(kerne: string) {
		if (markerer) return;
		const foer = gennemgang;
		const harFlueben = erGennemgaaet(gennemgang, kerne);
		const uid = hentUser()?.uid ?? 'admin';
		markerer = kerne;
		markerFejl = '';
		gennemgang = harFlueben
			? fjernGennemgaaet(gennemgang, kerne)
			: markerGennemgaaet(gennemgang, kerne, uid);
		try {
			if (harFlueben) await sletGennemgaaet(kerne, uid);
			else await gemGennemgaaet(kerne, uid);
		} catch (e) {
			console.error('[admin] kunne ikke gemme markeringen', e);
			gennemgang = foer;
			markerFejl = 'Kunne ikke gemme markeringen. Prøv igen.';
		} finally {
			markerer = '';
		}
	}

	function toggleKategori(k: OpskriftKategori) {
		valgteKategorier = valgteKategorier.includes(k)
			? valgteKategorier.filter((v) => v !== k)
			: [...valgteKategorier, k];
	}

	function etTal(x: number | null): string {
		if (x === null) return '—';
		return (Math.round(x * 10) / 10).toString().replace('.', ',');
	}

	const fejlliste = $derived<Fejl[]>(retter ? valider(felter, note) : []);
	const advarselliste = $derived<string[]>(retter ? advarsler(felter) : []);
	const raekkeDerRettes = $derived(alle.find((r) => r.kerne === retter) ?? null);
	const harAendret = $derived.by(() => {
		const v = raekkeDerRettes?.vare as RettbarVare | null | undefined;
		return v ? noget(talFra(v), felter) : false;
	});

	function fejlFor(f: Fejl['felt']): string {
		return fejlliste.find((x) => x.felt === f)?.tekst ?? '';
	}

	function aabnRettelse(r: IngrediensRaekke) {
		const v = r.vare as RettbarVare | null;
		if (!v) return;
		retter = r.kerne;
		felter = talFra(v);
		note = '';
		gemFejl = '';
		kvittering = null;
	}

	function lukRettelse() {
		retter = '';
		gemFejl = '';
	}

	/** Bygger listen forfra, saa skaermen viser det der nu staar i databasen. */
	function byggForfra() {
		alle = byggOversigt(opskrifter, koblinger, varer);
	}

	async function gem(r: IngrediensRaekke) {
		const v = r.vare as RettbarVare | null;
		if (!v || gemmer) return;
		if (fejlliste.length > 0) return;
		gemmer = true;
		gemFejl = '';
		try {
			const res = await retFodevare(
				v,
				felter,
				note,
				opskrifter,
				koblinger,
				varer,
				hentUser()?.uid ?? 'admin'
			);
			byggForfra();
			kvittering = { navn: v.name, aendrede: res.aendrede, linjerSkrevet: res.linjerSkrevet };
			retter = '';
		} catch (e) {
			console.error('[admin] kunne ikke rette tallet', e);
			// Bemaerk ordlyden. Gaar omregningen galt EFTER at varen er
			// skrevet, staar de to kilder og er uenige, og saa skal det siges
			// hoejt i stedet for at ligne en fejl der ikke skete.
			gemFejl =
				'Kunne ikke gemme hele vejen. Tjek tallet på varen, og hent siden igen før du retter mere.';
		} finally {
			gemmer = false;
		}
	}

	async function fortryd(r: IngrediensRaekke) {
		const v = r.vare as RettbarVare | null;
		if (!v || gemmer) return;
		gemmer = true;
		gemFejl = '';
		try {
			const res = await fortrydRettelse(
				v,
				opskrifter,
				koblinger,
				varer,
				hentUser()?.uid ?? 'admin'
			);
			byggForfra();
			if (res)
				kvittering = { navn: v.name, aendrede: res.aendrede, linjerSkrevet: res.linjerSkrevet };
			retter = '';
		} catch (e) {
			console.error('[admin] kunne ikke fortryde', e);
			gemFejl = 'Kunne ikke fortryde. Hent siden igen.';
		} finally {
			gemmer = false;
		}
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
				<div class="it-tal-boks sete">
					<strong>{seteIalt} af {tal.ialt}</strong> gennemgået
				</div>
				<div class="it-tal-boks" class:advarsel={tal.udenKobling > 0}>
					<strong>{tal.udenKobling}</strong> uden kobling
				</div>
				<div class="it-tal-boks" class:advarsel={tal.manglerKalorier > 0}>
					<strong>{tal.manglerKalorier}</strong> mangler kalorier
				</div>
			</div>
			<p class="it-note">
				En ingrediens står kun én gang, uanset hvor mange opskrifter den er i. Retter du tallet her,
				gælder det dem alle. Tør og kogt står hver for sig, for tallene ligger langt fra hinanden.
			</p>
		</div>

		{#if besked}<p class="it-besked">{besked}</p>{/if}
		{#if markerFejl}<p class="it-besked">{markerFejl}</p>{/if}

		{#if kvittering}
			<div class="it-kvit">
				<strong>{kvittering.navn} er rettet.</strong>
				{#if kvittering.aendrede.length === 0}
					Ingen opskrifter flyttede sig.
				{:else}
					{kvittering.aendrede.length}
					{kvittering.aendrede.length === 1 ? 'opskrift' : 'opskrifter'} blev regnet om:
					<ul class="it-kvit-liste">
						{#each kvittering.aendrede as a (a.opskriftId)}
							<li>
								{a.titel}: protein {a.foerProtein} → {a.efterProtein} g, {a.foerKalorier} →
								{a.efterKalorier} kcal
							</li>
						{/each}
					</ul>
				{/if}
				{#if kvittering.linjerSkrevet > 0}
					<p class="it-kvit-linjer">
						Makro-linjen i teksten er skrevet om i {kvittering.linjerSkrevet}
						{kvittering.linjerSkrevet === 1 ? 'opskrift' : 'opskrifter'}, så den gamle app og 3.0
						står ens.
					</p>
				{/if}
				<button type="button" class="it-kvit-luk" onclick={() => (kvittering = null)}>Luk</button>
			</div>
		{/if}

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
			<button
				type="button"
				class="it-chip sete"
				class:paa={kunIkkeGennemgaaet}
				onclick={() => (kunIkkeGennemgaaet = !kunIkkeGennemgaaet)}
			>
				Ikke gennemgået
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
								{#if erGennemgaaet(gennemgang, r.kerne)}
									<span class="it-set">✓ Gennemgået</span>
								{/if}
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

								<!-- Fluebenet staar sammen med rettelsen, og det gaelder ogsaa
								     de raekker der IKKE har en madvare. De er netop dem der skal
								     ses efter foerst, og de skal kunne markeres som set. -->
								{#if retter !== r.kerne}
									<div class="it-ret-rad">
										{#if r.vare}
											<button type="button" class="it-ret-knap" onclick={() => aabnRettelse(r)}>
												Ret næringstallene
											</button>
										{/if}
										<button
											type="button"
											class="it-set-knap"
											class:af={erGennemgaaet(gennemgang, r.kerne)}
											disabled={markerer === r.kerne}
											onclick={() => skiftGennemgaaet(r.kerne)}
										>
											{#if erGennemgaaet(gennemgang, r.kerne)}
												Fjern markeringen
											{:else}
												✓ Marker som gennemgået
											{/if}
										</button>
										{#if r.vare && (r.vare as RettbarVare).linnRettet}
											<span class="it-rettet">Rettet af dig</span>
										{/if}
									</div>
									{#if gennemgang[r.kerne]}
										<p class="it-set-linje">
											✓ Gennemgået {gennemgang[r.kerne].af === (hentUser()?.uid ?? 'admin')
												? 'af dig'
												: ''}
											{datoTekst(gennemgang[r.kerne].naar)}
										</p>
									{/if}
									{#if r.vare && (r.vare as RettbarVare).linnNote}
										<p class="it-note-vist">
											Din note: {(r.vare as RettbarVare).linnNote}
										</p>
									{/if}
								{/if}

								{#if r.vare}
									{#if retter === r.kerne}
										<div class="it-form">
											<p class="it-form-advarsel">
												Tallene hører til madvaren <strong>{r.varenavn}</strong>, ikke kun til denne
												ingrediens. Retter du dem, gælder de i alle
												{r.antalOpskrifter}
												{r.antalOpskrifter === 1 ? 'opskrift' : 'opskrifter'} der bruger den, og kunderne
												får det nye tal når de taster varen ind fremover. Det de allerede har registreret
												ændrer sig ikke.
											</p>

											<div class="it-felter">
												{#each [['p', 'Protein'], ['f', 'Fiber'], ['kh', 'Kulhydrat'], ['fedt', 'Fedt'], ['kcal', 'Kalorier']] as [n, mrk] (n)}
													<label class="it-felt">
														<span>{mrk}</span>
														<input
															type="number"
															step="0.1"
															min="0"
															disabled={gemmer}
															bind:value={felter[n as keyof RettedeTal]}
														/>
														{#if fejlFor(n as keyof RettedeTal)}
															<em>{fejlFor(n as keyof RettedeTal)}</em>
														{/if}
													</label>
												{/each}
											</div>
											<p class="it-form-hint">
												Alle tal er pr 100 gram. Kulhydrat, fedt og kalorier må stå tomme. Lad dem
												hellere være tomme end at skrive nul, for nul betyder at varen ikke
												indeholder noget.
											</p>

											<label class="it-felt bred">
												<span>Hvorfor retter du tallet</span>
												<input
													type="text"
													placeholder="Fx: DTU har kun med skind, dansk butiksvare er magrere"
													disabled={gemmer}
													bind:value={note}
												/>
												{#if fejlFor('note')}<em>{fejlFor('note')}</em>{/if}
											</label>
											<p class="it-form-hint">
												Noten står kun her i admin. Kunden ser den aldrig, hun ser kun tallet.
											</p>

											{#if advarselliste.length > 0}
												<div class="it-form-tjek">
													{#each advarselliste as a (a)}<span>{a}</span>{/each}
													<em>Du kan godt gemme alligevel.</em>
												</div>
											{/if}

											{#if gemFejl}<div class="it-form-fejl">{gemFejl}</div>{/if}

											<div class="it-form-knapper">
												<button
													type="button"
													class="it-gem"
													disabled={gemmer || fejlliste.length > 0 || !harAendret}
													onclick={() => gem(r)}
												>
													{gemmer ? 'Gemmer og regner om...' : 'Gem og regn opskrifterne om'}
												</button>
												<button
													type="button"
													class="it-annuller"
													disabled={gemmer}
													onclick={lukRettelse}
												>
													Annuller
												</button>
												{#if (r.vare as RettbarVare).foerRettelse}
													<button
														type="button"
														class="it-annuller"
														disabled={gemmer}
														onclick={() => fortryd(r)}
													>
														Sæt tilbage til det oprindelige
													</button>
												{/if}
											</div>
											{#if !harAendret}
												<p class="it-form-hint">Ret et tal før du kan gemme.</p>
											{/if}
										</div>
									{/if}
								{/if}
							</div>
						{/if}
					</article>
				{/each}
			</div>
		{/if}

		<p class="it-fod">
			Tallene kommer fra Den Danske Fødevaredatabase fra DTU Fødevareinstituttet, undtagen dem der
			står med Egne tal. Kunden ser aldrig hvor tallet kommer fra, kun selve tallet.
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
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
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
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-2);
		white-space: nowrap;
	}

	.it-tal-boks strong {
		display: block;
		font-size: calc(17px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--espresso);
	}

	.it-tal-boks.advarsel strong {
		color: var(--ler-tekst);
	}

	.it-note {
		margin: 8px 0 0;
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
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
		font-size: calc(13.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
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
		font-size: calc(12.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
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
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3);
	}

	/* FLERE SOEJLER NAAR DER ER PLADS. Én lang stribe paa en bred skaerm
	   betoed, at man saa faa ad gangen og resten var tom plads til
	   hoejre. Paa en smal skaerm bliver det én soejle igen af sig selv. */
	.it-liste {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
		gap: 8px;
		align-content: start;
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
		flex-wrap: wrap;
		gap: 8px;
	}

	.it-h-navn h2 {
		margin: 0;
		font-size: calc(14.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
		color: var(--espresso);
	}

	.it-brug {
		flex-shrink: 0;
		font-size: calc(11px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3);
	}

	.it-vare {
		margin-top: 3px;
		font-size: calc(12px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-2);
	}

	.it-mrk {
		display: inline-block;
		margin-left: 6px;
		padding: 1px 7px;
		border-radius: 99px;
		font-size: calc(10px * var(--fs-scale, 1) * var(--adm-skala, 1));
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
		font-size: calc(11px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3);
	}

	.it-naering strong {
		color: var(--espresso);
		font-size: calc(12.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
	}

	.it-fejl {
		margin-top: 6px;
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ler-tekst);
		font-weight: 600;
		line-height: 1.4;
	}

	.it-detalje {
		padding: 0 13px 12px;
		border-top: 1px solid var(--line);
		padding-top: 10px;
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-2);
		line-height: 1.5;
	}

	.it-d-linje {
		margin-bottom: 6px;
	}

	.it-d-mrk {
		display: block;
		font-size: calc(10px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 700;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--ink-3);
	}

	.it-hjaelp {
		margin-top: 4px;
		font-size: calc(11px * var(--fs-scale, 1) * var(--adm-skala, 1));
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
		font-size: calc(12px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
		color: var(--plum);
	}

	.it-kvit {
		margin: 10px 17px;
		padding: 12px 14px;
		background: var(--sage-tint);
		border: 1px solid var(--sage);
		border-radius: 12px;
		font-size: calc(12px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--sage-tekst);
		line-height: 1.5;
	}

	.it-kvit-liste {
		margin: 6px 0 0;
		padding-left: 18px;
	}

	.it-kvit-linjer {
		margin: 10px 0 0;
		font-size: calc(13px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--text2);
	}

	.it-kvit-luk {
		margin-top: 8px;
		padding: 6px 12px;
		background: var(--paper);
		border: 1px solid var(--sage);
		border-radius: 99px;
		color: var(--sage-tekst);
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-family: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.it-ret-rad {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 8px;
	}

	.it-ret-knap {
		padding: 8px 14px;
		background: var(--plum);
		border: 1px solid var(--plum);
		border-radius: 99px;
		color: #fff;
		font-size: calc(12.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-family: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.it-rettet {
		padding: 2px 9px;
		background: var(--honey-tint);
		border-radius: 99px;
		font-size: calc(10.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 700;
		color: var(--honey-deep);
	}

	.it-note-vist {
		margin: 6px 0 0;
		font-size: calc(11px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3);
		line-height: 1.45;
	}

	.it-form {
		margin-top: 10px;
		padding: 12px;
		background: var(--paper-2);
		border: 1px solid var(--line);
		border-radius: 12px;
	}

	/* Den her linje er hele grunden til at rettelsen ikke kan ske ved et
	   uheld. Den skal blive staaende. */
	.it-form-advarsel {
		margin: 0 0 10px;
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--espresso);
		line-height: 1.5;
	}

	.it-felter {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.it-felt {
		display: flex;
		flex-direction: column;
		gap: 3px;
		flex: 1 1 90px;
	}

	.it-felt.bred {
		flex-basis: 100%;
		margin-top: 10px;
	}

	.it-felt span {
		font-size: calc(10.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 700;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--ink-3);
	}

	.it-felt input {
		padding: 9px 10px;
		background: var(--paper);
		border: 1px solid var(--line);
		border-radius: 9px;
		color: var(--espresso);
		font-size: calc(13px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-family: inherit;
		width: 100%;
		box-sizing: border-box;
	}

	.it-felt em {
		font-size: calc(10.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ler-tekst);
		font-style: normal;
		font-weight: 600;
	}

	.it-form-hint {
		margin: 8px 0 0;
		font-size: calc(10.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3);
		line-height: 1.45;
	}

	.it-form-tjek {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin-top: 10px;
		padding: 9px 11px;
		background: var(--honey-tint);
		border-radius: 9px;
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--honey-deep);
		font-weight: 600;
	}

	.it-form-tjek em {
		font-style: normal;
		font-weight: 400;
	}

	.it-form-fejl {
		margin-top: 10px;
		padding: 9px 11px;
		background: var(--ler-tint);
		border-radius: 9px;
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ler-tekst);
		font-weight: 600;
		line-height: 1.45;
	}

	.it-form-knapper {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 12px;
	}

	.it-gem {
		padding: 10px 16px;
		background: var(--plum);
		border: 1px solid var(--plum);
		border-radius: 99px;
		color: #fff;
		font-size: calc(12.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-family: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.it-gem:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.it-annuller {
		padding: 10px 16px;
		background: var(--paper);
		border: 1px solid var(--line);
		border-radius: 99px;
		color: var(--ink-2);
		font-size: calc(12.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-family: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.it-fod {
		margin: 18px 0 0;
		padding: 0 17px;
		font-size: calc(10.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3);
		line-height: 1.5;
	}

	/* Gennemgaaet. Sage er husets farve for noget der er faldet paa
	   plads, se ny.css. Den maa ikke ligne en advarsel. */
	.it-tal-boks.sete {
		border-color: var(--sage);
		background: var(--sage-tint);
		color: var(--sage-tekst);
	}

	.it-tal-boks.sete strong {
		color: var(--sage-tekst);
	}

	.it-chip.sete.paa {
		border-color: var(--sage);
		background: var(--sage-tint);
		color: var(--sage-tekst);
	}

	.it-set {
		flex-shrink: 0;
		padding: 2px 8px;
		border: 1px solid var(--sage);
		border-radius: 999px;
		background: var(--sage-tint);
		font-size: calc(10.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
		color: var(--sage-tekst);
		white-space: nowrap;
	}

	.it-set-knap {
		padding: 9px 13px;
		border: 1px solid var(--sage);
		border-radius: 12px;
		background: var(--sage-tint);
		font-size: calc(13px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
		color: var(--sage-tekst);
		cursor: pointer;
	}

	/* Naar fluebenet allerede staar, er det at TAGE det af der er den
	   sjaeldne handling. Saa skal knappen ikke raabe. */
	.it-set-knap.af {
		border-color: var(--line);
		background: transparent;
		font-weight: 400;
		color: var(--ink-2);
	}

	.it-set-knap:disabled {
		opacity: 0.5;
	}

	.it-set-linje {
		margin: 8px 0 0;
		padding: 7px 10px;
		border-radius: 10px;
		background: var(--sage-tint);
		font-size: calc(12px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--sage-tekst);
	}
</style>
