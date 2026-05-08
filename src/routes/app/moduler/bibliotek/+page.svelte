<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import type { User } from 'firebase/auth';
	import type { UserProduct } from '$lib/content/mikrotraening';
	import type { FaqKategori, FaqItem } from '$lib/content/bibliotek';
	import {
		grupperEfterKategori,
		kunUdgivne,
		sorterItems,
		sorterKategorier
	} from '$lib/content/bibliotek';
	import { hentFaqKategorier, hentFaqItems } from '$lib/firestore/bibliotek';
	import { hentUserProduct } from '$lib/firestore/mikrotraening';
	import Icon from '$lib/components/Icon.svelte';

	const getUser = getContext<() => User | null>('user');
	const user = $derived(getUser());

	type Tab = 'faq' | 'guides';

	function tabFraQuery(): Tab {
		const t = page.url.searchParams.get('tab');
		if (t === 'guides') return 'guides';
		return 'faq';
	}

	let aktivTab = $state<Tab>(tabFraQuery());

	function skiftTab(ny: Tab) {
		aktivTab = ny;
		const url = new URL(page.url);
		if (ny === 'faq') {
			url.searchParams.delete('tab');
		} else {
			url.searchParams.set('tab', ny);
		}
		replaceState(url, page.state);
	}

	let kategorier = $state<FaqKategori[]>([]);
	let items = $state<FaqItem[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let aabneItems = $state<Set<string>>(new Set());

	const sorterede = $derived(sorterKategorier(kategorier));
	const itemsPrKategori = $derived(grupperEfterKategori(kunUdgivne(items)));

	function harIndholdIKategori(kategoriId: string): boolean {
		const liste = itemsPrKategori[kategoriId];
		return !!liste && liste.length > 0;
	}

	function itemsForKategori(kategoriId: string): FaqItem[] {
		return sorterItems(itemsPrKategori[kategoriId] ?? []);
	}

	function toggleItem(id: string) {
		const ny = new Set(aabneItems);
		if (ny.has(id)) {
			ny.delete(id);
		} else {
			ny.add(id);
		}
		aabneItems = ny;
	}

	onMount(async () => {
		const u = user;
		if (!u) {
			fejl = 'Du skal være logget ind.';
			loading = false;
			return;
		}

		try {
			const up = await hentUserProduct(u.uid, 'kickstart');
			if (!up) {
				fejl = 'Du har ikke adgang til Bibliotek endnu.';
				loading = false;
				return;
			}

			const forlobId = (up as UserProduct & { forlobId?: string }).forlobId;
			if (!forlobId) {
				fejl = 'Du er ikke tilknyttet et forløb endnu. Kontakt Linn.';
				loading = false;
				return;
			}

			const [kats, its] = await Promise.all([
				hentFaqKategorier(forlobId),
				hentFaqItems(forlobId)
			]);
			kategorier = kats;
			items = its;
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente bibliotek. Prøv igen.';
		} finally {
			loading = false;
		}
	});
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/moduler">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Moduler</span>
		</a>
		<div class="eyebrow">Bibliotek</div>
		<h1>Bibliotek</h1>
		<p class="page-sub">FAQ og guides for dit forløb.</p>
	</header>

	<div class="tabs">
		<button
			class="tab-knap"
			class:aktiv={aktivTab === 'faq'}
			type="button"
			onclick={() => skiftTab('faq')}
		>
			FAQ
		</button>
		<button
			class="tab-knap"
			class:aktiv={aktivTab === 'guides'}
			type="button"
			onclick={() => skiftTab('guides')}
		>
			Guides
		</button>
	</div>

	{#if aktivTab === 'faq'}
		{#if loading}
			<div class="status-besked">Henter FAQ...</div>
		{:else if fejl}
			<div class="status-besked fejl">{fejl}</div>
		{:else if sorterede.length === 0}
			<div class="status-besked">
				Der er ikke lagt FAQ ind for dit forløb endnu.
			</div>
		{:else}
			{@const synligeKategorier = sorterede.filter((k) => harIndholdIKategori(k.id))}
			{#if synligeKategorier.length === 0}
				<div class="status-besked">
					Der er ingen udgivne spørgsmål endnu.
				</div>
			{:else}
				<div class="kat-liste">
					{#each synligeKategorier as kat (kat.id)}
						<section class="kat-section">
							<h2 class="kat-title">{kat.navn}</h2>
							<div class="faq-liste">
								{#each itemsForKategori(kat.id) as it (it.id)}
									<article class="faq-item" class:open={aabneItems.has(it.id)}>
										<button
											class="faq-q"
											type="button"
											onclick={() => toggleItem(it.id)}
											aria-expanded={aabneItems.has(it.id)}
										>
											<span class="faq-q-text">{it.spoergsmaal}</span>
											<span class="faq-chev">
												<Icon name="chevron-d" size={16} color="var(--terra)" />
											</span>
										</button>
										{#if aabneItems.has(it.id)}
											<div class="faq-a">
												<div class="faq-a-inner">{it.svar}</div>
											</div>
										{/if}
									</article>
								{/each}
							</div>
						</section>
					{/each}
				</div>
			{/if}
		{/if}
	{:else}
		<div class="status-besked">
			Guides kommer snart. Indtil videre kan du finde dine ressourcer på de andre moduler.
		</div>
	{/if}
</div>

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 520px;
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
		font-size: 30px;
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 4px 0 0;
		line-height: 1.05;
		color: var(--text);
	}

	.page-sub {
		font-size: 13px;
		color: var(--text2);
		margin: 6px 0 0;
		line-height: 1.4;
	}

	.tabs {
		display: grid;
		grid-template-columns: 1fr 1fr;
		background: var(--bg2);
		padding: 4px;
		border-radius: 12px;
		margin-bottom: 14px;
		gap: 4px;
	}

	.tab-knap {
		padding: 10px 6px;
		font-size: 12.5px;
		font-weight: 600;
		border-radius: 8px;
		border: none;
		background: transparent;
		color: var(--text2);
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.tab-knap.aktiv {
		background: var(--white);
		color: var(--terra);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
	}

	.status-besked {
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text2);
		font-size: 13px;
		text-align: center;
	}

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.kat-liste {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.kat-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.kat-title {
		font-family: var(--ff-d);
		font-size: 16px;
		font-weight: 500;
		font-style: italic;
		color: var(--text);
		margin: 4px 2px;
	}

	.faq-liste {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.faq-item {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		overflow: hidden;
		transition: border-color 0.18s;
	}

	.faq-item.open {
		border-color: var(--terra);
	}

	.faq-q {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 13px 14px;
		width: 100%;
		text-align: left;
		background: transparent;
		border: none;
		cursor: pointer;
		font-family: inherit;
	}

	.faq-q-text {
		flex: 1;
		font-size: 14px;
		font-weight: 500;
		color: var(--text);
		line-height: 1.4;
	}

	.faq-chev {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		transition: transform 0.25s;
	}

	.faq-item.open .faq-chev {
		transform: rotate(180deg);
	}

	.faq-a-inner {
		padding: 0 14px 14px;
		font-size: 13px;
		line-height: 1.65;
		color: var(--text2);
		white-space: pre-wrap;
	}
</style>
