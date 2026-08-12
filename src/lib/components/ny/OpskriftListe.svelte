<script lang="ts">
	// ============================================================
	// Opskrift-listen i 30-30 beregneren. Se SPEC-3.0.md afsnit 26.
	//
	// To i bredden med farvet flise efter maaltid. Fliserne bliver hvor de
	// er naar hun soeger, der bliver bare faerre af dem. Et gitter der
	// skifter til en liste under fingrene er forvirrende.
	//
	// Det maalte fund der former skaermen: 56% af alle soegetraeffer har
	// IKKE ordet i titlen. Soeger hun paa tomat kommer der 35 frem, og paa
	// de 31 staar ordet kun i ingredienslisten. Derfor skriver flisen
	// grunden til at den kom med, saa ingen flise ser ud som en fejl.
	//
	// Filtrene ligger i et eget ark, se OpskriftFiltre.svelte. De laa foer
	// som tre raekker knapper her og aad 215 pixels foer den foerste
	// opskrift. Nu er hovedet 92.
	//
	// Maaltidet er forvalgt ud fra den skaerm hun kom fra: aabner hun
	// listen inde fra Frokost, staar den paa frokost. Det er det
	// almindelige tilfaelde, og det koster nul tryk. Fordi filtrene er
	// skjulte, SKAL det kunne ses at listen er begraenset. Derfor staar
	// maaltidet i overskriften og et tal paa filter-knappen.
	// ============================================================

	import { portal } from '$lib/actions/portal';
	import OpskriftFiltre from './OpskriftFiltre.svelte';
	import {
		filtrerOpskrifter3,
		fremhaev,
		grundTekst,
		soegetermer
	} from '$lib/content/opskriftSoeg3';
	import {
		KATEGORI_NAVN,
		antalPrKategori,
		farveKategori,
		fliseBogstav,
		type Kategori3
	} from '$lib/content/opskriftKategori3';
	import { kunFavoritter } from '$lib/content/favoritOpskrift3';
	import type { Opskrift3 } from '$lib/firestore/opskrifter3';
	import type { DietTag } from '$lib/content/opskrifter';

	interface Props {
		opskrifter: Opskrift3[];
		henter?: boolean;
		/** Maaltidet hun kom fra. Forvaelges. null = ingen forvalg. */
		startKategori?: Kategori3 | null;
		/** Id'erne paa de opskrifter hun har markeret. Se favoritOpskrift3.ts. */
		favoritter?: string[];
		onvaelg: (id: string) => void;
		onluk: () => void;
	}

	let {
		opskrifter,
		henter = false,
		startKategori = null,
		favoritter = [],
		onvaelg,
		onluk
	}: Props = $props();

	// Fanerne. Alle er forvalgt, saa hun lander praecis hvor hun landede foer
	// favoritterne fandtes, og intet aendrer sig for den der ikke bruger dem.
	let fane = $state<'alle' | 'favoritter'>('alle');

	/** Alle hendes favoritter, UDEN maaltid og soegning. Tallet paa fanen. */
	const favoritListe = $derived(kunFavoritter(opskrifter, favoritter));

	/**
	 * Den liste alt andet regnes ud fra. Fanen er altsaa bare endnu et filter,
	 * lagt foerst, saa maaltid, kost og soegning virker praecis ens paa begge
	 * faner uden at nogen af dem skal vide at fanerne findes.
	 */
	const grundliste = $derived(fane === 'favoritter' ? favoritListe : opskrifter);

	let soegeord = $state('');
	// Kun STARTvaerdien, med vilje. Aendrer hun filteret bagefter, skal
	// forvalget ikke traekke det tilbage. Arket bygges forfra hver gang hun
	// aabner det, saa hun faar altid det rigtige maaltid forvalgt.
	// svelte-ignore state_referenced_locally
	let valgteKategorier = $state<Kategori3[]>(startKategori ? [startKategori] : []);
	let valgteDiet = $state<DietTag[]>([]);
	let filtreAabne = $state(false);

	const termer = $derived(soegetermer(soegeord));

	/** Listen efter soegning og diaet, men UDEN kategori-filteret. Tallene ud
	    for kategorierne taelles paa den, saa tallet siger hvad hun faar hvis
	    hun trykker, ikke hvad hun allerede har. */
	const udenKategori = $derived(
		filtrerOpskrifter3(grundliste, { soegeord, dietTags: valgteDiet })
	);
	const antal = $derived(antalPrKategori(udenKategori.map((r) => r.opskrift)));

	/** Samme for kost-knapperne: talt uden diaet-filteret selv. */
	const udenDiet = $derived(
		filtrerOpskrifter3(grundliste, { soegeord, kategorier: valgteKategorier })
	);
	const dietAntal = $derived<Record<DietTag, number>>({
		vegetar: udenDiet.filter((r) => r.opskrift.dietTags.includes('vegetar')).length,
		glutenfri: udenDiet.filter((r) => r.opskrift.dietTags.includes('glutenfri')).length
	});

	const resultater = $derived(
		filtrerOpskrifter3(grundliste, {
			soegeord,
			kategorier: valgteKategorier,
			dietTags: valgteDiet
		})
	);

	/** Hvor mange der er inden for filtrene UDEN soegning. Staar i
	    soegefeltet, saa hun ved hvad hun soeger i. */
	const udenSoegning = $derived(
		filtrerOpskrifter3(grundliste, {
			kategorier: valgteKategorier,
			dietTags: valgteDiet
		}).length
	);

	const antalFiltre = $derived(valgteKategorier.length + valgteDiet.length);
	const harFiltre = $derived(antalFiltre > 0);
	const soeger = $derived(termer.length > 0);
	const paaFavoritter = $derived(fane === 'favoritter');
	/** Hun staar paa Favoritter og har slet ingen. En anden tom skaerm end
	    "ingen passer paa filtrene", for der er intet at rydde. */
	const ingenFavoritter = $derived(paaFavoritter && favoritListe.length === 0);

	/** Staar der praecis ét maaltid, siger overskriften hvilket. Det er den
	    eneste plads hvor begraensningen kan ses gratis, nu hvor filtrene er
	    gemt vaek. Maaltids-forvalget gaelder BEGGE faner, Linns valg 12.
	    august, saa overskriften skal ogsaa sige det paa Favoritter. */
	const overskrift = $derived.by(() => {
		const hvad = paaFavoritter ? 'Favoritter' : 'Opskrifter';
		if (valgteKategorier.length === 1) {
			return `${hvad} til ${KATEGORI_NAVN[valgteKategorier[0]].toLowerCase()}`;
		}
		return hvad;
	});

	function slaaKategori(k: Kategori3) {
		valgteKategorier = valgteKategorier.includes(k)
			? valgteKategorier.filter((x) => x !== k)
			: [...valgteKategorier, k];
	}

	function slaaDiet(d: DietTag) {
		valgteDiet = valgteDiet.includes(d) ? valgteDiet.filter((x) => x !== d) : [...valgteDiet, d];
	}

	function ryd() {
		valgteKategorier = [];
		valgteDiet = [];
	}

	function fokuser(node: HTMLInputElement) {
		// Tastaturet maa ikke springe op af sig selv. Hun vil oftest bladre
		// foerst, og et tastatur ville daekke halvdelen af listen.
		node.blur();
	}
