<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Opskrift } from '$lib/content/opskrifter';
	import {
		BUTIKS_GRUPPER,
		BUTIKS_LABELS,
		formaterMaengde,
		grupperIndkoebsliste,
		teksteksport,
		tilfoejManuel,
		type IndkoebsItem,
		type ValgteOpskrifter
	} from '$lib/content/indkoebsliste';
	import { genererPDF } from '$lib/content/indkoebsliste-pdf';

	interface Props {
		items: IndkoebsItem[];
		valgte: ValgteOpskrifter;
		opskrifter: Opskrift[];
		onClose: () => void;
		onItemsChange: (items: IndkoebsItem[]) => void;
	}

	let { items, valgte, opskrifter, onClose, onItemsChange }: Props = $props();

	let manuelNavn = $state('');
	let manuelMaengde = $state('');
	let manuelEnhed = $state('stk');
	let toast = $state<string | null>(null);
	let pdfArbejder = $state(false);

	// Lås bagvedliggende scroll så iPhone ikke scroller siden under overlayet
	onMount(() => {
		const original = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = original;
		};
	});

	onDestroy(() => {
		// Sikkerhed: nulstil hvis komponenten fjernes uden at onMount-cleanup kører
		if (typeof document !== 'undefined') {
			document.body.style.overflow = '';
		}
	});

	const grupper = $derived(grupperIndkoebsliste(items));
	const aktiveCount = $derived(items.filter((i) => !i.tjekket).length);

	function visToast(tekst: string) {
		toast = tekst;
		setTimeout(() => {
			if (toast === tekst) toast = null;
		}, 2200);
	}

	function tjekToggle(id: string) {
		onItemsChange(items.map((i) => (i.id === id ? { ...i, tjekket: !i.tjekket } : i)));
	}

	function fjern(id: string) {
		onItemsChange(items.filter((i) => i.id !== id));
	}

	function tilfoej() {
		const navn = manuelNavn.trim();
		if (!navn) {
			visToast('Skriv et varenavn');
			return;
		}
		const m = parseFloat(manuelMaengde) || 0;
		const ny = tilfoejManuel(items, navn, m, manuelEnhed);
		onItemsChange(ny);
		manuelNavn = '';
		manuelMaengde = '';
	}

	async function eksporterTekst() {
		const tekst = teksteksport(items);
		if (!tekst) {
			visToast('Ingen varer på listen');
			return;
		}
		try {
			await navigator.clipboard.writeText(tekst);
			visToast('Liste kopieret');
		} catch {
			visToast('Kunne ikke kopiere — prøv PDF i stedet');
		}
	}

	async function eksporterPDF() {
		if (pdfArbejder) return;
		pdfArbejder = true;
		try {
			genererPDF(items, opskrifter, valgte);
			visToast('PDF downloadet');
		} catch (e) {
			console.error(e);
			visToast('PDF kunne ikke genereres');
		} finally {
			pdfArbejder = false;
		}
	}
</script>

<div
	class="overlay"
	role="button"
	tabindex="0"
	aria-label="Luk indkøbsliste"
	onclick={(e) => e.target === e.currentTarget && onClose()}
	onkeydown={(e) => (e.key === 'Escape' || e.key === 'Enter') && onClose()}
