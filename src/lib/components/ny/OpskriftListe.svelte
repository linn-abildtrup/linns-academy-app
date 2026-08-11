<script lang="ts">
	// ============================================================
	// Opskrift-listen i 30-30 beregneren. Se SPEC-3.0.md afsnit 26.
	//
	// To i bredden med farvet flise efter maaltid. Fliserne bliver hvor de
	// er naar hun soeger, der bliver bare faerre af dem. Et gitter der
	// skifter til en liste under fingrene er forvirrende.
	//
	// Det maalte fund der former skaermen: 56% af alle soegetraeffer har
	// IKKE ordet i titlen. Soeger hun paa tomat kommer der 35 frem, og paa
	// de 31 staar ordet kun i ingredienslisten. Derfor skriver flisen
	// grunden til at den kom med, saa ingen flise ser ud som en fejl.
	// ============================================================

	import { portal } from '$lib/actions/portal';
	import {
		filtrerOpskrifter3,
		fremhaev,
		grundTekst,
		soegetermer
	} from '$lib/content/opskriftSoeg3';
	import {
		KATEGORIER3,
		KATEGORI_NAVN,
		antalPrKategori,
		farveKategori,
		fliseBogstav,
		type Kategori3
	} from '$lib/content/opskriftKategori3';
	import type { Opskrift3 } from '$lib/firestore/opskrifter3';
	import type { DietTag } from '$lib/content/opskrifter';

	interface Props {
		opskrifter: Opskrift3[];
		henter?: boolean;
		onvaelg: (id: string) => void;
		onluk: () => void;
	}

	let { opskrifter, henter = false, onvaelg, onluk }: Props = $props();

	let soegeord = $state('');
	let valgteKategorier = $state<Kategori3[]>([]);
	let valgteDiet = $state<DietTag[]>([]);

	const DIET: { id: DietTag; navn: string }[] = [
		{ id: 'vegetar', navn: 'Vegetar' },
		{ id: 'glutenfri', navn: 'Glutenfri' }
	];

	const termer = $derived(soegetermer(soegeord));

	/** Listen efter soegning og diaet, men UDEN kategori-filteret. Tallene ud
	    for kategori-knapperne taelles paa den, saa tallet siger hvad hun
	    faktisk faar hvis hun trykker. */
	const udenKategori = $derived(
		filtrerOpskrifter3(opskrifter, { soegeord, dietTags: valgteDiet })
	);

	const antal = $derived(antalPrKategori(udenKategori.map((r) => r.opskrift)));

	/** Samme for diaet-knapperne: talt uden diaet-filteret selv. */
	const udenDiet = $derived(
		filtrerOpskrifter3(opskrifter, { soegeord, kategorier: valgteKategorier })
	);
	const dietAntal = $derived({
		vegetar: udenDiet.filter((r) => r.opskrift.dietTags.includes('vegetar')).length,
		glutenfri: udenDiet.filter((r) => r.opskrift.dietTags.includes('glutenfri')).length
	});

	const resultater = $derived(
		filtrerOpskrifter3(opskrifter, {
			soegeord,
			kategorier: valgteKategorier,
			dietTags: valgteDiet
		})
	);

	const harFiltre = $derived(
		termer.length > 0 || valgteKategorier.length > 0 || valgteDiet.length > 0
	);

	function slaaKategori(k: Kategori3) {
		valgteKategorier = valgteKategorier.includes(k)
			? valgteKategorier.filter((x) => x !== k)
			: [...valgteKategorier, k];
	}

	function slaaDiet(d: DietTag) {
		valgteDiet = valgteDiet.includes(d)
			? valgteDiet.filter((x) => x !== d)
			: [...valgteDiet, d];
	}

	function ryd() {
		soegeord = '';
		valgteKategorier = [];
		valgteDiet = [];
	}

	function fokuser(node: HTMLInputElement) {
		// Tastaturet maa ikke springe op af sig selv. Hun vil oftest bladre
		// foerst, og et tastatur ville daekke halvdelen af listen.
		node.blur();
	}

	function traefTekst(n: number): string {
		if (n === 0) return 'ingen træffer';
		return n === 1 ? '1 træffer' : `${n} træffere`;
	}
</script>

