<script lang="ts">
	import Icon from './Icon.svelte';

	type Variant = 'primary' | 'ghost' | 'outline' | 'soft' | 'sage';
	type Size = 'sm' | 'md' | 'lg';

	let {
		variant = 'primary',
		size = 'md',
		icon,
		full = false,
		onclick,
		children
	}: {
		variant?: Variant;
		size?: Size;
		icon?: string;
		full?: boolean;
		onclick?: (e: MouseEvent) => void;
		children: any;
	} = $props();
</script>

<button class="btn btn-{variant} btn-{size}" class:full {onclick}>
	{#if icon}
		<Icon name={icon as any} size={size === 'sm' ? 14 : 16} />
	{/if}
	{@render children()}
</button>

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		font-family: var(--ff-b);
		font-weight: 500;
		letter-spacing: 0.02em;
		border-radius: 999px;
		cursor: pointer;
		border: 1px solid transparent;
		transition: opacity 0.15s;
	}

	.btn:hover {
		opacity: 0.85;
	}

	.btn:active {
		opacity: 0.7;
	}

	.btn.full {
		width: 100%;
	}

	/* Sizes */
	.btn-sm {
		padding: 8px 15px;
		font-size: 12px;
	}

	.btn-md {
		padding: 11px 18px;
		font-size: 13px;
	}

	.btn-lg {
		padding: 14px 22px;
		font-size: 14px;
	}

	/* Variants */
	.btn-primary {
		background: var(--terra);
		color: #fff;
	}

	.btn-ghost {
		background: transparent;
		color: var(--text3);
	}

	.btn-outline {
		background: transparent;
		color: var(--text);
		border-color: var(--border2);
	}

	.btn-soft {
		background: var(--tdim);
		color: var(--terra);
		border-color: var(--tdim2);
	}

	.btn-sage {
		background: var(--sdim);
		color: var(--sage);
		border-color: rgba(111, 158, 126, 0.25);
	}
</style>
