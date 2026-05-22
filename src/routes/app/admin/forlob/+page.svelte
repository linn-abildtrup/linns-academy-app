<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Timestamp } from 'firebase/firestore';
	import type { Forlob, ForlobType } from '$lib/content/forlobAdgang';
	import {
		hentAlleForlob,
		kopierForlobIndhold,
		opretForlob
	} from '$lib/firestore/forlob';
	import Icon from '$lib/components/Icon.svelte';

	let forlob = $state<Forlob[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);

	let viserForm = $state(false);
	let formNavn = $state('');
	let formStartDato = $state('');
	let formAntalDage = $state(21);
	let formId = $state('');
	let formAktiv = $state(true);
	let formType = $state<ForlobType>('kickstart');
	let formKopierFra = $state<string>('');
	let opretterFejl = $state<string | null>(null);
	let opretter = $state(false);

	onMount(async () => {
		try {
			forlob = await hentAlleForlob();
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente forløb.';
		} finally {
			loading = false;
		}
	});

	function genererId(navn: string): string {
		return navn
			.toLowerCase()
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.replace(/æ/g, 'ae')
			.replace(/ø/g, 'oe')
			.replace(/å/g, 'aa')
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_|_$/g, '');
	}


	function visForm() {
		viserForm = true;
		formNavn = '';
		formStartDato = '';
		formAntalDage = 21;
		formId = '';
		formAktiv = true;
		formType = 'kickstart';
		formKopierFra = '';
		opretterFejl = null;
	}

	function opdaterIdFraNavn() {
		if (!formId || formId === genererId(formNavn.slice(0, formNavn.length - 1))) {
			formId = genererId(formNavn);
		}
	}

	async function opret() {
		opretterFejl = null;
		const trimmedNavn = formNavn.trim();
		if (!trimmedNavn) {
			opretterFejl = 'Forløbet skal have et navn.';
			return;
		}
		if (!formStartDato) {
			opretterFejl = 'Vælg en startdato.';
			return;
		}
		if (formAntalDage < 1 || formAntalDage > 365) {
			opretterFejl = 'Antal dage skal være mellem 1 og 365.';
			return;
		}
		const id = formId.trim() || genererId(trimmedNavn);
		if (!id) {
			opretterFejl = 'Kunne ikke generere et gyldigt id fra navnet.';
			return;
		}

		opretter = true;
		try {
			const startDate = new Date(formStartDato + 'T06:00:00');
			await opretForlob(id, {
				navn: trimmedNavn,
				startDato: Timestamp.fromDate(startDate),
				antalDage: formAntalDage,
				vaneProgramId: null,
				aktiv: formAktiv,
				type: formType
			});

			if (formKopierFra) {
				try {
					await kopierForlobIndhold(formKopierFra, id);
				} catch (e) {
					console.error('Kopi fejlede:', e);
					opretterFejl =
						'Forløbet er oprettet, men kopiering af indhold fejlede. Du kan kopiere manuelt fra forløb-siden.';
					opretter = false;
					forlob = await hentAlleForlob();
					return;
				}
			}

			goto(`/app/admin/forlob/${id}`);
		} catch (e) {
			console.error(e);
			opretterFejl = e instanceof Error ? e.message : 'Kunne ikke oprette forløbet.';
			opretter = false;
		}
	}

	function formatDato(t: { toDate: () => Date } | undefined): string {
		if (!t || typeof t.toDate !== 'function') return '—';
		const d = t.toDate();
		return `${d.getDate()}/${d.getMonth() + 1}-${d.getFullYear()}`;
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Admin</span>
		</a>
		<div class="eyebrow">Admin · Forløb</div>
		<h1>Forløb</h1>
		<p class="page-sub">
			Opret en ny runde af et produkt med fælles startdato og email-whitelist fra Simplero.
		</p>
	</header>

	{#if !viserForm}
		<button class="opret-knap" type="button" onclick={visForm}>
			<Icon name="plus" size={14} color="#fff" />
			Opret nyt forløb
		</button>
	{:else}
		<div class="form-card">
			<div class="form-titel">Nyt forløb</div>
			<label class="felt">
				<span class="felt-label">Navn</span>
				<input
					type="text"
					placeholder="fx Kickstart maj 2026"
					bind:value={formNavn}
					oninput={opdaterIdFraNavn}
					disabled={opretter}
				/>
			</label>
			<label class="felt">
				<span class="felt-label">ID (bruges i URL)</span>
				<input
					type="text"
					placeholder="kickstart_maj_2026"
					bind:value={formId}
					disabled={opretter}
				/>
				<span class="felt-hint">Auto-genereret fra navnet — kan tilrettes.</span>
			</label>
			<div class="felt-rad">
				<label class="felt">
					<span class="felt-label">Startdato</span>
					<input type="date" bind:value={formStartDato} disabled={opretter} />
				</label>
				<label class="felt">
					<span class="felt-label">Antal dage</span>
					<input
						type="number"
						min="1"
						max="365"
						bind:value={formAntalDage}
						disabled={opretter}
					/>
				</label>
			</div>
			<label class="checkbox-rad">
				<input type="checkbox" bind:checked={formAktiv} disabled={opretter} />
				<span>Aktivt forløb (nye køb tilknyttes automatisk)</span>
			</label>

			<div class="felt">
				<span class="felt-label">Forløbs-type</span>
				<div class="type-toggle">
					<button
						type="button"
						class="type-knap"
						class:aktiv={formType === 'kickstart'}
						onclick={() => (formType = 'kickstart')}
						disabled={opretter}
					>
						<div class="type-titel">Kickstart</div>
						<div class="type-sub">21 dage · basis-niveau</div>
					</button>
					<button
						type="button"
						class="type-knap"
						class:aktiv={formType === 'kropsro'}
						onclick={() => (formType = 'kropsro')}
						disabled={opretter}
					>
						<div class="type-titel">Kropsro</div>
						<div class="type-sub">12 uger · med buddymakker</div>
					</button>
				</div>
			</div>

			<label class="felt">
				<span class="felt-label">Indhold</span>
				<select class="select" bind:value={formKopierFra} disabled={opretter}>
					<option value="">Tomt forløb (ingen vaneprogram)</option>
					{#each forlob as f (f.id)}
						<option value={f.id}>Kopier alt fra: {f.navn}</option>
					{/each}
				</select>
				<span class="felt-hint">
					{formKopierFra
						? 'Vaneprogrammet kopieres ind. Du kan rette det bagefter uden at påvirke det oprindelige forløb.'
						: 'Du kan altid kopiere fra et andet forløb senere.'}
				</span>
			</label>

			{#if opretterFejl}
				<div class="fejl-besked">{opretterFejl}</div>
			{/if}

			<div class="form-knapper">
				<button
					class="form-knap ghost"
					type="button"
					onclick={() => (viserForm = false)}
					disabled={opretter}
				>
					Annuller
				</button>
				<button class="form-knap primary" type="button" onclick={opret} disabled={opretter}>
					{opretter ? 'Opretter...' : 'Opret forløb'}
				</button>
			</div>
		</div>
	{/if}

	<div style="margin-top: 18px;">
		{#if loading}
			<div class="status-besked">Henter forløb...</div>
		{:else if fejl}
			<div class="status-besked fejl">{fejl}</div>
		{:else if forlob.length === 0}
			<div class="status-besked">Ingen forløb endnu — opret det første ovenfor.</div>
		{:else}
			<div class="forlob-liste">
				{#each forlob as f (f.id)}
					<a class="forlob-row" href="/app/admin/forlob/{f.id}">
						<div class="forlob-icon" class:inaktiv={!f.aktiv}>
							<Icon name="cal" size={16} color="#fff" />
						</div>
						<div class="forlob-tekst">
							<div class="forlob-navn">
								{f.navn}
								{#if f.aktiv}
									<span class="badge aktiv">Aktiv</span>
								{:else}
									<span class="badge inaktiv">Inaktiv</span>
								{/if}
							</div>
							<div class="forlob-sub">
								Start {formatDato(f.startDato)} · {f.antalDage} dage
							</div>
						</div>
						<Icon name="chevron-r" size={14} color="var(--text3)" />
					</a>
				{/each}
			</div>
		{/if}
	</div>
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
		font-size: calc(28px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 4px 0 0;
		line-height: 1.05;
		color: var(--text);
	}

	.page-sub {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		margin: 6px 0 0;
		line-height: 1.4;
	}

	.opret-knap {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 14px;
		background: var(--terra);
		color: #fff;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 12px;
		border: none;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.opret-knap:hover {
		filter: brightness(0.95);
	}

	.form-card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.form-titel {
		font-family: var(--ff-d);
		font-size: calc(18px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
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

	.select {
		padding: 10px 12px;
		font-size: calc(14px * var(--fs-scale, 1));
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-b);
		outline: none;
		cursor: pointer;
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236b4e42' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 14px center;
		padding-right: 32px;
	}

	.select:focus {
		border-color: var(--terra);
	}

	.felt-hint {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text4);
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

	.type-toggle {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		margin-top: 6px;
	}

	.type-knap {
		padding: 12px 14px;
		background: var(--white);
		border: 1.5px solid var(--border);
		border-radius: 10px;
		cursor: pointer;
		text-align: left;
		font-family: var(--ff-b);
		color: inherit;
	}

	.type-knap:hover {
		border-color: var(--terra);
	}

	.type-knap.aktiv {
		border-color: var(--terra);
		background: var(--tdim);
	}

	.type-knap:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.type-titel {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.type-knap.aktiv .type-titel {
		color: var(--terra);
	}

	.type-sub {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.fejl-besked {
		padding: 10px 12px;
		background: #fbeeea;
		border: 1px solid #f0d6cf;
		border-radius: 8px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: #8a4a3e;
	}

	.form-knapper {
		display: grid;
		grid-template-columns: 1fr 1.4fr;
		gap: 10px;
		margin-top: 4px;
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

	.form-knap:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.status-besked {
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
		text-align: center;
	}

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.forlob-liste {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		overflow: hidden;
	}

	.forlob-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 14px;
		border-top: 1px solid var(--border);
		text-decoration: none;
		color: inherit;
	}

	.forlob-row:first-child {
		border-top: none;
	}

	.forlob-row:hover {
		background: var(--bg2);
	}

	.forlob-icon {
		width: 40px;
		height: 40px;
		border-radius: 11px;
		background: var(--terra);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.forlob-icon.inaktiv {
		background: var(--text3);
	}

	.forlob-tekst {
		flex: 1;
		min-width: 0;
	}

	.forlob-navn {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.forlob-sub {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
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
</style>
