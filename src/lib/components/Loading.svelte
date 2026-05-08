<script lang="ts">
	interface Props {
		tekst?: string;
		kompakt?: boolean;
	}

	let { tekst = 'Henter data...', kompakt = false }: Props = $props();
</script>

<div class="loading" class:kompakt>
	<div class="bar" aria-hidden="true">
		<div class="bar-fyld"></div>
	</div>
	<div class="tekst">{tekst}</div>
</div>

<style>
	.loading {
		padding: 28px 16px;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}

	.loading.kompakt {
		padding: 14px 16px;
		gap: 8px;
	}

	.bar {
		position: relative;
		width: 100%;
		max-width: 280px;
		height: 4px;
		border-radius: 99px;
		background: var(--bg2);
		overflow: hidden;
	}

	.loading.kompakt .bar {
		max-width: 200px;
		height: 3px;
	}

	.bar-fyld {
		position: absolute;
		top: 0;
		left: 0;
		height: 100%;
		width: 35%;
		background: var(--terra);
		border-radius: 99px;
		animation: skub 1.4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}

	@keyframes skub {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(380%);
		}
	}

	.tekst {
		font-family: var(--ff-d);
		font-size: 13px;
		font-style: italic;
		color: var(--text2);
		letter-spacing: 0.01em;
	}

	.loading.kompakt .tekst {
		font-size: 12px;
	}

	@media (prefers-reduced-motion: reduce) {
		.bar-fyld {
			animation: none;
			width: 100%;
			opacity: 0.4;
		}
	}
</style>
