<script lang="ts">
	// ============================================================
	// /ny/snak er NEDLAGT 16. august 2026.
	//
	// Linns beslutning: ordet Snak droppes, siden hedder Beskeder. Ruten
	// bliver staaende alene for at sende videre, fordi der ligger links
	// til den i kundernes browser-historik og paa forsiden.
	// ============================================================

	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';

	onMount(() => {
		// Fanen foelger med, saa et gammelt link til fanen Linn stadig
		// lander det rigtige sted.
		const fane = page.url.searchParams.get('fane');
		void goto(fane ? `/ny/beskeder?fane=${fane}` : '/ny/beskeder', { replaceState: true });
	});
</script>

<svelte:head><title>Beskeder</title></svelte:head>

<div class="ny-besked">
	<Ventetegn variant="lille" />
	<p class="vente-linje">Et øjeblik</p>
</div>
