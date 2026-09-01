<script lang="ts">
	// Byggeklods 2. Én flade der samler noget der hoerer sammen.
	// Ingen ramme, kun en anden farve. Det er den ene ting der goer at en
	// side med meget indhold kan foeles rolig.
	interface Props {
		children: import('svelte').Snippet;
		/** Daempet honning. Noget der boer ses paa. */
		ro?: boolean;
		/** Ploomme. Noget der venter paa hende. Brug den SPARSOMT: er alt
		    fremhaevet, betyder fremhaevelsen ingenting. */
		vigtig?: boolean;
		flad?: boolean;
	}
	let { children, ro = false, vigtig = false, flad = false }: Props = $props();
</script>

<div class="ak" class:ro class:vigtig class:flad>{@render children()}</div>

<style>
	.ak {
		padding: 16px 18px;
		background: var(--paper-2, #f6f0e7);
		border-radius: 16px;
		margin-bottom: 10px;
	}

	.ak.flad {
		padding: 0;
		background: none;
	}

	.ak.ro {
		background: var(--honey-tint, #f7ecd7);
	}

	.ak.vigtig {
		background: var(--plum, #7c4f63);
		color: #fff;
	}
</style>
