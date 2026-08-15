<script lang="ts">
	// ============================================================
	// Dagens traening paa forsiden. Bid 5, 15. august 2026.
	//
	// Flisen laeste hidtil den GAMLE apps programmer. Nu peger den paa
	// den nye model, og den er blevet et link: et tryk foerer hende ind
	// i programmet, hvor Start-knappen staar.
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
	}

	let { traening }: Props = $props();
</script>

<section>
	<div class="lab">
		<h2>Dagens træning</h2>
	</div>

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
