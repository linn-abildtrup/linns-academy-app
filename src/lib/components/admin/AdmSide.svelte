<script lang="ts">
	// ============================================================
	// Rammen om ÉN admin-side.
	//
	// Byggeklods 1 af 6, bygget 1. september 2026. De 19 gamle admin-sider
	// laves om én ad gangen, og uden faelles klodser ville jeg traeffe de
	// samme designbeslutninger nitten gange. Saa kommer siderne til at
	// ligne hinanden naesten men ikke helt, og det er vaerre end at de er
	// aabenlyst forskellige.
	//
	// KLODSERNE VIRKER I BEGGE APPER. Farverne skrives som
	// var(--paper, #fbf8f2): paa /ny findes tokenet i ny.css, og alle
	// andre steder falder den tilbage paa den samme vaerdi. Saa er der ét
	// sted at rette farven, og klodsen kan bruges hvor som helst.
	// ============================================================

	interface Props {
		titel: string;
		under?: string;
		/** Staar til hoejre for titlen, fx en knap. */
		handling?: import('svelte').Snippet;
		children: import('svelte').Snippet;
		/** Sat paa sider med en tabel eller mange kolonner. */
		bred?: boolean;
		/** Hvor "tilbage" foerer hen. Uden den vises intet tilbage-link. */
		tilbage?: string;
		/** Teksten paa tilbage-linket. */
		tilbageTekst?: string;
	}
	let {
		titel,
		under,
		handling,
		children,
		bred = false,
		tilbage,
		tilbageTekst = 'Tilbage'
	}: Props = $props();
</script>

<div class="as" class:bred>
	<header class="as-top">
		{#if tilbage}
			<a class="as-tilbage" href={tilbage}>‹ {tilbageTekst}</a>
		{/if}
		<h1>{titel}</h1>
		{#if under}<p class="as-under">{under}</p>{/if}
		{#if handling}<div class="as-handling">{@render handling()}</div>{/if}
	</header>
	{@render children()}
</div>

<style>
	/* ============================================================
	   Rammen om én admin-side, bygget om 5. september 2026 efter de
	   principper dag-editoren blev proevet af paa.
	
	   1. BREDT. Admin bruges paa en iMac, ikke paa telefon. 780 punkter
	      efterlod det halve af skaermen tom.
	   2. SLANK TOP. Titel, undertitel og handling staar paa én linje.
	      Foer fyldte de tre linjer, og paa en bred, lav skaerm er
	      hoejden det knappe.
	   3. ÉT TAL FOR STOERRELSER, sat i admin-layoutet.
	
	   Den gamle app bruger ikke denne klods. Kontrolleret 5. september.
	   ============================================================ */
	.as {
		max-width: 1040px;
		margin: 0 auto;
		padding: 16px 18px 40px;
		color: var(--espresso, #382c2a);
		font-family: inherit;
	}

	/* Sider med en tabel eller mange kolonner faar hele fladen. */
	.as.bred {
		max-width: 1560px;
	}

	.as-top {
		display: flex;
		align-items: baseline;
		gap: 14px;
		flex-wrap: wrap;
		margin-bottom: 14px;
	}

	.as-tilbage {
		font-size: calc(12px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-2, #6f5f57);
		text-decoration: none;
		white-space: nowrap;
	}

	.as-top h1 {
		margin: 0;
		font-size: calc(21px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
		letter-spacing: -0.02em;
		white-space: nowrap;
	}

	.as-under {
		margin: 0;
		max-width: 68ch;
		font-size: calc(12.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-2, #6f5f57);
		line-height: 1.45;
	}

	/* Handlinger skubbes helt ud til hoejre, vaek fra teksten, saa de er
	   til at finde uden at lede. */
	.as-handling {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	@media (max-width: 700px) {
		.as {
			padding: 14px 14px 40px;
		}

		.as-top h1 {
			white-space: normal;
		}
	}
</style>
