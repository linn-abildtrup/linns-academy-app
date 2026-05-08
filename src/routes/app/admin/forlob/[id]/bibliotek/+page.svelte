<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import type { FaqKategori, FaqItem } from '$lib/content/bibliotek';
	import {
		grupperEfterKategori,
		naesteOrden,
		sorterItems,
		sorterKategorier
	} from '$lib/content/bibliotek';
	import {
		hentFaqKategorier,
		hentFaqItems,
		opdaterFaqItem,
		opdaterFaqKategori,
		opretFaqItem,
		opretFaqKategori,
		sletFaqItem,
		sletFaqKategoriMedItems
	} from '$lib/firestore/bibliotek';
	import Icon from '$lib/components/Icon.svelte';

	const forlobId = $derived(page.params.id ?? '');

	let kategorier = $state<FaqKategori[]>([]);
	let items = $state<FaqItem[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);

	let nyKategoriNavn = $state('');
	let opretterKategori = $state(false);

	let redigererKategoriId = $state<string | null>(null);
	let redigeringNavn = $state('');

	let viserItemDialog = $state(false);
	let dialogItemId = $state<string | null>(null);
	let dialogKategoriId = $state<string>('');
	let dialogSpoergsmaal = $state('');
	let dialogSvar = $state('');
	let dialogUdgivet = $state(true);
	let dialogGemmer = $state(false);
	let dialogFejl = $state<string | null>(null);

	let bekraeftKategoriId = $state<string | null>(null);

	const sorteredeKategorier = $derived(sorterKategorier(kategorier));
	const itemsPrKategori = $derived(grupperEfterKategori(items));

	function tael(kategoriId: string): { total: number; udgivet: number } {
		const liste = itemsPrKategori[kategoriId] ?? [];
		return {
			total: liste.length,
			udgivet: liste.filter((it) => it.udgivet).length
		};
	}

	function itemsForKategori(kategoriId: string): FaqItem[] {
		return sorterItems(itemsPrKategori[kategoriId] ?? []);
	}

	onMount(async () => {
		await indlaes();
	});

	async function indlaes() {
		loading = true;
		fejl = null;
		try {
			const [kats, its] = await Promise.all([
				hentFaqKategorier(forlobId),
				hentFaqItems(forlobId)
			]);
			kategorier = kats;
			items = its;
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente bibliotek.';
		} finally {
			loading = false;
		}
	}

	async function tilfoejKategori() {
		const navn = nyKategoriNavn.trim();
		if (!navn) return;
		opretterKategori = true;
		try {
			const orden = naesteOrden(kategorier);
			await opretFaqKategori(forlobId, navn, orden);
			nyKategoriNavn = '';
			await indlaes();
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke oprette kategori.';
		} finally {
			opretterKategori = false;
		}
	}

	function startRedigerKategori(kat: FaqKategori) {
		redigererKategoriId = kat.id;
		redigeringNavn = kat.navn;
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
			await opdaterFaqKategori(forlobId, id, { navn });
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
			await sletFaqKategoriMedItems(forlobId, id);
			bekraeftKategoriId = null;
			await indlaes();
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke slette kategori.';
		}
	}

	function aabnNytItem(kategoriId: string) {
		dialogItemId = null;
		dialogKategoriId = kategoriId;
		dialogSpoergsmaal = '';
		dialogSvar = '';
		dialogUdgivet = true;
		dialogFejl = null;
		viserItemDialog = true;
	}

	function aabnRedigerItem(it: FaqItem) {
		dialogItemId = it.id;
		dialogKategoriId = it.kategoriId;
		dialogSpoergsmaal = it.spoergsmaal;
		dialogSvar = it.svar;
		dialogUdgivet = it.udgivet;
		dialogFejl = null;
		viserItemDialog = true;
	}

	function lukDialog() {
		viserItemDialog = false;
		dialogItemId = null;
		dialogFejl = null;
	}

	async function gemItem() {
		const spoergsmaal = dialogSpoergsmaal.trim();
		const svar = dialogSvar.trim();
		if (!spoergsmaal) {
			dialogFejl = 'Spørgsmålet må ikke være tomt.';
			return;
		}
		if (!svar) {
			dialogFejl = 'Svaret må ikke være tomt.';
			return;
		}
		dialogGemmer = true;
		dialogFejl = null;
		try {
			if (dialogItemId) {
				await opdaterFaqItem(forlobId, dialogItemId, {
					kategoriId: dialogKategoriId,
					spoergsmaal,
					svar,
					udgivet: dialogUdgivet
				});
			} else {
				const sibs = items.filter((it) => it.kategoriId === dialogKategoriId);
				await opretFaqItem(forlobId, {
					kategoriId: dialogKategoriId,
					spoergsmaal,
					svar,
					orden: naesteOrden(sibs),
					udgivet: dialogUdgivet
				});
			}
			lukDialog();
			await indlaes();
		} catch (e) {
			console.error(e);
			dialogFejl = 'Kunne ikke gemme. Prøv igen.';
		} finally {
			dialogGemmer = false;
		}
	}

	async function sletItem() {
		if (!dialogItemId) return;
		dialogGemmer = true;
		dialogFejl = null;
		try {
			await sletFaqItem(forlobId, dialogItemId);
			lukDialog();
			await indlaes();
		} catch (e) {
			console.error(e);
			dialogFejl = 'Kunne ikke slette.';
		} finally {
			dialogGemmer = false;
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
		<h1>FAQ</h1>
		<p class="page-sub">
			Opret kategorier og læg svar ind på ofte stillede spørgsmål, som klienterne kan se.
		</p>
	</header>

	{#if loading}
		<div class="status-besked">Henter...</div>
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else}
		<div class="form-card">
			<div class="form-titel">Ny kategori</div>
			<div class="ny-kat-rad">
				<input
					type="text"
					placeholder="Navn på ny kategori..."
					bind:value={nyKategoriNavn}
					maxlength="60"
					disabled={opretterKategori}
					onkeydown={(e) => e.key === 'Enter' && tilfoejKategori()}
				/>
				<button
					class="form-knap primary"
					type="button"
					onclick={tilfoejKategori}
					disabled={!nyKategoriNavn.trim() || opretterKategori}
				>
					+ Tilføj
				</button>
			</div>
		</div>

		{#if sorteredeKategorier.length === 0}
			<div class="status-besked">
				Ingen kategorier endnu. Opret den første ovenfor.
			</div>
		{:else}
			<div class="kat-liste">
				{#each sorteredeKategorier as kat (kat.id)}
					{@const t = tael(kat.id)}
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
									<button
										class="ikon-knap"
										type="button"
										title="Gem"
										onclick={gemKategoriNavn}
										aria-label="Gem"
									>
										<Icon name="check" size={14} color="var(--sage)" />
									</button>
									<button
										class="ikon-knap"
										type="button"
										title="Annuller"
										onclick={annullerRedigerKategori}
										aria-label="Annuller"
									>
										✕
									</button>
								</div>
							{:else}
								<h2 class="kat-navn">{kat.navn}</h2>
								<span class="kat-tael">
									{t.udgivet}/{t.total}
								</span>
								<div class="kat-head-knapper">
									<button
										class="ikon-knap"
										type="button"
										title="Omdøb"
										onclick={() => startRedigerKategori(kat)}
										aria-label="Omdøb"
									>
										✎
									</button>
									<button
										class="ikon-knap fare"
										type="button"
										title={bekraeftKategoriId === kat.id
											? 'Klik igen for at bekræfte'
											: 'Slet kategori'}
										onclick={() => bekraeftSletKategori(kat.id)}
										aria-label="Slet"
									>
										{bekraeftKategoriId === kat.id ? '!' : '×'}
									</button>
								</div>
							{/if}
						</header>

						{#if itemsForKategori(kat.id).length > 0}
							<div class="item-liste">
								{#each itemsForKategori(kat.id) as it (it.id)}
									<button
										class="item-row"
										type="button"
										onclick={() => aabnRedigerItem(it)}
									>
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
							onclick={() => aabnNytItem(kat.id)}
							style="border-style: dashed;"
						>
							+ Nyt spørgsmål
						</button>
					</section>
				{/each}
			</div>
		{/if}
	{/if}
</div>

{#if viserItemDialog}
	<div
		class="dialog-overlay"
		role="button"
		tabindex="0"
		onclick={lukDialog}
		onkeydown={(e) => e.key === 'Escape' && lukDialog()}
	></div>
	<div class="dialog" role="dialog" aria-modal="true">
		<header class="dialog-head">
			<div class="form-titel">{dialogItemId ? 'Rediger spørgsmål' : 'Nyt spørgsmål'}</div>
			<button class="ikon-knap" type="button" onclick={lukDialog} aria-label="Luk">×</button>
		</header>

		<label class="felt">
			<span class="felt-label">Kategori</span>
			<select bind:value={dialogKategoriId} disabled={dialogGemmer}>
				{#each sorteredeKategorier as kat (kat.id)}
					<option value={kat.id}>{kat.navn}</option>
				{/each}
			</select>
		</label>

		<label class="felt">
			<span class="felt-label">Spørgsmål</span>
			<input
				type="text"
				bind:value={dialogSpoergsmaal}
				maxlength="200"
				disabled={dialogGemmer}
			/>
		</label>

		<label class="felt">
			<span class="felt-label">Svar</span>
			<textarea bind:value={dialogSvar} rows="6" disabled={dialogGemmer}></textarea>
		</label>

		<label class="checkbox-rad">
			<input type="checkbox" bind:checked={dialogUdgivet} disabled={dialogGemmer} />
			<span>Udgivet (synligt for klienterne)</span>
		</label>

		{#if dialogFejl}
			<div class="fejl-besked">{dialogFejl}</div>
		{/if}

		<div class="dialog-knapper">
			{#if dialogItemId}
				<button
					class="form-knap danger"
					type="button"
					onclick={sletItem}
					disabled={dialogGemmer}
				>
					Slet
				</button>
			{/if}
			<button
				class="form-knap primary"
				type="button"
				onclick={gemItem}
				disabled={dialogGemmer}
			>
				{dialogGemmer ? 'Gemmer...' : 'Gem'}
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
</style>
