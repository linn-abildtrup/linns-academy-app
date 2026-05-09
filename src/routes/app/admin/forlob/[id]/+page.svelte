<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Timestamp } from 'firebase/firestore';
	import type { AllowedEmail, CsvParseResult, Forlob } from '$lib/content/forlobAdgang';
	import { parseSimpleroCsv } from '$lib/content/forlobAdgang';
	import {
		gemAllowedEmailsBatch,
		gemForlob,
		hentAllowedEmailsForForlob,
		hentForlob,
		sletForlob,
		type ImportResultat
	} from '$lib/firestore/forlob';
	import Icon from '$lib/components/Icon.svelte';

	const forlobId = $derived(page.params.id ?? '');

	let forlob = $state<Forlob | null>(null);
	let emails = $state<AllowedEmail[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);

	let formNavn = $state('');
	let formStartDato = $state('');
	let formAntalDage = $state(21);
	let formAktiv = $state(true);
	let gemmer = $state(false);
	let gemFejl = $state<string | null>(null);
	let gemKvit = $state(false);

	let sletter = $state(false);
	let bekraefter = $state(false);

	let csvIndhold = $state('');
	let parsResultat = $state<CsvParseResult | null>(null);
	let importerer = $state(false);
	let importResultat = $state<ImportResultat | null>(null);
	let importFejl = $state<string | null>(null);

	let soegning = $state('');

	const filtreredeEmails = $derived.by<AllowedEmail[]>(() => {
		const q = soegning.trim().toLowerCase();
		if (!q) return emails;
		return emails.filter((e) => {
			return (
				e.email.toLowerCase().includes(q) ||
				(e.firstName ?? '').toLowerCase().includes(q) ||
				(e.lastName ?? '').toLowerCase().includes(q)
			);
		});
	});

	function laesCsvFil(e: Event) {
		const input = e.target as HTMLInputElement;
		const fil = input.files?.[0];
		if (!fil) return;
		const reader = new FileReader();
		reader.onload = () => {
			csvIndhold = String(reader.result ?? '');
			previewCsv();
		};
		reader.onerror = () => {
			importFejl = 'Kunne ikke læse filen.';
		};
		reader.readAsText(fil, 'utf-8');
		input.value = '';
	}

	onMount(async () => {
		await indlaes();
	});

	async function indlaes() {
		loading = true;
		fejl = null;
		try {
			const f = await hentForlob(forlobId);
			if (!f) {
				fejl = 'Forløbet findes ikke.';
				loading = false;
				return;
			}
			forlob = f;
			formNavn = f.navn;
			formStartDato = f.startDato.toDate().toISOString().slice(0, 10);
			formAntalDage = f.antalDage;
			formAktiv = f.aktiv;

			emails = await hentAllowedEmailsForForlob(forlobId);
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente forløbet.';
		} finally {
			loading = false;
		}
	}

	async function gem() {
		gemFejl = null;
		gemKvit = false;
		const trimmedNavn = formNavn.trim();
		if (!trimmedNavn) {
			gemFejl = 'Forløbet skal have et navn.';
			return;
		}
		if (!formStartDato) {
			gemFejl = 'Vælg en startdato.';
			return;
		}
		if (formAntalDage < 1 || formAntalDage > 365) {
			gemFejl = 'Antal dage skal være mellem 1 og 365.';
			return;
		}
		gemmer = true;
		try {
			const startDate = new Date(formStartDato + 'T06:00:00');
			await gemForlob(forlobId, {
				navn: trimmedNavn,
				startDato: Timestamp.fromDate(startDate),
				antalDage: formAntalDage,
				aktiv: formAktiv
			});
			if (forlob) {
				forlob = {
					...forlob,
					navn: trimmedNavn,
					startDato: Timestamp.fromDate(startDate),
					antalDage: formAntalDage,
					aktiv: formAktiv
				};
			}
			gemKvit = true;
			setTimeout(() => (gemKvit = false), 2000);
		} catch (e) {
			console.error(e);
			gemFejl = 'Kunne ikke gemme. Prøv igen.';
		} finally {
			gemmer = false;
		}
	}

	async function slet() {
		if (!bekraefter) {
			bekraefter = true;
			return;
		}
		sletter = true;
		try {
			await sletForlob(forlobId);
			goto('/app/admin/forlob');
		} catch (e) {
			console.error(e);
			gemFejl = 'Kunne ikke slette forløbet.';
			sletter = false;
		}
	}

	function statusLabel(status: AllowedEmail['status']): string {
		return status === 'registered' ? 'Tilmeldt' : 'Inviteret';
	}

	function previewCsv() {
		importResultat = null;
		importFejl = null;
		const r = parseSimpleroCsv(csvIndhold);
		parsResultat = r;
	}

	async function importer() {
		if (!parsResultat || parsResultat.rows.length === 0) return;
		importerer = true;
		importFejl = null;
		try {
			const r = await gemAllowedEmailsBatch(parsResultat.rows, forlobId);
			importResultat = r;
			emails = await hentAllowedEmailsForForlob(forlobId);
			csvIndhold = '';
			parsResultat = null;
		} catch (e) {
			console.error(e);
			importFejl = 'Kunne ikke importere. Prøv igen.';
		} finally {
			importerer = false;
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin/forlob">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Forløb</span>
		</a>
		<div class="eyebrow">Admin · Forløb</div>
		<h1>{forlob?.navn ?? forlobId}</h1>
	</header>

	{#if loading}
		<div class="status-besked">Henter forløb...</div>
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if forlob}
		<div class="form-card">
			<div class="form-titel">Indstillinger</div>
			<label class="felt">
				<span class="felt-label">Navn</span>
				<input type="text" bind:value={formNavn} disabled={gemmer} />
			</label>
			<div class="felt-rad">
				<label class="felt">
					<span class="felt-label">Startdato</span>
					<input type="date" bind:value={formStartDato} disabled={gemmer} />
				</label>
				<label class="felt">
					<span class="felt-label">Antal dage</span>
					<input
						type="number"
						min="1"
						max="365"
						bind:value={formAntalDage}
						disabled={gemmer}
					/>
				</label>
			</div>
			<label class="checkbox-rad">
				<input type="checkbox" bind:checked={formAktiv} disabled={gemmer} />
				<span>Aktivt forløb (nye køb tilknyttes automatisk)</span>
			</label>

			{#if gemFejl}
				<div class="fejl-besked">{gemFejl}</div>
			{/if}
			{#if gemKvit}
				<div class="kvit-besked">Gemt ✓</div>
			{/if}

			<button class="form-knap primary" type="button" onclick={gem} disabled={gemmer}>
				{gemmer ? 'Gemmer...' : 'Gem ændringer'}
			</button>
		</div>

		<a class="indhold-row" href="/app/admin/forlob/{forlobId}/lektioner">
			<div class="indhold-icon" style="background: #9D6358;">
				<Icon name="path" size={16} color="#fff" />
			</div>
			<div class="indhold-tekst">
				<div class="indhold-navn">Lektioner</div>
				<div class="indhold-sub">Læg dagens lektion ind for hver dag i forløbet</div>
			</div>
			<Icon name="chevron-r" size={14} color="var(--text3)" />
		</a>

		<a class="indhold-row" href="/app/admin/forlob/{forlobId}/vaner">
			<div class="indhold-icon">
				<Icon name="leaf" size={16} color="#fff" />
			</div>
			<div class="indhold-tekst">
				<div class="indhold-navn">Vaneprogram</div>
				<div class="indhold-sub">Rediger refleksioner, vaner og bonus pr dag</div>
			</div>
			<Icon name="chevron-r" size={14} color="var(--text3)" />
		</a>

		<a class="indhold-row" href="/app/admin/forlob/{forlobId}/mikrotraening">
			<div class="indhold-icon" style="background: #C9A07A;">
				<Icon name="flame" size={16} color="#fff" />
			</div>
			<div class="indhold-tekst">
				<div class="indhold-navn">Mikrotræning</div>
				<div class="indhold-sub">Byg programmer (varianter) som klienten kan vælge imellem</div>
			</div>
			<Icon name="chevron-r" size={14} color="var(--text3)" />
		</a>

		<a class="indhold-row" href="/app/admin/forlob/{forlobId}/bibliotek">
			<div class="indhold-icon" style="background: var(--terra);">
				<Icon name="book" size={16} color="#fff" />
			</div>
			<div class="indhold-tekst">
				<div class="indhold-navn">Bibliotek</div>
				<div class="indhold-sub">FAQ og links for forløbet</div>
			</div>
			<Icon name="chevron-r" size={14} color="var(--text3)" />
		</a>

		<a class="indhold-row" href="/app/admin/forlob/{forlobId}/beskeder">
			<div class="indhold-icon" style="background: #5C7A8C;">
				<Icon name="mail" size={16} color="#fff" />
			</div>
			<div class="indhold-tekst">
				<div class="indhold-navn">Beskeder</div>
				<div class="indhold-sub">Spørgsmål fra klienter på dette forløb</div>
			</div>
			<Icon name="chevron-r" size={14} color="var(--text3)" />
		</a>

		<div class="form-card">
			<div class="form-titel">Importér emails fra Simplero</div>
			<p class="csv-hint">
				Upload din Simplero-eksport som CSV-fil eller paste indholdet ind. Klienter med
				"Canceled at" udfyldt springes automatisk over.
			</p>

			<label class="csv-fil-knap" class:disabled={importerer}>
				📎 Vælg CSV-fil
				<input
					type="file"
					accept=".csv,text/csv,text/plain"
					onchange={laesCsvFil}
					disabled={importerer}
				/>
			</label>

			<div class="csv-eller">eller indsæt manuelt</div>

			<textarea
				class="csv-textarea"
				placeholder="Paste CSV-indhold her..."
				bind:value={csvIndhold}
				disabled={importerer}
				rows="6"
			></textarea>

			<div class="csv-knapper">
				<button
					class="form-knap ghost"
					type="button"
					onclick={previewCsv}
					disabled={!csvIndhold.trim() || importerer}
				>
					Forhåndsvis
				</button>
				<button
					class="form-knap primary"
					type="button"
					onclick={importer}
					disabled={!parsResultat || parsResultat.rows.length === 0 || importerer}
				>
					{importerer ? 'Importerer...' : 'Importér'}
				</button>
			</div>

			{#if parsResultat}
				{#if parsResultat.fejl}
					<div class="fejl-besked">{parsResultat.fejl}</div>
				{:else}
					<div class="csv-preview">
						<div class="csv-preview-tael">
							<strong>{parsResultat.rows.length}</strong> gyldige emails klar til import
						</div>
						{#if parsResultat.skippedCanceled > 0}
							<div class="csv-preview-info">
								{parsResultat.skippedCanceled} annullerede sprunget over
							</div>
						{/if}
						{#if parsResultat.skippedInvalid > 0}
							<div class="csv-preview-info">
								{parsResultat.skippedInvalid} ugyldige rækker sprunget over
							</div>
						{/if}
					</div>
				{/if}
			{/if}

			{#if importResultat}
				<div class="kvit-besked">
					Import færdig — {importResultat.tilfoejet} tilføjet · {importResultat.opdateret} opdateret
					· {importResultat.uaendret} uændret
					{#if importResultat.fejl > 0}
						· {importResultat.fejl} fejl
					{/if}
				</div>
			{/if}

			{#if importFejl}
				<div class="fejl-besked">{importFejl}</div>
			{/if}
		</div>

		<div class="emails-card">
			<div class="emails-head">
				<div class="form-titel">Tilmeldte emails</div>
				<div class="emails-tael">
					{#if soegning.trim() && filtreredeEmails.length !== emails.length}
						{filtreredeEmails.length} af {emails.length}
					{:else}
						{emails.length}
					{/if}
				</div>
			</div>

			{#if emails.length > 0}
				<div class="soeg-rad">
					<input
						type="search"
						class="soeg-input"
						placeholder="Søg på navn eller email..."
						bind:value={soegning}
					/>
					{#if soegning}
						<button
							class="soeg-ryd"
							type="button"
							onclick={() => (soegning = '')}
							aria-label="Ryd søgning"
						>
							×
						</button>
					{/if}
				</div>
			{/if}

			{#if emails.length === 0}
				<div class="status-besked" style="margin: 0;">
					Ingen emails tilknyttet endnu. Importér en CSV-fil ovenfor for at komme i gang.
				</div>
			{:else if filtreredeEmails.length === 0}
				<div class="status-besked" style="margin: 0;">
					Ingen match for "{soegning}".
				</div>
			{:else}
				<div class="emails-liste">
					{#each filtreredeEmails as e (e.email)}
						<div class="email-row">
							<div class="email-info">
								<div class="email-adresse">{e.email}</div>
								{#if e.firstName || e.lastName}
									<div class="email-navn">{e.firstName} {e.lastName}</div>
								{/if}
							</div>
							<span class="badge {e.status === 'registered' ? 'aktiv' : 'inaktiv'}">
								{statusLabel(e.status)}
							</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<div class="slet-omraade">
			{#if !bekraefter}
				<button class="slet-knap" type="button" onclick={slet}>Slet forløb</button>
			{:else}
				<div class="slet-bekraeft">
					<div class="slet-tekst">
						Slet forløbet permanent? Tilknyttede allowedEmails forbliver i Firestore.
					</div>
					<div class="slet-knapper">
						<button
							class="form-knap ghost"
							type="button"
							onclick={() => (bekraefter = false)}
							disabled={sletter}
						>
							Annuller
						</button>
						<button class="form-knap danger" type="button" onclick={slet} disabled={sletter}>
							{sletter ? 'Sletter...' : 'Ja, slet'}
						</button>
					</div>
				</div>
			{/if}
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
		margin-bottom: 18px;
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

	.back:hover {
		color: var(--text);
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
		margin: 4px 0 0;
		line-height: 1.05;
		color: var(--text);
	}

	.status-besked {
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
		text-align: center;
		margin-bottom: 14px;
	}

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.form-card,
	.emails-card {
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
		font-size: calc(18px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.emails-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.emails-tael {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text3);
		font-variant-numeric: tabular-nums;
	}

	.emails-liste {
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-height: 320px;
		overflow-y: auto;
	}

	.email-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 10px;
		background: var(--bg2);
		border-radius: 8px;
	}

	.email-info {
		flex: 1;
		min-width: 0;
	}

	.email-adresse {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text);
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.email-navn {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 1px;
	}

	.felt {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.felt-label {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.felt input {
		padding: 10px 12px;
		font-size: calc(14px * var(--fs-scale, 1));
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-b);
		outline: none;
	}

	.felt input:focus {
		border-color: var(--terra);
	}

	.felt-rad {
		display: grid;
		grid-template-columns: 2fr 1fr;
		gap: 10px;
	}

	.checkbox-rad {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: calc(13px * var(--fs-scale, 1));
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
		font-size: calc(12px * var(--fs-scale, 1));
		color: #8a4a3e;
	}

	.indhold-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		text-decoration: none;
		color: inherit;
		margin-bottom: 14px;
	}

	.indhold-row:hover {
		background: var(--bg2);
	}

	.indhold-icon {
		width: 36px;
		height: 36px;
		border-radius: 10px;
		background: var(--sage);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.indhold-tekst {
		flex: 1;
		min-width: 0;
	}

	.indhold-navn {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.indhold-sub {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.kvit-besked {
		padding: 8px 12px;
		background: var(--sdim);
		border-radius: 8px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--sage);
		text-align: center;
	}

	.csv-hint {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		line-height: 1.5;
		margin: 0;
	}

	.csv-fil-knap {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 11px 16px;
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 10px;
		border: 1px dashed var(--terra);
		background: var(--tdim);
		color: var(--terra);
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.csv-fil-knap:hover {
		background: var(--white);
	}

	.csv-fil-knap.disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.csv-fil-knap input[type='file'] {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
		font-size: 0;
	}

	.csv-fil-knap.disabled input[type='file'] {
		cursor: not-allowed;
	}

	.csv-eller {
		text-align: center;
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		font-style: italic;
		margin: 2px 0;
	}

	.soeg-rad {
		position: relative;
		display: flex;
		align-items: center;
	}

	.soeg-input {
		flex: 1;
		padding: 10px 36px 10px 12px;
		font-size: calc(13px * var(--fs-scale, 1));
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-b);
		outline: none;
	}

	.soeg-input:focus {
		border-color: var(--terra);
	}

	.soeg-ryd {
		position: absolute;
		right: 6px;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: none;
		background: var(--text3);
		color: #fff;
		font-size: calc(14px * var(--fs-scale, 1));
		line-height: 1;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.csv-textarea {
		font-family: ui-monospace, monospace;
		font-size: calc(11px * var(--fs-scale, 1));
		padding: 10px 12px;
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text);
		outline: none;
		resize: vertical;
		min-height: 100px;
	}

	.csv-textarea:focus {
		border-color: var(--terra);
	}

	.csv-knapper {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.csv-preview {
		padding: 10px 12px;
		background: var(--bg2);
		border-radius: 8px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.csv-preview-tael strong {
		color: var(--terra);
		font-size: calc(14px * var(--fs-scale, 1));
	}

	.csv-preview-info {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.form-knap {
		padding: 12px;
		font-size: calc(14px * var(--fs-scale, 1));
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

	.badge {
		font-size: calc(9.5px * var(--fs-scale, 1));
		letter-spacing: 0.1em;
		text-transform: uppercase;
		padding: 2px 7px;
		border-radius: 99px;
		font-weight: 600;
	}

	.badge.aktiv {
		background: var(--sdim);
		color: var(--sage);
	}

	.badge.inaktiv {
		background: var(--bg2);
		color: var(--text3);
	}

	.slet-omraade {
		margin-top: 24px;
	}

	.slet-knap {
		background: none;
		border: 1px solid #e8c8c1;
		color: #b8503f;
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 500;
		padding: 10px 16px;
		border-radius: 10px;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.slet-knap:hover {
		background: #fbeeea;
	}

	.slet-bekraeft {
		background: #fbeeea;
		border: 1px solid #f0d6cf;
		border-radius: 12px;
		padding: 14px;
	}

	.slet-tekst {
		font-size: calc(13px * var(--fs-scale, 1));
		color: #8a4a3e;
		margin-bottom: 10px;
	}

	.slet-knapper {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
</style>
