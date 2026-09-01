<script lang="ts">
	// Byggeklods 3.
	//
	// BAGGRUNDEN STAAR ALTID EKSPLICIT. En knap uden egen baggrund faar
	// browserens graa, og saa ligner to knapper med hver sin betydning
	// hinanden. Den faelde er vi faldet i to gange, 10. august og 25.
	// august.
	interface Props {
		children: import('svelte').Snippet;
		slags?: 'primaer' | 'rolig' | 'fare';
		disabled?: boolean;
		onclick?: () => void;
		type?: 'button' | 'submit';
		fuld?: boolean;
	}
	let {
		children,
		slags = 'rolig',
		disabled = false,
		onclick,
		type = 'button',
		fuld = false
	}: Props = $props();
</script>

<button class="an {slags}" class:fuld {type} {disabled} {onclick}>{@render children()}</button>

<style>
	.an {
		padding: 10px 18px;
		border-radius: 99px;
		border: 1px solid transparent;
		font-size: calc(13.5px * var(--fs-scale, 1));
		font-family: inherit;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
	}

	.an.fuld {
		width: 100%;
	}

	.an.primaer {
		background: var(--plum, #7c4f63);
		color: #fff;
	}

	.an.rolig {
		background: var(--paper, #fbf8f2);
		border-color: var(--line, #e8dfd1);
		color: var(--ink-2, #6f5f57);
	}

	.an.fare {
		background: var(--ler-tint, #f4e6de);
		color: var(--ler-tekst, #8a5439);
	}

	.an:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
