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
	import { formatMaengde, parseOpskriftMakro, skalerMaengde } from '$lib/content/opskrifter';
	import { formatPortion } from '$lib/content/maengde3';
	import { portal } from '$lib/actions/portal';

	interface Props {
		opskrift: Opskrift;
		maaltidLabel: string;
		gemmer?: boolean;
		ongem: (portioner: number) => void;
		ontilbage: () => void;
	}

	let { opskrift, maaltidLabel, gemmer = false, ongem, ontilbage }: Props = $props();

	const basis = $derived(opskrift.defaultPortioner || 1);
	let portioner = $state(1);

	const makro = $derived(parseOpskriftMakro(opskrift.instruktioner));
	const protein = $derived(Math.round((makro.protein ?? 0) * portioner * 10) / 10);
	const fiber = $derived(Math.round((makro.fiber ?? 0) * portioner * 10) / 10);

	// En halv portion er en almindelig maengde, saa vi springer halve.
	const SPRING = 0.5;

	function flyt(retning: 1 | -1) {
		const ny = portioner + SPRING * retning;
		if (ny < SPRING) return;
		portioner = Math.round(ny * 100) / 100;
	}
</script>

<!-- ny-tokens: arket flyttes ud af .ny-app, saa farverne skal foelge med. -->
<div class="ark-lag ny-tokens" use:portal role="dialog" aria-modal="true" aria-labelledby="op-titel">
	<button type="button" class="ark-luk-flade" onclick={ontilbage} aria-label="Tilbage"></button>
	<div class="va-ark op-ark">
		<div class="ma-greb" aria-hidden="true"></div>
		<button type="button" class="ma-luk" onclick={ontilbage} aria-label="Tilbage til listen">×</button>

		<div class="op-rul">
			{#if opskrift.billedeUrl}
				<img class="op-billede" src={opskrift.billedeUrl} alt="" />
			{/if}

			<h2 class="op-titel" id="op-titel">{opskrift.titel}</h2>
			{#if opskrift.beskrivelse}
				<p class="op-beskrivelse">{opskrift.beskrivelse}</p>
			{/if}

			<div class="op-makro">
				<div>
					<div class="op-m-navn">Protein</div>
					<div class="op-m-tal">{formatPortion(protein)} g</div>
				</div>
				<div>
					<div class="op-m-navn">Fiber</div>
					<div class="op-m-tal">{formatPortion(fiber)} g</div>
				</div>
			</div>

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
				<button type="button" class="ma-st-knap" onclick={() => flyt(1)} aria-label="Mere">+</button>
			</div>

			{#if opskrift.ingredienser?.length}
				<div class="op-k">Ingredienser</div>
				<div class="op-ingredienser">
					{#each opskrift.ingredienser as ing (ing.navn + ing.maengde)}
						<div>
							<span class="op-i-navn">{ing.navn}</span>
							<span class="op-i-m">
								{formatMaengde(skalerMaengde(ing.maengde, basis, basis * portioner))}
								{ing.enhed}
							</span>
						</div>
					{/each}
				</div>
			{/if}

			{#if opskrift.instruktioner?.trim()}
				<div class="op-k">Fremgangsmåde</div>
				<div class="op-instruktioner">{opskrift.instruktioner}</div>
			{/if}
		</div>

		<button type="button" class="ma-gem op-gem" disabled={gemmer} onclick={() => ongem(portioner)}>
			{gemmer ? 'Gemmer' : `Læg i ${maaltidLabel.toLowerCase()}`}
		</button>
	</div>
</div>
