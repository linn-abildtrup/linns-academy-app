<script lang="ts">
	// ============================================================
	// Ret en opskrift, i det nye design.
	//
	// Attende af de 19 gamle admin-sider, 1. september 2026, og den mest
	// naenssomme af dem alle.
	//
	// HELE SCRIPTET ER FLYTTET ORDRET fra den gamle side. Ikke én linje
	// logik er skrevet om, og det er med vilje: siden skriver MAKRO-LINJEN
	// nederst i fremgangsmaaden, og den linje laeses af BEGGE apper. Bliver
	// formatet forkert, mister alle 133 opskrifter deres naeringstal paa én
	// gang. Se advarslen i afsnit 7 i overdragelsen.
	//
	// Det eneste der er aendret i scriptet er admin-tjekket, byggeklodserne
	// og hvor man lander efter en sletning. Alt andet, altsaa
	// skrivMakroLinje, byggMakroLinje, regnemaskinen og de fem makro-felter,
	// er det samme.
	//
	// Den gamle side paa /app/admin/opskrifter/[id] er uroert.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import AdmSide from '$lib/components/admin/AdmSide.svelte';
	import AdmKort from '$lib/components/admin/AdmKort.svelte';
	import AdmKnap from '$lib/components/admin/AdmKnap.svelte';
	import AdmMaerkat from '$lib/components/admin/AdmMaerkat.svelte';
	import AdmTom from '$lib/components/admin/AdmTom.svelte';
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

	const hentUser = getContext<() => User | null>('user');
	const maaVaereHer = $derived(isAdmin(hentUser()));

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
			goto('/ny/admin/opskrifter');
		} catch (e) {
			console.error(e);
			gemFejl = 'Kunne ikke slette opskriften.';
			sletter = false;
		}
	}
</script>

<svelte:head><title>{formTitel || 'Opskrift'} · Admin</title></svelte:head>