<!-- ny-tokens: arket flyttes ud af .ny-app, saa farverne skal foelge med. -->
<div class="ark-lag ny-tokens" use:portal role="dialog" aria-modal="true" aria-labelledby="ol-titel">
	<button type="button" class="ark-luk-flade" onclick={onluk} aria-label="Luk"></button>
	<div class="ol-ark">
		<div class="ma-greb" aria-hidden="true"></div>
		<button type="button" class="ma-luk" onclick={onluk} aria-label="Luk">×</button>

		<h2 class="ol-titel" id="ol-titel">Opskrifter</h2>

		<div class="ol-soegfelt">
			<input
				class="ol-soeg"
				type="search"
				bind:value={soegeord}
				use:fokuser
				placeholder="Søg blandt {opskrifter.length} opskrifter"
				aria-label="Søg i opskrifter"
			/>
			{#if harFiltre}
				<span class="ol-tael" aria-live="polite">{traefTekst(resultater.length)}</span>
			{/if}
		</div>

		<div class="ol-filtre" role="group" aria-label="Filtrér på måltid">
			{#each KATEGORIER3 as k (k)}
				<button
					type="button"
					class="ol-chip"
					class:valgt={valgteKategorier.includes(k)}
					aria-pressed={valgteKategorier.includes(k)}
					onclick={() => slaaKategori(k)}
				>
					{KATEGORI_NAVN[k]}
					<span class="ol-n">{antal[k]}</span>
				</button>
			{/each}
		</div>

		<div class="ol-filtre" role="group" aria-label="Filtrér på kost">
			{#each DIET as d (d.id)}
				<button
					type="button"
					class="ol-chip diet"
					class:valgt={valgteDiet.includes(d.id)}
					aria-pressed={valgteDiet.includes(d.id)}
					onclick={() => slaaDiet(d.id)}
				>
					{d.navn}
					<span class="ol-n">{dietAntal[d.id]}</span>
				</button>
			{/each}
			{#if harFiltre}
				<button type="button" class="ol-chip ryd" onclick={ryd}>Ryd</button>
			{/if}
		</div>

		<div class="ol-liste">
			{#if henter}
				<p class="ol-tom">Henter opskrifter</p>
			{:else if resultater.length === 0}
				<p class="ol-tom">
					{#if harFiltre}
						Ingen opskrifter passer på det. Prøv at fjerne et filter.
					{:else}
						Der er ingen opskrifter endnu.
					{/if}
				</p>
			{:else}
				<div class="ol-gitter">
					{#each resultater as r (r.opskrift.id)}
						{@const farve = farveKategori(r.opskrift.kategorier3, valgteKategorier)}
						{@const grund = grundTekst(r.grunde)}
						<button type="button" class="ol-flise" onclick={() => onvaelg(r.opskrift.id)}>
							<span class="ol-top f-{farve ?? 'andet'}">
								{#if r.opskrift.billedeUrl}
									<img
										class="ol-foto"
										src={r.opskrift.billedeUrl}
										alt=""
										loading="lazy"
										decoding="async"
									/>
									{#if farve}
										<span class="ol-maerkat">{KATEGORI_NAVN[farve]}</span>
									{/if}
								{:else}
									<span class="ol-bogstav" aria-hidden="true"
										>{fliseBogstav(r.opskrift.titel)}</span
									>
								{/if}
							</span>
							<span class="ol-tekst">
								<span class="ol-navn">
									{#each fremhaev(r.opskrift.titel, termer) as del, i (i)}
										{#if del.traef}<mark>{del.tekst}</mark>{:else}{del.tekst}{/if}
									{/each}
								</span>
								<span class="ol-makro">
									{#if r.opskrift.protein !== null}{Math.round(r.opskrift.protein)} g protein{/if}
									{#if r.opskrift.protein !== null && r.opskrift.fiber !== null}
										·
									{/if}
									{#if r.opskrift.fiber !== null}{Math.round(r.opskrift.fiber)} g fiber{/if}
								</span>
								{#if grund}
									<!-- Grunden til at flisen kom med, naar ordet ikke er i titlen. -->
									<span class="ol-grund">
										<span class="ol-grund-ikon" aria-hidden="true">↳</span>
										<span>{grund}</span>
									</span>
								{/if}
							</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
