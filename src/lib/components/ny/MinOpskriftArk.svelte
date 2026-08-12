<script lang="ts">
	// ============================================================
	// Kundens EGEN opskrift. Se SPEC-3.0.md afsnit 26.11.
	//
	// Den ligner Linns opskrift-ark, men er enklere paa ét punkt: der er
	// ingen fremgangsmaade. AI'en laeser kun ingredienser og makro af
	// billedet, saa der er intet at vise.
	//
	// Og den kan én ting Linns ikke kan: hun saetter selv hvilke
	// maaltider opskriften hoerer til, og hun kan rette det bagefter.
	// Linns beslutning 12. august. Uden det ville de 222 opskrifter der
	// er lavet i den gamle app aldrig kunne faa et maaltid, for de har
	// ingen og kan ikke faa et af sig selv.
	//
	// Maaltiderne gemmes MED DET SAMME naar hun trykker, praecis som
	// hjertet paa Linns opskrifter. Fejler skrivningen, rulles visningen
	// tilbage uden en fejlbesked: hun har ikke mistet noget, og et
	// maaltids-maerke er ikke vigtigt nok til at afbryde hende midt i at
	// registrere sin mad.
	// ============================================================

	import { portal } from '$lib/actions/portal';
	import { formatPortion } from '$lib/content/maengde3';
	import { KATEGORIER3, KATEGORI_NAVN, type Kategori3 } from '$lib/content/opskriftKategori3';
	import {
		START_PORTIONER,
		ingrediensMaengde,
		makroFor,
		type MinOpskrift3
	} from '$lib/content/mineOpskrifter3';

	interface Props {
		opskrift: MinOpskrift3;
		/** De maaltider den hoerer til lige nu, hendes valg eller gaettet. */
		kategorier: Kategori3[];
		maaltidLabel: string;
		gemmer?: boolean;
		visUdvidet?: boolean;
		ongem: (portioner: number) => void;
		onkategorier: (kategorier: Kategori3[]) => void;
		onslet: () => void;
		ontilbage: () => void;
	}

	let {
		opskrift,
		kategorier,
		maaltidLabel,
		gemmer = false,
		visUdvidet = false,
		ongem,
		onkategorier,
		onslet,
		ontilbage
	}: Props = $props();

	// Kun STARTvaerdien. Arket bygges forfra hver gang hun aabner en
	// opskrift, saa den starter altid paa én portion.
	// svelte-ignore state_referenced_locally
	let portioner = $state(START_PORTIONER);
	let spoergSlet = $state(false);

	const makro = $derived(makroFor(opskrift, portioner));
	const antal = $derived(opskrift.antalPortioner || 1);
	const harKategorier = $derived(kategorier.length > 0);

	function flyt(retning: 1 | -1) {
		const ny = portioner + retning * 0.5;
		if (ny < 0.5) return;
		portioner = Math.round(ny * 100) / 100;
	}

	function slaa(k: Kategori3) {
		const ny = kategorier.includes(k)
			? kategorier.filter((x) => x !== k)
			: [...kategorier, k];
		// Altid i fast raekkefoelge, saa to opskrifter aldrig staar med
		// maaltiderne i hver sin orden.
		onkategorier(KATEGORIER3.filter((x) => ny.includes(x)));
	}
</script>

