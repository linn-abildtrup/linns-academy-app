<script lang="ts">
	// Toast vises automatisk naar en skrive-handling blokeres af viewOnly-mode.
	// Lyttede paa aktuelToast fra viewOnlyState og vises som lille pop-up
	// nederst paa skaermen.
	import { aktuelToast } from '$lib/viewOnlyState.svelte';

	const tekst = $derived(aktuelToast());
</script>

{#if tekst}
	<div class="toast" role="status">{tekst}</div>
{/if}

<style>
	.toast {
		position: fixed;
		bottom: 92px;
		left: 50%;
		transform: translateX(-50%);
		background: rgba(35, 23, 18, 0.92);
		color: #fff;
		padding: 10px 18px;
		border-radius: 99px;
		font-family: var(--ff-b);
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		z-index: 200;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
		pointer-events: none;
		animation: dukkOp 200ms ease-out;
	}

	@keyframes dukkOp {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}
</style>
