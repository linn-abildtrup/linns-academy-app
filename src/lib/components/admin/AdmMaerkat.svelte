<script lang="ts">
	// Byggeklods 4. Et lille maerkat paa en raekke.
	interface Props {
		children: import('svelte').Snippet;
		farve?: 'ro' | 'klar' | 'fare' | 'stille';
	}
	let { children, farve = 'stille' }: Props = $props();
</script>

<span class="am {farve}">{@render children()}</span>

<style>
	.am {
		display: inline-block;
		padding: 2px 9px;
		border-radius: 99px;
		font-size: calc(10.5px * var(--fs-scale, 1));
		font-weight: 700;
		letter-spacing: 0.03em;
		white-space: nowrap;
	}

	.am.stille {
		background: var(--paper, #fbf8f2);
		color: var(--ink-3, #a3948a);
	}

	.am.ro {
		background: var(--honey-tint, #f7ecd7);
		color: var(--honey-deep, #b47f3e);
	}

	.am.klar {
		background: var(--sage-tint, #e7efe5);
		color: var(--sage-tekst, #46603f);
	}

	.am.fare {
		background: var(--ler-tint, #f4e6de);
		color: var(--ler-tekst, #8a5439);
	}
</style>
