<script lang="ts">
	let {
		padded = true,
		onclick,
		children
	}: {
		padded?: boolean;
		onclick?: (e: MouseEvent) => void;
		children: any;
	} = $props();
</script>

{#if onclick}
	<button class="card" class:padded {onclick}>
		{@render children()}
	</button>
{:else}
	<div class="card" class:padded>
		{@render children()}
	</div>
{/if}

<style>
	.card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: var(--rl);
		display: block;
		width: 100%;
		text-align: left;
	}

	.card.padded {
		padding: var(--card-pad);
	}

	button.card {
		font: inherit;
		color: inherit;
		cursor: pointer;
		transition: opacity 0.15s;
	}

	button.card:hover {
		opacity: 0.9;
	}
</style>