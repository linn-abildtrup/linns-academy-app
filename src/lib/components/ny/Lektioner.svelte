<script lang="ts">
	// ============================================================
	// Dagens lektioner i forloebet.
	//
	// Alle er raekker i samme stoerrelse som traeningen, saa siden staar
	// jaevnt. Den foerste der IKKE er klaret, er markeret "Naeste" og har
	// knappen. Bliver den klaret, faar den flueben og teksten se igen, og
	// den naeste faar markeringen. Raekkefoelgen aendrer sig aldrig, og
	// ingenting forsvinder.
	// ============================================================

	import type { LektionItem } from '$lib/content/forlob';
	import { detekterGuideType, erLydLektion, videoThumbnail } from '$lib/content/bibliotek';
	import Fluebe from './Fluebe.svelte';

	interface Props {
		titel: string;
		lektioner: LektionItem[];
		klaret: Set<string>;
		gemmer: string | null;
		onklaret: (id: string, klaret: boolean) => void;
	}

	let { titel, lektioner, klaret, gemmer, onklaret }: Props = $props();

	/** Den foerste uklarede. Den er dagens naeste skridt. */
	const naeste = $derived(lektioner.find((l) => !klaret.has(l.id)) ?? null);
	const alleKlaret = $derived(lektioner.length > 0 && !naeste);

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
	<div class="lab">
		<h2>{titel}</h2>
	</div>

	{#if lektioner.length === 0}
		<div class="kort rolig">Der er ikke lagt noget op til i dag.</div>
	{:else}
		<div class="medie-liste">
			{#each lektioner as l (l.id)}
				{@const erKlaret = klaret.has(l.id)}
				{@const erNaeste = naeste?.id === l.id}
				<article class="medie-raekke" class:set={erKlaret}>
					<div class="medie-thumb {art(l)}">
						{#if billede(l)}
							<img class="medie-foto" src={billede(l)} alt="" loading="lazy" />
							<span class="medie-play" aria-hidden="true">{IKON[art(l)]}</span>
						{:else}
							<span class="medie-glyph" aria-hidden="true">{IKON[art(l)]}</span>
						{/if}
						{#if erNaeste}
							<span class="medie-tag">Næste</span>
						{/if}
					</div>

					<div class="medie-tekst">
						<div class="medie-t">{l.titel}</div>
						<div class="medie-m">
							{#if erKlaret}<span class="klar-tekst">Klaret</span> · se igen{:else}{meta(l)}{/if}
						</div>

						{#if erKlaret}
							<button
								class="klar-chip"
								disabled={gemmer === l.id}
								aria-label={`Fortryd ${l.titel}`}
								onclick={() => onklaret(l.id, false)}
							>
								<span class="rund-fluebe" aria-hidden="true"><Fluebe /></span>
								Klaret
							</button>
						{:else}
							<button
								class="btn"
								class:ghost={!erNaeste}
								disabled={gemmer === l.id}
								onclick={() => onklaret(l.id, true)}
							>
								Markér klaret
							</button>
						{/if}
					</div>
				</article>
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
