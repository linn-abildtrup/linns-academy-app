<script lang="ts">
	// ============================================================
	// Et billede i fuld skaerm. Bruges naar kunden trykker paa billedet i
	// en besked fra Linn.
	//
	// LAGET PORTALES UD I BODY. Uden det ligger bundmenuen ovenpaa paa en
	// iPhone, fordi siden ruller inde i et element der fanger position:
	// fixed. Den regel har vi betalt for at laere én gang.
	//
	// Bygget 1. september 2026.
	// ============================================================

	import { portal } from '$lib/actions/portal';

	interface Props {
		url: string;
		tekst?: string;
		luk: () => void;
	}

	let { url, tekst = '', luk }: Props = $props();
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') luk();
	}}
/>

<div class="bl-lag ny-tokens" use:portal role="dialog" aria-modal="true" aria-label="Billede fra Linn">
	<button type="button" class="bl-flade" aria-label="Luk billedet" onclick={luk}></button>
	<div class="bl-indhold">
		<button type="button" class="bl-luk" onclick={luk} aria-label="Luk">×</button>
		<img src={url} alt={tekst || 'Billede fra Linn'} />
		{#if tekst}<p class="bl-tekst">{tekst}</p>{/if}
	</div>
</div>

<style>
	.bl-lag {
		position: fixed;
		inset: 0;
		/* Samme hoejde som arkene, altsaa over bundmenuen paa 100. */
		z-index: 110;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 18px;
	}

	.bl-flade {
		position: absolute;
		inset: 0;
		border: 0;
		padding: 0;
		background: rgba(33, 27, 30, 0.94);
		cursor: pointer;
	}

	.bl-indhold {
		position: relative;
		max-width: 100%;
		max-height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
	}

	.bl-indhold img {
		max-width: 100%;
		/* Plads til teksten og lukkeknappen, ogsaa paa en lav skaerm. */
		max-height: 76vh;
		border-radius: 14px;
		object-fit: contain;
	}

	.bl-luk {
		align-self: flex-end;
		border: 0;
		background: none;
		color: rgba(255, 255, 255, 0.8);
		font-size: calc(24px * var(--fs-scale, 1));
		line-height: 1;
		padding: 4px 6px;
		cursor: pointer;
	}

	.bl-tekst {
		margin: 0;
		color: rgba(255, 255, 255, 0.75);
		font-size: calc(12.5px * var(--fs-scale, 1));
		text-align: center;
		max-width: 40ch;
	}
</style>
