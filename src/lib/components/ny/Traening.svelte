<script lang="ts">
	// ============================================================
	// Dagens traening. Samme raekke for begge kundetyper, saa en kvinde
	// paa forloeb ogsaa har sin traening paa forsiden.
	//
	// Dagens foerste oevelse koerer lydloest i loop i et 16:9-felt paa
	// 140 px, saa hele oevelsen er synlig uden at kortet fylder en
	// tredjedel af skaermen. Er den klaret, bliver knappen til en chip
	// med flueben, saa der ikke staar "Start" paa noget hun lige har gjort.
	// ============================================================

	import type { DagensTraening } from '$lib/firestore/forside3';
	import Fluebe from './Fluebe.svelte';

	interface Props {
		traening: DagensTraening;
	}

	let { traening }: Props = $props();
</script>

<section>
	<div class="lab">
		<h2>Dagens træning</h2>
	</div>

	<article class="medie-raekke">
		<div class="medie-thumb traening">
			{#if traening.videoUrl}
				<!-- svelte-ignore a11y_media_has_caption -->
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
			{:else}
				<a class="btn" href="/ny/moduler">Start</a>
			{/if}
		</div>
	</article>
</section>
