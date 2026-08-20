<script lang="ts">
	// ============================================================
	// Én oevelse: video, beskrivelse og trin for trin.
	//
	// ET ARK OG IKKE EN SIDE. Hun lukker det og er tilbage i listen med
	// det samme. Den gamle app aabner en helskaerm man skal ud af igen,
	// og opskrifterne i 3.0 bruger allerede ark. Linns valg 20. august.
	//
	// VIDEOEN KOERER I RING UDEN LYD OG UDEN KNAPPER, som den goer inde i
	// en traening. Den gamle app viser afspilningsknapper og starter selv.
	// En loekke er bedre til en oevelse: hun skal se bevaegelsen gentaget,
	// ikke styre en film paa fire sekunder.
	// ============================================================

	import { portal } from '$lib/actions/portal';
	import type { Exercise } from '$lib/content/mikrotraening';
	import { udstyrTekst } from '$lib/content/oevelsesSoeg3';
	import Ventetegn from './Ventetegn.svelte';

	interface Props {
		oevelse: Exercise;
		/** Adressen paa videoen. Null mens den hentes, eller hvis den fejlede. */
		video: string | null;
		henterVideo?: boolean;
		onluk: () => void;
		/**
		 * Ekstra linje under kategorien, fx "3 saet · 40 sek". Kommer fra
		 * traeningen, hvor den samme oevelse kan koere med forskellige tal.
		 * Biblioteket sender den ikke, for dér findes tallene ikke.
		 */
		undertekst?: string;
		/**
		 * Hvor hun er i en raekke, fx { nu: 1, ialt: 6 }. Er den sat, tegnes
		 * bladre-linjen nederst. Uden den er arket som foer.
		 */
		plads?: { nu: number; ialt: number };
		onforrige?: () => void;
		onnaeste?: () => void;
	}

	let {
		oevelse,
		video,
		henterVideo = false,
		onluk,
		undertekst,
		plads,
		onforrige,
		onnaeste
	}: Props = $props();

	const trin = $derived((oevelse.how ?? []).filter((t) => t.trim().length > 0));
	const udstyr = $derived(udstyrTekst(oevelse.udstyr ?? []));
</script>

<!-- ny-tokens: arket flyttes ud af .ny-app, saa farverne skal foelge med. -->
<div
	class="ark-lag ny-tokens"
	use:portal
	role="dialog"
	aria-modal="true"
	aria-labelledby="oev-titel"
>
	<button type="button" class="ark-luk-flade" onclick={onluk} aria-label="Tilbage"></button>
	<div class="va-ark oev-ark">
		<div class="ma-greb" aria-hidden="true"></div>
		<button type="button" class="ma-luk" onclick={onluk} aria-label="Tilbage til listen">×</button>

		<div class="op-rul">
			<div class="oev-scene">
				{#if video}
					<video class="oev-video" src={video} autoplay muted loop playsinline></video>
				{:else if henterVideo}
					<Ventetegn variant="lille" />
				{:else}
					<!-- Uden video kan hun stadig laese hvordan oevelsen laves, og
					     det er hovedsagen. Vi siger det i stedet for at vise et
					     tomt felt. -->
					<span class="oev-ingen">Videoen kunne ikke hentes</span>
				{/if}
			</div>

			<h2 class="oev-titel" id="oev-titel">{oevelse.name}</h2>
			<p class="oev-meta">
				{oevelse.catLabel}{#if udstyr}
					· {udstyr}{/if}{#if undertekst}
					· {undertekst}{/if}
			</p>

			{#if oevelse.desc}
				<p class="oev-desc">{oevelse.desc}</p>
			{/if}

			{#if trin.length > 0}
				<div class="oev-h">Sådan gør du</div>
				<ol class="oev-trin">
					{#each trin as t, i (i)}
						<li>{t}</li>
					{/each}
				</ol>
			{/if}

			<!-- Bladring. Uden den skulle hun lukke arket og trykke paa den
			     naeste raekke for hver eneste oevelse, og saa kigger man ikke
			     traeningen igennem, saa slaar man én oevelse op. -->
			{#if plads && plads.ialt > 1}
				<div class="oev-bladr">
					<button
						type="button"
						class="oev-bl"
						onclick={onforrige}
						disabled={plads.nu <= 1}
						aria-label="Forrige øvelse">‹ Forrige</button
					>
					<span class="oev-taeller">{plads.nu} af {plads.ialt}</span>
					<button
						type="button"
						class="oev-bl"
						onclick={onnaeste}
						disabled={plads.nu >= plads.ialt}
						aria-label="Næste øvelse">Næste ›</button
					>
				</div>
			{/if}
		</div>
	</div>
</div>
