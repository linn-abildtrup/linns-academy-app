<script lang="ts">
	// ============================================================
	// Maengde-arket. Se SPEC-3.0.md afsnit 26.3.
	//
	// Glider op nedefra, saa maaltidet bliver staaende bagved og hun
	// ikke mister fornemmelsen af hvad hun var i gang med.
	//
	// To veje, i den raekkefoelge de bruges:
	//   1. GENVEJE. Madvarens egne portioner, hendes saedvanlige valgt.
	//      Ni ud af ti gange er hun faerdig her.
	//   2. PLUS OG MINUS med enhed, naar hun trykker Anden maengde.
	//
	// Tallene opdaterer sig levende, mens hun trykker. Det er halvdelen
	// af pointen: hun laerer hvad 65 g havregryn giver, uden at nogen
	// fortaeller hende det.
	// ============================================================

	import type { Fodevare } from '$lib/content/kost';
	import {
		enhederFor,
		formatPortion,
		genvejeFor,
		kanTrykkeMinus,
		naeringFor,
		skridt,
		springFor
	} from '$lib/content/maengde3';
	import { portal } from '$lib/actions/portal';

	interface Props {
		food: Fodevare;
		maaltidLabel: string;
		/** Den maengde hun plejer at bruge, hvis vi kender den. */
		saedvanlig?: { portion: number; enhedId?: string } | null;
		gemmer?: boolean;
		ongem: (portion: number, enhedId: string | undefined) => void;
		onluk: () => void;
	}

	let { food, maaltidLabel, saedvanlig = null, gemmer = false, ongem, onluk }: Props = $props();

	const genveje = $derived(genvejeFor(food, saedvanlig));
	const enheder = $derived(enhederFor(food));

	// Hendes saedvanlige er valgt paa forhaand. Hun skal ikke traeffe et
	// valg hun allerede har truffet tredive gange foer.
	// svelte-ignore state_referenced_locally
	let portion = $state(genveje[0]?.portion ?? 100);
	// svelte-ignore state_referenced_locally
	let enhedId = $state<string | undefined>(genveje[0]?.enhedId ?? enheder[0]?.u);

	let visStepper = $state(false);
	let visEnheder = $state(false);

	const naering = $derived(naeringFor(food, portion, enhedId));
	const enhedLabel = $derived(enheder.find((e) => e.u === enhedId)?.label ?? 'gram');
	const spring = $derived(springFor(enhedId));

	function vaelgGenvej(g: { portion: number; enhedId: string }) {
		portion = g.portion;
		enhedId = g.enhedId;
		visStepper = false;
	}

	function erValgt(g: { portion: number; enhedId: string }): boolean {
		return !visStepper && g.portion === portion && g.enhedId === enhedId;
	}
</script>

<!-- ny-tokens: arket flyttes ud af .ny-app, saa farverne skal foelge med.
     Uden den bliver arket gennemsigtigt. Se ny.css i toppen. -->
<div class="ark-lag ny-tokens" use:portal role="dialog" aria-modal="true" aria-labelledby="ma-navn">
	<button type="button" class="ark-luk-flade" onclick={onluk} aria-label="Luk"></button>
	<div class="ma-ark">
		<div class="ma-greb" aria-hidden="true"></div>

		<div class="ma-navn" id="ma-navn">{food.name}</div>
		<div class="ma-under">{food.p} g protein og {food.f} g fiber pr 100 g</div>

		<div class="ma-makro">
			<div>
				<div class="ma-m-navn">Protein</div>
				<div class="ma-m-tal">{formatPortion(naering.protein)} g</div>
			</div>
			<div>
				<div class="ma-m-navn">Fiber</div>
				<div class="ma-m-tal">{formatPortion(naering.fiber)} g</div>
			</div>
		</div>

		{#if visEnheder}
			<div class="ma-k">Vælg enhed</div>
			<div class="ma-enheder">
				{#each enheder as e (e.u)}
					<button
						type="button"
						class:valgt={e.u === enhedId}
						onclick={() => {
							enhedId = e.u;
							visEnheder = false;
						}}
					>
						<span>{e.label}</span>
						<span class="ma-e-g">{e.g} g</span>
					</button>
				{/each}
			</div>
		{:else}
			<div class="ma-k">Hvor meget?</div>

			{#if visStepper}
				<div class="ma-maengde">
					<div class="ma-stepper">
						<button
							type="button"
							class="ma-st-knap"
							disabled={!kanTrykkeMinus(portion, enhedId)}
							onclick={() => (portion = skridt(portion, enhedId, -1))}
							aria-label="Mindre">−</button
						>
						<span class="ma-st-vaerdi">
							<span class="ma-st-tal">{formatPortion(portion)}</span>
							<span class="ma-st-spring">springer {formatPortion(spring)} ad gangen</span>
						</span>
						<button
							type="button"
							class="ma-st-knap"
							onclick={() => (portion = skridt(portion, enhedId, 1))}
							aria-label="Mere">+</button
						>
					</div>
					<button type="button" class="ma-enhed" onclick={() => (visEnheder = true)}>
						{enhedLabel} ⌄
					</button>
				</div>
			{:else}
				<div class="ma-chips">
					{#each genveje as g (g.label)}
						<button type="button" class="ma-chip" class:valgt={erValgt(g)} onclick={() => vaelgGenvej(g)}>
							{g.label}
						</button>
					{/each}
					<button type="button" class="ma-chip anden" onclick={() => (visStepper = true)}>
						Anden mængde
					</button>
				</div>
			{/if}
		{/if}

		<button
			type="button"
			class="ma-gem"
			disabled={gemmer}
			onclick={() => ongem(portion, enhedId)}
		>
			{gemmer ? 'Gemmer' : `Læg i ${maaltidLabel.toLowerCase()}`}
		</button>
	</div>
</div>