{#if !maaVaereHer}
	<p class="ro-kun">Siden er kun for admin.</p>
{:else if loading}
	<AdmSide titel="Opskrift"><AdmTom tekst="Henter opskriften…" /></AdmSide>
{:else if fejl}
	<AdmSide titel="Opskrift">
		<AdmTom tekst={fejl} fejl>
			{#snippet handling()}
				<AdmKnap onclick={() => goto('/ny/admin/opskrifter')}>Tilbage til listen</AdmKnap>
			{/snippet}
		</AdmTom>
	</AdmSide>
{:else if original}
	<AdmSide titel={formTitel || 'Uden navn'} under="Ret opskriften. Kunderne ser den i Mad." bred>
		{#snippet handling()}
			<AdmKnap onclick={() => goto('/ny/admin/opskrifter')}>Tilbage til listen</AdmKnap>
		{/snippet}

		{#if gemKvit}<div class="ro-kvit">Gemt</div>{/if}
		{#if gemFejl}<div class="ro-fejl">{gemFejl}</div>{/if}

		<AdmKort>
			<div class="ro-raek">
				<label class="ro-felt bred">
					<span>Titel</span>
					<input type="text" bind:value={formTitel} disabled={gemmer} />
				</label>
				<label class="ro-felt bred">
					<span>Kort beskrivelse</span>
					<input type="text" bind:value={formBeskrivelse} disabled={gemmer} />
				</label>
				<label class="ro-felt bred">
					<span>Billede</span>
					<input
						type="text"
						placeholder="Adressen på billedet"
						bind:value={formBilledeUrl}
						disabled={gemmer}
					/>
				</label>
			</div>

			<div class="ro-felt bred">
				<span>Madtype</span>
				<div class="ro-chips">
					{#each ALLE_KATEGORIER as k (k)}
						<button
							type="button"
							class="ro-chip"
							class:paa={formKategorier.includes(k)}
							disabled={gemmer}
							onclick={() => toggleKategori(k)}
						>
							{KATEGORI_LABELS[k]}
						</button>
					{/each}
				</div>
			</div>

			<div class="ro-felt bred">
				<span>Mærkater</span>
				<div class="ro-chips">
					{#each ALLE_DIET_TAGS as t (t)}
						<button
							type="button"
							class="ro-chip"
							class:paa={formDietTags.includes(t)}
							disabled={gemmer}
							onclick={() => toggleDietTag(t)}
						>
							{DIET_LABELS[t]}
						</button>
					{/each}
				</div>
			</div>

			<div class="ro-raek">
				<label class="ro-felt">
					<span>Ingredienslisten rækker til</span>
					<input
						type="number"
						min="1"
						max="20"
						bind:value={formDefaultPortioner}
						disabled={gemmer}
					/>
					<em>portioner. Mængderne skaleres ud fra det tal, makroen gør ikke.</em>
				</label>
			</div>

			<label class="ro-flueben">
				<input type="checkbox" bind:checked={formAktiv} disabled={gemmer} />
				<span>Synlig for kunderne</span>
			</label>
		</AdmKort>

		<AdmKort>
			<div class="ro-h-raek">
				<h2 class="ro-h">Ingredienser</h2>
				<span class="ro-antal">{formIngredienser.length}</span>
			</div>
			<p class="ro-hint">Mængderne gælder de portioner du skrev ovenfor.</p>

			{#each formIngredienser as ing, i (i)}
				<div class="ro-ing">
					<div class="ro-ing-raek">
						<input
							class="ro-m"
							type="number"
							min="0"
							step="0.5"
							placeholder="0"
							bind:value={formIngredienser[i].maengde}
							disabled={gemmer}
						/>
						<input
							class="ro-e"
							type="text"
							placeholder="g"
							bind:value={formIngredienser[i].enhed}
							disabled={gemmer}
						/>
						<input
							class="ro-n"
							type="text"
							placeholder="navn"
							bind:value={formIngredienser[i].navn}
							disabled={gemmer}
						/>
						<button
							type="button"
							class="ro-ikon"
							disabled={gemmer || i === 0}
							onclick={() => flytIngrediens(i, -1)}
							aria-label="Flyt op">↑</button
						>
						<button
							type="button"
							class="ro-ikon"
							disabled={gemmer || i === formIngredienser.length - 1}
							onclick={() => flytIngrediens(i, 1)}
							aria-label="Flyt ned">↓</button
						>
						<button
							type="button"
							class="ro-ikon"
							disabled={gemmer}
							onclick={() => fjernIngrediens(i)}
							aria-label="Fjern">×</button
						>
					</div>

					{#if henterTal}
						<div class="ro-tal henter">Henter næringsdata…</div>
					{:else if linjer[i]}
						{@const l = linjer[i]}
						{#if l.vare && !l.uden_betydning}
							<div class="ro-tal">
								<span class="ro-vare">{l.vare.name}</span>
								<span class="ro-gram">{etTal(l.gram)} g</span>
								<span class="ro-makro">
									Protein {etTal(l.makro.protein)} g · Fiber {etTal(l.makro.fiber)} g · Kulhydrat
									{etTal(l.makro.kh)} g · Fedt {etTal(l.makro.fedt)} g · {etTal(l.makro.kalorier)} kcal
								</span>
								{#if l.mangel === 'varen mangler tal'}<span class="ro-mangel"
										>Varen mangler kalorietal</span
									>{/if}
								{#if l.vaegtSikkerhed !== 'tabel'}<span class="ro-usikker">Vægten er et skøn</span
									>{/if}
							</div>
						{:else}
							<div class="ro-tal tom">{mangelTekst(l)}</div>
						{/if}
					{/if}
				</div>
			{/each}

			<AdmKnap disabled={gemmer} onclick={tilfoejIngrediens}>Tilføj en ingrediens</AdmKnap>

			{#if talFejl}
				<p class="ro-tal-fejl">{talFejl}</p>
			{:else if beregning && ialt && prPortion}
				<div class="ro-sum">
					<div class="ro-sum-h">Regnet af ingredienserne</div>
					<div class="ro-sum-raek">
						<span class="ro-sum-navn">{flerePortioner ? 'Hele retten' : 'I alt'}</span>
						<span class="ro-sum-tal">
							Protein {etTal(ialt.protein)} g · Fiber {etTal(ialt.fiber)} g · Kulhydrat {etTal(
								ialt.kh
							)} g · Fedt {etTal(ialt.fedt)} g · {etTal(ialt.kalorier)} kcal
						</span>
					</div>
					{#if flerePortioner}
						<div class="ro-sum-raek">
							<span class="ro-sum-navn">Pr portion</span>
							<span class="ro-sum-tal">
								Protein {etTal(prPortion.protein)} g · Fiber {etTal(prPortion.fiber)} g · Kulhydrat
								{etTal(prPortion.kh)} g · Fedt {etTal(prPortion.fedt)} g · {etTal(
									prPortion.kalorier
								)} kcal
							</span>
						</div>
						<p class="ro-hint">
							Ingredienslisten er skrevet til {listenErSkrevetTil(formDefaultPortioner)} portioner. Dine
							makro-felter nedenfor er PR PORTION, så det er den nederste række der skal sammenlignes.
						</p>
					{/if}
					<div class="ro-daekning" class:advarsel={tilliden(beregning.daekning) !== 'god'}>
						Der er gjort rede for {Math.round(beregning.daekning)} % af rettens vægt.
						{#if beregning.antalMangler > 0}
							{beregning.antalMangler}
							{beregning.antalMangler === 1 ? 'ingrediens mangler' : 'ingredienser mangler'} en kobling
							og tæller ikke med, så tallene er for lave.
						{/if}
						{#if !beregning.kalorierPaalidelige}
							En eller flere varer mangler kalorietal, så kalorier, kulhydrat og fedt kan ikke
							bruges. Protein og fiber er stadig rigtige.
						{/if}
					</div>
					{#if afvig}
						<div class="ro-sum-h andet">Mod det du selv har skrevet</div>
						<div class="ro-afvig">
							<span>Protein: {afvigTekst(afvig.protein) || 'intet tal skrevet'}</span>
							<span>Fiber: {afvigTekst(afvig.fiber) || 'intet tal skrevet'}</span>
							<span>Kulhydrat: {afvigTekst(afvig.kh) || 'intet tal skrevet'}</span>
							<span>Fedt: {afvigTekst(afvig.fedt) || 'intet tal skrevet'}</span>
							<span>Kalorier: {afvigTekst(afvig.kalorier) || 'intet tal skrevet'}</span>
						</div>
						<p class="ro-hint">
							En forskel er ikke i sig selv en fejl. De skrevne tal er runde måltal, og retterne
							indeholder som regel lidt mere end der står. Der bliver ikke ændret noget automatisk.
						</p>
					{/if}
				</div>
			{/if}
		</AdmKort>

		<AdmKort>
			<h2 class="ro-h">Næring pr portion</h2>
			<p class="ro-hint">
				De her tal er dem kunden ser i begge apper. Lad et felt stå tomt hvis du ikke har tallet, så
				viser appen en streg i stedet for at gætte.
			</p>
			<div class="ro-raek">
				<label class="ro-felt"
					><span>Protein</span><input
						type="number"
						min="0"
						step="0.1"
						bind:value={formProtein}
						disabled={gemmer}
					/></label
				>
				<label class="ro-felt"
					><span>Fiber</span><input
						type="number"
						min="0"
						step="0.1"
						bind:value={formFiber}
						disabled={gemmer}
					/></label
				>
				<label class="ro-felt"
					><span>Kulhydrat</span><input
						type="number"
						min="0"
						step="0.1"
						bind:value={formKh}
						disabled={gemmer}
					/></label
				>
				<label class="ro-felt"
					><span>Fedt</span><input
						type="number"
						min="0"
						step="0.1"
						bind:value={formFedt}
						disabled={gemmer}
					/></label
				>
				<label class="ro-felt"
					><span>Kalorier</span><input
						type="number"
						min="0"
						step="1"
						bind:value={formKalorier}
						disabled={gemmer}
					/></label
				>
				<label class="ro-felt"
					><span>Tid</span><input
						type="text"
						placeholder="fx 15 minutter"
						bind:value={formTid}
						disabled={gemmer}
					/></label
				>
			</div>
			{#if makroMangler}
				<div class="ro-advarsel">
					Der mangler tal. Kunden ser en streg for de felter der står tomme.
				</div>
			{/if}
			<!-- FORHAANDSVISNINGEN AF LINJEN SKAL BLIVE STAAENDE. Den er den
			     eneste maade at se hvad der faktisk bliver skrevet ned i
			     fremgangsmaaden, og den linje laeses af begge apper. -->
			<p class="ro-hint">Sådan kommer linjen til at stå nederst i fremgangsmåden når du gemmer:</p>
			<code class="ro-linje">{kommendeLinje || '(ingen linje, alle felter er tomme)'}</code>
		</AdmKort>

		<AdmKort>
			<h2 class="ro-h">Fremgangsmåde</h2>
			<textarea class="ro-tekst" rows="10" bind:value={formInstruktioner} disabled={gemmer}
			></textarea>
			<p class="ro-hint">
				Makro-linjen bliver skrevet nederst automatisk når du gemmer. Du skal ikke skrive den selv.
			</p>
		</AdmKort>

		<div class="ro-knapper">
			<AdmKnap slags="primaer" disabled={gemmer} onclick={gem}>
				{gemmer ? 'Gemmer…' : 'Gem opskriften'}
			</AdmKnap>
			{#if bekraefter}
				<span class="ro-advarsel-linje">Opskriften slettes permanent.</span>
				<AdmKnap slags="fare" disabled={sletter} onclick={slet}>
					{sletter ? 'Sletter…' : 'Ja, slet'}
				</AdmKnap>
				<AdmKnap disabled={sletter} onclick={() => (bekraefter = false)}>Fortryd</AdmKnap>
			{:else}
				<AdmKnap slags="fare" onclick={slet}>Slet opskriften</AdmKnap>
			{/if}
		</div>

		<div class="ro-godkend" class:sat={godkendt}>
			<AdmKnap disabled={gemmerGodkendt} onclick={toggleGodkendt}>
				{gemmerGodkendt
					? 'Gemmer…'
					: godkendt
						? 'Godkendt. Tryk for at fjerne'
						: 'Marker som godkendt'}
			</AdmKnap>
			{#if godkendt}<AdmMaerkat farve="klar">Set igennem</AdmMaerkat>{/if}
			<p class="ro-hint">
				Kun dit eget overblik. Kunderne mærker det ikke, og det er stadig fluebenet Synlig for
				kunderne der bestemmer om de kan se opskriften. Gemmes med det samme.
			</p>
			{#if godkendFejl}<p class="ro-tal-fejl">{godkendFejl}</p>{/if}
		</div>
	</AdmSide>
{/if}

<style>
	.ro-kun {
		padding: 24px 18px;
		color: var(--ink-2);
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
	}

	.ro-kvit,
	.ro-fejl {
		margin-bottom: 12px;
		padding: 11px 15px;
		border-radius: 12px;
		font-size: calc(13.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
	}
	.ro-kvit {
		background: var(--sage-tint, #e7efe5);
		color: var(--sage-tekst, #46603f);
	}
	.ro-fejl {
		background: var(--ler-tint, #f4e6de);
		color: var(--ler-tekst, #8a5439);
	}

	.ro-h {
		margin: 0 0 4px;
		font-size: calc(16px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
	}
	.ro-h-raek {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px;
	}
	.ro-antal {
		font-size: calc(12px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3, #a3948a);
	}

	.ro-raek {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}
	.ro-felt {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1 1 120px;
		margin-bottom: 11px;
	}
	.ro-felt.bred {
		flex-basis: 100%;
	}
	.ro-felt span {
		font-size: calc(10.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-3, #a3948a);
	}
	.ro-felt em {
		font-size: calc(11px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3, #a3948a);
		font-style: normal;
		line-height: 1.4;
	}
	.ro-felt input,
	.ro-tekst {
		padding: 11px 13px;
		background: var(--paper, #fbf8f2);
		border: 1px solid var(--line, #e8dfd1);
		border-radius: 11px;
		color: var(--espresso, #382c2a);
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-family: inherit;
		line-height: 1.55;
		box-sizing: border-box;
		resize: vertical;
	}
	.ro-tekst {
		display: block;
		width: 100%;
	}

	.ro-flueben {
		display: flex;
		align-items: center;
		gap: 9px;
		margin: 2px 0 0;
		font-size: calc(13.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
	}
	.ro-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	/* Baggrunden staar eksplicit, se noten i AdmKnap. */
	.ro-chip {
		padding: 8px 14px;
		background: var(--paper, #fbf8f2);
		border: 1px solid var(--line, #e8dfd1);
		border-radius: 99px;
		color: var(--ink-2, #6f5f57);
		font-size: calc(12.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-family: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	.ro-chip.paa {
		background: var(--plum, #7c4f63);
		border-color: var(--plum, #7c4f63);
		color: #fff;
	}

	.ro-hint {
		margin: 6px 0 11px;
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3, #a3948a);
		line-height: 1.5;
	}

	.ro-ing {
		margin-bottom: 9px;
	}
	.ro-ing-raek {
		display: flex;
		gap: 6px;
		align-items: center;
	}
	.ro-ing-raek input {
		padding: 10px 12px;
		background: var(--paper, #fbf8f2);
		border: 1px solid var(--line, #e8dfd1);
		border-radius: 10px;
		color: var(--espresso, #382c2a);
		font-size: calc(13.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-family: inherit;
		box-sizing: border-box;
		min-width: 0;
	}
	.ro-m {
		width: 74px;
		flex-shrink: 0;
	}
	.ro-e {
		width: 62px;
		flex-shrink: 0;
	}
	.ro-n {
		flex: 1;
	}
	.ro-ikon {
		width: 34px;
		height: 38px;
		flex-shrink: 0;
		background: var(--paper, #fbf8f2);
		border: 1px solid var(--line, #e8dfd1);
		border-radius: 9px;
		color: var(--ink-2, #6f5f57);
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-family: inherit;
		cursor: pointer;
	}
	.ro-ikon:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.ro-tal {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 8px;
		margin-top: 4px;
		padding: 6px 9px;
		background: var(--paper, #fbf8f2);
		border-radius: 9px;
		font-size: calc(11px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-2, #6f5f57);
		line-height: 1.4;
	}
	.ro-tal.tom,
	.ro-tal.henter {
		color: var(--ink-3, #a3948a);
		font-style: italic;
	}
	.ro-vare {
		font-weight: 600;
		color: var(--espresso, #382c2a);
	}
	.ro-gram,
	.ro-usikker {
		color: var(--ink-3, #a3948a);
	}
	.ro-makro {
		flex-basis: 100%;
	}
	/* En manglende oplysning skal SES. Et stille nul er den fejl hvor en ret
	   ser ud til at have mindre protein end den har. */
	.ro-mangel {
		color: var(--ler-tekst, #8a5439);
		font-weight: 600;
	}

	.ro-sum {
		margin-top: 14px;
		padding: 13px 15px;
		background: var(--paper, #fbf8f2);
		border-radius: 12px;
	}
	.ro-sum-h {
		font-size: calc(10.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink-3, #a3948a);
		margin-bottom: 8px;
	}
	.ro-sum-h.andet {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid var(--line, #e8dfd1);
	}
	.ro-sum-raek {
		margin-bottom: 6px;
	}
	.ro-sum-navn {
		display: block;
		font-size: calc(12px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
	}
	.ro-sum-tal {
		display: block;
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-2, #6f5f57);
		line-height: 1.45;
	}
	.ro-daekning {
		margin-top: 8px;
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-2, #6f5f57);
		line-height: 1.45;
	}
	.ro-daekning.advarsel {
		color: var(--ler-tekst, #8a5439);
		font-weight: 600;
	}
	.ro-afvig {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-2, #6f5f57);
	}

	.ro-advarsel {
		margin: 4px 0 10px;
		padding: 10px 13px;
		background: var(--honey-tint, #f7ecd7);
		border-radius: 11px;
		color: var(--honey-deep, #b47f3e);
		font-size: calc(12.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
	}
	.ro-advarsel-linje,
	.ro-tal-fejl {
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ler-tekst, #8a5439);
		font-weight: 600;
	}
	.ro-tal-fejl {
		margin: 8px 0 0;
	}

	.ro-linje {
		display: block;
		padding: 11px 13px;
		background: var(--paper, #fbf8f2);
		border: 1px solid var(--line, #e8dfd1);
		border-radius: 10px;
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--espresso, #382c2a);
		word-break: break-word;
		line-height: 1.5;
	}

	.ro-knapper {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		margin-top: 14px;
	}

	.ro-godkend {
		margin-top: 14px;
		padding: 13px 15px;
		background: var(--paper-2, #f6f0e7);
		border-radius: 14px;
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}
	.ro-godkend.sat {
		background: var(--sage-tint, #e7efe5);
	}
	.ro-godkend .ro-hint {
		flex-basis: 100%;
		margin: 0;
	}
</style>
