<script lang="ts">
	import Icon from './Icon.svelte';

	type Tone = 'terra' | 'sage' | 'gold' | 'neutral';

	let {
		tone = 'terra',
		icon,
		children
	}: {
		tone?: Tone;
		icon?: string;
		children: any;
	} = $props();
</script>

<span class="pill pill-{tone}">
	{#if icon}
		<Icon name={icon as any} size={11} />
	{/if}
	{@render children()}
</span>

<style>
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 3px 9px;
		border-radius: 999px;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		border: 1px solid transparent;
	}

	.pill-terra {
		background: var(--tdim);
		color: var(--terra);
		border-color: var(--tdim2);
	}

	.pill-sage {
		background: var(--sdim);
		color: var(--sage);
		border-color: rgba(111, 158, 126, 0.25);
	}

	.pill-gold {
		background: var(--gdim);
		color: var(--gold);
		border-color: rgba(184, 149, 106, 0.25);
	}

	.pill-neutral {
		background: var(--bg2);
		color: var(--text3);
		border-color: var(--border);
	}
</style>