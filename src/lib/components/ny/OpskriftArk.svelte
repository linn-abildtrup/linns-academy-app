<script lang="ts">
	// ============================================================
	// Opskriften, vist inde i et maaltid. Se SPEC-3.0.md afsnit 26.2.
	//
	// Hun skal kunne SE opskriften foer hun laegger den i. Foer trykkede
	// hun paa en titel og saa var den registreret, uden at have set
	// hverken ingredienser eller fremgangsmaade. Det var forkert, og den
	// gamle app kan det i forvejen.
	//
	// Antal portioner kan aendres, og makroen skalerer med. Hun spiser
	// tit en halv portion, og saa er tallet forkert hvis vi laaser det.
	// ============================================================

	import type { Opskrift } from '$lib/content/opskrifter';
	import { formatMaengde, parseOpskriftMakro } from '$lib/content/opskrifter';
	import { visMakro } from '$lib/content/opskriftMakro3';
	import type { Beregninger } from '$lib/firestore/opskriftBeregning3';
	import { formatPortion } from '$lib/content/maengde3';
	import { HJERTE_ETIKET } from '$lib/content/favoritOpskrift3';
	import {
		startPortioner,
		ingrediensMaengde,
		makroForPortioner,
		gemEtiket
	} from '$lib/content/opskriftPortion3';
	import { fremgangsmaadeTrin, tilberedningstid } from '$lib/content/opskriftTekst3';
	import { portal } from '$lib/actions/portal';
	import type { Fodevare } from '$lib/content/kost';
	import type { KoblingsOpslag } from '$lib/content/opskriftMakro3';
	import {
		type Aendring,
		tomAendring,
		harAendringer,
		aendringsTekst,
		naesteMaengde,
		saetMaengde,
		saetLagtTilPortion,
		fjernLagtTil,
		egenPlads,
		regnMedAendringer
	} from '$lib/content/opskriftAendring3';

	interface Props {
		opskrift: Opskrift;
		maaltidLabel: string;
		gemmer?: boolean;
		/** Maa hun se kulhydrat, fedt og kalorier? Se SPEC-3.0.md 26.5. */
		visUdvidet?: boolean;
		/** Har hun markeret den her opskrift? */
		erFavorit?: boolean;
		/**
		 * De beregnede makrotal, ét opslag pr opskrift-id.
		 *
		 * Er opskriften med og har god nok daekning, vises DEN i stedet
		 * for tallet i teksten. Tom = fald tilbage paa teksten, saa arket
		 * virker uaendret hvis beregningerne ikke er hentet.
		 * Linns valg 13. august, se SPEC-3.0.md 26.19.
		 */
		beregninger?: Beregninger;
		/**
		 * Laeg retten i et maaltid. Udeladt = ren laesning, og saa er der
		 * ingen knap. Bruges af opskrift-siden under Din side, hvor hun
		 * kigger og ikke registrerer. Linns valg 18. august.
		 */
		ongem?: ((portioner: number, aendring: Aendring) => void) | null;
		/** Slaar bogmaerket til eller fra. Udeladt = intet hjerte. */
		onfavorit?: (() => void) | null;
		ontilbage: () => void;

		// ── Hun retter i opskriften. Se content/opskriftAendring3.ts ──
		//
		// Alt her er VALGFRIT, og uden det opfoerer arket sig noejagtig som
		// foer. Opskrift-siden under Din side sender ingenting og er derfor
		// uroert: dér kigger hun, hun registrerer ikke.
		/**
		 * Hendes aendringer. Tilstanden bor hos SIDEN og ikke i arket,
		 * fordi det er siden der ejer soegningen naar hun laegger en
		 * ingrediens til. Laa den her, ville den vaere vaek i det sekund
		 * soege-arket aabnede ovenpaa.
		 */
		aendring?: Aendring;
		onaendring?: ((a: Aendring) => void) | null;
		/** Aabner soegningen. Udeladt = ingen "Tilfoej en ingrediens". */
		ontilfoej?: (() => void) | null;
		/** Kernenavn til foedevare. Uden den kan der ikke regnes paa stedet. */
		koblinger?: Record<string, KoblingsOpslag>;
		/** Hele foedevaredatabasen, som siden alligevel har hentet. */
		varer?: Map<string, Fodevare>;
	}

	let {
		opskrift,
		maaltidLabel,
		gemmer = false,
		visUdvidet = false,
		erFavorit = false,
		beregninger = {},
		ongem = null,
		onfavorit = null,
		ontilbage,
		aendring = tomAendring(),
		onaendring = null,
		ontilfoej = null,
		koblinger = {},
		varer = new Map()
	}: Props = $props();

	/**
	 * Maa hun overhovedet rette i den her opskrift?
	 *
	 * Kun naar siden baade har givet os en vej til at gemme aendringen OG
	 * det der skal til for at regne den ud. Mangler ét af dem, staar
	 * listen som ren tekst, praecis som foer 25. august.
	 */
	const kanRette = $derived(!!onaendring && !!ongem);

	// Arket aabner paa opskriftens eget tal, altsaa 1 for de fleste og 4 for de
	// retter der er skrevet til en familie. Linns valg 12. august: listen skal
	// kunne laeses direkte som opskrift. Skruer hun ned til 1, regner baade
	// makro og ingredienser sig om med det samme.
	//
	// Kun STARTvaerdien. Arket bygges forfra hver gang hun aabner en opskrift,
	// for listen bagved kan ikke naas mens arket er aabent.
	// svelte-ignore state_referenced_locally
	// Altid én portion. Spoergsmaalet er "hvor meget spiste du", og det
	// almindelige svar er én, ikke hele gryden. Linns valg 13. august.
	let portioner = $state(startPortioner(opskrift.defaultPortioner));

	// Beregnet tal foerst, det skrevne som reserve. Se visMakro.
	const makro = $derived(
		visMakro(
			opskrift.id,
			opskrift.instruktioner,
			beregninger,
			parseOpskriftMakro(opskrift.instruktioner)
		)
	);
	// Makroen er PR PORTION, ogsaa paa de retter der er til fire. Derfor ganges
	// der kun med antal portioner, og defaultPortioner indgaar aldrig. Se
	// content/opskriftPortion3.ts for maalingerne bag.
	// ── Ingredienslisten som den staar paa skaermen ──
	//
	// Skaleret til det antal portioner hun har valgt. Det er DEN liste
	// hendes aendringer haenger paa, se punkt 1 i opskriftAendring3.ts.
	const viste = $derived(
		(opskrift.ingredienser ?? []).map((i) => ({
			...i,
			maengde: ingrediensMaengde(i.maengde, opskrift.defaultPortioner, portioner)
		}))
	);

	const rettet = $derived(harAendringer(aendring));

	/**
	 * Regnestykket paa stedet. Kun naar hun har roert noget.
	 *
	 * Uden aendringer bruges det GEMTE tal, som med vilje er frosset, se
	 * opskriftBeregning3.ts. De to kan give en lille forskel paa den
	 * samme mad, og Linn har sagt ja til det 25. august: hellere ét tal
	 * der altid er konsekvent end en omvej der koster mere end forskellen
	 * er vaerd.
	 */
	const paaStedet = $derived(
		rettet ? regnMedAendringer(viste, aendring, koblinger, varer) : null
	);

	const protein = $derived(
		paaStedet ? paaStedet.makro.protein : (makroForPortioner(makro.protein ?? 0, portioner) ?? 0)
	);
	const fiber = $derived(
		paaStedet ? paaStedet.makro.fiber : (makroForPortioner(makro.fiber ?? 0, portioner) ?? 0)
	);
	// Alle fem skalerer ens. Kulhydrat, fedt og kalorier vises kun med adgang,
	// men regnes altid ud, saa de kan gemmes uanset. Se SPEC-3.0.md 26.5.
	const kh = $derived(
		paaStedet ? paaStedet.makro.kh : (makroForPortioner(makro.kh ?? 0, portioner) ?? 0)
	);
	const fedt = $derived(
		paaStedet ? paaStedet.makro.fedt : (makroForPortioner(makro.fedt ?? 0, portioner) ?? 0)
	);
	const kalorier = $derived(
		paaStedet
			? Math.round(paaStedet.makro.kalorier)
			: Math.round(makroForPortioner(makro.kalorier ?? 0, portioner) ?? 0)
	);

	/**
	 * Linjerne som de skal staa paa skaermen, hendes egne lagt i bunden.
	 *
	 * BEMAERK: en linje hun selv har sat foelger IKKE portions-taelleren
	 * bagefter. Hun satte 200 g fordi det var det hun spiste, og det tal
	 * skal ikke gange sig selv naar hun skruer paa portionerne. De
	 * linjer er maerket paa skaermen netop derfor.
	 */
	const linjer = $derived(
		paaStedet
			? paaStedet.linjer
			: viste.map((i, plads) => ({
					plads,
					navn: i.navn ?? '',
					maengde: Number(i.maengde),
					enhed: String(i.enhed ?? ''),
					foer: undefined as number | undefined,
					aendret: false,
					egen: false
				}))
	);

	/** Hvilken linje er foldet ud. Kun én ad gangen. */
	let aabenLinje = $state<number | null>(null);

	function vipLinje(plads: number) {
		if (!kanRette) return;
		aabenLinje = aabenLinje === plads ? null : plads;
	}

	/**
	 * Plus og minus.
	 *
	 * Hendes EGNE linjer ligger efter Linns i den samlede liste, saa
	 * pladsen skal regnes om foerst. Uden det ramte et tryk paa hendes
	 * egen linje ingenting, fordi tallet blev skrevet paa en plads der
	 * ikke findes i Linns liste.
	 */
	function skru(plads: number, retning: 1 | -1) {
		const l = linjer[plads];
		if (!l || !onaendring) return;
		const ny = naesteMaengde(l.maengde, l.enhed, retning);
		if (l.egen) {
			// Nul fjerner den. Se saetLagtTilPortion: hendes egen linje
			// stod der ikke i forvejen, saa der er intet at fortryde.
			onaendring(saetLagtTilPortion(aendring, egenPlads(plads, viste.length), ny));
			if (ny <= 0) aabenLinje = null;
			return;
		}
		onaendring(saetMaengde(aendring, plads, ny));
	}

	/** Linns linje: skrues til nul, men bliver staaende saa hun kan fortryde. */
	function tagIkkeI(plads: number) {
		if (!onaendring) return;
		onaendring(saetMaengde(aendring, plads, 0));
		aabenLinje = null;
	}

	/** Hendes egen linje: fjernes helt. */
	function fjernEgen(plads: number) {
		if (!onaendring) return;
		onaendring(fjernLagtTil(aendring, egenPlads(plads, viste.length)));
		aabenLinje = null;
	}

	function saetTilbage() {
		if (!onaendring) return;
		onaendring(tomAendring());
		aabenLinje = null;
	}

	// Makro-linjen klippes ud af fremgangsmaaden, saa kunden ikke laeser de
	// samme tal én gang til som en teknisk streng midt i madlavningen. Data er
	// uroert, se content/opskriftTekst3.ts. Tiden traekkes ud og vises for sig,
	// for den ville ellers ryge med.
	const trin = $derived(fremgangsmaadeTrin(opskrift.instruktioner));
	const tid = $derived(tilberedningstid(opskrift.instruktioner));

	// En halv portion er en almindelig maengde, saa vi springer halve.
	const SPRING = 0.5;

	function flyt(retning: 1 | -1) {
		const ny = portioner + SPRING * retning;
		if (ny < SPRING) return;
		portioner = Math.round(ny * 100) / 100;
	}
