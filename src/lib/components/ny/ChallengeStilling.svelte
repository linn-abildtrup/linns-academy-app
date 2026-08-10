<script lang="ts">
	// ============================================================
	// Stillingen i 3.0.
	//
	// Den gamle viste alle deltagere. Det gik da en challenge hoerte til
	// ét hold paa 28. Nu kan den gaa til alle der har appen, og saa er
	// en fuld liste 600 til 700 navne. Det er ikke en stilling, det er
	// en telefonbog, og "nummer 400" fortaeller hende ingenting.
	//
	// Derfor: de ti oeverste, og hendes egen linje nedenunder hvis hun
	// ikke allerede staar der. Samme oplevelse ved 28 som ved 700.
	// ============================================================

	import type { StillingVisning } from '$lib/content/challenge3';
	import { portal } from '$lib/actions/portal';
	import Ventetegn from './Ventetegn.svelte';

	interface Props {
		navn: string;
		visning: StillingVisning | null;
		henter: boolean;
		onluk: () => void;
	}

	let { navn, visning, henter, onluk }: Props = $props();

	const maxScore = $derived(visning?.top[0]?.score ?? 0);

	function bredde(score: number): string {
		if (maxScore <= 0) return '0%';
		// Mindst en synlig stump, saa en lav score ikke bliver usynlig.
		return `${Math.max(6, Math.round((score / maxScore) * 100))}%`;
	}
</script>

<!-- ny-tokens: se MaengdeArk. Uden den mister overlayet sine farver. -->
<div class="st-lag ny-tokens" use:portal role="dialog" aria-modal="true" aria-labelledby="st-titel">
	<header class="st-top">
		<div>
			<div class="st-k">Stillingen</div>
			<h2 id="st-titel">{navn}</h2>
		</div>
		<button type="button" class="st-luk" onclick={onluk} aria-label="Luk">×</button>
	</header>

	<div class="st-krop">
		{#if henter}
			<div class="st-venter">
				<Ventetegn variant="lille" />
				<span>Henter stillingen</span>
			</div>
		{:else if !visning || visning.top.length === 0}
			<p class="st-tom">Der er ingen indtastninger endnu. Bliv den første.</p>
		{:else}
			<p class="st-antal">
				{visning.antal}
				{visning.antal === 1 ? 'deltager' : 'deltagere'} er med
			</p>

			<ol class="st-liste">
				{#each visning.top as r (r.uid)}
					<li class="st-linje" class:mig={r.erMig}>
						<span class="st-plads">{r.plads}</span>
						<span class="st-navn">{r.erMig ? 'Dig' : r.displayNavn}</span>
						<span class="st-bar" aria-hidden="true">
							<span class="st-bar-fyld" style="width:{bredde(r.score)}"></span>
						</span>
						<span class="st-score">{r.score}</span>
					</li>
				{/each}
			</ol>

			{#if visning.mig}
				<!-- Hendes egen linje, saa hun altid kan finde sig selv
				     uden at rulle gennem hundredvis af navne. -->
				<div class="st-adskil"><span>din placering</span></div>
				<ol class="st-liste">
					<li class="st-linje mig">
						<span class="st-plads">{visning.mig.plads}</span>
						<span class="st-navn">Dig</span>
						<span class="st-bar" aria-hidden="true">
							<span class="st-bar-fyld" style="width:{bredde(visning.mig.score)}"></span>
						</span>
						<span class="st-score">{visning.mig.score}</span>
					</li>
				</ol>
			{/if}
		{/if}
	</div>
</div>
