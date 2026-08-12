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
	import { formatPortion } from '$lib/content/maengde3';
	import { HJERTE_ETIKET } from '$lib/content/favoritOpskrift3';
	import {
		startPortioner,
		ingrediensMaengde,
		makroForPortioner,
		gemEtiket
	} from '$lib/content/opskriftPortion3';
	import { portal } from '$lib/actions/portal';

	interface Props {
		opskrift: Opskrift;
		maaltidLabel: string;
		gemmer?: boolean;
		/** Maa hun se kulhydrat, fedt og kalorier? Se SPEC-3.0.md 26.5. */
		visUdvidet?: boolean;
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
		visUdvidet = false,
		erFavorit = false,
		ongem,
		onfavorit = null,
		ontilbage
	}: Props = $props();

	// Arket aabner paa opskriftens eget tal, altsaa 1 for de fleste og 4 for de
	// retter der er skrevet til en familie. Linns valg 12. august: listen skal
	// kunne laeses direkte som opskrift. Skruer hun ned til 1, regner baade
	// makro og ingredienser sig om med det samme.
	//
	// Kun STARTvaerdien. Arket bygges forfra hver gang hun aabner en opskrift,
	// for listen bagved kan ikke naas mens arket er aabent.
	// svelte-ignore state_referenced_locally
	let portioner = $state(startPortioner(opskrift.defaultPortioner));

	const makro = $derived(parseOpskriftMakro(opskrift.instruktioner));
	// Makroen er PR PORTION, ogsaa paa de retter der er til fire. Derfor ganges
	// der kun med antal portioner, og defaultPortioner indgaar aldrig. Se
	// content/opskriftPortion3.ts for maalingerne bag.
	const protein = $derived(makroForPortioner(makro.protein ?? 0, portioner) ?? 0);
	const fiber = $derived(makroForPortioner(makro.fiber ?? 0, portioner) ?? 0);
	// Alle fem skalerer ens. Kulhydrat, fedt og kalorier vises kun med adgang,
	// men regnes altid ud, saa de kan gemmes uanset. Se SPEC-3.0.md 26.5.
	const kh = $derived(makroForPortioner(makro.kh ?? 0, portioner) ?? 0);
	const fedt = $derived(makroForPortioner(makro.fedt ?? 0, portioner) ?? 0);
	const kalorier = $derived(Math.round(makroForPortioner(makro.kalorier ?? 0, portioner) ?? 0));

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

			<!-- Protein og fiber er metodens tal og staar groent. Kulhydrat og fedt
			     er til orientering og staar daempet, saa skaermen ikke ser ud som om
			     alle fire er lige vigtige. Samme opdeling som i maengde-arket.
			     Se SPEC-3.0.md 26.5. -->
			<div class="op-makro">
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
								{formatMaengde(
									ingrediensMaengde(ing.maengde, opskrift.defaultPortioner, portioner)
								)}
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
			<!-- Knappen siger antallet naar det ikke er 1. Aabner arket paa 4, fordi
			     retten er skrevet til fire, skal hun kunne se hvad der bliver lagt i
			     uden at kigge op paa taelleren. -->
			<button type="button" class="ma-gem op-gem" disabled={gemmer} onclick={() => ongem(portioner)}>
				{gemmer ? 'Gemmer' : gemEtiket(maaltidLabel, portioner)}
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
