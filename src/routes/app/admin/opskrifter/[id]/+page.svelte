<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		ALLE_DIET_TAGS,
		ALLE_KATEGORIER,
		DIET_LABELS,
		KATEGORI_LABELS,
		parseOpskriftMakro,
		type DietTag,
		type Ingrediens,
		type Opskrift,
		type OpskriftKategori
	} from '$lib/content/opskrifter';
	import {
		gemOpskrift,
		hentOpskrift,
		saetOpskriftGodkendt,
		sletOpskrift
	} from '$lib/firestore/opskrifter';
	import { byggMakroLinje, skrivMakroLinje, tidenILinjen } from '$lib/content/makroLinje';
	// Regnemaskinen fra august. Rene funktioner der KUN laeser, se
	// opskriftMakro3.ts. Den skriver aldrig i opskrifterne, og den bruges her
	// praecis som paa admin-siden i 3.0, saa de to aldrig kan sige forskellige
	// ting om den samme ret.
	import {
		afrund,
		afvigelse,
		regnOpskrift,
		tilliden,
		type IngrediensLinje,
		type KoblingsOpslag,
		type OpskriftBeregning
	} from '$lib/content/opskriftMakro3';
	import { listenErSkrevetTil } from '$lib/content/opskriftPortion3';
	import { hentAlleFodevarer } from '$lib/firestore/kost';
	import { hentKoblinger } from '$lib/firestore/ingrediensKobling3';
	import type { Fodevare } from '$lib/content/kost';
	import Icon from '$lib/components/Icon.svelte';

	const opskriftId = $derived(page.params.id ?? '');

	let original = $state<Opskrift | null>(null);

	let formTitel = $state('');
	let formBeskrivelse = $state('');
	let formBilledeUrl = $state('');
	let formKategorier = $state<OpskriftKategori[]>([]);
	let formDietTags = $state<DietTag[]>([]);
	let formDefaultPortioner = $state(4);
	let formIngredienser = $state<Ingrediens[]>([]);
	let formInstruktioner = $state('');
	// Makro som EGNE felter. De skriver linjen nederst i fremgangsmaaden,
	// som begge apps laeser. Se content/makroLinje.ts. Linns oenske 31.
	// august 2026: admin skal kunne rette makro uden at ramme et format i
	// fritekst.
	let formProtein = $state<number | null>(null);
	let formFiber = $state<number | null>(null);
	let formKh = $state<number | null>(null);
	let formFedt = $state<number | null>(null);
	let formKalorier = $state<number | null>(null);
	// Tiden staar i samme linje. Vi laeser den for at kunne skrive den
	// tilbage uroert.
	let formTid = $state('');

	// Live-aflæsning af makro fra instruktioner-feltet, saa admin med det samme
	// kan se om makroen kan parses (kunderne ser '—' hvis ikke). Protein, fiber
	// og kalorier er de "vigtige" felter 30-30-3 viser.
	const makroFelter = $derived({
		protein: formProtein,
		fiber: formFiber,
		kh: formKh,
		fedt: formFedt,
		kalorier: formKalorier
	});
	/** Linjen som den kommer til at staa, naar du gemmer. */
	const kommendeLinje = $derived(byggMakroLinje(makroFelter, formTid.trim() || null));
	const makroAflaest = $derived(makroFelter);
	const makroMangler = $derived(
		makroAflaest.protein === null || makroAflaest.fiber === null || makroAflaest.kalorier === null
	);
	const makroResume = $derived(
		[
			`Protein ${makroAflaest.protein ?? '—'} g`,
			`Fiber ${makroAflaest.fiber ?? '—'} g`,
			`Kulhydrat ${makroAflaest.kh ?? '—'} g`,
			`Fedt ${makroAflaest.fedt ?? '—'} g`,
			`Kalorier ${makroAflaest.kalorier ?? '—'} kcal`
		].join(' · ')
	);
	let formAktiv = $state(false);

	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let gemmer = $state(false);
	let gemFejl = $state<string | null>(null);
	let gemKvit = $state(false);
	let bekraefter = $state(false);
	let sletter = $state(false);

	// Godkendelsen er Linns eget flueben og har intet med 'aktiv' at goere.
	// Den gemmes med det samme og foelger derfor IKKE Gem-knappen: to ting der
	// gemmes hver sin vej paa samme skaerm er forvirrende, og fluebenet skal
	// virke ens her og i listen.
	let godkendt = $state(false);
	let gemmerGodkendt = $state(false);
	let godkendFejl = $state<string | null>(null);

	// ============================================================
	// Naeringstal pr ingrediens.
	//
	// Regnes paa de felter der staar paa skaermen lige nu, og ikke paa det
	// der ligger i databasen. Retter du en maengde, foelger tallene med med
	// det samme. Der SKRIVES ingenting: makro-felterne ovenfor er dine, og
	// Linns regel er at intet regnes om automatisk.
	//
	// Foedevarerne hentes med den GAMLE apps egen indgang, saa den her side
	// ikke faar sin egen kopi af 2.268 raekker ved siden af den appen har i
	// forvejen. Kun selve regnestykket kommer fra 3.0's filer, og de laeser
	// kun.
	// ============================================================
	let varer = $state<Map<string, Fodevare> | null>(null);
	let koblinger = $state<Record<string, KoblingsOpslag> | null>(null);
	let henterTal = $state(true);
	let talFejl = $state<string | null>(null);

	async function hentGrundlag() {
		henterTal = true;
		talFejl = null;
		try {
			const [liste, kort] = await Promise.all([hentAlleFodevarer(), hentKoblinger()]);
			const enkel: Record<string, KoblingsOpslag> = {};
			for (const [k, v] of Object.entries(kort)) {
				enkel[k] = { foodId: v.foodId, egenVare: v.egenVare };
			}
			varer = new Map(liste.map((v) => [v.id, v]));
			koblinger = enkel;
		} catch (e) {
			console.error(e);
			talFejl = 'Kunne ikke hente næringsdata. Resten af siden virker.';
		} finally {
			henterTal = false;
		}
	}

	const beregning = $derived.by<OpskriftBeregning | null>(() => {
		if (!varer || !koblinger) return null;
		return regnOpskrift(
			{
				id: opskriftId,
				titel: formTitel,
				ingredienser: formIngredienser,
				defaultPortioner: formDefaultPortioner
			},
			koblinger,
			varer
		);
	});

	/** Linjerne i samme raekkefoelge som felterne, saa de kan staa side om side. */
	const linjer = $derived<IngrediensLinje[]>(beregning?.linjer ?? []);

	const ialt = $derived(beregning ? afrund(beregning.ialt) : null);
	const prPortion = $derived(beregning ? afrund(beregning.prPortion) : null);

	// Listen er skrevet til det antal portioner der staar i feltet. Er det 1,
	// er hele retten og én portion det samme tal, og saa er der ingen grund
	// til at skrive det to gange.
	const flerePortioner = $derived(listenErSkrevetTil(formDefaultPortioner) > 1);

	/**
	 * Hvor langt det beregnede ligger fra det du selv har skrevet.
	 * Sammenlignes altid PR PORTION, for det er det makro-felterne er.
	 */
	const afvig = $derived.by(() => {
		if (!prPortion) return null;
		return {
			protein: afvigelse(prPortion.protein, formProtein),
			fiber: afvigelse(prPortion.fiber, formFiber),
			kh: afvigelse(prPortion.kh, formKh),
			fedt: afvigelse(prPortion.fedt, formFedt),
			kalorier: afvigelse(prPortion.kalorier, formKalorier)
		};
	});

	function etTal(x: number): string {
		return (Math.round(x * 10) / 10).toString().replace('.', ',');
	}

	function afvigTekst(pct: number | null): string {
		if (pct === null) return '';
		if (pct === 0) return 'passer';
		return pct > 0 ? `${pct} % mere` : `${Math.abs(pct)} % mindre`;
	}

	/** Teksten paa en linje der ikke kunne regnes. Aldrig et stille nul. */
	function mangelTekst(l: IngrediensLinje): string {
		if (l.uden_betydning) return 'Tæller ikke med';
		if (l.mangel === 'ingen kobling') return 'Ingen kobling, tælles ikke med';
		if (l.mangel === 'varen findes ikke') return 'Varen findes ikke længere';
		if (l.mangel === 'varen mangler tal') return 'Varen mangler kalorietal';
		return '';
	}

	async function toggleGodkendt() {
		if (gemmerGodkendt) return;
		gemmerGodkendt = true;
		godkendFejl = null;
		const ny = !godkendt;
		try {
			await saetOpskriftGodkendt(opskriftId, ny);
			godkendt = ny;
		} catch (e) {
			console.error(e);
			godkendFejl = 'Kunne ikke gemme godkendelsen. Prøv igen.';
		} finally {
			gemmerGodkendt = false;
		}
	}

	onMount(async () => {
		try {
			const o = await hentOpskrift(opskriftId);
			if (!o) {
				fejl = 'Opskriften findes ikke.';
				loading = false;
				return;
			}
			original = o;
			formTitel = o.titel;
			formBeskrivelse = o.beskrivelse;
			formBilledeUrl = o.billedeUrl ?? '';
			formKategorier = [...o.kategorier];
			formDietTags = [...(o.dietTags ?? [])];
			formDefaultPortioner = o.defaultPortioner;
			formIngredienser = o.ingredienser.map((i) => ({ ...i }));
			formInstruktioner = o.instruktioner;
			const m = parseOpskriftMakro(o.instruktioner);
			formProtein = m.protein;
			formFiber = m.fiber;
			formKh = m.kh;
			formFedt = m.fedt;
			formKalorier = m.kalorier;
			formTid = tidenILinjen(o.instruktioner) ?? '';
			formAktiv = o.aktiv;
			godkendt = o.godkendt === true;
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente opskriften.';
		} finally {
			loading = false;
		}
		// Hentes FOR SIG, efter opskriften. De 2.268 foedevarer tager tid, og
		// redigeringen maa ikke vente paa dem. Gaar det galt, staar der en
		// linje om det og resten af siden virker som foer.
		hentGrundlag();
	});

	function toggleKategori(k: OpskriftKategori) {
		if (formKategorier.includes(k)) {
			formKategorier = formKategorier.filter((x) => x !== k);
		} else {
			formKategorier = [...formKategorier, k];
		}
	}

	function toggleDietTag(t: DietTag) {
		if (formDietTags.includes(t)) {
			formDietTags = formDietTags.filter((x) => x !== t);
		} else {
			formDietTags = [...formDietTags, t];
		}
	}

	function tilfoejIngrediens() {
		formIngredienser = [...formIngredienser, { navn: '', maengde: 0, enhed: 'g' }];
	}

	function fjernIngrediens(index: number) {
		formIngredienser = formIngredienser.filter((_, i) => i !== index);
	}

	function flytIngrediens(index: number, retning: -1 | 1) {
		const ny = index + retning;
		if (ny < 0 || ny >= formIngredienser.length) return;
		const opdateret = [...formIngredienser];
		[opdateret[index], opdateret[ny]] = [opdateret[ny], opdateret[index]];
		formIngredienser = opdateret;
	}

	async function gem() {
		gemFejl = null;
		gemKvit = false;
		const titel = formTitel.trim();
		if (!titel) {
			gemFejl = 'Opskriften skal have en titel.';
			return;
		}
		if (formDefaultPortioner < 1) {
			gemFejl = 'Default portioner skal være mindst 1.';
			return;
		}
		gemmer = true;
		try {
			const renseIngredienser = formIngredienser
				.map((i) => ({
					navn: i.navn.trim(),
					maengde: Number(i.maengde) || 0,
					enhed: i.enhed.trim()
				}))
				.filter((i) => i.navn);
			await gemOpskrift({
				id: opskriftId,
				titel,
				beskrivelse: formBeskrivelse.trim(),
				billedeUrl: formBilledeUrl.trim() || null,
				kategorier: formKategorier,
				dietTags: formDietTags,
				defaultPortioner: formDefaultPortioner,
				ingredienser: renseIngredienser,
				instruktioner: skrivMakroLinje(
					formInstruktioner.trim(),
					makroFelter,
					formTid.trim() || null
				),
				aktiv: formAktiv
			});
			gemKvit = true;
			setTimeout(() => (gemKvit = false), 2000);
		} catch (e) {
			console.error(e);
			gemFejl = 'Kunne ikke gemme. Prøv igen.';
		} finally {
			gemmer = false;
		}
	}

	async function slet() {
		if (!bekraefter) {
			bekraefter = true;
			return;
		}
		sletter = true;
		try {
			await sletOpskrift(opskriftId);
			goto('/app/admin/opskrifter');
		} catch (e) {
			console.error(e);
			gemFejl = 'Kunne ikke slette opskriften.';
			sletter = false;
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin/opskrifter">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Opskrifter</span>
		</a>
		<div class="eyebrow">Admin · Opskrifter</div>
		<h1>{formTitel || 'Ny opskrift'}</h1>
	</header>

	{#if loading}
		<div class="status-besked">Henter opskrift...</div>
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if original}
		<section class="card">
			<div class="form-titel">Generelt</div>

			<label class="felt">
				<span class="felt-label">Titel</span>
				<input type="text" bind:value={formTitel} disabled={gemmer} />
			</label>

			<label class="felt">
				<span class="felt-label">Beskrivelse</span>
				<textarea
					class="textarea"
					bind:value={formBeskrivelse}
					rows="3"
					disabled={gemmer}
					placeholder="Kort beskrivelse der vises på opskriftens detalje-side..."
				></textarea>
			</label>

			<label class="felt">
				<span class="felt-label">Billede-URL</span>
				<input type="url" bind:value={formBilledeUrl} disabled={gemmer} placeholder="https://..." />
				<span class="felt-hint">
					Brug en hosted URL for nu. Upload via Firebase Storage tilføjes senere.
				</span>
			</label>

			<div class="felt">
				<span class="felt-label">Kategorier</span>
				<div class="chip-rad">
					{#each ALLE_KATEGORIER as k (k)}
						<button
							type="button"
							class="chip"
							class:aktiv={formKategorier.includes(k)}
							onclick={() => toggleKategori(k)}
							disabled={gemmer}
						>
							{KATEGORI_LABELS[k]}
						</button>
					{/each}
				</div>
			</div>

			<div class="felt">
				<span class="felt-label">Diæt-tags</span>
				<div class="chip-rad">
					{#each ALLE_DIET_TAGS as t (t)}
						<button
							type="button"
							class="chip"
							class:aktiv={formDietTags.includes(t)}
							onclick={() => toggleDietTag(t)}
							disabled={gemmer}
						>
							{DIET_LABELS[t]}
						</button>
					{/each}
				</div>
			</div>

			<label class="felt">
				<span class="felt-label">Default antal portioner</span>
				<input type="number" min="1" max="20" bind:value={formDefaultPortioner} disabled={gemmer} />
				<span class="felt-hint">Brugeren kan justere op/ned, og mængderne skaleres.</span>
			</label>

			<label class="checkbox-rad">
				<input type="checkbox" bind:checked={formAktiv} disabled={gemmer} />
				<span>Aktiv (synlig for brugerne)</span>
			</label>
		</section>

		<section class="card">
			<div class="form-titel">Ingredienser</div>
			<p class="hint">
				Mængder er for default-portioner ovenfor. Klienten kan skalere ved at justere
				portion-tællen.
			</p>
			{#each formIngredienser as ing, i (i)}
				<div class="ing-form">
					<div class="ing-form-rad">
						<input
							class="ing-maengde"
							type="number"
							min="0"
							step="0.5"
							placeholder="0"
							bind:value={formIngredienser[i].maengde}
							disabled={gemmer}
						/>
						<input
							class="ing-enhed"
							type="text"
							placeholder="g"
							bind:value={formIngredienser[i].enhed}
							disabled={gemmer}
						/>
						<input
							class="ing-navn"
							type="text"
							placeholder="navn"
							bind:value={formIngredienser[i].navn}
							disabled={gemmer}
						/>
					</div>
					<div class="ing-handlinger">
						<button
							type="button"
							class="ikon-knap"
							onclick={() => flytIngrediens(i, -1)}
							disabled={gemmer || i === 0}
							aria-label="Flyt op">↑</button
						>
						<button
							type="button"
							class="ikon-knap"
							onclick={() => flytIngrediens(i, 1)}
							disabled={gemmer || i === formIngredienser.length - 1}
							aria-label="Flyt ned">↓</button
						>
						<button
							type="button"
							class="ikon-knap"
							onclick={() => fjernIngrediens(i)}
							disabled={gemmer}
							aria-label="Fjern">×</button
						>
					</div>

					{#if henterTal}
						<div class="ing-tal henter">Henter næringsdata...</div>
					{:else if linjer[i]}
						{@const l = linjer[i]}
						{#if l.vare && !l.uden_betydning}
							<div class="ing-tal">
								<span class="ing-tal-vare">{l.vare.name}</span>
								<span class="ing-tal-gram">{etTal(l.gram)} g</span>
								<span class="ing-tal-makro">
									Protein {etTal(l.makro.protein)} g · Fiber {etTal(l.makro.fiber)} g · Kulhydrat
									{etTal(l.makro.kh)} g · Fedt {etTal(l.makro.fedt)} g · {etTal(l.makro.kalorier)} kcal
								</span>
								{#if l.mangel === 'varen mangler tal'}
									<span class="ing-tal-mangel">Varen mangler kalorietal</span>
								{/if}
								{#if l.vaegtSikkerhed !== 'tabel'}
									<span class="ing-tal-usikker">Vægten er et skøn</span>
								{/if}
							</div>
						{:else}
							<div class="ing-tal tom">{mangelTekst(l)}</div>
						{/if}
					{/if}
				</div>
			{/each}
			<button class="ghost-knap" type="button" onclick={tilfoejIngrediens} disabled={gemmer}>
				+ Tilføj ingrediens
			</button>

			{#if talFejl}
				<div class="tal-fejl">{talFejl}</div>
			{:else if beregning && ialt && prPortion}
				<div class="sum-boks">
					<div class="sum-titel">Regnet af ingredienserne</div>

					<div class="sum-rad">
						<span class="sum-navn">{flerePortioner ? 'Hele retten' : 'I alt'}</span>
						<span class="sum-tal">
							Protein {etTal(ialt.protein)} g · Fiber {etTal(ialt.fiber)} g · Kulhydrat
							{etTal(ialt.kh)} g · Fedt {etTal(ialt.fedt)} g · {etTal(ialt.kalorier)} kcal
						</span>
					</div>

					{#if flerePortioner}
						<div class="sum-rad">
							<span class="sum-navn">Pr portion</span>
							<span class="sum-tal">
								Protein {etTal(prPortion.protein)} g · Fiber {etTal(prPortion.fiber)} g · Kulhydrat
								{etTal(prPortion.kh)} g · Fedt {etTal(prPortion.fedt)} g · {etTal(prPortion.kalorier)}
								kcal
							</span>
						</div>
						<p class="sum-hint">
							Ingredienslisten er skrevet til {listenErSkrevetTil(formDefaultPortioner)} portioner.
							Dine makro-felter nedenfor er PR PORTION, så det er den nederste række der skal
							sammenlignes.
						</p>
					{/if}

					<div class="daekning" class:advarsel={tilliden(beregning.daekning) !== 'god'}>
						Der er gjort rede for {Math.round(beregning.daekning)} % af rettens vægt.
						{#if beregning.antalMangler > 0}
							{beregning.antalMangler} ingrediens{beregning.antalMangler === 1 ? '' : 'er'} mangler en
							kobling og tæller ikke med, så tallene er for lave.
						{/if}
						{#if !beregning.kalorierPaalidelige}
							En eller flere varer mangler kalorietal, så kalorier, kulhydrat og fedt kan ikke bruges.
							Protein og fiber er stadig rigtige.
						{/if}
					</div>

					{#if afvig}
						<div class="sum-titel andet">Mod det du selv har skrevet</div>
						<div class="afvig-liste">
							<span>Protein: {afvigTekst(afvig.protein) || 'intet tal skrevet'}</span>
							<span>Fiber: {afvigTekst(afvig.fiber) || 'intet tal skrevet'}</span>
							<span>Kulhydrat: {afvigTekst(afvig.kh) || 'intet tal skrevet'}</span>
							<span>Fedt: {afvigTekst(afvig.fedt) || 'intet tal skrevet'}</span>
							<span>Kalorier: {afvigTekst(afvig.kalorier) || 'intet tal skrevet'}</span>
						</div>
						<p class="sum-hint">
							En forskel er ikke i sig selv en fejl. De skrevne tal er runde måltal, og retterne
							indeholder som regel lidt mere end der står. Der bliver ikke ændret noget automatisk.
						</p>
					{/if}
				</div>
			{/if}
		</section>

		<section class="card">
			<div class="form-titel">Næringsindhold pr portion</div>
			<p class="hint">
				Tallene her er dem kunden ser i begge apps. Lad et felt stå tomt, hvis du ikke har tallet.
				Så viser appen en tankestreg i stedet for at gætte.
			</p>
			<div class="makro-felter">
				<label class="felt">
					<span class="felt-label">Protein (g)</span>
					<input type="number" min="0" step="0.1" bind:value={formProtein} disabled={gemmer} />
				</label>
				<label class="felt">
					<span class="felt-label">Fiber (g)</span>
					<input type="number" min="0" step="0.1" bind:value={formFiber} disabled={gemmer} />
				</label>
				<label class="felt">
					<span class="felt-label">Kulhydrat (g)</span>
					<input type="number" min="0" step="0.1" bind:value={formKh} disabled={gemmer} />
				</label>
				<label class="felt">
					<span class="felt-label">Fedt (g)</span>
					<input type="number" min="0" step="0.1" bind:value={formFedt} disabled={gemmer} />
				</label>
				<label class="felt">
					<span class="felt-label">Kalorier (kcal)</span>
					<input type="number" min="0" step="1" bind:value={formKalorier} disabled={gemmer} />
				</label>
				<label class="felt">
					<span class="felt-label">Tilberedningstid</span>
					<input type="text" bind:value={formTid} disabled={gemmer} placeholder="fx 15 minutter" />
				</label>
			</div>
			{#if makroMangler}
				<div class="makro-aflaest advarsel">
					<strong>⚠️ Der mangler tal.</strong>
					<span>Kunden ser en tankestreg for de felter der står tomme.</span>
				</div>
			{/if}
			<p class="hint">
				Sådan kommer linjen til at stå nederst i fremgangsmåden, når du gemmer:
				<br /><code>{kommendeLinje || '(ingen linje, alle felter er tomme)'}</code>
			</p>
		</section>

		<section class="card">
			<div class="form-titel">Fremgangsmåde</div>
			<textarea
				class="textarea"
				bind:value={formInstruktioner}
				rows="10"
				disabled={gemmer}
				placeholder="1. Start med...&#10;2. Fortsæt med..."
			></textarea>
			<p class="hint">Skriv hvert trin på sin egen linje. Tomme linjer giver afsnit.</p>
			<p class="hint">
				Du skal ikke skrive næringstallene her. De styres af felterne ovenfor og bliver skrevet
				nederst i teksten, når du gemmer.
			</p>
		</section>

		{#if gemFejl}
			<div class="fejl-besked">{gemFejl}</div>
		{/if}
		{#if gemKvit}
			<div class="kvit-besked">Gemt ✓</div>
		{/if}

		<button class="primary-knap" type="button" onclick={gem} disabled={gemmer}>
			{gemmer ? 'Gemmer...' : 'Gem opskrift'}
		</button>

		<div class="godkend-omraade" class:sat={godkendt}>
			<button
				class="godkend-knap"
				class:sat={godkendt}
				type="button"
				onclick={toggleGodkendt}
				disabled={gemmerGodkendt}
				aria-pressed={godkendt ? 'true' : 'false'}
			>
				<span class="godkend-flueben">✓</span>
				<span>
					{#if gemmerGodkendt}
						Gemmer...
					{:else if godkendt}
						Godkendt. Tryk for at fjerne
					{:else}
						Marker som godkendt
					{/if}
				</span>
			</button>
			<p class="godkend-hint">
				Kun dit eget overblik. Kunderne kan hverken se eller mærke det, og det er
				stadig Aktiv ovenfor der bestemmer om opskriften vises for dem. Gemmes med
				det samme, du behøver ikke trykke Gem.
			</p>
			{#if godkendFejl}
				<div class="fejl-besked">{godkendFejl}</div>
			{/if}
		</div>

		<div class="slet-omraade">
			{#if !bekraefter}
				<button class="slet-knap" type="button" onclick={slet}>Slet opskrift</button>
			{:else}
				<div class="slet-bekraeft">
					<div class="slet-tekst">Slet opskriften permanent?</div>
					<div class="slet-knapper">
						<button
							class="form-knap ghost"
							type="button"
							onclick={() => (bekraefter = false)}
							disabled={sletter}
						>
							Annuller
						</button>
						<button class="form-knap danger" type="button" onclick={slet} disabled={sletter}>
							{sletter ? 'Sletter...' : 'Ja, slet'}
						</button>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 520px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 14px;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
		text-decoration: none;
		margin-bottom: 12px;
	}

	.eyebrow {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text3);
	}

	h1 {
		font-family: var(--ff-d);
		font-size: calc(26px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 4px 0 0;
		line-height: 1.05;
		color: var(--text);
	}

	.status-besked {
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
		text-align: center;
		margin-bottom: 14px;
	}

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-bottom: 14px;
	}

	.form-titel {
		font-family: var(--ff-d);
		font-size: calc(16px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.hint {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin: 0;
		line-height: 1.45;
	}

	.makro-felter {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 12px;
		margin-bottom: 12px;
	}

	.makro-aflaest {
		margin-top: 10px;
		padding: 10px 12px;
		border-radius: 8px;
		background: #eef4ef;
		border-left: 3px solid var(--sage, #6f9e7e);
		font-size: calc(12px * var(--fs-scale, 1));
		line-height: 1.5;
		color: var(--text2);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.makro-aflaest.advarsel {
		background: #fdf0d5;
		border-left-color: #b8860b;
	}



	.felt {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.felt-label {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.felt input,
	.textarea {
		padding: 10px 12px;
		font-size: calc(14px * var(--fs-scale, 1));
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-b);
		outline: none;
	}

	.textarea {
		resize: vertical;
		line-height: 1.5;
	}

	.felt input:focus,
	.textarea:focus {
		border-color: var(--terra);
	}

	.felt-hint {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text4);
	}

	.chip-rad {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.chip {
		padding: 7px 12px;
		font-size: calc(12px * var(--fs-scale, 1));
		border-radius: 99px;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text2);
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.chip.aktiv {
		background: var(--terra);
		color: #fff;
		border-color: var(--terra);
	}

	.chip:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.checkbox-rad {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		cursor: pointer;
	}

	.checkbox-rad input {
		width: 16px;
		height: 16px;
		accent-color: var(--terra);
	}

	.ing-form {
		display: flex;
		gap: 6px;
		align-items: stretch;
	}

	.ing-form-rad {
		display: grid;
		grid-template-columns: 70px 70px 1fr;
		gap: 6px;
		flex: 1;
	}

	.ing-maengde,
	.ing-enhed,
	.ing-navn {
		padding: 8px 10px;
		font-size: calc(13px * var(--fs-scale, 1));
		border-radius: 8px;
		border: 1px solid var(--border);
		background: var(--bg2);
		font-family: var(--ff-b);
	}

	.ing-handlinger {
		display: flex;
		gap: 4px;
	}

	.ikon-knap {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		background: var(--bg2);
		border: 1px solid var(--border);
		color: var(--text3);
		font-size: calc(14px * var(--fs-scale, 1));
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.ikon-knap:hover:not(:disabled) {
		background: #fbeeea;
		color: #8a4a3e;
	}

	.ikon-knap:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.ghost-knap {
		padding: 10px 14px;
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 500;
		border-radius: 10px;
		background: var(--bg2);
		border: 1px dashed var(--border);
		color: var(--text2);
		cursor: pointer;
		font-family: var(--ff-b);
		align-self: flex-start;
	}

	.ghost-knap:hover {
		background: var(--white);
		border-color: var(--terra);
		color: var(--terra);
	}

	.fejl-besked {
		padding: 10px 12px;
		background: #fbeeea;
		border: 1px solid #f0d6cf;
		border-radius: 8px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: #8a4a3e;
		margin-bottom: 12px;
	}

	.kvit-besked {
		padding: 8px 12px;
		background: var(--sdim);
		border-radius: 8px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--sage);
		text-align: center;
		margin-bottom: 12px;
	}

	.primary-knap {
		display: block;
		width: 100%;
		padding: 13px;
		background: var(--terra);
		color: #fff;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 12px;
		border: none;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.primary-knap:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.slet-omraade {
		margin-top: 24px;
	}

	.ing-tal {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 8px;
		margin-top: 4px;
		padding: 6px 8px;
		background: var(--bg2);
		border-radius: 8px;
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.4;
	}

	.ing-tal.tom,
	.ing-tal.henter {
		color: var(--text3);
		font-style: italic;
	}

	.ing-tal-vare {
		font-weight: 600;
		color: var(--text);
	}

	.ing-tal-gram {
		color: var(--text3);
	}

	.ing-tal-makro {
		flex-basis: 100%;
	}

	/* En manglende oplysning skal SES. Et stille nul er den fejl hvor en ret
	   ser ud til at have mindre protein end den har. */
	.ing-tal-mangel {
		color: #8a4a3e;
		font-weight: 600;
	}

	.ing-tal-usikker {
		color: var(--text3);
	}

	.sum-boks {
		margin-top: 14px;
		padding: 12px 14px;
		background: var(--bg2);
		border: 1px solid var(--border);
		border-radius: 12px;
	}

	.sum-titel {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text3);
		margin-bottom: 8px;
	}

	.sum-titel.andet {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid var(--border);
	}

	.sum-rad {
		margin-bottom: 6px;
	}

	.sum-navn {
		display: block;
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.sum-tal {
		display: block;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.45;
	}

	.sum-hint {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		line-height: 1.45;
		margin: 6px 0 0;
	}

	.daekning {
		margin-top: 8px;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.45;
	}

	.daekning.advarsel {
		color: #8a4a3e;
		font-weight: 600;
	}

	.afvig-liste {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text2);
	}

	.tal-fejl {
		margin-top: 12px;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.godkend-omraade {
		margin-top: 12px;
		padding: 12px 14px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
	}

	.godkend-omraade.sat {
		background: #e7f2e9;
		border-color: #cfe3d4;
	}

	/* Baggrunden staar eksplicit, ellers giver browseren knappen sin egen
	   graa flade og de to tilstande ligner hinanden. */
	.godkend-knap {
		display: flex;
		align-items: center;
		gap: 9px;
		width: 100%;
		padding: 10px 12px;
		background: var(--bg2);
		border: 1px solid var(--border);
		border-radius: 10px;
		color: var(--text);
		font-size: calc(13.5px * var(--fs-scale, 1));
		font-family: var(--ff-b);
		font-weight: 600;
		cursor: pointer;
		text-align: left;
	}

	.godkend-knap.sat {
		background: #4f8a5b;
		border-color: #4f8a5b;
		color: #fff;
	}

	.godkend-knap:disabled {
		opacity: 0.6;
		cursor: wait;
	}

	.godkend-flueben {
		font-size: calc(15px * var(--fs-scale, 1));
		line-height: 1;
	}

	.godkend-hint {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		line-height: 1.45;
		margin: 8px 0 0;
	}

	.slet-knap {
		background: none;
		border: 1px solid #e8c8c1;
		color: #b8503f;
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 500;
		padding: 10px 16px;
		border-radius: 10px;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.slet-knap:hover {
		background: #fbeeea;
	}

	.slet-bekraeft {
		background: #fbeeea;
		border: 1px solid #f0d6cf;
		border-radius: 12px;
		padding: 14px;
	}

	.slet-tekst {
		font-size: calc(13px * var(--fs-scale, 1));
		color: #8a4a3e;
		margin-bottom: 10px;
	}

	.slet-knapper {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.form-knap {
		padding: 11px;
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 8px;
		border: none;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.form-knap.ghost {
		background: var(--white);
		border: 1px solid var(--border);
		color: var(--text2);
	}

	.form-knap.danger {
		background: #b8503f;
		color: #fff;
	}

	.form-knap:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
