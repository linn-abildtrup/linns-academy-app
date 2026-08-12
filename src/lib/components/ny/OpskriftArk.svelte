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
	import { HJERTE_ETIKET } from '$lib/content/favoritOpskrift3';
	import { portal } from '$lib/actions/portal';

	interface Props {
		opskrift: Opskrift;
		maaltidLabel: string;
		gemmer?: boolean;
		/** Har hun markeret den her opskrift? */
		erFavorit?: boolean;
		ongem: (portioner: number) => void;
		/** Slaar bogmaerket til eller fra. Udeladt = intet hjerte. */
		onfavorit?: (() => void) | null;
		ontilbage: () => void;
	}

	let {
		opskrift,
		maaltidLabel,
		gemmer = false,
		erFavorit = false,
		ongem,
		onfavorit = null,
		ontilbage
	}: Props = $props();

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

		<!-- Hjertet sidder HER, ved siden af den knap hun i forvejen trykker paa,
		     saa hun ikke skal flytte haanden op i hjoernet. Linns valg 12. august.
		     Se SPEC-3.0.md. -->
		<div class="op-gem-rk">
			<button type="button" class="ma-gem op-gem" disabled={gemmer} onclick={() => ongem(portioner)}>
				{gemmer ? 'Gemmer' : `Læg i ${maaltidLabel.toLowerCase()}`}
			</button>
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
