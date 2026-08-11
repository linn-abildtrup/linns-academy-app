<script lang="ts">
	// ============================================================
	// Filter-arket til opskrift-listen. Se SPEC-3.0.md afsnit 26.
	//
	// Filtrene laa foer som tre raekker knapper oven over listen og aad 215
	// pixels, altsaa over en fjerdedel af arket, foer hun saa den foerste
	// opskrift. De ligger nu her inde og aabnes fra en knap ved siden af
	// soegefeltet. Hovedet er dermed nede paa 92 pixels.
	//
	// Prisen er at filtre man ikke kan se, bliver brugt mindre. Den betaler
	// vi paa to maader: knappen udenfor baerer et tal naar der er filtre i
	// brug, og listens overskrift siger hvad den er begraenset til.
	// ============================================================

	import { portal } from '$lib/actions/portal';
	import {
		KATEGORIER3,
		KATEGORI_NAVN,
		type Kategori3
	} from '$lib/content/opskriftKategori3';
	import type { DietTag } from '$lib/content/opskrifter';

	interface Props {
		valgteKategorier: Kategori3[];
		valgteDiet: DietTag[];
		/** Antal pr kategori, talt UDEN kategori-filteret selv. */
		antal: Record<Kategori3, number>;
		dietAntal: Record<DietTag, number>;
		/** Hvor mange opskrifter der er tilbage lige nu. Staar paa knappen. */
		resultatAntal: number;
		onkategori: (k: Kategori3) => void;
		ondiet: (d: DietTag) => void;
		onnulstil: () => void;
		onluk: () => void;
	}

	let {
		valgteKategorier,
		valgteDiet,
		antal,
		dietAntal,
		resultatAntal,
		onkategori,
		ondiet,
		onnulstil,
		onluk
	}: Props = $props();

	const DIET: { id: DietTag; navn: string }[] = [
		{ id: 'vegetar', navn: 'Vegetar' },
		{ id: 'glutenfri', navn: 'Glutenfri' }
	];

	const harFiltre = $derived(valgteKategorier.length > 0 || valgteDiet.length > 0);

	function visTekst(n: number): string {
		if (n === 0) return 'Ingen opskrifter passer';
		return n === 1 ? 'Vis 1 opskrift' : `Vis ${n} opskrifter`;
	}
</script>

<!-- ny-tokens: arket flyttes ud af .ny-app, saa farverne skal foelge med. -->
<div
	class="ark-lag of-lag ny-tokens"
	use:portal
	role="dialog"
	aria-modal="true"
	aria-labelledby="of-titel"
>
	<button type="button" class="ark-luk-flade" onclick={onluk} aria-label="Luk"></button>
	<div class="of-ark">
		<div class="ma-greb" aria-hidden="true"></div>
		<button type="button" class="ma-luk" onclick={onluk} aria-label="Luk">×</button>

		<h2 class="of-titel" id="of-titel">Filtre</h2>

		<div class="of-rul">
			<h3 class="of-gruppe">Måltid</h3>
			<div class="of-raekke" role="group" aria-label="Filtrér på måltid">
				{#each KATEGORIER3 as k (k)}
					<button
						type="button"
						class="of-valg"
						class:valgt={valgteKategorier.includes(k)}
						aria-pressed={valgteKategorier.includes(k)}
						onclick={() => onkategori(k)}
					>
						<span class="of-navn">{KATEGORI_NAVN[k]}</span>
						<span class="of-n">{antal[k]}</span>
					</button>
				{/each}
			</div>

			<h3 class="of-gruppe">Kost</h3>
			<div class="of-raekke" role="group" aria-label="Filtrér på kost">
				{#each DIET as d (d.id)}
					<button
						type="button"
						class="of-valg"
						class:valgt={valgteDiet.includes(d.id)}
						aria-pressed={valgteDiet.includes(d.id)}
						onclick={() => ondiet(d.id)}
					>
						<span class="of-navn">{d.navn}</span>
						<span class="of-n">{dietAntal[d.id]}</span>
					</button>
				{/each}
			</div>
			<p class="of-note">Vælger du begge, vises kun opskrifter der er begge dele.</p>
		</div>

		<div class="of-bund">
			{#if harFiltre}
				<button type="button" class="of-nulstil" onclick={onnulstil}>Nulstil</button>
			{/if}
			<button type="button" class="of-vis" onclick={onluk} disabled={resultatAntal === 0}>
				{visTekst(resultatAntal)}
			</button>
		</div>
	</div>
</div>
