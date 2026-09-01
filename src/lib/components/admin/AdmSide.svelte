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
	}
	let { titel, under, handling, children, bred = false }: Props = $props();
</script>

<div class="as" class:bred>
	<header class="as-top">
		<div class="as-tekst">
			<h1>{titel}</h1>
			{#if under}<p>{under}</p>{/if}
		</div>
		{#if handling}<div class="as-handling">{@render handling()}</div>{/if}
	</header>
	{@render children()}
</div>

<style>
	.as {
		max-width: 780px;
		margin: 0 auto;
		padding: 22px 20px 60px;
		color: var(--espresso, #382c2a);
		font-family: inherit;
	}

	.as.bred {
		max-width: 1100px;
	}

	.as-top {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 12px;
		margin-bottom: 20px;
	}

	.as-tekst h1 {
		margin: 0;
		font-size: calc(25px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: -0.02em;
	}

	.as-tekst p {
		margin: 5px 0 0;
		max-width: 62ch;
		font-size: calc(13.5px * var(--fs-scale, 1));
		color: var(--ink-2, #6f5f57);
		line-height: 1.45;
	}

	@media (max-width: 700px) {
		.as {
			padding: 16px 15px 44px;
		}
	}
</style>
