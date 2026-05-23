<script lang="ts">
	// Genbrugelig bekræftelses-modal i app-stil. Erstatter native confirm()
	// og alert() med en bottom-sheet-modal der matcher resten af appen.
	//
	// Brug:
	//   <BekraeftModal
	//     titel="Slet opskrift?"
	//     beskrivelse="Den slettes permanent og kan ikke gendannes."
	//     bekraeftTekst="Slet"
	//     destruktiv
	//     arbejder={sletter}
	//     onBekraeft={() => void slet()}
	//     onAnnuller={() => (visModal = false)}
	//   />
	//
	// For ren info-besked (kun OK-knap, ingen Annullér):
	//   onlyOk på true. onBekraeft kaldes ved klik (oftest bare setter visModal=false).
	import { onDestroy, onMount } from 'svelte';

	interface Props {
		titel: string;
		beskrivelse?: string;
		bekraeftTekst?: string;
		annullerTekst?: string;
		/** True hvis handlingen er destruktiv — gør bekræft-knappen rød. */
		destruktiv?: boolean;
		/** True hvis handlingen er i gang — disabler knapperne. */
		arbejder?: boolean;
		/** Hvis true: kun OK-knap (ren info-besked, ikke en bekræftelse). */
		onlyOk?: boolean;
		onBekraeft: () => void;
		onAnnuller?: () => void;
	}

	let {
		titel,
		beskrivelse = '',
		bekraeftTekst = 'Bekræft',
		annullerTekst = 'Annullér',
		destruktiv = false,
		arbejder = false,
		onlyOk = false,
		onBekraeft,
		onAnnuller
	}: Props = $props();

	function portalToBody(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				if (node.parentNode === document.body) {
					document.body.removeChild(node);
				}
			}
		};
	}

	function annuller() {
		if (arbejder) return;
		if (onlyOk) {
			onBekraeft();
		} else {
			onAnnuller?.();
		}
	}

	onMount(() => {
		const original = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = original;
		};
	});

	onDestroy(() => {
		if (typeof document !== 'undefined') {
			document.body.style.overflow = '';
		}
	});
</script>

<div
	class="bag"
	role="dialog"
	aria-modal="true"
	use:portalToBody
	onclick={(e) => {
		if (e.target === e.currentTarget) annuller();
	}}
	onkeydown={(e) => {
		if (e.key === 'Escape') annuller();
	}}
	tabindex="-1"
>
	<div class="modal">
		<div class="head">
			<div class="titel">{titel}</div>
			<button class="luk" type="button" onclick={annuller} aria-label="Luk" disabled={arbejder}>
				×
			</button>
		</div>
		{#if beskrivelse}
			<p class="beskrivelse">{beskrivelse}</p>
		{/if}
		<div class="handlinger">
			{#if !onlyOk}
				<button
					type="button"
					class="ghost-knap"
					onclick={annuller}
					disabled={arbejder}
				>
					{annullerTekst}
				</button>
			{/if}
			<button
				type="button"
				class="primary-knap"
				class:destruktiv
				onclick={onBekraeft}
				disabled={arbejder}
			>
				{arbejder ? 'Arbejder…' : bekraeftTekst}
			</button>
		</div>
	</div>
</div>

<style>
	.bag {
		position: fixed;
		inset: 0;
		z-index: 700;
		background: rgba(42, 31, 23, 0.55);
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}

	@media (min-width: 600px) {
		.bag {
			align-items: center;
		}
	}

	.modal {
		width: 100%;
		max-width: 520px;
		background: var(--bg, #f6f3ee);
		border-radius: 18px 18px 0 0;
		padding: 18px 18px calc(18px + env(safe-area-inset-bottom));
		display: flex;
		flex-direction: column;
		gap: 14px;
		box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.15);
	}

	@media (min-width: 600px) {
		.modal {
			border-radius: 18px;
		}
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}

	.titel {
		font-family: var(--ff-d);
		font-size: calc(18px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		line-height: 1.2;
	}

	.luk {
		background: none;
		border: none;
		font-size: 26px;
		color: var(--text3);
		cursor: pointer;
		line-height: 1;
		padding: 4px 8px;
	}

	.luk:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.beskrivelse {
		font-size: calc(13.5px * var(--fs-scale, 1));
		color: var(--text2);
		margin: 0;
		line-height: 1.5;
	}

	.handlinger {
		display: flex;
		gap: 8px;
		margin-top: 4px;
	}

	.ghost-knap,
	.primary-knap {
		flex: 1;
		display: block;
		padding: 13px;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		font-family: var(--ff-b);
		border-radius: 10px;
		cursor: pointer;
		margin: 0;
	}

	.ghost-knap {
		background: transparent;
		color: var(--text2);
		border: 1px solid var(--border);
	}

	.ghost-knap:hover:not(:disabled) {
		border-color: var(--terra);
		color: var(--terra);
	}

	.primary-knap {
		background: var(--terra);
		color: #fff;
		border: none;
	}

	.primary-knap.destruktiv {
		background: #c5544a;
	}

	.ghost-knap:disabled,
	.primary-knap:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
