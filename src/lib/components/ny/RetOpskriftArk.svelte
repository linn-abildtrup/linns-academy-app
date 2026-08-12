<script lang="ts">
	// ============================================================
	// At rette i en af hendes egne opskrifter. Se SPEC-3.0.md 26.11.
	//
	// ARKET BRUGES TO STEDER, og det er derfor det arbejder paa et
	// udkast og ikke paa dokumentet:
	//   1. naar hun retter en opskrift hun har
	//   2. naar hun gennemgaar det AI'en har laest af et billede, foer
	//      hun gemmer det foerste gang
	//
	// Felterne er tekst mens hun skriver, ikke tal. Et talfelt der bliver
	// til NaN midt i en indtastning er en klassisk maade at tabe det hun
	// har skrevet paa, og hun skal kunne naa at skrive "1," foer "1,5".
	// Se talFra i mineOpskrifter3.ts.
	//
	// Kulhydrat, fedt og kalorier vises kun hvis hun maa se dem, praecis
	// som resten af modulet. Tallene bliver staaende uroert i dokumentet
	// naar de er skjult, saa de ikke gaar tabt den dag Linn giver et hold
	// adgang. Se SPEC 26.5.
	// ============================================================

	import { portal } from '$lib/actions/portal';
	import {
		ENHEDER,
		hvadMangler,
		tomIngrediens,
		udkastDuger,
		type OpskriftUdkast
	} from '$lib/content/mineOpskrifter3';

	interface Props {
		/** Startpunktet. Arket bygges forfra hver gang, saa det er kun start. */
		start: OpskriftUdkast;
		titel: string;
		gemTekst: string;
		gemmer?: boolean;
		visUdvidet?: boolean;
		ongem: (udkast: OpskriftUdkast) => void;
		onluk: () => void;
	}

	let {
		start,
		titel,
		gemTekst,
		gemmer = false,
		visUdvidet = false,
		ongem,
		onluk
	}: Props = $props();

	// Kun STARTvaerdien, med vilje. Arket bygges forfra hver gang hun
	// aabner det, og et forslag udefra maa ikke tage det hun skriver.
	// svelte-ignore state_referenced_locally
	let udkast = $state<OpskriftUdkast>({
		...start,
		ingredienser: start.ingredienser.map((i) => ({ ...i })),
		makro: { ...start.makro }
	});

	const mangler = $derived(hvadMangler(udkast));
	const kanGemme = $derived(udkastDuger(udkast) && !gemmer);

	function tilfoej() {
		udkast.ingredienser = [...udkast.ingredienser, tomIngrediens()];
	}

	function fjern(i: number) {
		udkast.ingredienser = udkast.ingredienser.filter((_, n) => n !== i);
	}

	function flytPortioner(retning: 1 | -1) {
		const ny = (udkast.antalPortioner || 1) + retning;
		if (ny < 1) return;
		udkast.antalPortioner = ny;
	}
</script>

<!-- ny-tokens: arket flyttes ud af .ny-app, saa farverne skal foelge med. -->
<div class="ark-lag ny-tokens" use:portal role="dialog" aria-modal="true" aria-labelledby="ro-titel">
	<button type="button" class="ark-luk-flade" onclick={onluk} aria-label="Luk"></button>
	<div class="va-ark op-ark">
		<div class="ma-greb" aria-hidden="true"></div>
		<button type="button" class="ma-luk" onclick={onluk} aria-label="Luk">×</button>

		<div class="op-rul">
			<h2 class="op-titel" id="ro-titel">{titel}</h2>

			<div class="ro-k">Navn</div>
			<input class="ro-felt" type="text" bind:value={udkast.navn} maxlength="80" aria-label="Navn" />

			<div class="ro-k">Hvor mange portioner rækker opskriften til?</div>
			<div class="ma-stepper ro-stepper">
				<button
					type="button"
					class="ma-st-knap"
					onclick={() => flytPortioner(-1)}
					disabled={udkast.antalPortioner <= 1}
					aria-label="Færre">−</button
				>
				<span class="ma-st-vaerdi">
					<span class="op-st-tal">{udkast.antalPortioner}</span>
					<span class="ma-st-spring">{udkast.antalPortioner === 1 ? 'portion' : 'portioner'}</span>
				</span>
				<button
					type="button"
					class="ma-st-knap"
					onclick={() => flytPortioner(1)}
					aria-label="Flere">+</button
				>
			</div>
			<p class="ro-hjaelp">
				Det gælder kun ingredienslisten. Næringen herunder er altid pr portion.
			</p>

			<div class="ro-k">Ingredienser</div>
			<div class="ro-ing">
				{#each udkast.ingredienser as ing, i (i)}
					<div class="ro-i-raekke">
						<input
							class="ro-felt ro-i-navn"
							type="text"
							bind:value={ing.navn}
							placeholder="Navn"
							aria-label="Ingrediens {i + 1}"
						/>
						<input
							class="ro-felt ro-i-m"
							type="text"
							inputmode="decimal"
							bind:value={ing.maengde}
							placeholder="0"
							aria-label="Mængde"
						/>
						<select class="ro-felt ro-i-e" bind:value={ing.enhed} aria-label="Enhed">
							{#each ENHEDER as e (e)}
								<option value={e}>{e}</option>
							{/each}
						</select>
						<button
							type="button"
							class="ro-i-fjern"
							onclick={() => fjern(i)}
							aria-label="Fjern {ing.navn || 'ingrediensen'}">×</button
						>
					</div>
				{/each}
			</div>
			<button type="button" class="ro-tilfoej" onclick={tilfoej}>+ Tilføj ingrediens</button>

			<div class="ro-k">Næring pr portion</div>
			<div class="ro-makro">
				<label class="ro-m">
					<span>Protein</span>
					<input type="text" inputmode="decimal" bind:value={udkast.makro.protein} />
					<i>g</i>
				</label>
				<label class="ro-m">
					<span>Fiber</span>
					<input type="text" inputmode="decimal" bind:value={udkast.makro.fiber} />
					<i>g</i>
				</label>
				{#if visUdvidet}
					<label class="ro-m">
						<span>Kulhydrat</span>
						<input type="text" inputmode="decimal" bind:value={udkast.makro.kh} />
						<i>g</i>
					</label>
					<label class="ro-m">
						<span>Fedt</span>
						<input type="text" inputmode="decimal" bind:value={udkast.makro.fedt} />
						<i>g</i>
					</label>
					<label class="ro-m">
						<span>Kalorier</span>
						<input type="text" inputmode="decimal" bind:value={udkast.makro.kcal} />
						<i>kcal</i>
					</label>
				{/if}
			</div>

			{#if mangler}
				<p class="ro-mangler">{mangler}</p>
			{/if}
		</div>

		<button type="button" class="ma-gem" disabled={!kanGemme} onclick={() => ongem(udkast)}>
			{gemmer ? 'Gemmer' : gemTekst}
		</button>
	</div>
</div>
