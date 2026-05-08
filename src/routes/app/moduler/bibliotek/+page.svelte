<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import type { User } from 'firebase/auth';
	import type { UserProduct } from '$lib/content/mikrotraening';
	import type {
		FaqKategori,
		FaqItem,
		GuideKategori,
		GuideItem,
		GuideType
	} from '$lib/content/bibliotek';
	import {
		formatDanskDato,
		GUIDE_TYPE_LABELS,
		grupperEfterKategori,
		kunUdgivne,
		sorterGuides,
		sorterItems,
		sorterKategorier,
		videoEmbedUrl
	} from '$lib/content/bibliotek';
	import {
		hentFaqKategorier,
		hentFaqItems,
		hentGuideKategorier,
		hentGuideItems
	} from '$lib/firestore/bibliotek';
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

	let faqKategorier = $state<FaqKategori[]>([]);
	let faqItems = $state<FaqItem[]>([]);
	let guideKategorier = $state<GuideKategori[]>([]);
	let guideItems = $state<GuideItem[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let aabneFaqItems = $state<Set<string>>(new Set());

	let aabenGuide = $state<GuideItem | null>(null);

	const sorterede = $derived(sorterKategorier(faqKategorier));
	const faqItemsPrKategori = $derived(grupperEfterKategori(kunUdgivne(faqItems)));

	const sorteredeGuideKats = $derived(sorterKategorier(guideKategorier));
	const guideItemsPrKategori = $derived(grupperEfterKategori(kunUdgivne(guideItems)));

	function harFaqIKategori(kategoriId: string): boolean {
		const liste = faqItemsPrKategori[kategoriId];
		return !!liste && liste.length > 0;
	}

	function faqForKategori(kategoriId: string): FaqItem[] {
		return sorterItems(faqItemsPrKategori[kategoriId] ?? []);
	}

	function harGuidesIKategori(kategoriId: string): boolean {
		const liste = guideItemsPrKategori[kategoriId];
		return !!liste && liste.length > 0;
	}

	function guidesForKategori(kategoriId: string): GuideItem[] {
		return sorterGuides(guideItemsPrKategori[kategoriId] ?? []);
	}

	function toggleFaqItem(id: string) {
		const ny = new Set(aabneFaqItems);
		if (ny.has(id)) {
			ny.delete(id);
		} else {
			ny.add(id);
		}
		aabneFaqItems = ny;
	}

	function aabnGuide(it: GuideItem) {
		if (it.type === 'pdf' || it.type === 'link') {
			window.open(it.url, '_blank', 'noopener,noreferrer');
			return;
		}
		aabenGuide = it;
	}

	function lukGuide() {
		aabenGuide = null;
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

			const [faqKats, faqIts, guideKats, guideIts] = await Promise.all([
				hentFaqKategorier(forlobId),
				hentFaqItems(forlobId),
				hentGuideKategorier(forlobId),
				hentGuideItems(forlobId)
			]);
			faqKategorier = faqKats;
			faqItems = faqIts;
			guideKategorier = guideKats;
			guideItems = guideIts;
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente bibliotek. Prøv igen.';
		} finally {
			loading = false;
		}
	});

	function typeKlassenavn(type: GuideType): string {
		return `thumb-${type}`;
	}

	function typeLabel(type: GuideType): string {
		return GUIDE_TYPE_LABELS[type];
	}

	const aabenEmbed = $derived(aabenGuide?.type === 'video' ? videoEmbedUrl(aabenGuide.url) : null);
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
			{@const synligeKategorier = sorterede.filter((k) => harFaqIKategori(k.id))}
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
								{#each faqForKategori(kat.id) as it (it.id)}
									<article class="faq-item" class:open={aabneFaqItems.has(it.id)}>
										<button
											class="faq-q"
											type="button"
											onclick={() => toggleFaqItem(it.id)}
											aria-expanded={aabneFaqItems.has(it.id)}
										>
											<span class="faq-q-text">{it.spoergsmaal}</span>
											<span class="faq-chev">
												<Icon name="chevron-d" size={16} color="var(--terra)" />
											</span>
										</button>
										{#if aabneFaqItems.has(it.id)}
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
		{#if loading}
			<div class="status-besked">Henter guides...</div>
		{:else if fejl}
			<div class="status-besked fejl">{fejl}</div>
		{:else if sorteredeGuideKats.length === 0}
			<div class="status-besked">
				Der er ikke lagt guides op for dit forløb endnu.
			</div>
		{:else}
			{@const synligeKategorier = sorteredeGuideKats.filter((k) => harGuidesIKategori(k.id))}
			{#if synligeKategorier.length === 0}
				<div class="status-besked">
					Der er ingen udgivne guides endnu.
				</div>
			{:else}
				<div class="kat-liste">
					{#each synligeKategorier as kat (kat.id)}
						<section class="kat-section">
							<h2 class="kat-title">{kat.navn}</h2>
							<div class="guide-liste">
								{#each guidesForKategori(kat.id) as it (it.id)}
									<button class="guide-card" type="button" onclick={() => aabnGuide(it)}>
										<div class="guide-thumb {typeKlassenavn(it.type)}">
											<span class="guide-type-pill">{typeLabel(it.type)}</span>
											<div class="guide-thumb-icon">
												{#if it.type === 'video'}
													<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.95)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
														<circle cx="12" cy="12" r="10" />
														<path d="M10 8l6 4-6 4V8z" fill="rgba(255,255,255,.95)" stroke="none" />
													</svg>
												{:else if it.type === 'pdf'}
													<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.95)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
														<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
														<path d="M14 2v6h6" />
														<path d="M9 13h6M9 17h4" />
													</svg>
												{:else if it.type === 'audio'}
													<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.95)" stroke-width="1.8" stroke-linecap="round">
														<path d="M3 10v4M7 7v10M11 4v16M15 8v8M19 11v2" />
													</svg>
												{:else}
													<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.95)" stroke-width="1.5">
														<circle cx="12" cy="12" r="9" />
														<path d="M12 3c-2 2-3 5-3 9s1 7 3 9M12 3c2 2 3 5 3 9s-1 7-3 9M3 12h18" />
													</svg>
												{/if}
											</div>
										</div>
										<div class="guide-body">
											<div class="guide-titel">{it.titel}</div>
											{#if it.beskrivelse}
												<div class="guide-beskrivelse">{it.beskrivelse}</div>
											{/if}
											{#if it.dato}
												<div class="guide-dato">{formatDanskDato(it.dato)}</div>
											{/if}
										</div>
									</button>
								{/each}
							</div>
						</section>
					{/each}
				</div>
			{/if}
		{/if}
	{/if}
</div>

{#if aabenGuide}
	<div
		class="overlay-bg"
		role="button"
		tabindex="0"
		onclick={lukGuide}
		onkeydown={(e) => e.key === 'Escape' && lukGuide()}
	></div>
	<div class="overlay" role="dialog" aria-modal="true">
		<header class="overlay-head">
			<div class="overlay-titel">{aabenGuide.titel}</div>
			<button class="overlay-luk" type="button" onclick={lukGuide} aria-label="Luk">×</button>
		</header>

		{#if aabenGuide.type === 'video'}
			{#if aabenEmbed}
				<div class="overlay-video">
					<iframe
						src={aabenEmbed}
						title={aabenGuide.titel}
						allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
						allowfullscreen
					></iframe>
				</div>
			{:else}
				<div class="overlay-fallback">
					<p>Videoen kan ikke afspilles indlejret.</p>
					<a class="overlay-link" href={aabenGuide.url} target="_blank" rel="noopener noreferrer">
						Åbn i ny fane
					</a>
				</div>
			{/if}
		{:else if aabenGuide.type === 'audio'}
			<div class="overlay-audio">
				<audio controls src={aabenGuide.url}>
					Din browser kan ikke afspille lyd-elementet.
				</audio>
			</div>
		{/if}

		{#if aabenGuide.beskrivelse}
			<p class="overlay-beskrivelse">{aabenGuide.beskrivelse}</p>
		{/if}

		{#if aabenGuide.dato}
			<div class="overlay-dato">{formatDanskDato(aabenGuide.dato)}</div>
		{/if}
	</div>
{/if}

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

	.guide-liste {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.guide-card {
		display: flex;
		flex-direction: column;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		overflow: hidden;
		cursor: pointer;
		text-align: left;
		font-family: inherit;
		padding: 0;
		transition: border-color 0.18s, transform 0.1s;
	}

	.guide-card:active {
		transform: scale(0.995);
		border-color: var(--terra);
	}

	.guide-card:hover {
		border-color: var(--terra);
	}

	.guide-thumb {
		position: relative;
		width: 100%;
		aspect-ratio: 16 / 9;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.guide-thumb-icon {
		position: relative;
		z-index: 1;
		filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.18));
	}

	.guide-type-pill {
		position: absolute;
		top: 8px;
		left: 8px;
		z-index: 2;
		background: rgba(42, 15, 30, 0.72);
		color: #fff;
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.06em;
		padding: 4px 9px;
		border-radius: 999px;
		backdrop-filter: blur(6px);
	}

	.thumb-video {
		background: linear-gradient(135deg, #B87B6E 0%, #9D6358 100%);
	}

	.thumb-pdf {
		background: linear-gradient(135deg, #F5E4DC 0%, #E8C9BC 55%, #D9A895 100%);
	}

	.thumb-pdf .guide-thumb-icon svg {
		stroke: rgba(60, 30, 22, 0.85);
	}

	.thumb-pdf .guide-type-pill {
		color: #2a0f1e;
		background: rgba(255, 255, 255, 0.7);
	}

	.thumb-link {
		background: linear-gradient(135deg, #C8DDD1 0%, #A9CBBA 100%);
	}

	.thumb-link .guide-thumb-icon svg {
		stroke: rgba(31, 58, 42, 0.85);
	}

	.thumb-link .guide-type-pill {
		color: #1f3a2a;
		background: rgba(255, 255, 255, 0.7);
	}

	.thumb-audio {
		background: linear-gradient(135deg, #B87B6E 0%, #CC9080 100%);
	}

	.guide-body {
		padding: 12px 14px 14px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.guide-titel {
		font-size: 14px;
		font-weight: 600;
		color: var(--text);
		line-height: 1.35;
	}

	.guide-beskrivelse {
		font-size: 12.5px;
		color: var(--text2);
		line-height: 1.5;
	}

	.guide-dato {
		font-size: 10.5px;
		color: var(--text3);
		letter-spacing: 0.04em;
		margin-top: 2px;
	}

	.overlay-bg {
		position: fixed;
		inset: 0;
		background: rgba(20, 14, 18, 0.7);
		z-index: 60;
		border: none;
	}

	.overlay {
		position: fixed;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		background: var(--white);
		border-radius: 16px;
		width: calc(100% - 24px);
		max-width: 720px;
		max-height: 92vh;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		z-index: 61;
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
	}

	.overlay-head {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.overlay-titel {
		flex: 1;
		font-family: var(--ff-d);
		font-size: 18px;
		font-weight: 600;
		color: var(--text);
		line-height: 1.3;
	}

	.overlay-luk {
		width: 32px;
		height: 32px;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text2);
		font-size: 18px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.overlay-video {
		position: relative;
		width: 100%;
		aspect-ratio: 16 / 9;
		background: #000;
		border-radius: 10px;
		overflow: hidden;
	}

	.overlay-video iframe {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: none;
	}

	.overlay-audio {
		display: flex;
		justify-content: center;
		padding: 8px 0;
	}

	.overlay-audio audio {
		width: 100%;
	}

	.overlay-beskrivelse {
		font-size: 13px;
		line-height: 1.6;
		color: var(--text2);
		margin: 0;
		white-space: pre-wrap;
	}

	.overlay-dato {
		font-size: 11px;
		color: var(--text3);
		letter-spacing: 0.04em;
	}

	.overlay-fallback {
		padding: 20px;
		text-align: center;
		color: var(--text2);
		font-size: 13px;
	}

	.overlay-link {
		display: inline-block;
		margin-top: 10px;
		padding: 8px 16px;
		background: var(--terra);
		color: #fff;
		text-decoration: none;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 600;
	}
</style>
