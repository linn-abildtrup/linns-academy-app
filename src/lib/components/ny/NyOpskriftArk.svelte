<script lang="ts">
	// ============================================================
	// Tag et billede af en opskrift, og lad AI'en laese den.
	// Se SPEC-3.0.md afsnit 26.11.
	//
	// Arket viser KUN vejen ind: vaelg billeder, se dem, send. Naar
	// AI'en har svaret, lukker det, og hun gennemgaar resultatet i
	// RetOpskriftArk. Det er den samme skaerm som naar hun retter en
	// opskrift bagefter, saa den skal kun bygges og vedligeholdes én
	// gang.
	//
	// Hun gennemgaar ALTID svaret foer der gemmes noget. AI'en gaetter
	// makro ud fra et billede, og et gaet der lander direkte i hendes
	// dagbog uden at hun har set det, ville vaere den forkerte slags
	// automatik i et modul der handler om to praecise tal.
	// ============================================================

	import { portal } from '$lib/actions/portal';
	import { MAX_BILLEDER } from '$lib/content/mineOpskrifter3';

	interface Props {
		/** Filerne hun har valgt, og forhaandsvisningerne af dem. */
		filer: File[];
		previews: string[];
		/** Sat mens AI'en laeser. Saa maa der ikke trykkes. */
		arbejder?: boolean;
		fejl?: string | null;
		onvaelg: (filer: FileList | null) => void;
		onfjern: (i: number) => void;
		onanalyser: () => void;
		onluk: () => void;
	}

	let {
		filer,
		previews,
		arbejder = false,
		fejl = null,
		onvaelg,
		onfjern,
		onanalyser,
		onluk
	}: Props = $props();

	let input: HTMLInputElement | null = $state(null);

	const kanFlere = $derived(filer.length < MAX_BILLEDER);
	const kanSende = $derived(filer.length > 0 && !arbejder);
</script>

<!-- ny-tokens: arket flyttes ud af .ny-app, saa farverne skal foelge med. -->
<div class="ark-lag ny-tokens" use:portal role="dialog" aria-modal="true" aria-labelledby="no-titel">
	<button type="button" class="ark-luk-flade" onclick={onluk} aria-label="Luk"></button>
	<div class="ma-ark">
		<div class="ma-greb" aria-hidden="true"></div>
		<button type="button" class="ma-luk" onclick={onluk} aria-label="Luk">×</button>

		<h2 class="ma-navn" id="no-titel">Ny opskrift</h2>
		<p class="no-under">
			Tag et billede af opskriften, eller vælg et fra din telefon. Så læser appen ingredienserne og
			regner næringen ud. Du ser det hele og kan rette, før der gemmes noget.
		</p>

		{#if previews.length > 0}
			<div class="no-billeder">
				{#each previews as p, i (i)}
					<div class="no-b">
						<img src={p} alt="Billede {i + 1}" />
						{#if !arbejder}
							<button
								type="button"
								class="no-b-fjern"
								onclick={() => onfjern(i)}
								aria-label="Fjern billede {i + 1}">×</button
							>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		<!-- Skjult felt. Knappen herunder er den hun ser, for et raat
		     fil-felt ser forskelligt ud i hver browser og siger ikke hvad
		     der sker. -->
		<input
			class="no-input"
			type="file"
			accept="image/*"
			multiple
			bind:this={input}
			onchange={(e) => onvaelg((e.target as HTMLInputElement).files)}
		/>

		{#if kanFlere && !arbejder}
			<button type="button" class="no-vaelg" onclick={() => input?.click()}>
				{filer.length === 0 ? 'Vælg billede' : 'Tilføj et billede mere'}
			</button>
		{/if}

		<p class="no-hjaelp">
			Fylder opskriften to sider, kan du tage op til {MAX_BILLEDER} billeder af den samme opskrift.
		</p>

		{#if fejl}
			<p class="no-fejl">{fejl}</p>
		{/if}

		{#if arbejder}
			<p class="no-arbejder">Læser opskriften. Det tager et øjeblik.</p>
		{/if}

		<button type="button" class="ma-gem" disabled={!kanSende} onclick={onanalyser}>
			{arbejder ? 'Læser' : 'Læs opskriften'}
		</button>
	</div>
</div>
