<script lang="ts">
	// ============================================================
	// Dagens traening paa forsiden. Bid 5, 15. august 2026.
	//
	// Flisen laeste hidtil den GAMLE apps programmer. Nu peger den paa
	// den nye model, og den er blevet et link.
	//
	// Siden 18. august foerer trykket DIREKTE ind paa selve traeningen og
	// ikke paa listen over dage. Linns valg: kunden har allerede valgt sit
	// program, saa de to mellemled var spildte tryk. Hun lander paa
	// klar-skaermen med videoen og trykker selv Start.
	//
	// Staar der "Klaret", betyder det bare at hun HAR traenet i dag. Linket
	// peger stadig paa den naeste, for der er ingen graense pr dag.
	//
	// Dagens foerste oevelse koerer lydloest i loop i et 16:9-felt paa
	// 140 px, saa hele oevelsen er synlig uden at kortet fylder en
	// tredjedel af skaermen. Er den klaret, bliver knappen til en chip
	// med flueben, saa der ikke staar Start paa noget hun lige har gjort.
	// ============================================================

	import type { DagensTraening3 } from '$lib/firestore/traeningForside3';
	import Fluebe from './Fluebe.svelte';

	interface Props {
		traening: DagensTraening3;
		/**
		 * Skal komponenten skrive sin egen overskrift.
		 *
		 * Falsk naar den ligger inde i en foldet sektion, hvor overskriften
		 * allerede staar i raekken der folder. Ellers stod "Dagens træning"
		 * to gange lige under hinanden.
		 */
		visTitel?: boolean;
	}

	let { traening, visTitel = true }: Props = $props();
</script>

<section>
	{#if visTitel}
		<div class="lab">
			<h2>Dagens træning</h2>
		</div>
	{/if}

	<a class="medie-raekke tr-flise" href={traening.href}>
		<div class="medie-thumb traening">
			{#if traening.videoUrl}
				<video
					class="medie-video"
					src={traening.videoUrl}
					autoplay
					muted
					loop
					playsinline
					preload="metadata"
				></video>
				<span class="spiller" aria-hidden="true"><i></i>Spiller</span>
			{:else}
				<span class="medie-glyph" aria-hidden="true">◈</span>
			{/if}
		</div>

		<div class="medie-tekst">
			<div class="medie-t">{traening.navn}</div>
			<div class="medie-m">{traening.undertekst}</div>
			{#if traening.klaretIDag}
				<span class="klar-chip">
					<span class="rund-fluebe" aria-hidden="true"><Fluebe /></span>
					Klaret
				</span>
			{/if}
		</div>
	</a>
</section>
