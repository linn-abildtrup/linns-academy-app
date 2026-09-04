<script lang="ts">
	// ============================================================
	// Dagens lektioner i forloebet.
	//
	// Alle er raekker i samme stoerrelse som traeningen, saa siden staar
	// jaevnt. Hele raekken aabner lektionen. Er en set, faar den et flueben
	// i hjoernet af billedet. Raekkefoelgen aendrer sig aldrig, og
	// ingenting forsvinder.
	// ============================================================

	import type { LektionItem } from '$lib/content/forlob';
	import { detekterGuideType, erLydLektion, videoThumbnail } from '$lib/content/bibliotek';
	import { alleSet3, erSet3 } from '$lib/content/lektionSet3';
	import { fliseTitel3 } from '$lib/content/lektionFlise3';
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

	const alleKlaret = $derived(alleSet3(klaret, lektioner));

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

	/**
	 * Er det en skriftlig lektion UDEN billede.
	 *
	 * De faar en flise der ligner et stykke papir med titlen paa, i stedet
	 * for den lilla flade med en stjerne. Linn 4. september: to
	 * forskellige lektioner lignede hinanden fuldstaendig, og firkanten
	 * lovede et billede der ikke var der. 23 af de 42 lektioner i
	 * Kickstart August har intet billede, saa det er ikke en enkelt flise.
	 *
	 * Video og lyd roeres IKKE. Video uden billede beholder sit ▶, for
	 * pilen siger allerede hvad det er, og lyd har Linns eget billede.
	 */
	function erSide(l: LektionItem): boolean {
		return art(l) === 'tekst' && !billede(l);
	}

	// Titlen paa flisen ligger i content/lektionFlise3.ts, saa reglen om
	// "Dag 5, " kan testes uden browser. Se testene der.
</script>

<section>
	{#if visTitel}
		<!-- "Alle dage" er fjernet 20. august paa Linns oenske. Datostrimlen
		     lige over foerer allerede til hver enkelt dag, saa linket var en
		     anden vej til det samme sted. -->
		<div class="lab">
			<h2>{titel}</h2>
		</div>
	{/if}

	{#if lektioner.length === 0}
		<div class="kort rolig">Der er ikke lagt noget op til i dag.</div>
	{:else}
		<div class="medie-liste">
			{#each lektioner as l (l.id)}
				{@const erKlaret = erSet3(klaret, l)}
				<!-- Hele raekken aabner lektionen. Ingen knap, for hun trykker
				     alligevel paa billedet eller titlen. -->
				<a class="medie-raekke" class:set={erKlaret} href={`/ny/lektion/${dagNummer}/${l.id}`}>
					<span class="medie-thumb {art(l)}" class:side={erSide(l)}>
						<!-- Billedet bliver staaende naar hun har set lektionen, og
						     fluebenet laegger sig i hjoernet. Foer 22. august
						     ERSTATTEDE fluebenet billedet, og saa kunne hun ikke
						     se hvad det var hun havde set. Gaelder ogsaa lyd og
						     laesning, hvor billedet er den farvede flise. -->
						{#if billede(l)}
							<img class="medie-foto" src={billede(l)} alt="" loading="lazy" />
							<span class="medie-play" aria-hidden="true">{IKON[art(l)]}</span>
						{:else if erSide(l)}
							<!-- Titlen staar paa flisen, saa to skriftlige lektioner
							     ikke ligner hinanden. Skjult for oplaesning: den
							     staar ordret igen i raekken ved siden af. -->
							<span class="side-titel" aria-hidden="true">{fliseTitel3(l.titel)}</span>
							<span class="side-streger" aria-hidden="true"><i></i><i></i></span>
						{:else}
							<span class="medie-glyph" aria-hidden="true">{IKON[art(l)]}</span>
						{/if}
						{#if erKlaret}
							<span class="rund-fluebe hjoerne" aria-hidden="true"><Fluebe /></span>
						{/if}
					</span>

					<span class="medie-tekst">
						<span class="medie-t">{l.titel}</span>
						<!-- BESKRIVELSEN LAA UBRUGT. Den staar allerede paa flere
						     lektioner i Linns data, og appen viste den ikke. Den
						     er det der for alvor adskiller to raekker fra
						     hinanden, og den koster ingen hentning. Linns valg
						     4. september, se mockups-skriftlige-lektioner.html. -->
						{#if l.beskrivelse}
							<span class="medie-beskr">{l.beskrivelse}</span>
						{/if}
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
