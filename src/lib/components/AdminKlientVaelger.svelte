<script lang="ts">
	// Modal der vises når admin trykker på 'Klient'-knappen i tabbaren.
	// Lister alle forløb i Firestore og lader admin vælge ét at logge ind
	// som klient på. Når admin vælger et forløb sættes
	// userDoc.adminKlientForlobId og hele app'en skifter til klient-mode.
	import { onMount, onDestroy } from 'svelte';
	import { hentAlleForlob } from '$lib/firestore/forlob';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import Icon from '$lib/components/Icon.svelte';

	interface Props {
		aktivtForlobId?: string;
		onVaelg: (forlobId: string) => void;
		onClose: () => void;
	}

	let { aktivtForlobId, onVaelg, onClose }: Props = $props();

	let forlob = $state<Forlob[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);

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

	onMount(() => {
		const original = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		void indlaesForlob();
		return () => {
			document.body.style.overflow = original;
		};
	});

	async function indlaesForlob() {
		try {
			forlob = await hentAlleForlob();
			forlob.sort((a, b) => a.navn.localeCompare(b.navn, 'da'));
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente forløb.';
		} finally {
			loading = false;
		}
	}

	onDestroy(() => {
		if (typeof document !== 'undefined') {
			document.body.style.overflow = '';
		}
	});

	function formaterStartDato(startDato: { toDate?: () => Date } | undefined): string {
		if (!startDato?.toDate) return '';
		const d = startDato.toDate();
		return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' });
	}
</script>

<div
	class="bag"
	role="button"
	tabindex="0"
	use:portalToBody
	onclick={(e) => {
		if (e.target === e.currentTarget) onClose();
	}}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
>
	<div class="modal" role="dialog" aria-modal="true">
		<header class="head">
			<div class="titel">
				<div class="eyebrow">Skift til klient</div>
				<h2>Vælg forløb</h2>
			</div>
			<button class="luk" type="button" onclick={onClose} aria-label="Luk">×</button>
		</header>

		<p class="info">
			Du logger ind som klient på det valgte forløb. Alt du gemmer (måltider, vaner osv.)
			holdes adskilt fra dine admin-data og fra dine klienters data.
		</p>

		{#if loading}
			<div class="status">Henter forløb...</div>
		{:else if fejl}
			<div class="status fejl">{fejl}</div>
		{:else if forlob.length === 0}
			<div class="status">Ingen forløb fundet. Opret et i admin først.</div>
		{:else}
			<div class="liste">
				{#each forlob as f (f.id)}
					<button
						class="forlob-knap"
						class:aktiv={aktivtForlobId === f.id}
						type="button"
						onclick={() => onVaelg(f.id)}
					>
						<div class="forlob-tekst">
							<div class="forlob-navn">{f.navn}</div>
							<div class="forlob-meta">
								Start {formaterStartDato(f.startDato)} · {f.antalDage} dage
							</div>
						</div>
						<Icon name="chevron-r" size={14} color="var(--text3)" />
					</button>
				{/each}
			</div>
		{/if}
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

	.modal {
		background: var(--white);
		width: 100%;
		max-width: 520px;
		max-height: 88dvh;
		border-radius: 18px 18px 0 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		padding: 18px 18px calc(18px + env(safe-area-inset-bottom));
		box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.18);
	}

	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		flex-shrink: 0;
	}

	.eyebrow {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text3);
	}

	h2 {
		font-family: var(--ff-d);
		font-size: calc(22px * var(--fs-scale, 1));
		font-weight: 600;
		margin: 4px 0 0;
		color: var(--text);
	}

	.luk {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--bg2);
		border: none;
		color: var(--text2);
		font-size: 20px;
		cursor: pointer;
		flex-shrink: 0;
	}

	.info {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.5;
		margin: 12px 0 14px;
	}

	.status {
		padding: 14px;
		text-align: center;
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.status.fejl {
		color: #8a4a3e;
	}

	.liste {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.forlob-knap {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		cursor: pointer;
		text-align: left;
		font-family: var(--ff-b);
	}

	.forlob-knap:hover {
		border-color: var(--terra);
	}

	.forlob-knap.aktiv {
		border-color: var(--terra);
		background: var(--tdim);
	}

	.forlob-tekst {
		flex: 1;
		min-width: 0;
	}

	.forlob-navn {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.forlob-meta {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}
</style>
