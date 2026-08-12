<script lang="ts">
	// ============================================================
	// Lav eller ret en af hendes egne foedevarer. Se SPEC-3.0.md 26.12.
	//
	// TALLENE ER PR 100 G, og det staar tydeligt tre steder: i
	// overskriften, under felterne og i listen bagefter. Hun taster dem
	// af varedeklarationen, hvor de netop staar pr 100 g. Staar det ikke
	// paa skaermen, taster hun tallene for hele pakken, og saa er hendes
	// protein tre gange for hoejt resten af aaret.
	//
	// Felterne er tekst mens hun skriver, ikke tal. Se tal3.ts.
	//
	// Kulhydrat, fedt og kalorier vises kun hvis hun maa se dem, som
	// resten af modulet. Kalorierne regnes af makroerne bagved uanset
	// hvad, saa tallet er der den dag Linn giver et hold adgang.
	// ============================================================

	import { portal } from '$lib/actions/portal';
	import {
		KATEGORIER,
		KATEGORI_NAVN,
		hvadMangler,
		kalorierNu,
		udkastDuger,
		type FodevareUdkast
	} from '$lib/content/egneFodevarer3';

	interface Props {
		start: FodevareUdkast;
		titel: string;
		gemTekst: string;
		gemmer?: boolean;
		visUdvidet?: boolean;
		/** Sat naar hun allerede har en vare med det navn. */
		advarsel?: string | null;
		ongem: (udkast: FodevareUdkast) => void;
		onluk: () => void;
	}

	let {
		start,
		titel,
		gemTekst,
		gemmer = false,
		visUdvidet = false,
		advarsel = null,
		ongem,
		onluk
	}: Props = $props();

	// Kun STARTvaerdien. Arket bygges forfra hver gang hun aabner det.
	// svelte-ignore state_referenced_locally
	let udkast = $state<FodevareUdkast>({ ...start });

	const mangler = $derived(hvadMangler(udkast));
	const kanGemme = $derived(udkastDuger(udkast) && !gemmer);
	const kcal = $derived(kalorierNu(udkast));
	/** Hun har ikke selv skrevet et kalorietal, saa vi viser det udregnede. */
	const kcalErUdregnet = $derived(!udkast.kcal.trim() && kcal > 0);
</script>

<!-- ny-tokens: arket flyttes ud af .ny-app, saa farverne skal foelge med. -->
<div class="ark-lag ny-tokens" use:portal role="dialog" aria-modal="true" aria-labelledby="nf-titel">
	<button type="button" class="ark-luk-flade" onclick={onluk} aria-label="Luk"></button>
	<div class="va-ark op-ark">
		<div class="ma-greb" aria-hidden="true"></div>
		<button type="button" class="ma-luk" onclick={onluk} aria-label="Luk">×</button>

		<div class="op-rul">
			<h2 class="op-titel" id="nf-titel">{titel}</h2>

			<div class="ro-k">Navn</div>
			<input
				class="ro-felt"
				type="text"
				bind:value={udkast.navn}
				maxlength="60"
				placeholder="fx Skyr, vanilje"
				aria-label="Navn"
			/>
			<p class="ro-hjaelp">Det navn du selv vil kunne finde den på.</p>

			{#if advarsel}
				<p class="nf-advarsel">{advarsel}</p>
			{/if}

			<div class="ro-k">Næring pr 100 g</div>
			<div class="ro-makro">
				<label class="ro-m">
					<span>Protein</span>
					<input type="text" inputmode="decimal" bind:value={udkast.protein} placeholder="0" />
					<i>g</i>
				</label>
				<label class="ro-m">
					<span>Fiber</span>
					<input type="text" inputmode="decimal" bind:value={udkast.fiber} placeholder="0" />
					<i>g</i>
				</label>
				{#if visUdvidet}
					<label class="ro-m">
						<span>Kulhydrat</span>
						<input type="text" inputmode="decimal" bind:value={udkast.kh} placeholder="0" />
						<i>g</i>
					</label>
					<label class="ro-m">
						<span>Fedt</span>
						<input type="text" inputmode="decimal" bind:value={udkast.fedt} placeholder="0" />
						<i>g</i>
					</label>
					<label class="ro-m">
						<span>Kalorier</span>
						<input type="text" inputmode="decimal" bind:value={udkast.kcal} placeholder="0" />
						<i>kcal</i>
					</label>
				{/if}
			</div>
			<p class="ro-hjaelp">
				Tallene står pr 100 g på varens bagside.
				{#if visUdvidet}
					Lader du kalorier stå tom, regner appen dem ud af de andre.
					{#if kcalErUdregnet}<strong>Lige nu bliver det {kcal} kcal.</strong>{/if}
				{/if}
			</p>

			<div class="ro-k">Slags</div>
			<select class="ro-felt" bind:value={udkast.kategori} aria-label="Slags">
				{#each KATEGORIER as k (k)}
					<option value={k}>{KATEGORI_NAVN[k]}</option>
				{/each}
			</select>

			<!-- Den gamle app saetter altid nej her, saa en kunde med en
			     proteinshake skal taste i gram. Ét afkryds giver hende
			     deciliter i maengde-arket bagefter. -->
			<label class="nf-tjek">
				<input type="checkbox" bind:checked={udkast.flydende} />
				<span class="nf-boks" aria-hidden="true"></span>
				<span>Det er noget man drikker</span>
			</label>
			<p class="ro-hjaelp">Sæt flueben, så kan du taste i deciliter i stedet for gram.</p>

			{#if mangler}
				<p class="ro-mangler">{mangler}</p>
			{/if}
		</div>

		<button type="button" class="ma-gem" disabled={!kanGemme} onclick={() => ongem(udkast)}>
			{gemmer ? 'Gemmer' : gemTekst}
		</button>
	</div>
</div>
