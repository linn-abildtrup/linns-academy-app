<script lang="ts">
	// Byggeklods 6. Den sidste udvej.
	//
	// DEN HER SKAL BRUGES PAA HVER ENESTE SIDE. En kaede af tilfaelde paa
	// en hel skaerm skal altid have noget der tegnes, ellers staar man med
	// en blank side. Det er sket to gange paa to dage, 25. og 26. august,
	// og anden gang stod advarslen allerede i overdragelsen.
	interface Props {
		tekst: string;
		/** Vises som en knap, fx "Prøv igen". */
		handling?: import('svelte').Snippet;
		fejl?: boolean;
	}
	let { tekst, handling, fejl = false }: Props = $props();
</script>

<div class="at" class:fejl>
	<p>{tekst}</p>
	{#if handling}<div class="at-h">{@render handling()}</div>{/if}
</div>

<style>
	.at {
		padding: 26px 20px;
		background: var(--paper-2, #f6f0e7);
		border-radius: 16px;
		text-align: center;
	}

	.at.fejl {
		background: var(--ler-tint, #f4e6de);
	}

	.at p {
		margin: 0;
		font-size: calc(13.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-2, #6f5f57);
		line-height: 1.5;
	}

	.at.fejl p {
		color: var(--ler-tekst, #8a5439);
		font-weight: 600;
	}

	.at-h {
		margin-top: 14px;
	}
</style>
