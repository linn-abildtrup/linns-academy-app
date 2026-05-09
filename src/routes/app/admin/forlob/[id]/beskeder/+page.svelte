<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import Icon from '$lib/components/Icon.svelte';
	import {
		hentAlleSpoergsmaal,
		opdaterSpoergsmaalStatus,
		sletSpoergsmaal,
		svarPaaSpoergsmaal,
		type KlientSpoergsmaal,
		type SpoergsmaalStatus
	} from '$lib/firestore/spoergsmaal';
	import { hentForlob } from '$lib/firestore/forlob';

	const forlobId = $derived(page.params.id ?? '');

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
	let forlobNavn = $state<string>('');
	let aktivtFilter = $state<Filter>('alle');
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let toast = $state<string | null>(null);
	let svarUdkast = $state<Record<string, string>>({});
	let svarSender = $state<string | null>(null);
	let aabenSvarId = $state<string | null>(null);

	// Kun spørgsmål for dette forløb
	const forlobSpoergsmaal = $derived(alle.filter((q) => q.forlobId === forlobId));

	const filtreret = $derived(
		aktivtFilter === 'alle'
			? forlobSpoergsmaal
			: forlobSpoergsmaal.filter((q) => q.status === aktivtFilter)
	);

	async function genindlaes() {
		loading = true;
		fejl = null;
		try {
			const [liste, f] = await Promise.all([
				hentAlleSpoergsmaal(),
				hentForlob(forlobId)
			]);
			alle = liste;
			forlobNavn = f?.navn ?? forlobId;
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

	function aabnSvar(q: KlientSpoergsmaal) {
		aabenSvarId = q.id;
		if (!(q.id in svarUdkast)) {
			svarUdkast[q.id] = q.svar ?? '';
		}
	}

	function lukSvar() {
		aabenSvarId = null;
	}

	async function sendSvar(id: string) {
		const tekst = (svarUdkast[id] ?? '').trim();
		if (!tekst) {
			visToast('Skriv et svar først');
			return;
		}
		svarSender = id;
		try {
			await svarPaaSpoergsmaal(id, tekst);
			alle = alle.map((q) =>
				q.id === id ? { ...q, svar: tekst, status: 'besvaret' as SpoergsmaalStatus } : q
			);
			aabenSvarId = null;
			visToast('Svar sendt');
		} catch (e) {
			console.error(e);
			visToast('Kunne ikke sende svar');
		} finally {
			svarSender = null;
		}
	}

	function formaterDato(t: { toDate?: () => Date } | null | undefined): string {
		if (!t || !t.toDate) return '—';
		const d = t.toDate();
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	const ubesvaretAntal = $derived(forlobSpoergsmaal.filter((q) => !q.svar).length);

	onMount(() => {
		void genindlaes();
	});
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin/forlob/{forlobId}">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>{forlobNavn || 'Forløb'}</span>
		</a>
		<div class="head-row">
			<div>
				<div class="eyebrow">Admin · {forlobNavn || 'Forløb'}</div>
				<h1>Beskeder fra <em>klienter</em></h1>
				<p class="page-sub">
					{forlobSpoergsmaal.length} spørgsmål, {ubesvaretAntal} ubesvarede
				</p>
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
	</section>

	{#if loading}
		<div class="status-besked">Henter...</div>
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if filtreret.length === 0}
		<div class="status-besked">
			{forlobSpoergsmaal.length === 0
				? 'Ingen spørgsmål fra klienter på dette forløb endnu.'
				: 'Ingen spørgsmål i dette filter.'}
		</div>
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

					{#if q.svar && aabenSvarId !== q.id}
						<div class="svar-vist">
							<div class="svar-label">Svar fra Linn</div>
							<div class="svar-tekst">{q.svar}</div>
						</div>
					{/if}

					{#if aabenSvarId === q.id}
						<div class="svar-form">
							<label class="svar-label" for="svar-{q.id}">Svar til klienten</label>
							<textarea
								id="svar-{q.id}"
								class="svar-input"
								rows="4"
								placeholder="Skriv dit svar her..."
								bind:value={svarUdkast[q.id]}
								disabled={svarSender === q.id}
							></textarea>
							<div class="svar-knapper">
								<button
									type="button"
									class="primary-knap sm"
									onclick={() => sendSvar(q.id)}
									disabled={svarSender === q.id}
								>
									{svarSender === q.id ? 'Sender...' : q.svar ? 'Opdater svar' : 'Send svar'}
								</button>
								<button
									type="button"
									class="ghost-knap sm"
									onclick={lukSvar}
									disabled={svarSender === q.id}
								>
									Annullér
								</button>
							</div>
						</div>
					{/if}

					<div class="spq-knapper">
						{#if aabenSvarId !== q.id}
							<button type="button" class="primary-knap sm" onclick={() => aabnSvar(q)}>
								{q.svar ? 'Rediger svar' : 'Svar klienten'}
							</button>
						{/if}
						{#if q.status !== 'laest'}
							<button type="button" class="ghost-knap sm" onclick={() => aendreStatus(q.id, 'laest')}>
								Markér som læst
							</button>
						{/if}
						{#if q.status !== 'brugt'}
							<button type="button" class="ghost-knap sm" onclick={() => aendreStatus(q.id, 'brugt')}>
								Markér som brugt
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
		font-size: calc(12px * var(--fs-scale, 1));
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
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text3);
	}

	h1 {
		font-family: var(--ff-d);
		font-size: calc(26px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 4px 0 4px;
		line-height: 1.05;
		color: var(--text);
	}

	h1 em {
		font-style: italic;
		color: var(--terra);
		font-weight: 400;
	}

	.page-sub {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		margin: 0;
	}

	.filter-card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 12px;
		margin-bottom: 14px;
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
		font-size: calc(12px * var(--fs-scale, 1));
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
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		cursor: pointer;
	}

	.primary-knap.sm {
		padding: 8px 12px;
		font-size: calc(12px * var(--fs-scale, 1));
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
		font-size: calc(12px * var(--fs-scale, 1));
		cursor: pointer;
	}

	.ghost-knap.sm {
		padding: 6px 10px;
		font-size: calc(11.5px * var(--fs-scale, 1));
	}

	.ghost-knap.danger {
		color: #8a4a3e;
	}

	.ghost-knap:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.status-besked {
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text3);
		font-size: calc(13px * var(--fs-scale, 1));
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
		font-size: calc(11px * var(--fs-scale, 1));
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
		font-size: calc(10px * var(--fs-scale, 1));
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
		font-size: calc(14px * var(--fs-scale, 1));
		color: var(--text);
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.spq-knapper {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.svar-vist {
		background: var(--header);
		border-left: 3px solid var(--terra);
		padding: 10px 12px;
		border-radius: 8px;
	}

	.svar-label {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--terra);
		margin-bottom: 4px;
		display: block;
	}

	.svar-tekst {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text);
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.svar-form {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.svar-input {
		font-family: var(--ff-b);
		font-size: calc(13px * var(--fs-scale, 1));
		line-height: 1.5;
		padding: 10px 12px;
		border-radius: 8px;
		background: var(--bg2);
		border: 1px solid var(--border);
		color: var(--text);
		outline: none;
		resize: vertical;
		min-height: 80px;
	}

	.svar-input:focus {
		border-color: var(--terra);
	}

	.svar-knapper {
		display: flex;
		gap: 6px;
	}

	.toast {
		position: fixed;
		bottom: calc(20px + env(safe-area-inset-bottom));
		left: 50%;
		transform: translateX(-50%);
		background: var(--text);
		color: var(--white);
		padding: 10px 16px;
		border-radius: 99px;
		font-size: calc(12px * var(--fs-scale, 1));
		z-index: 200;
	}
</style>