>
	<div class="panel" role="dialog" aria-label="Indkøbsliste">
		<header class="head">
			<div>
				<div class="eyebrow">Indkøbsliste</div>
				<h2>
					Indkøbs<em>liste</em>
				</h2>
			</div>
			<button type="button" class="luk" aria-label="Luk" onclick={onClose}>×</button>
		</header>

		<div class="body">
			{#if items.length === 0}
				<div class="tom">Ingen varer endnu. Vælg opskrifter og åbn listen igen.</div>
			{:else}
				{#each BUTIKS_GRUPPER as g (g)}
					{#if grupper[g].length}
						<div class="gruppe-label">{BUTIKS_LABELS[g]}</div>
						<div class="card">
							{#each grupper[g] as item (item.id)}
								<div class="rad" class:tjekket={item.tjekket}>
									<button
										type="button"
										class="check"
										class:on={item.tjekket}
										aria-label={item.tjekket ? 'Fjern flueben' : 'Sæt flueben'}
										onclick={() => tjekToggle(item.id)}
									></button>
									<div class="tekst">
										{#if item.maengde > 0}
											<span class="maengde">{formaterMaengde(item.maengde)} {item.enhed}</span>
										{/if}
										<span class="navn">{item.navn}</span>
									</div>
									<button
										type="button"
										class="fjern"
										aria-label="Fjern fra liste"
										onclick={() => fjern(item.id)}>×</button
									>
								</div>
							{/each}
						</div>
					{/if}
				{/each}
			{/if}

			<div class="manuel-section">
				<div class="section-label">Tilføj manuel vare</div>
				<div class="manuel-rad">
					<input
						type="text"
						bind:value={manuelNavn}
						placeholder="Vare-navn"
						onkeydown={(e) => e.key === 'Enter' && tilfoej()}
					/>
					<input
						type="number"
						bind:value={manuelMaengde}
						placeholder="0"
						class="maengde-input"
						min="0"
						step="0.5"
					/>
					<select bind:value={manuelEnhed}>
						<option value="stk">stk</option>
						<option value="g">g</option>
						<option value="kg">kg</option>
						<option value="ml">ml</option>
						<option value="dl">dl</option>
						<option value="l">l</option>
						<option value="tsk">tsk</option>
						<option value="spsk">spsk</option>
					</select>
					<button type="button" class="primary-knap" onclick={tilfoej}>+ Tilføj</button>
				</div>
			</div>

			<div class="eksport-section">
				<div class="section-label">Eksport — indkøbsliste og opskrifter</div>
				<div class="eksport-knapper">
					<button type="button" class="ghost-knap" onclick={eksporterTekst} disabled={!aktiveCount}>
						Kopier som tekst
					</button>
					<button
						type="button"
						class="primary-knap"
						onclick={eksporterPDF}
						disabled={pdfArbejder || !aktiveCount}
					>
						{pdfArbejder ? 'Genererer...' : 'Download PDF'}
					</button>
				</div>
				<div class="eksport-hint">PDF indeholder indkøbslisten + alle valgte opskrifter</div>
			</div>
		</div>

		{#if toast}
			<div class="toast" role="status">{toast}</div>
		{/if}
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(53, 35, 24, 0.45);
		z-index: 200;
		display: flex;
		justify-content: center;
		align-items: flex-end;
	}

	.panel {
		background: var(--bg);
		width: 100%;
		max-width: 520px;
		max-height: 92dvh;
		border-radius: 18px 18px 0 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		box-shadow: 0 -10px 40px rgba(53, 35, 24, 0.18);
		position: relative;
	}

	.head {
		padding: 18px 20px 12px;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		background: var(--header);
		border-bottom: 1px solid var(--border);
	}

	.eyebrow {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text3);
	}

	h2 {
		font-family: var(--ff-d);
		font-size: 26px;
		font-weight: 600;
		margin: 4px 0 0;
		line-height: 1.05;
		color: var(--text);
	}

	h2 em {
		font-style: italic;
		color: var(--terra);
		font-weight: 400;
	}

	.luk {
		width: 32px;
		height: 32px;
		border: none;
		background: transparent;
		font-size: 26px;
		color: var(--text2);
		cursor: pointer;
		line-height: 1;
	}

	.body {
		padding: 14px 18px calc(24px + env(safe-area-inset-bottom));
		overflow-y: auto;
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
		flex: 1;
		min-height: 0;
	}

	.tom {
		padding: 24px;
		text-align: center;
		color: var(--text3);
		font-size: 13px;
	}

	.gruppe-label {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--terra);
		margin: 14px 0 6px;
	}

	.card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		overflow: hidden;
	}

	.rad {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		border-top: 1px solid var(--border);
	}

	.rad:first-child {
		border-top: none;
	}

	.rad.tjekket {
		opacity: 0.55;
	}

	.check {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		border: 1.5px solid var(--terra);
		background: transparent;
		cursor: pointer;
		flex-shrink: 0;
		position: relative;
	}

	.check.on {
		background: var(--terra);
	}

	.check.on::after {
		content: '✓';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		color: var(--white);
		font-size: 12px;
		font-weight: 700;
	}

	.tekst {
		flex: 1;
		font-size: 13px;
		color: var(--text);
		min-width: 0;
	}

	.rad.tjekket .tekst {
		text-decoration: line-through;
	}

	.maengde {
		font-weight: 600;
		color: var(--terra);
		margin-right: 6px;
	}

	.fjern {
		border: none;
		background: transparent;
		color: var(--text3);
		cursor: pointer;
		font-size: 20px;
		padding: 0 4px;
		line-height: 1;
	}

	.manuel-section,
	.eksport-section {
		margin-top: 18px;
	}

	.section-label {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text3);
		margin-bottom: 8px;
	}

	.manuel-rad {
		display: flex;
		gap: 6px;
		align-items: center;
	}

	.manuel-rad input[type='text'] {
		flex: 1;
		min-width: 0;
		padding: 8px 10px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--white);
		font-family: inherit;
		font-size: 13px;
	}

	.manuel-rad input[type='number'] {
		width: 50px;
		padding: 8px 8px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--white);
		font-family: inherit;
		font-size: 13px;
		text-align: right;
	}

	.manuel-rad select {
		padding: 8px 6px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--white);
		font-family: inherit;
		font-size: 13px;
	}

	.eksport-knapper {
		display: flex;
		gap: 8px;
	}

	.eksport-knapper .ghost-knap,
	.eksport-knapper .primary-knap {
		flex: 1;
	}

	.primary-knap {
		background: var(--terra);
		color: var(--white);
		border: none;
		padding: 10px 14px;
		border-radius: 10px;
		font-family: inherit;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}

	.primary-knap:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.ghost-knap {
		background: var(--white);
		color: var(--text2);
		border: 1px solid var(--border);
		padding: 10px 14px;
		border-radius: 10px;
		font-family: inherit;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
	}

	.ghost-knap:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.eksport-hint {
		margin-top: 6px;
		font-size: 11px;
		color: var(--text3);
		text-align: center;
	}

	.toast {
		position: absolute;
		bottom: 80px;
		left: 50%;
		transform: translateX(-50%);
		background: var(--text);
		color: var(--white);
		padding: 8px 16px;
		border-radius: 99px;
		font-size: 12px;
		font-weight: 500;
		box-shadow: 0 4px 18px rgba(0, 0, 0, 0.2);
	}
</style>
