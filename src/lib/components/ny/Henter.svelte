<script lang="ts">
	// ============================================================
	// Vente-skaermen. Logoet med tegnet der loeber, og et tal der taeller
	// RIGTIGE trin, ikke sekunder.
	//
	// Den gamle app taeller mod 99 procent paa en timer og bliver staaende
	// der. Er forbindelsen langsom, ser kunden praecis det billede hun
	// frygtede. Her flytter tallet sig kun, naar noget faktisk er hentet.
	//
	// Traekker det ud, siger vi det aerligt i stedet for at lade tallet
	// daekke over det.
	// ============================================================

	import { onMount } from 'svelte';
	import Ventetegn from './Ventetegn.svelte';

	interface Props {
		/** Hvor mange trin der hentes i alt. */
		ialt: number;
		/** Hvor mange der er hjemme. */
		hentet: number;
		/** Hvad der arbejdes paa lige nu. */
		tekst?: string;
	}

	let { ialt, hentet, tekst = '' }: Props = $props();

	const procent = $derived(ialt > 0 ? Math.min(100, Math.round((hentet / ialt) * 100)) : 0);

	// Traekker det ud, faar hun en linje mere. Foerst efter fire sekunder,
	// saa en normal hentning aldrig viser den.
	let laenge = $state(false);
	onMount(() => {
		const id = setTimeout(() => (laenge = true), 4000);
		return () => clearTimeout(id);
	});
</script>

<div class="henter">
	<Ventetegn variant="fuld" />
	<p class="henter-tekst">Et øjeblik, jeg henter dine ting.</p>

	<div class="trin-bar" role="progressbar" aria-valuenow={procent} aria-valuemin="0" aria-valuemax="100">
		<div class="trin-fyld" style:width="{procent}%"></div>
	</div>
	<div class="trin-tekst">
		<span>{tekst}</span>
		<b>{procent} %</b>
	</div>

	{#if laenge}
		<p class="henter-tekst dvask">
			Det tager længere end normalt. Din forbindelse er måske langsom lige nu.
		</p>
	{/if}
</div>
