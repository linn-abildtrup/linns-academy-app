<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import {
		hentAlleSpoergsmaal,
		opdaterSpoergsmaalStatus,
		sletSpoergsmaal,
		type KlientSpoergsmaal,
		type SpoergsmaalStatus
	} from '$lib/firestore/spoergsmaal';

	type Filter = 'alle' | SpoergsmaalStatus;

	const FILTRE: { id: Filter; label: string }[] = [
		{ id: 'alle', label: 'Alle' },
		{ id: 'ny', label: 'Nye' },
		{ id: 'laest', label: 'Læste' },
		{ id: 'besvaret', label: 'Besvarede' },
		{ id: 'brugt', label: 'Brugte' }
	];

	const STATUS_LABELS: Record<SpoergsmaalStatus, string> = {
		ny: 'Ny',
		laest: 'Læst',
		besvaret: 'Besvaret',
		brugt: 'Brugt'
	};

	let alle = $state<KlientSpoergsmaal[]>([]);
	let aktivtFilter = $state<Filter>('alle');
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let toast = $state<string | null>(null);

	const filtreret = $derived(
		aktivtFilter === 'alle' ? alle : alle.filter((q) => q.status === aktivtFilter)
	);

	async function genindlaes() {
		loading = true;
		fejl = null;
		try {
			alle = await hentAlleSpoergsmaal();
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente spørgsmål.';
		} finally {
			loading = false;
		}
	}

	function visToast(t: string) {
		toast = t;
		setTimeout(() => {
			if (toast === t) toast = null;
		}, 2200);
	}

	async function aendreStatus(id: string, ny: SpoergsmaalStatus) {
		try {
			await opdaterSpoergsmaalStatus(id, ny);
			alle = alle.map((q) => (q.id === id ? { ...q, status: ny } : q));
			visToast('Status opdateret');
		} catch (e) {
			console.error(e);
			visToast('Kunne ikke opdatere');
		}
	}

	async function slet(id: string) {
		const ok = confirm('Slet spørgsmålet permanent?');
		if (!ok) return;
		try {
			await sletSpoergsmaal(id);
			alle = alle.filter((q) => q.id !== id);
			visToast('Slettet');
		} catch (e) {
			console.error(e);
			visToast('Kunne ikke slette');
		}
	}

	function formaterDato(t: { toDate?: () => Date } | null | undefined): string {
		if (!t || !t.toDate) return '—';
		const d = t.toDate();
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	function csvFelt(s: string): string {
		const trim = (s ?? '').toString();
		if (/[";\n\r]/.test(trim)) {
			return '"' + trim.replace(/"/g, '""') + '"';
		}
		return trim;
	}

	function eksporterCSV() {
		if (filtreret.length === 0) {
			visToast('Ingen spørgsmål at eksportere');
			return;
		}
		const header = ['Nr', 'Dato', 'Email', 'Spørgsmål', 'Status', 'Svar'];
		const rows = filtreret.map((q, i) => [
			String(i + 1),
			formaterDato(q.oprettet),
			q.email,
			q.spoergsmaal,
			STATUS_LABELS[q.status],
			''
		]);
		const csvLinjer = [header, ...rows].map((r) => r.map(csvFelt).join(';'));
		const csv = '﻿' + csvLinjer.join('\r\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		const now = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		const fname = `spoergsmaal-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.csv`;
		a.href = url;
		a.download = fname;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		visToast(`CSV downloadet (${filtreret.length})`);
	}

	onMount(() => {
		void genindlaes();
	});
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Admin</span>
		</a>
		<div class="head-row">
			<div>
				<div class="eyebrow">Admin · Spørgsmål</div>
				<h1>Spørgsmål fra <em>klienter</em></h1>
			</div>
			<button type="button" class="ghost-knap sm" onclick={genindlaes} disabled={loading}>
				{loading ? 'Henter...' : 'Opdater'}
			</button>
		</div>
	</header>

	<section class="filter-card">
		<div class="filter-rad">
			{#each FILTRE as f (f.id)}
				<button
					type="button"
					class="filter-chip"
					class:aktiv={aktivtFilter === f.id}
					onclick={() => (aktivtFilter = f.id)}
				>
					{f.label}
				</button>
			{/each}
		</div>
		<button type="button" class="primary-knap" onclick={eksporterCSV} disabled={filtreret.length === 0}>
			Download som CSV
		</button>
		<div class="hint">
			Eksporterer {filtreret.length}
			{filtreret.length === 1 ? 'spørgsmål' : 'spørgsmål'} (følger filteret ovenfor)
		</div>
	</section>

	{#if loading}
		<div class="status-besked">Henter...</div>
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if filtreret.length === 0}
		<div class="status-besked">Ingen spørgsmål i dette filter</div>
	{:else}
		<div class="liste">
			{#each filtreret as q (q.id)}
				<article class="spq-kort spq-status-{q.status}">
					<div class="spq-meta">
						<span class="spq-pill spq-pill-{q.status}">{STATUS_LABELS[q.status]}</span>
						<span>·</span>
						<span class="spq-email">{q.email || 'ukendt'}</span>
						<span>·</span>
						<span>{formaterDato(q.oprettet)}</span>
					</div>
					<div class="spq-tekst">{q.spoergsmaal}</div>
					<div class="spq-knapper">
						{#if q.status !== 'laest'}
							<button type="button" class="ghost-knap sm" onclick={() => aendreStatus(q.id, 'laest')}>
								Markér som læst
							</button>
						{/if}
						{#if q.status !== 'besvaret'}
							<button
								type="button"
								class="ghost-knap sm"
								onclick={() => aendreStatus(q.id, 'besvaret')}
							>
								Markér som besvaret
							</button>
						{/if}
						{#if q.status !== 'brugt'}
							<button type="button" class="ghost-knap sm" onclick={() => aendreStatus(q.id, 'brugt')}>
								Markér som brugt
							</button>
						{/if}
						{#if q.status !== 'ny'}
							<button type="button" class="ghost-knap sm" onclick={() => aendreStatus(q.id, 'ny')}>
								Tilbage til ny
							</button>
						{/if}
						<button type="button" class="ghost-knap sm danger" onclick={() => slet(q.id)}>
							Slet
						</button>
					</div>
				</article>
			{/each}
		</div>
	{/if}

	{#if toast}
		<div class="toast" role="status">{toast}</div>
	{/if}
</div>

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 600px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 14px;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--text2);
		text-decoration: none;
		margin-bottom: 12px;
	}

	.head-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
	}

	.eyebrow {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text3);
	}

	h1 {
		font-family: var(--ff-d);
		font-size: 26px;
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 4px 0 0;
		line-height: 1.05;
		color: var(--text);
	}

	h1 em {
		font-style: italic;
		color: var(--terra);
		font-weight: 400;
	}

	.filter-card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 14px;
		margin-bottom: 14px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.filter-rad {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.filter-chip {
		background: var(--bg2);
		border: 1px solid var(--border);
		color: var(--text2);
		border-radius: 99px;
		padding: 6px 12px;
		font-family: inherit;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
	}

	.filter-chip.aktiv {
		background: var(--terra);
		border-color: var(--terra);
		color: var(--white);
	}

	.primary-knap {
		background: var(--terra);
		color: var(--white);
		border: none;
		padding: 12px 14px;
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
		padding: 8px 12px;
		border-radius: 8px;
		font-family: inherit;
		font-size: 12px;
		cursor: pointer;
	}

	.ghost-knap.sm {
		padding: 6px 10px;
		font-size: 11.5px;
	}

	.ghost-knap.danger {
		color: #8a4a3e;
	}

	.ghost-knap:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.hint {
		font-size: 11px;
		color: var(--text3);
		text-align: center;
	}

	.status-besked {
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text3);
		font-size: 13px;
		text-align: center;
	}

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.liste {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.spq-kort {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 12px 14px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.spq-kort.spq-status-ny {
		border-color: var(--terra);
	}

	.spq-meta {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		color: var(--text3);
		flex-wrap: wrap;
	}

	.spq-email {
		color: var(--text2);
		font-weight: 500;
	}

	.spq-pill {
		padding: 2px 8px;
		border-radius: 99px;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.spq-pill-ny {
		background: var(--terra);
		color: var(--white);
	}

	.spq-pill-laest {
		background: var(--bg2);
		color: var(--text2);
	}

	.spq-pill-besvaret {
		background: rgba(143, 168, 144, 0.2);
		color: #4f6f5b;
	}

	.spq-pill-brugt {
		background: rgba(160, 136, 120, 0.18);
		color: var(--text3);
	}

	.spq-tekst {
		font-size: 14px;
		color: var(--text);
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.spq-knapper {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.toast {
		position: fixed;
		bottom: 80px;
		left: 50%;
		transform: translateX(-50%);
		background: var(--text);
		color: var(--white);
		padding: 8px 16px;
		border-radius: 99px;
		font-size: 12px;
		font-weight: 500;
		z-index: 1000;
	}
</style>
