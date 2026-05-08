<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import type {
		FaqKategori,
		FaqItem,
		GuideKategori,
		GuideItem,
		GuideType
	} from '$lib/content/bibliotek';
	import {
		detekterGuideType,
		GUIDE_TYPER,
		GUIDE_TYPE_LABELS,
		grupperEfterKategori,
		naesteOrden,
		sorterGuides,
		sorterItems,
		sorterKategorier
	} from '$lib/content/bibliotek';
	import {
		hentFaqKategorier,
		hentFaqItems,
		hentGuideKategorier,
		hentGuideItems,
		opdaterFaqItem,
		opdaterFaqKategori,
		opdaterGuideItem,
		opdaterGuideKategori,
		opretFaqItem,
		opretFaqKategori,
		opretGuideItem,
		opretGuideKategori,
		sletFaqItem,
		sletFaqKategoriMedItems,
		sletGuideItem,
		sletGuideKategoriMedItems
	} from '$lib/firestore/bibliotek';
	import Icon from '$lib/components/Icon.svelte';

	const forlobId = $derived(page.params.id ?? '');

	type Tab = 'faq' | 'guides';
	function tabFraQuery(): Tab {
		const t = page.url.searchParams.get('tab');
		return t === 'guides' ? 'guides' : 'faq';
	}
	let aktivTab = $state<Tab>(tabFraQuery());
	function skiftTab(ny: Tab) {
		aktivTab = ny;
		const url = new URL(page.url);
		if (ny === 'faq') url.searchParams.delete('tab');
		else url.searchParams.set('tab', ny);
		replaceState(url, page.state);
	}

	// FAQ-state
	let faqKats = $state<FaqKategori[]>([]);
	let faqItems = $state<FaqItem[]>([]);
	// Guides-state
	let guideKats = $state<GuideKategori[]>([]);
	let guideItems = $state<GuideItem[]>([]);

	let loading = $state(true);
	let fejl = $state<string | null>(null);

	// Delt: ny kategori (forskellig pr tab)
	let nyFaqKatNavn = $state('');
	let nyGuideKatNavn = $state('');
	let opretterKategori = $state(false);

	// Delt: omdøb kategori
	let redigererKategoriId = $state<string | null>(null);
	let redigeringNavn = $state('');
	let bekraeftKategoriId = $state<string | null>(null);

	// FAQ-dialog
	let viserFaqDialog = $state(false);
	let faqDialogItemId = $state<string | null>(null);
	let faqDialogKategoriId = $state('');
	let faqDialogSpoergsmaal = $state('');
	let faqDialogSvar = $state('');
	let faqDialogUdgivet = $state(true);
	let faqDialogGemmer = $state(false);
	let faqDialogFejl = $state<string | null>(null);

	// Guide-dialog
	let viserGuideDialog = $state(false);
	let guideDialogItemId = $state<string | null>(null);
	let guideDialogKategoriId = $state('');
	let guideDialogTitel = $state('');
	let guideDialogBeskrivelse = $state('');
	let guideDialogUrl = $state('');
	let guideDialogType = $state<GuideType>('video');
	let guideDialogDato = $state('');
	let guideDialogUdgivet = $state(true);
	let guideDialogGemmer = $state(false);
	let guideDialogFejl = $state<string | null>(null);

	const sorteredeFaqKats = $derived(sorterKategorier(faqKats));
	const faqItemsPrKategori = $derived(grupperEfterKategori(faqItems));
	const sorteredeGuideKats = $derived(sorterKategorier(guideKats));
	const guideItemsPrKategori = $derived(grupperEfterKategori(guideItems));

	function faqTael(katId: string) {
		const l = faqItemsPrKategori[katId] ?? [];
		return { total: l.length, udgivet: l.filter((it) => it.udgivet).length };
	}
	function guideTael(katId: string) {
		const l = guideItemsPrKategori[katId] ?? [];
		return { total: l.length, udgivet: l.filter((it) => it.udgivet).length };
	}
	function faqForKategori(katId: string): FaqItem[] {
		return sorterItems(faqItemsPrKategori[katId] ?? []);
	}
	function guidesForKategori(katId: string): GuideItem[] {
		return sorterGuides(guideItemsPrKategori[katId] ?? []);
	}

	onMount(async () => {
		await indlaes();
	});

	async function indlaes() {
		loading = true;
		fejl = null;
		try {
			const [fk, fi, gk, gi] = await Promise.all([
				hentFaqKategorier(forlobId),
				hentFaqItems(forlobId),
				hentGuideKategorier(forlobId),
				hentGuideItems(forlobId)
			]);
			faqKats = fk;
			faqItems = fi;
			guideKats = gk;
			guideItems = gi;
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente bibliotek.';
		} finally {
			loading = false;
		}
	}

	// FAQ-kategorier
	async function tilfoejFaqKategori() {
		const navn = nyFaqKatNavn.trim();
		if (!navn) return;
		opretterKategori = true;
		try {
			await opretFaqKategori(forlobId, navn, naesteOrden(faqKats));
			nyFaqKatNavn = '';
			await indlaes();
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke oprette kategori.';
		} finally {
			opretterKategori = false;
		}
	}

	// Guide-kategorier
	async function tilfoejGuideKategori() {
		const navn = nyGuideKatNavn.trim();
		if (!navn) return;
		opretterKategori = true;
		try {
			await opretGuideKategori(forlobId, navn, naesteOrden(guideKats));
			nyGuideKatNavn = '';
			await indlaes();
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke oprette kategori.';
		} finally {
			opretterKategori = false;
		}
	}

	// Delt: omdøb og slet kategori (skifter helper baseret på aktiv tab)
	function startRedigerKategori(navn: string, id: string) {
		redigererKategoriId = id;
		redigeringNavn = navn;
	}
	function annullerRedigerKategori() {
		redigererKategoriId = null;
		redigeringNavn = '';
	}
	async function gemKategoriNavn() {
		const id = redigererKategoriId;
		const navn = redigeringNavn.trim();
		if (!id || !navn) return;
		try {
			if (aktivTab === 'faq') {
				await opdaterFaqKategori(forlobId, id, { navn });
			} else {
				await opdaterGuideKategori(forlobId, id, { navn });
			}
			redigererKategoriId = null;
			redigeringNavn = '';
			await indlaes();
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke gemme kategori.';
		}
	}
	async function bekraeftSletKategori(id: string) {
		if (bekraeftKategoriId !== id) {
			bekraeftKategoriId = id;
			return;
		}
		try {
			if (aktivTab === 'faq') {
				await sletFaqKategoriMedItems(forlobId, id);
			} else {
				await sletGuideKategoriMedItems(forlobId, id);
			}
			bekraeftKategoriId = null;
			await indlaes();
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke slette kategori.';
		}
	}

	// FAQ-dialog
	function aabnNytFaq(katId: string) {
		faqDialogItemId = null;
		faqDialogKategoriId = katId;
		faqDialogSpoergsmaal = '';
		faqDialogSvar = '';
		faqDialogUdgivet = true;
		faqDialogFejl = null;
		viserFaqDialog = true;
	}
	function aabnRedigerFaq(it: FaqItem) {
		faqDialogItemId = it.id;
		faqDialogKategoriId = it.kategoriId;
		faqDialogSpoergsmaal = it.spoergsmaal;
		faqDialogSvar = it.svar;
		faqDialogUdgivet = it.udgivet;
		faqDialogFejl = null;
		viserFaqDialog = true;
	}
	function lukFaqDialog() {
		viserFaqDialog = false;
		faqDialogItemId = null;
		faqDialogFejl = null;
	}
	async function gemFaq() {
		const sp = faqDialogSpoergsmaal.trim();
		const sv = faqDialogSvar.trim();
		if (!sp) {
			faqDialogFejl = 'Spørgsmålet må ikke være tomt.';
			return;
		}
		if (!sv) {
			faqDialogFejl = 'Svaret må ikke være tomt.';
			return;
		}
		faqDialogGemmer = true;
		faqDialogFejl = null;
		try {
			if (faqDialogItemId) {
				await opdaterFaqItem(forlobId, faqDialogItemId, {
					kategoriId: faqDialogKategoriId,
					spoergsmaal: sp,
					svar: sv,
					udgivet: faqDialogUdgivet
				});
			} else {
				const sibs = faqItems.filter((it) => it.kategoriId === faqDialogKategoriId);
				await opretFaqItem(forlobId, {
					kategoriId: faqDialogKategoriId,
					spoergsmaal: sp,
					svar: sv,
					orden: naesteOrden(sibs),
					udgivet: faqDialogUdgivet
				});
			}
			lukFaqDialog();
			await indlaes();
		} catch (e) {
			console.error(e);
			faqDialogFejl = 'Kunne ikke gemme. Prøv igen.';
		} finally {
			faqDialogGemmer = false;
		}
	}
	async function sletFaqDialogItem() {
		if (!faqDialogItemId) return;
		faqDialogGemmer = true;
		faqDialogFejl = null;
		try {
			await sletFaqItem(forlobId, faqDialogItemId);
			lukFaqDialog();
			await indlaes();
		} catch (e) {
			console.error(e);
			faqDialogFejl = 'Kunne ikke slette.';
		} finally {
			faqDialogGemmer = false;
		}
	}

	// Guide-dialog
	function aabnNytGuide(katId: string) {
		guideDialogItemId = null;
		guideDialogKategoriId = katId;
		guideDialogTitel = '';
		guideDialogBeskrivelse = '';
		guideDialogUrl = '';
		guideDialogType = 'video';
		guideDialogDato = '';
		guideDialogUdgivet = true;
		guideDialogFejl = null;
		viserGuideDialog = true;
	}
	function aabnRedigerGuide(it: GuideItem) {
		guideDialogItemId = it.id;
		guideDialogKategoriId = it.kategoriId;
		guideDialogTitel = it.titel;
		guideDialogBeskrivelse = it.beskrivelse;
		guideDialogUrl = it.url;
		guideDialogType = it.type;
		guideDialogDato = it.dato;
		guideDialogUdgivet = it.udgivet;
		guideDialogFejl = null;
		viserGuideDialog = true;
	}
	function lukGuideDialog() {
		viserGuideDialog = false;
		guideDialogItemId = null;
		guideDialogFejl = null;
	}
	function autoDetektType() {
		guideDialogType = detekterGuideType(guideDialogUrl);
	}
	async function gemGuide() {
		const titel = guideDialogTitel.trim();
		const url = guideDialogUrl.trim();
		if (!titel) {
			guideDialogFejl = 'Titlen må ikke være tom.';
			return;
		}
		if (!url) {
			guideDialogFejl = 'URL må ikke være tom.';
			return;
		}
		guideDialogGemmer = true;
		guideDialogFejl = null;
		try {
			if (guideDialogItemId) {
				await opdaterGuideItem(forlobId, guideDialogItemId, {
					kategoriId: guideDialogKategoriId,
					titel,
					beskrivelse: guideDialogBeskrivelse.trim(),
					url,
					type: guideDialogType,
					dato: guideDialogDato,
					udgivet: guideDialogUdgivet
				});
			} else {
				const sibs = guideItems.filter((it) => it.kategoriId === guideDialogKategoriId);
				await opretGuideItem(forlobId, {
					kategoriId: guideDialogKategoriId,
					titel,
					beskrivelse: guideDialogBeskrivelse.trim(),
					url,
					type: guideDialogType,
					dato: guideDialogDato,
					orden: naesteOrden(sibs),
					udgivet: guideDialogUdgivet
				});
			}
			lukGuideDialog();
			await indlaes();
		} catch (e) {
			console.error(e);
			guideDialogFejl = 'Kunne ikke gemme. Prøv igen.';
		} finally {
			guideDialogGemmer = false;
		}
	}
	async function sletGuideDialogItem() {
		if (!guideDialogItemId) return;
		guideDialogGemmer = true;
		guideDialogFejl = null;
		try {
			await sletGuideItem(forlobId, guideDialogItemId);
			lukGuideDialog();
			await indlaes();
		} catch (e) {
			console.error(e);
			guideDialogFejl = 'Kunne ikke slette.';
		} finally {
			guideDialogGemmer = false;
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin/forlob/{forlobId}">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Forløb</span>
		</a>
		<div class="eyebrow">Admin · Bibliotek</div>
		<h1>Bibliotek</h1>
		<p class="page-sub">
			Opret kategorier og indhold til FAQ og guides for dette forløb.
		</p>
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

	{#if loading}
		<div class="status-besked">Henter...</div>
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if aktivTab === 'faq'}
		<div class="form-card">
			<div class="form-titel">Ny kategori</div>
			<div class="ny-kat-rad">
				<input
					type="text"
					placeholder="Navn på ny kategori..."
					bind:value={nyFaqKatNavn}
					maxlength="60"
					disabled={opretterKategori}
					onkeydown={(e) => e.key === 'Enter' && tilfoejFaqKategori()}
				/>
				<button
					class="form-knap primary"
					type="button"
					onclick={tilfoejFaqKategori}
					disabled={!nyFaqKatNavn.trim() || opretterKategori}
				>
					+ Tilføj
				</button>
			</div>
		</div>

		{#if sorteredeFaqKats.length === 0}
			<div class="status-besked">
				Ingen kategorier endnu. Opret den første ovenfor.
			</div>
		{:else}
			<div class="kat-liste">
				{#each sorteredeFaqKats as kat (kat.id)}
					{@const t = faqTael(kat.id)}
					<section class="kat-card">
						<header class="kat-head">
							{#if redigererKategoriId === kat.id}
								<input
									type="text"
									class="kat-edit-input"
									bind:value={redigeringNavn}
									maxlength="60"
									onkeydown={(e) => {
										if (e.key === 'Enter') gemKategoriNavn();
										if (e.key === 'Escape') annullerRedigerKategori();
									}}
								/>
								<div class="kat-head-knapper">
									<button class="ikon-knap" type="button" title="Gem" onclick={gemKategoriNavn} aria-label="Gem">
										<Icon name="check" size={14} color="var(--sage)" />
									</button>
									<button class="ikon-knap" type="button" title="Annuller" onclick={annullerRedigerKategori} aria-label="Annuller">✕</button>
								</div>
							{:else}
								<h2 class="kat-navn">{kat.navn}</h2>
								<span class="kat-tael">{t.udgivet}/{t.total}</span>
								<div class="kat-head-knapper">
									<button class="ikon-knap" type="button" title="Omdøb" onclick={() => startRedigerKategori(kat.navn, kat.id)} aria-label="Omdøb">✎</button>
									<button
										class="ikon-knap fare"
										type="button"
										title={bekraeftKategoriId === kat.id ? 'Klik igen for at bekræfte' : 'Slet kategori'}
										onclick={() => bekraeftSletKategori(kat.id)}
										aria-label="Slet"
									>
										{bekraeftKategoriId === kat.id ? '!' : '×'}
									</button>
								</div>
							{/if}
						</header>

						{#if faqForKategori(kat.id).length > 0}
							<div class="item-liste">
								{#each faqForKategori(kat.id) as it (it.id)}
									<button class="item-row" type="button" onclick={() => aabnRedigerFaq(it)}>
										<span class="item-q">{it.spoergsmaal}</span>
										{#if !it.udgivet}
											<span class="badge kladde">Kladde</span>
										{:else}
											<span class="badge udgivet">Udgivet</span>
										{/if}
									</button>
								{/each}
							</div>
						{/if}

						<button
							class="form-knap ghost"
							type="button"
							onclick={() => aabnNytFaq(kat.id)}
							style="border-style: dashed;"
						>
							+ Nyt spørgsmål
						</button>
					</section>
				{/each}
			</div>
		{/if}
	{:else}
		<div class="form-card">
			<div class="form-titel">Ny kategori</div>
			<div class="ny-kat-rad">
				<input
					type="text"
					placeholder="Navn på ny kategori (fx Kost, Træning, Søvn)..."
					bind:value={nyGuideKatNavn}
					maxlength="60"
					disabled={opretterKategori}
					onkeydown={(e) => e.key === 'Enter' && tilfoejGuideKategori()}
				/>
				<button
					class="form-knap primary"
					type="button"
					onclick={tilfoejGuideKategori}
					disabled={!nyGuideKatNavn.trim() || opretterKategori}
				>
					+ Tilføj
				</button>
			</div>
		</div>

		{#if sorteredeGuideKats.length === 0}
			<div class="status-besked">
				Ingen kategorier endnu. Opret den første ovenfor.
			</div>
		{:else}
			<div class="kat-liste">
				{#each sorteredeGuideKats as kat (kat.id)}
					{@const t = guideTael(kat.id)}
					<section class="kat-card">
						<header class="kat-head">
							{#if redigererKategoriId === kat.id}
								<input
									type="text"
									class="kat-edit-input"
									bind:value={redigeringNavn}
									maxlength="60"
									onkeydown={(e) => {
										if (e.key === 'Enter') gemKategoriNavn();
										if (e.key === 'Escape') annullerRedigerKategori();
									}}
								/>
								<div class="kat-head-knapper">
									<button class="ikon-knap" type="button" title="Gem" onclick={gemKategoriNavn} aria-label="Gem">
										<Icon name="check" size={14} color="var(--sage)" />
									</button>
									<button class="ikon-knap" type="button" title="Annuller" onclick={annullerRedigerKategori} aria-label="Annuller">✕</button>
								</div>
							{:else}
								<h2 class="kat-navn">{kat.navn}</h2>
								<span class="kat-tael">{t.udgivet}/{t.total}</span>
								<div class="kat-head-knapper">
									<button class="ikon-knap" type="button" title="Omdøb" onclick={() => startRedigerKategori(kat.navn, kat.id)} aria-label="Omdøb">✎</button>
									<button
										class="ikon-knap fare"
										type="button"
										title={bekraeftKategoriId === kat.id ? 'Klik igen for at bekræfte' : 'Slet kategori'}
										onclick={() => bekraeftSletKategori(kat.id)}
										aria-label="Slet"
									>
										{bekraeftKategoriId === kat.id ? '!' : '×'}
									</button>
								</div>
							{/if}
						</header>

						{#if guidesForKategori(kat.id).length > 0}
							<div class="item-liste">
								{#each guidesForKategori(kat.id) as it (it.id)}
									<button class="item-row" type="button" onclick={() => aabnRedigerGuide(it)}>
										<div class="item-info">
											<div class="item-q">{it.titel}</div>
											<div class="item-meta">{GUIDE_TYPE_LABELS[it.type]}{it.dato ? ' · ' + it.dato : ''}</div>
										</div>
										{#if !it.udgivet}
											<span class="badge kladde">Kladde</span>
										{:else}
											<span class="badge udgivet">Udgivet</span>
										{/if}
									</button>
								{/each}
							</div>
						{/if}

						<button
							class="form-knap ghost"
							type="button"
							onclick={() => aabnNytGuide(kat.id)}
							style="border-style: dashed;"
						>
							+ Ny guide
						</button>
					</section>
				{/each}
			</div>
		{/if}
	{/if}
</div>

{#if viserFaqDialog}
	<div
		class="dialog-overlay"
		role="button"
		tabindex="0"
		onclick={lukFaqDialog}
		onkeydown={(e) => e.key === 'Escape' && lukFaqDialog()}
	></div>
	<div class="dialog" role="dialog" aria-modal="true">
		<header class="dialog-head">
			<div class="form-titel">{faqDialogItemId ? 'Rediger spørgsmål' : 'Nyt spørgsmål'}</div>
			<button class="ikon-knap" type="button" onclick={lukFaqDialog} aria-label="Luk">×</button>
		</header>

		<label class="felt">
			<span class="felt-label">Kategori</span>
			<select bind:value={faqDialogKategoriId} disabled={faqDialogGemmer}>
				{#each sorteredeFaqKats as kat (kat.id)}
					<option value={kat.id}>{kat.navn}</option>
				{/each}
			</select>
		</label>

		<label class="felt">
			<span class="felt-label">Spørgsmål</span>
			<input type="text" bind:value={faqDialogSpoergsmaal} maxlength="200" disabled={faqDialogGemmer} />
		</label>

		<label class="felt">
			<span class="felt-label">Svar</span>
			<textarea bind:value={faqDialogSvar} rows="6" disabled={faqDialogGemmer}></textarea>
		</label>

		<label class="checkbox-rad">
			<input type="checkbox" bind:checked={faqDialogUdgivet} disabled={faqDialogGemmer} />
			<span>Udgivet (synligt for klienterne)</span>
		</label>

		{#if faqDialogFejl}
			<div class="fejl-besked">{faqDialogFejl}</div>
		{/if}

		<div class="dialog-knapper">
			{#if faqDialogItemId}
				<button class="form-knap danger" type="button" onclick={sletFaqDialogItem} disabled={faqDialogGemmer}>Slet</button>
			{/if}
			<button class="form-knap primary" type="button" onclick={gemFaq} disabled={faqDialogGemmer}>
				{faqDialogGemmer ? 'Gemmer...' : 'Gem'}
			</button>
		</div>
	</div>
{/if}

{#if viserGuideDialog}
	<div
		class="dialog-overlay"
		role="button"
		tabindex="0"
		onclick={lukGuideDialog}
		onkeydown={(e) => e.key === 'Escape' && lukGuideDialog()}
	></div>
	<div class="dialog" role="dialog" aria-modal="true">
		<header class="dialog-head">
			<div class="form-titel">{guideDialogItemId ? 'Rediger guide' : 'Ny guide'}</div>
			<button class="ikon-knap" type="button" onclick={lukGuideDialog} aria-label="Luk">×</button>
		</header>

		<label class="felt">
			<span class="felt-label">Kategori</span>
			<select bind:value={guideDialogKategoriId} disabled={guideDialogGemmer}>
				{#each sorteredeGuideKats as kat (kat.id)}
					<option value={kat.id}>{kat.navn}</option>
				{/each}
			</select>
		</label>

		<label class="felt">
			<span class="felt-label">URL</span>
			<input
				type="url"
				bind:value={guideDialogUrl}
				placeholder="https://..."
				disabled={guideDialogGemmer}
				onblur={autoDetektType}
			/>
		</label>

		<div class="felt">
			<span class="felt-label">Type</span>
			<div class="type-chips">
				{#each GUIDE_TYPER as t (t)}
					<button
						class="type-chip"
						class:aktiv={guideDialogType === t}
						type="button"
						onclick={() => (guideDialogType = t)}
						disabled={guideDialogGemmer}
					>
						{GUIDE_TYPE_LABELS[t]}
					</button>
				{/each}
			</div>
		</div>

		<label class="felt">
			<span class="felt-label">Titel</span>
			<input type="text" bind:value={guideDialogTitel} maxlength="140" disabled={guideDialogGemmer} />
		</label>

		<label class="felt">
			<span class="felt-label">Beskrivelse (valgfri)</span>
			<textarea bind:value={guideDialogBeskrivelse} rows="3" maxlength="400" disabled={guideDialogGemmer}></textarea>
		</label>

		<label class="felt">
			<span class="felt-label">Dato (valgfri, bruges til sortering)</span>
			<input type="date" bind:value={guideDialogDato} disabled={guideDialogGemmer} />
		</label>

		<label class="checkbox-rad">
			<input type="checkbox" bind:checked={guideDialogUdgivet} disabled={guideDialogGemmer} />
			<span>Udgivet (synligt for klienterne)</span>
		</label>

		{#if guideDialogFejl}
			<div class="fejl-besked">{guideDialogFejl}</div>
		{/if}

		<div class="dialog-knapper">
			{#if guideDialogItemId}
				<button class="form-knap danger" type="button" onclick={sletGuideDialogItem} disabled={guideDialogGemmer}>Slet</button>
			{/if}
			<button class="form-knap primary" type="button" onclick={gemGuide} disabled={guideDialogGemmer}>
				{guideDialogGemmer ? 'Gemmer...' : 'Gem'}
			</button>
		</div>
	</div>
{/if}

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 520px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 18px;
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

	.status-besked {
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text2);
		font-size: 13px;
		text-align: center;
		margin-bottom: 14px;
	}

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.form-card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-bottom: 14px;
	}

	.form-titel {
		font-family: var(--ff-d);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}

	.ny-kat-rad {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 8px;
	}

	.ny-kat-rad input {
		padding: 10px 12px;
		font-size: 14px;
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text);
		outline: none;
		font-family: var(--ff-b);
	}

	.ny-kat-rad input:focus {
		border-color: var(--terra);
	}

	.kat-liste {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.kat-card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 14px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.kat-head {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.kat-navn {
		flex: 1;
		font-family: var(--ff-d);
		font-size: 16px;
		font-weight: 500;
		font-style: italic;
		color: var(--text);
		margin: 0;
	}

	.kat-tael {
		font-size: 11px;
		color: var(--text3);
		padding: 3px 8px;
		background: var(--bg2);
		border: 1px solid var(--border);
		border-radius: 999px;
		font-variant-numeric: tabular-nums;
	}

	.kat-head-knapper {
		display: flex;
		gap: 4px;
	}

	.kat-edit-input {
		flex: 1;
		padding: 8px 10px;
		font-size: 14px;
		border-radius: 8px;
		border: 1px solid var(--terra);
		background: var(--white);
		color: var(--text);
		outline: none;
		font-family: var(--ff-b);
	}

	.ikon-knap {
		width: 30px;
		height: 30px;
		border-radius: 8px;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text2);
		font-size: 14px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--ff-b);
	}

	.ikon-knap:hover {
		background: var(--bg2);
	}

	.ikon-knap.fare:hover {
		background: #fbeeea;
		color: #8a4a3e;
		border-color: #f0d6cf;
	}

	.item-liste {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.item-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		background: var(--bg2);
		border: 1px solid var(--border);
		border-radius: 10px;
		cursor: pointer;
		text-align: left;
		font-family: inherit;
	}

	.item-row:hover {
		border-color: var(--terra);
	}

	.item-q {
		flex: 1;
		font-size: 13px;
		color: var(--text);
		line-height: 1.4;
	}

	.badge {
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 3px 7px;
		border-radius: 999px;
		flex-shrink: 0;
	}

	.badge.udgivet {
		background: var(--sdim);
		color: var(--sage);
		border: 1px solid rgba(111, 158, 126, 0.25);
	}

	.badge.kladde {
		background: var(--bg2);
		color: var(--text3);
		border: 1px solid var(--border);
	}

	.form-knap {
		padding: 12px;
		font-size: 14px;
		font-weight: 600;
		border-radius: 10px;
		border: none;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.form-knap.ghost {
		background: var(--white);
		border: 1px solid var(--border);
		color: var(--text2);
	}

	.form-knap.primary {
		background: var(--terra);
		color: #fff;
	}

	.form-knap.danger {
		background: #b8503f;
		color: #fff;
	}

	.form-knap:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.dialog-overlay {
		position: fixed;
		inset: 0;
		background: rgba(20, 14, 18, 0.45);
		z-index: 50;
		border: none;
	}

	.dialog {
		position: fixed;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		background: var(--white);
		border-radius: 14px;
		padding: 18px;
		width: calc(100% - 36px);
		max-width: 480px;
		max-height: 90vh;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
		z-index: 51;
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
	}

	.dialog-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.felt {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.felt-label {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.felt input,
	.felt select,
	.felt textarea {
		padding: 10px 12px;
		font-size: 14px;
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text);
		outline: none;
		font-family: var(--ff-b);
	}

	.felt textarea {
		resize: vertical;
		min-height: 100px;
		line-height: 1.5;
	}

	.felt input:focus,
	.felt select:focus,
	.felt textarea:focus {
		border-color: var(--terra);
	}

	.checkbox-rad {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--text2);
		cursor: pointer;
	}

	.checkbox-rad input {
		width: 16px;
		height: 16px;
		accent-color: var(--terra);
	}

	.fejl-besked {
		padding: 10px 12px;
		background: #fbeeea;
		border: 1px solid #f0d6cf;
		border-radius: 8px;
		font-size: 12px;
		color: #8a4a3e;
	}

	.dialog-knapper {
		display: grid;
		grid-template-columns: 1fr;
		gap: 8px;
	}

	.dialog-knapper:has(.danger) {
		grid-template-columns: auto 1fr;
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

	.item-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.item-meta {
		font-size: 11px;
		color: var(--text3);
		letter-spacing: 0.04em;
	}

	.type-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.type-chip {
		padding: 8px 14px;
		font-size: 13px;
		font-family: var(--ff-b);
		border-radius: 999px;
		border: 1px solid var(--border2);
		background: var(--bg2);
		color: var(--text2);
		cursor: pointer;
	}

	.type-chip.aktiv {
		background: var(--terra);
		border-color: var(--terra);
		color: #fff;
	}

	.type-chip:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