</script>

<!-- ny-tokens: arket flyttes ud af .ny-app, saa farverne skal foelge med. -->
<div class="ark-lag ny-tokens" use:portal role="dialog" aria-modal="true" aria-labelledby="ol-titel">
	<button type="button" class="ark-luk-flade" onclick={onluk} aria-label="Luk"></button>
	<div class="ol-ark">
		<div class="ma-greb" aria-hidden="true"></div>
		<button type="button" class="ma-luk" onclick={onluk} aria-label="Luk">×</button>

		<div class="ol-hoved">
			<h2 class="ol-titel" id="ol-titel">{overskrift}</h2>
			{#if harFiltre && grundliste.length > 0}
				<!-- Vejen ud af begraensningen, ét tryk. Uden den ville hun skulle
				     ind i filter-arket for at komme tilbage til alle 130.
				     Tallet foelger fanen: paa Favoritter staar der hendes eget
				     antal, saa knappen aldrig lover flere end der findes. -->
				<button type="button" class="ol-alle" onclick={ryd}>
					Vis alle {grundliste.length}
				</button>
			{/if}
		</div>

		<!-- Fanerne. Maaltids-forvalget gaelder begge, saa de opfoerer sig ens.
		     Se SPEC-3.0.md.

		     role="group" med aria-pressed, IKKE tablist og tab. De rigtige
		     fane-roller lover en skaermlaeser at der hoerer et panel til hver
		     fane, og at piletasterne skifter mellem dem. Det har vi ikke bygget,
		     og et loefte vi ikke holder er vaerre end ingen rolle. Det er ogsaa
		     samme moenster som filter-knapperne, se OpskriftFiltre.svelte. -->
		<div class="ol-faner" role="group" aria-label="Vis alle opskrifter eller kun dine favoritter">
			<button
				type="button"
				class="ol-fane"
				class:valgt={!paaFavoritter}
				aria-pressed={!paaFavoritter}
				onclick={() => (fane = 'alle')}
			>
				Alle <span class="ol-fane-tal">{opskrifter.length}</span>
			</button>
			<button
				type="button"
				class="ol-fane"
				class:valgt={paaFavoritter}
				aria-pressed={paaFavoritter}
				onclick={() => (fane = 'favoritter')}
			>
				Favoritter <span class="ol-fane-tal">{favoritListe.length}</span>
			</button>
		</div>

		<div class="ol-linje">
			<input
				class="ol-soeg"
				type="search"
				bind:value={soegeord}
				use:fokuser
				placeholder="Søg blandt {udenSoegning} {paaFavoritter ? 'favoritter' : 'opskrifter'}"
				aria-label="Søg i opskrifter"
			/>
			<button
				type="button"
				class="ol-filterknap"
				class:aktiv={harFiltre}
				onclick={() => (filtreAabne = true)}
				aria-label="Filtre{harFiltre ? `, ${antalFiltre} valgt` : ''}"
			>
				Filtre
				{#if harFiltre}<span class="ol-badge">{antalFiltre}</span>{/if}
			</button>
		</div>

		{#if soeger}
			<p class="ol-traef" aria-live="polite">
				{resultater.length === 0
					? 'Ingen træffere'
					: resultater.length === 1
						? '1 træffer'
						: `${resultater.length} træffere`}
			</p>
		{/if}

		<div class="ol-liste">
			{#if henter}
				<p class="ol-tom">Henter opskrifter</p>
			{:else if resultater.length === 0}
				<div class="ol-tom">
					{#if ingenFavoritter}
						<!-- Hun har slet ingen. Der er intet filter at rydde, saa vejen
						     videre er at fortaelle hvor hjertet sidder. -->
						<p>Du har ingen favoritter endnu.</p>
						<p class="ol-tom-hjaelp">
							Åbn en opskrift du kan lide, og tryk på hjertet ved siden af knappen nederst.
							Så ligger den her næste gang.
						</p>
						<button type="button" class="ol-udvej" onclick={() => (fane = 'alle')}>
							Se alle {opskrifter.length} opskrifter
						</button>
					{:else if soeger && harFiltre}
						<p>Ingen {paaFavoritter ? 'favoritter' : 'opskrifter'} passer på både søgningen og filtrene.</p>
						<button type="button" class="ol-udvej" onclick={ryd}>Søg i alle {grundliste.length}</button>
					{:else if soeger}
						<p>Ingen {paaFavoritter ? 'favoritter' : 'opskrifter'} passer på det ord.</p>
					{:else if harFiltre}
						<!-- Hun HAR favoritter, men ingen til det maaltid hun kom fra.
						     Tallet skal med, ellers modsiger fanen skaermen. -->
						<p>
							{#if paaFavoritter}
								Ingen af dine favoritter er til {valgteKategorier.length === 1
									? KATEGORI_NAVN[valgteKategorier[0]].toLowerCase()
									: 'det valgte'}.
							{:else}
								Ingen opskrifter passer på filtrene.
							{/if}
						</p>
						{#if paaFavoritter}
							<p class="ol-tom-hjaelp">
								Du har {grundliste.length}
								{grundliste.length === 1 ? 'favorit' : 'favoritter'} i alt.
							</p>
						{/if}
						<button type="button" class="ol-udvej" onclick={ryd}>Vis alle {grundliste.length}</button>
					{:else}
						<p>Der er ingen opskrifter endnu.</p>
					{/if}
				</div>
			{:else}
				<div class="ol-gitter">
					{#each resultater as r (r.opskrift.id)}
						{@const farve = farveKategori(r.opskrift.kategorier3, valgteKategorier)}
						{@const grund = grundTekst(r.grunde)}
						<button type="button" class="ol-flise" onclick={() => onvaelg(r.opskrift.id)}>
							<span class="ol-top f-{farve ?? 'andet'}">
								{#if r.opskrift.billedeUrlLille || r.opskrift.billedeUrl}
									<!-- Den lille er 480 px og vejer cirka 17 KB. Findes den ikke,
									     falder vi tilbage til den store, saa de to billeder der blev
									     flyttet 11. august stadig vises. -->
									<img
										class="ol-foto"
										src={r.opskrift.billedeUrlLille ?? r.opskrift.billedeUrl}
										alt=""
										loading="lazy"
										decoding="async"
									/>
									{#if farve}
										<span class="ol-maerkat">{KATEGORI_NAVN[farve]}</span>
									{/if}
								{:else}
									<span class="ol-bogstav" aria-hidden="true"
										>{fliseBogstav(r.opskrift.titel)}</span
									>
								{/if}
							</span>
							<span class="ol-tekst">
								<span class="ol-navn">
									{#each fremhaev(r.opskrift.titel, termer) as del, i (i)}
										{#if del.traef}<mark>{del.tekst}</mark>{:else}{del.tekst}{/if}
									{/each}
								</span>
								<span class="ol-makro">
									{#if r.opskrift.protein !== null}{Math.round(r.opskrift.protein)} g protein{/if}
									{#if r.opskrift.protein !== null && r.opskrift.fiber !== null}
										·
									{/if}
									{#if r.opskrift.fiber !== null}{Math.round(r.opskrift.fiber)} g fiber{/if}
								</span>
								{#if grund}
									<!-- Grunden til at flisen kom med, naar ordet ikke er i titlen. -->
									<span class="ol-grund">
										<span class="ol-grund-ikon" aria-hidden="true">↳</span>
										<span>{grund}</span>
									</span>
								{/if}
							</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

{#if filtreAabne}
	<OpskriftFiltre
		{valgteKategorier}
		{valgteDiet}
		{antal}
		{dietAntal}
		resultatAntal={resultater.length}
		onkategori={slaaKategori}
		ondiet={slaaDiet}
		onnulstil={ryd}
		onluk={() => (filtreAabne = false)}
	/>
{/if}
