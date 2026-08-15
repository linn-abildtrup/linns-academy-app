<script lang="ts">
	// ============================================================
	// "Hvad traener du med?" Bid 3, 15. august 2026.
	//
	// Skaermen bor i Profil, men den er skrevet som en komponent fordi
	// den SAMME skaerm skal bruges i onboarding senere. Linns beslutning
	// 15. august: spoergsmaalet hoerer hjemme foerste gang en ny kunde
	// logger paa, sammen med resten af det hun skal spoerges om.
	//
	// Kategorier der er maerket "vises altid" staar laast oeverst. De er
	// ikke et valg, de gaelder uanset hvad. Uden den laas kunne hun
	// fjerne alle fluebén og staa uden traening, og det er netop det
	// kropsvaegt-kategorien er der for at forhindre.
	// ============================================================

	import {
		laasteKategorier3,
		valgbareKategorier3,
		type TraeningKategori3
	} from '$lib/content/traeningKategori3';

	interface Props {
		kategorier: TraeningKategori3[];
		/** Kategori-id'er hun har valgt. Uden dem der vises altid. */
		valgte: string[];
		gemmer?: boolean;
		knapTekst?: string;
		gem: (valgte: string[]) => void;
	}

	let {
		kategorier,
		valgte,
		gemmer = false,
		knapTekst = 'Sådan træner jeg',
		gem
	}: Props = $props();

	// Indtil hun roerer noget, spejler skaermen det der er gemt. Foerst
	// naar hun saetter et flueben, overtager hendes eget valg. Et rent
	// $state ville laase den fast paa den foerste vaerdi, og saa ville
	// hendes gemte valg ikke staa markeret naar siden er faerdig med at
	// hente kategorierne.
	let egetValg = $state<string[] | null>(null);
	const markerede = $derived(egetValg ?? valgte);

	const laaste = $derived(laasteKategorier3(kategorier));
	const valgbare = $derived(valgbareKategorier3(kategorier));

	function skift(id: string) {
		egetValg = markerede.includes(id)
			? markerede.filter((x) => x !== id)
			: [...markerede, id];
	}
</script>

<div class="tv-valg">
	{#each laaste as k (k.id)}
		<div class="tv-raekke laast">
			<span class="tv-boks laast" aria-hidden="true">✓</span>
			<span class="tv-t">
				{k.navn}
				<span class="tv-s">Er altid med. Du har altid din egen krop</span>
			</span>
		</div>
	{/each}

	{#each valgbare as k (k.id)}
		<label class="tv-raekke">
			<input
				type="checkbox"
				class="tv-tjek"
				checked={markerede.includes(k.id)}
				onchange={() => skift(k.id)}
			/>
			<span class="tv-boks" class:paa={markerede.includes(k.id)} aria-hidden="true">
				{markerede.includes(k.id) ? '✓' : ''}
			</span>
			<span class="tv-t">{k.navn}</span>
		</label>
	{/each}

	{#if valgbare.length === 0}
		<p class="tv-hjaelp">Der er ikke andet at vælge imellem endnu.</p>
	{/if}

	<button type="button" class="tv-knap" onclick={() => gem(markerede)} disabled={gemmer}>
		{gemmer ? 'Gemmer' : knapTekst}
	</button>
	{#if valgbare.length > 0}
		<p class="tv-hjaelp">Du kan sætte flere flueben.</p>
	{/if}
</div>
