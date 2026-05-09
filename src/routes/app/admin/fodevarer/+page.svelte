<script lang="ts">
	import { onMount } from 'svelte';
	import {
		hentAlleFodevarer,
		adminSaetVerificeret,
		sletCommunityFodevare
	} from '$lib/firestore/kost';
	import { KATEGORI_LABELS, type Fodevare } from '$lib/content/kost';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';

	let alle = $state<Fodevare[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let arbejder = $state<string | null>(null);

	type Filter = 'alle' | 'verificeret' | 'pending' | 'mistaenkelig';
	let filter = $state<Filter>('alle');

	onMount(async () => {
		try {
			const liste = await hentAlleFodevarer();
			alle = liste.filter((f) => f.kilde === 'community');
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente fødevarer.';
		} finally {
			loading = false;
		}
	});

	const filtreret = $derived.by<Fodevare[]>(() => {
		if (filter === 'alle') return alle;
		if (filter === 'verificeret') return alle.filter((f) => f.verificeret);
		if (filter === 'pending')
			return alle.filter(
				(f) => !f.verificeret && (f.ejBy?.length ?? 0) <= (f.okBy?.length ?? 0)
			);
		if (filter === 'mistaenkelig')
			return alle.filter((f) => (f.ejBy?.length ?? 0) > (f.okBy?.length ?? 0));
		return alle;
	});

	async function toggleVerificeret(f: Fodevare) {
		if (!f.id || arbejder) return;
		arbejder = f.id;
		try {
			const ny = !f.verificeret;
			await adminSaetVerificeret(f.id, ny);
			alle = alle.map((x) => (x.id === f.id ? { ...x, verificeret: ny } : x));
		} catch (e) {
			console.error(e);
		} finally {
			arbejder = null;
		}
	}

	async function slet(f: Fodevare) {
		if (!f.id || arbejder) return;
		const ok = confirm(`Slet '${f.name}' permanent? Det kan ikke fortrydes.`);
		if (!ok) return;
		arbejder = f.id;
		try {
			await sletCommunityFodevare(f.id);
			alle = alle.filter((x) => x.id !== f.id);
		} catch (e) {
			console.error(e);
		} finally {
			arbejder = null;
		}
	}

	function status(f: Fodevare): {
		label: string;
		klasse: string;
	} {
		if (f.verificeret) return { label: 'Verificeret', klasse: 'ok' };
		const ok = f.okBy?.length ?? 0;
		const ej = f.ejBy?.length ?? 0;
		if (ej > ok) return { label: 'Mistænkelig', klasse: 'fejl' };
		return { label: `${ok}/3 ok`, klasse: 'pending' };
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Admin</span>
		</a>
		<div class="eyebrow">Admin</div>
		<h1>Fællesskabs-fødevarer</h1>
		<p class="page-sub">Fødevarer scannet eller manuelt tilføjet af brugere.</p>
	</header>

	<div class="tabs">
		<button class="tab-knap" class:aktiv={filter === 'alle'} type="button" onclick={() => (filter = 'alle')}>
			Alle ({alle.length})
		</button>
		<button class="tab-knap" class:aktiv={filter === 'pending'} type="button" onclick={() => (filter = 'pending')}>
			Pending ({alle.filter((f) => !f.verificeret && (f.ejBy?.length ?? 0) <= (f.okBy?.length ?? 0)).length})
		</button>
		<button class="tab-knap" class:aktiv={filter === 'verificeret'} type="button" onclick={() => (filter = 'verificeret')}>
			Verificeret ({alle.filter((f) => f.verificeret).length})
		</button>
		<button class="tab-knap" class:aktiv={filter === 'mistaenkelig'} type="button" onclick={() => (filter = 'mistaenkelig')}>
			Mistænkelig ({alle.filter((f) => (f.ejBy?.length ?? 0) > (f.okBy?.length ?? 0)).length})
		</button>
	</div>

	{#if loading}
		<Loading tekst="Henter fødevarer..." />
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if filtreret.length === 0}
		<div class="status-besked">Ingen fødevarer i denne kategori.</div>
	{:else}
		<div class="liste">
			{#each filtreret as f (f.id)}
				{@const s = status(f)}
				<div class="kort">
					<div class="kort-head">
						<div class="kort-info">
							<div class="kort-navn">{f.name}</div>
							<div class="kort-meta">
								{KATEGORI_LABELS[f.cat]} · {f.p}g protein · {f.f}g fiber
								{#if f.barcode}· kode {f.barcode}{/if}
							</div>
							<div class="kort-by">
								Tilføjet af {f.addedByName ?? 'ukendt'} ·
								<span class="status-badge {s.klasse}">{s.label}</span>
								{#if (f.ejBy?.length ?? 0) > 0}
									<span class="ej-badge">{f.ejBy?.length ?? 0} ej</span>
								{/if}
							</div>
						</div>
					</div>
					<div class="kort-actions">
						<button
							class="action"
							class:primary={!f.verificeret}
							type="button"
							disabled={arbejder === f.id}
							onclick={() => toggleVerificeret(f)}
						>
							{f.verificeret ? 'Fjern verificering' : 'Verificér'}
						</button>
						<button
							class="action danger"
							type="button"
							disabled={arbejder === f.id}
							onclick={() => slet(f)}
						>
							Slet
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 720px;
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
		margin: 4px 0 6px;
		color: var(--text);
	}

	.page-sub {
		font-size: 13px;
		color: var(--text2);
		margin: 0;
	}

	.tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		background: var(--bg2);
		padding: 4px;
		border-radius: 12px;
		margin: 14px 0;
	}

	.tab-knap {
		flex: 1;
		min-width: 0;
		padding: 8px 6px;
		font-size: 11px;
		font-weight: 500;
		font-family: var(--ff-b);
		background: transparent;
		color: var(--text2);
		border: none;
		border-radius: 9px;
		cursor: pointer;
		white-space: nowrap;
	}

	.tab-knap.aktiv {
		background: var(--white);
		color: var(--text);
		font-weight: 600;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
	}

	.status-besked {
		padding: 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		text-align: center;
		font-size: 13px;
		color: var(--text2);
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

	.kort {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 12px 14px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.kort-head {
		display: flex;
		justify-content: space-between;
		gap: 10px;
	}

	.kort-info {
		flex: 1;
		min-width: 0;
	}

	.kort-navn {
		font-size: 14px;
		font-weight: 600;
		color: var(--text);
	}

	.kort-meta {
		font-size: 11.5px;
		color: var(--text3);
		margin-top: 3px;
	}

	.kort-by {
		font-size: 11px;
		color: var(--text3);
		margin-top: 4px;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}

	.status-badge {
		display: inline-flex;
		padding: 2px 8px;
		border-radius: 99px;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.04em;
	}

	.status-badge.ok {
		background: var(--sdim);
		color: var(--sage);
	}

	.status-badge.pending {
		background: var(--bg2);
		color: var(--text2);
	}

	.status-badge.fejl {
		background: #fbeeea;
		color: #8a4a3e;
	}

	.ej-badge {
		display: inline-flex;
		padding: 2px 8px;
		border-radius: 99px;
		font-size: 10px;
		font-weight: 600;
		background: #fbeeea;
		color: #8a4a3e;
	}

	.kort-actions {
		display: flex;
		gap: 8px;
	}

	.action {
		flex: 1;
		padding: 8px 12px;
		font-size: 12px;
		font-weight: 600;
		font-family: var(--ff-b);
		border-radius: 9px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text);
		cursor: pointer;
	}

	.action.primary {
		background: var(--sage);
		color: #fff;
		border-color: var(--sage);
	}

	.action.danger {
		background: transparent;
		color: #8a4a3e;
		border-color: #f0d6cf;
	}

	.action:disabled {
		opacity: 0.5;
		cursor: wait;
	}
</style>