</script>

<!-- ny-tokens: arket flyttes ud af .ny-app, saa farverne skal foelge med. -->
<div
	class="ark-lag ny-tokens"
	use:portal
	role="dialog"
	aria-modal="true"
	aria-labelledby="op-titel"
>
	<button type="button" class="ark-luk-flade" onclick={ontilbage} aria-label="Tilbage"></button>
	<div class="va-ark op-ark">
		<div class="ma-greb" aria-hidden="true"></div>
		<button type="button" class="ma-luk" onclick={ontilbage} aria-label="Tilbage til listen"
			>×</button
		>

		<div class="op-rul">
			{#if opskrift.billedeUrl}
				<img class="op-billede" src={opskrift.billedeUrl} alt="" />
			{/if}

			<h2 class="op-titel" id="op-titel">{opskrift.titel}</h2>
			{#if tid}
				<!-- Tiden stod foer gemt inde i makro-linjen nederst. Den er brugbar
				     naar hun skal beslutte om hun har tid til retten i aften, saa den
				     staar her i stedet for at forsvinde med linjen. -->
				<p class="op-tid">
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.9"
						stroke-linecap="round"
						aria-hidden="true"
					>
						<circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.2 2" />
					</svg>
					{tid}
				</p>
			{/if}
			{#if opskrift.beskrivelse}
				<p class="op-beskrivelse">{opskrift.beskrivelse}</p>
			{/if}

			<!-- Protein og fiber er metodens tal og staar groent. Kulhydrat og fedt
			     er til orientering og staar daempet, saa skaermen ikke ser ud som om
			     alle fire er lige vigtige. Samme opdeling som i maengde-arket.
			     Se SPEC-3.0.md 26.5. -->
			<!-- Flader skifter til honning naar tallene er hendes og ikke
			     opskriftens. Uden det ser en rettet ret ud som Linns. -->
			<div class="op-makro" class:op-makro-rettet={rettet}>
				{#if rettet}
					<div class="op-m-dine">dine<br />mængder</div>
				{/if}
				<div>
					<div class="op-m-navn">Protein</div>
					<div class="op-m-tal">{formatPortion(protein)} g</div>
				</div>
				<div>
					<div class="op-m-navn">Fiber</div>
					<div class="op-m-tal">{formatPortion(fiber)} g</div>
				</div>
				{#if visUdvidet}
					<div>
						<div class="op-m-navn">Kulhydrat</div>
						<div class="op-m-tal blaeg">{formatPortion(kh)} g</div>
					</div>
					<div>
						<div class="op-m-navn">Fedt</div>
						<div class="op-m-tal blaeg">{formatPortion(fedt)} g</div>
					</div>
				{/if}
			</div>
			{#if visUdvidet}
				<div class="op-kcal">{kalorier} kcal</div>
			{/if}

			{#if rettet}
				<!-- Siger hvad der er sket, ikke hvad hun har gjort forkert. Se
				     Linns regel om at en side aldrig maa laese som en anklage. -->
				<div class="op-baand">
					<span>{aendringsTekst(aendring)} Tallene er dine, ikke opskriftens.</span>
					<button type="button" class="op-baand-tilbage" onclick={saetTilbage}>Sæt tilbage</button>
				</div>
			{/if}

			<div class="op-k">Hvor meget spiste du?</div>
			<div class="ma-stepper op-stepper">
				<button
					type="button"
					class="ma-st-knap"
					disabled={portioner <= SPRING}
					onclick={() => flyt(-1)}
					aria-label="Mindre">−</button
				>
				<span class="ma-st-vaerdi">
					<span class="op-st-tal">{formatPortion(portioner)}</span>
					<span class="ma-st-spring">{portioner === 1 ? 'portion' : 'portioner'}</span>
				</span>
				<button type="button" class="ma-st-knap" onclick={() => flyt(1)} aria-label="Mere">+</button
				>
			</div>

			{#if opskrift.ingredienser?.length}
				<div class="op-k">Ingredienser</div>

				{#if !kanRette}
					<!-- Ren laesning, fx opskrift-siden under Din side. Uaendret
					     siden foer 25. august. -->
					<div class="op-ingredienser">
						{#each viste as ing (ing.navn + ing.maengde)}
							<div>
								<span class="op-i-navn">{ing.navn}</span>
								<span class="op-i-m">{formatMaengde(ing.maengde)} {ing.enhed}</span>
							</div>
						{/each}
					</div>
				{:else}
					<div class="op-ing-liste">
						{#each linjer as l, plads (plads)}
							<button
								type="button"
								class="op-ing-r"
								class:aendret={l.aendret}
								class:egen={l.egen}
								class:nul={l.maengde === 0}
								class:aaben={aabenLinje === plads}
								onclick={() => vipLinje(plads)}
								aria-expanded={aabenLinje === plads}
							>
								{#if l.aendret || l.egen}
									<span class="op-ing-pip" class:egen={l.egen} aria-hidden="true"></span>
								{/if}
								<span class="op-ing-navn">
									{l.navn}
									{#if l.egen}<span class="op-ing-maerke">lagt til</span>{/if}
								</span>
								<span class="op-ing-m">
									{#if l.maengde === 0}
										ikke i
									{:else}
										{#if l.foer !== undefined}
											<span class="op-ing-foer">{formatMaengde(l.foer)} {l.enhed}</span>
										{/if}
										{formatMaengde(l.maengde)}
										{l.enhed}
									{/if}
								</span>
								<span class="op-ing-pil" aria-hidden="true"
									>{aabenLinje === plads ? '⌄' : '›'}</span
								>
							</button>

							{#if aabenLinje === plads}
								<div class="op-ind">
									<div class="op-ind-rk">
										<button
											type="button"
											class="op-ind-knap"
											onclick={() => skru(plads, -1)}
											disabled={l.maengde === 0}
											aria-label="Mindre">−</button
										>
										<span class="op-ind-tal">
											{l.maengde === 0 ? 'Ikke i' : formatMaengde(l.maengde)}
											{#if l.maengde > 0}<span class="op-ind-e">{l.enhed}</span>{/if}
										</span>
										<button
											type="button"
											class="op-ind-knap"
											onclick={() => skru(plads, 1)}
											aria-label="Mere">+</button
										>
									</div>
									<div class="op-ind-bund">
										{#if l.egen}
											<!-- Hendes egen linje fjernes HELT. Den stod der ikke i
											     forvejen, saa der er intet at fortryde. -->
											<button type="button" class="op-ind-nul" onclick={() => fjernEgen(plads)}
												>Fjern fra retten</button
											>
										{:else if l.maengde > 0}
											<!-- Linns linje skrues til nul og bliver staaende. Den
											     hurtige vej, for langt det almindeligste svar er at
											     hun sprang noget over. -->
											<button type="button" class="op-ind-nul" onclick={() => tagIkkeI(plads)}
												>Jeg tog den ikke i</button
											>
										{/if}
									</div>
								</div>
							{/if}
						{/each}
					</div>

					{#if ontilfoej}
						<!-- Stiplet, saa den kan ses som en VEJ og ikke som en
						     ingrediens. Staar nederst, for listen skal foerst kunne
						     laeses som opskriften. -->
						<button type="button" class="op-tilfoej" onclick={ontilfoej}>
							<span class="op-tilfoej-pl" aria-hidden="true">+</span> Tilføj en ingrediens
						</button>
					{/if}
				{/if}
			{/if}

			{#if trin.length > 0}
				<div class="op-k">Fremgangsmåde</div>
				<!-- Hvert trin staar for sig med luft imellem. Foer loeb de sammen
				     til én blok, fordi opskrifterne ikke er skrevet ens: nogle har
				     hvert trin paa sin egen linje, andre har alle fire i én linje.
				     Se content/opskriftTekst3.ts. -->
				<div class="op-instruktioner">
					{#each trin as t, i (i)}
						<p class="op-trin" class:nr={t.nummereret}>{t.tekst}</p>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Hjertet sidder HER, ved siden af den knap hun i forvejen trykker paa,
		     saa hun ikke skal flytte haanden op i hjoernet. Linns valg 12. august.
		     Se SPEC-3.0.md. -->
		<div class="op-gem-rk">
			<!-- Knappen siger antallet naar det ikke er 1. Aabner arket paa 4, fordi
			     retten er skrevet til fire, skal hun kunne se hvad der bliver lagt i
			     uden at kigge op paa taelleren. -->
			{#if ongem}
				<button
					type="button"
					class="ma-gem op-gem"
					disabled={gemmer}
					onclick={() => ongem(portioner, aendring)}
				>
					{gemmer ? 'Gemmer' : gemEtiket(maaltidLabel, portioner)}
				</button>
			{/if}
			{#if onfavorit}
				<button
					type="button"
					class="op-hj"
					class:fyldt={erFavorit}
					aria-pressed={erFavorit}
					aria-label={HJERTE_ETIKET}
					onclick={onfavorit}
				>
					<svg
						viewBox="0 0 24 24"
						fill={erFavorit ? 'currentColor' : 'none'}
						stroke="currentColor"
						stroke-width="1.9"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path
							d="M12 20.5s-7.1-4.4-9-8.7C1.6 8.5 3.3 5.2 6.6 5.2c1.9 0 3.2 1 4 2.2l1.4 1.9 1.4-1.9c.8-1.2 2.1-2.2 4-2.2 3.3 0 5 3.3 3.6 6.6-1.9 4.3-9 8.7-9 8.7Z"
						/>
					</svg>
				</button>
			{/if}
		</div>
	</div>
</div>