<!-- ny-tokens: arket flyttes ud af .ny-app, saa farverne skal foelge med. -->
<div class="ark-lag ny-tokens" use:portal role="dialog" aria-modal="true" aria-labelledby="mo-titel">
	<button type="button" class="ark-luk-flade" onclick={ontilbage} aria-label="Tilbage"></button>
	<div class="va-ark op-ark">
		<div class="ma-greb" aria-hidden="true"></div>
		<button type="button" class="ma-luk" onclick={ontilbage} aria-label="Tilbage til listen">×</button>

		<div class="op-rul">
			{#if opskrift.billedeUrl}
				<img class="op-billede" src={opskrift.billedeUrl} alt="" />
			{/if}

			<h2 class="op-titel" id="mo-titel">{opskrift.navn}</h2>
			<p class="mo-egen">Din egen opskrift</p>

			{#if opskrift.beskrivelse}
				<p class="op-beskrivelse">{opskrift.beskrivelse}</p>
			{/if}

			<div class="op-makro">
				<div>
					<div class="op-m-navn">Protein</div>
					<div class="op-m-tal">{formatPortion(makro.protein)} g</div>
				</div>
				<div>
					<div class="op-m-navn">Fiber</div>
					<div class="op-m-tal">{formatPortion(makro.fiber)} g</div>
				</div>
				{#if visUdvidet}
					<div>
						<div class="op-m-navn">Kulhydrat</div>
						<div class="op-m-tal blaeg">{formatPortion(makro.kh)} g</div>
					</div>
					<div>
						<div class="op-m-navn">Fedt</div>
						<div class="op-m-tal blaeg">{formatPortion(makro.fedt)} g</div>
					</div>
				{/if}
			</div>
			{#if visUdvidet}
				<div class="op-kcal">{makro.kcal} kcal</div>
			{/if}

			<div class="op-k">Hvor meget spiste du?</div>
			<div class="ma-stepper op-stepper">
				<button
					type="button"
					class="ma-st-knap"
					onclick={() => flyt(-1)}
					disabled={portioner <= 0.5}
					aria-label="Mindre">−</button
				>
				<span class="ma-st-vaerdi">
					<span class="op-st-tal">{formatPortion(portioner)}</span>
					<span class="ma-st-spring">{portioner === 1 ? 'portion' : 'portioner'}</span>
				</span>
				<button type="button" class="ma-st-knap" onclick={() => flyt(1)} aria-label="Mere">+</button>
			</div>

			{#if opskrift.ingredienser.length > 0}
				<div class="op-k">
					Ingredienser
					{#if antal !== 1}<span class="mo-raekker">listen rækker til {antal} portioner</span>{/if}
				</div>
				<div class="op-ingredienser">
					{#each opskrift.ingredienser as ing, i (i)}
						<div class="op-ingrediens">
							<span class="op-i-navn">{ing.navn}</span>
							<span class="op-i-m">
								{formatPortion(ingrediensMaengde(ing.maengde, antal, portioner))}
								{ing.enhed}
							</span>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Maaltiderne. Hun maa vaelge flere: en suppe er tit baade
			     frokost og aftensmad. -->
			<div class="op-k">Hvilke måltider passer den til?</div>
			<div class="ma-chips mo-chips">
				{#each KATEGORIER3 as k (k)}
					<button
						type="button"
						class="ma-chip"
						class:valgt={kategorier.includes(k)}
						aria-pressed={kategorier.includes(k)}
						onclick={() => slaa(k)}
					>
						{KATEGORI_NAVN[k]}
					</button>
				{/each}
			</div>
			{#if !harKategorier}
				<p class="mo-hjaelp">
					Den har ingen endnu, så den vises under alle måltider. Vælg et, så ligger den det rigtige
					sted næste gang.
				</p>
			{/if}

			<!-- Sletning spoerger foerst. Her er der ingen Fortryd at falde
			     tilbage paa, og hun mister noget hun selv har lavet. -->
			{#if spoergSlet}
				<div class="mo-slet-boks">
					<span class="mo-slet-t">Slet {opskrift.navn}?</span>
					<span class="mo-slet-n">
						Opskriften og dens billede fjernes. Det du allerede har spist bliver stående i din
						dagbog.
					</span>
					<div class="mo-slet-k">
						<button type="button" class="mo-slet-nej" onclick={() => (spoergSlet = false)}>
							Behold
						</button>
						<button type="button" class="mo-slet-ja" onclick={onslet}>Slet</button>
					</div>
				</div>
			{:else}
				<button type="button" class="mo-slet-link" onclick={() => (spoergSlet = true)}>
					Slet opskriften
				</button>
			{/if}
		</div>

		<button type="button" class="ma-gem" disabled={gemmer} onclick={() => ongem(portioner)}>
			Læg i {maaltidLabel.toLowerCase()}
		</button>
	</div>
</div>
