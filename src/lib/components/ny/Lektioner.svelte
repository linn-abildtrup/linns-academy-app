<script lang="ts">
	// ============================================================
	// Dagens lektioner i forloebet.
	//
	// Alle er raekker i samme stoerrelse som traeningen, saa siden staar
	// jaevnt. Hele raekken aabner lektionen. Er en set, faar den flueben i
	// stedet for billedet. Raekkefoelgen aendrer sig aldrig, og ingenting
	// forsvinder.
	// ============================================================

	import type { LektionItem } from '$lib/content/forlob';
	import { detekterGuideType, erLydLektion, videoThumbnail } from '$lib/content/bibliotek';
	import Fluebe from './Fluebe.svelte';

	interface Props {
		titel: string;
		/** Dagnummeret i forloebet. Bruges til adressen paa lektionen. */
		dagNummer: number;
		lektioner: LektionItem[];
		klaret: Set<string>;
		/**
		 * Skal komponenten skrive sin egen overskrift.
		 *
		 * Falsk naar den ligger inde i en foldet sektion, hvor overskriften
		 * allerede staar i raekken der folder.
		 */
		visTitel?: boolean;
	}

	let { titel, dagNummer, lektioner, klaret, visTitel = true }: Props = $props();

	const alleKlaret = $derived(lektioner.length > 0 && lektioner.every((l) => klaret.has(l.id)));

	/** Hvilken slags indhold lektionen er. Styrer farve og lille ikon. */
	function art(l: LektionItem): 'lyd' | 'video' | 'tekst' {
		if (erLydLektion(l.url)) return 'lyd';
		const t = detekterGuideType(l.url);
		if (t === 'video') return 'video';
		if (t === 'audio') return 'lyd';
		return 'tekst';
	}

	const IKON: Record<string, string> = { lyd: '♪', video: '▶', tekst: '✦' };

	/**
	 * Lektionens eget billede fra Vimeo eller YouTube. Kan det ikke hentes,
	 * falder vi tilbage til den farvede flade. Billederne ligger hos dem og
	 * koster os ingenting.
	 */
	function billede(l: LektionItem): string | null {
		return l.thumbnailUrl || videoThumbnail(l.url);
	}

	function meta(l: LektionItem): string {
		const a = art(l);
		const dele = [a === 'lyd' ? 'Lyd' : a === 'video' ? 'Video' : 'Læsning'];
		if (l.varighedMin) dele.push(`${l.varighedMin} min`);
		return dele.join(' · ');
	}
</script>

<section>
	{#if visTitel}
		<div class="lab">
			<h2>{titel}</h2>
			<a href="/ny/forlob">Alle dage</a>
		</div>
	{/if}

	{#if lektioner.length === 0}
		<div class="kort rolig">Der er ikke lagt noget op til i dag.</div>
	{:else}
		<div class="medie-liste">
			{#each lektioner as l (l.id)}
				{@const erKlaret = klaret.has(l.id)}
				<!-- Hele raekken aabner lektionen. Ingen knap, for hun trykker
				     alligevel paa billedet eller titlen. -->
				<a class="medie-raekke" class:set={erKlaret} href={`/ny/lektion/${dagNummer}/${l.id}`}>
					<span class="medie-thumb {art(l)}">
						{#if erKlaret}
							<span class="rund-fluebe stor" aria-hidden="true"><Fluebe /></span>
						{:else if billede(l)}
							<img class="medie-foto" src={billede(l)} alt="" loading="lazy" />
							<span class="medie-play" aria-hidden="true">{IKON[art(l)]}</span>
						{:else}
							<span class="medie-glyph" aria-hidden="true">{IKON[art(l)]}</span>
						{/if}
					</span>

					<span class="medie-tekst">
						<span class="medie-t">{l.titel}</span>
						<span class="medie-m">
							{#if erKlaret}<span class="klar-tekst">Set</span> · se igen{:else}{meta(l)}{/if}
						</span>
					</span>
					<span class="medie-pil" aria-hidden="true">›</span>
				</a>
			{/each}
		</div>

		{#if alleKlaret}
			<div class="kort rolig fuldfoert">
				<span class="rund-fluebe" aria-hidden="true"><Fluebe /></span>
				Du har taget alt for i dag.
			</div>
		{/if}
	{/if}
</section>
