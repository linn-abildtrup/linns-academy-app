<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import type { Niveau, TrainingProgram, Udstyr } from '$lib/content/mikrotraening';
	import { tommeDageSkelet } from '$lib/content/mikrotraening';
	import {
		gemForlobsProgram,
		gemForlobsDage,
		hentForlobsProgrammer,
		sletForlobsProgram
	} from '$lib/firestore/mikrotraening';
	import { hentForlob } from '$lib/firestore/forlob';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import Icon from '$lib/components/Icon.svelte';

	const UDSTYR: { id: Udstyr; label: string }[] = [
		{ id: 'ingen', label: 'Intet' },
		{ id: 'kettlebell', label: 'Kettlebell' },
		{ id: 'elastik', label: 'Elastik' },
		{ id: 'haandvaegte', label: 'Håndvægte' },
		{ id: 'forhojning', label: 'Forhøjning' }
	];

	const NIVEAUER: { id: Niveau; label: string }[] = [
		{ id: 'begynder', label: 'Begynder' },
		{ id: 'let_oevet', label: 'Let øvet' },
		{ id: 'oevet', label: 'Øvet' }
	];

	const forlobId = $derived(page.params.id ?? '');

	let forlob = $state<Forlob | null>(null);
	let programmer = $state<TrainingProgram[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);

	let viserDialog = $state(false);
	let dlgId = $state('');
	let dlgNavn = $state('');
	let dlgBeskrivelse = $state('');
	let dlgAntalDage = $state(21);
	let dlgUdstyr = $state<Udstyr[]>(['ingen']);
	let dlgNiveau = $state<Niveau>('begynder');
	let dlgGemmer = $state(false);
	let dlgFejl = $state<string | null>(null);

	onMount(async () => {
		await indlaes();
	});

	async function indlaes() {
		loading = true;
		fejl = null;
		try {
			const [f, progs] = await Promise.all([
				hentForlob(forlobId),
				hentForlobsProgrammer(forlobId)
			]);
			forlob = f;
			programmer = progs;
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente programmer.';
		} finally {
			loading = false;
		}
	}

	function aabnDialog() {
		dlgId = '';
		dlgNavn = '';
		dlgBeskrivelse = '';
		dlgAntalDage = forlob?.antalDage ?? 21;
		dlgUdstyr = ['ingen'];
		dlgNiveau = 'begynder';
		dlgFejl = null;
		viserDialog = true;
	}

	function lukDialog() {
		viserDialog = false;
	}

	function toggleUdstyr(u: Udstyr) {
		dlgUdstyr = dlgUdstyr.includes(u)
			? dlgUdstyr.filter((x) => x !== u)
			: [...dlgUdstyr, u];
	}

	async function opret() {
		const id = dlgId.trim();
		const navn = dlgNavn.trim();
		if (!id || !/^[a-z0-9_]+$/.test(id)) {
			dlgFejl = 'ID skal være snake_case (kun små bogstaver, tal og _).';
			return;
		}
		if (!navn) {
			dlgFejl = 'Navnet må ikke være tomt.';
			return;
		}
		if (dlgUdstyr.length === 0) {
			dlgFejl = 'Vælg mindst ét udstyr.';
			return;
		}
		if (programmer.some((p) => p.id === id)) {
			dlgFejl = 'Et program med dette ID findes allerede.';
			return;
		}
		dlgGemmer = true;
		dlgFejl = null;
		try {
			await gemForlobsProgram(forlobId, id, {
				navn,
				beskrivelse: dlgBeskrivelse.trim(),
				treaningsform: 'mikrotraening',
				antalDage: dlgAntalDage,
				dagligTid: 180,
				niveau: dlgNiveau,
				udstyr: dlgUdstyr,
				aktiv: true
			});
			// Initialiser tomme dage så Linn kan begynde at fylde dem
			await gemForlobsDage(forlobId, id, tommeDageSkelet(dlgAntalDage));
			lukDialog();
			await indlaes();
		} catch (e) {
			console.error(e);
			dlgFejl = 'Kunne ikke oprette programmet.';
		} finally {
			dlgGemmer = false;
		}
	}

	async function bekraeftSlet(p: TrainingProgram) {
		if (!confirm(`Slet '${p.navn}' og alle dets dage permanent?`)) return;
		try {
			await sletForlobsProgram(forlobId, p.id);
			await indlaes();
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke slette programmet.';
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin/forlob/{forlobId}">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Forløb</span>
		</a>
		<div class="eyebrow">Admin · Mikrotræning</div>
		<h1>Mikrotræningsprogrammer</h1>
		<p class="page-sub">
			Programmer specifikke for {forlob?.navn ?? 'dette forløb'}. Klienten vælger imellem dem ved
			onboarding.
		</p>
	</header>

	<button class="primary-knap full" type="button" onclick={aabnDialog}>+ Nyt program</button>

	{#if loading}
		<div class="status-besked">Henter programmer...</div>
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if programmer.length === 0}
		<div class="status-besked">
			Ingen programmer endnu. Opret det første ovenfor.
		</div>
	{:else}
		<div class="program-liste">
			{#each programmer as p (p.id)}
				<div class="program-row">
					<a class="program-info" href="/app/admin/forlob/{forlobId}/mikrotraening/{p.id}">
						<div class="program-icon">
							<Icon name="flame" size={16} color="#fff" />
						</div>
						<div class="program-tekst">
							<div class="program-navn">
								{p.navn}
								{#if !p.aktiv}
									<span class="badge inaktiv">Inaktiv</span>
								{/if}
							</div>
							<div class="program-sub">
								{p.antalDage} dage · {p.udstyr.join(', ')}
							</div>
						</div>
						<Icon name="chevron-r" size={14} color="var(--text3)" />
					</a>
					<button
						class="slet-mini"
						type="button"
						onclick={() => bekraeftSlet(p)}
						aria-label="Slet program"
						title="Slet program"
					>
						×
					</button>
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if viserDialog}
	<div
		class="dialog-overlay"
		role="button"
		tabindex="0"
		onclick={lukDialog}
		onkeydown={(e) => e.key === 'Escape' && lukDialog()}
	></div>
	<div class="dialog" role="dialog" aria-modal="true">
		<header class="dialog-head">
			<div class="form-titel">Nyt mikrotræningsprogram</div>
			<button class="ikon-knap" type="button" onclick={lukDialog} aria-label="Luk">×</button>
		</header>

		<label class="felt">
			<span class="felt-label">ID (snake_case)</span>
			<input
				type="text"
				bind:value={dlgId}
				placeholder="fx mikrotraening_kettlebell"
				disabled={dlgGemmer}
			/>
		</label>

		<label class="felt">
			<span class="felt-label">Navn</span>
			<input
				type="text"
				bind:value={dlgNavn}
				placeholder="Mikrotræning med kettlebell"
				disabled={dlgGemmer}
			/>
		</label>

		<label class="felt">
			<span class="felt-label">Beskrivelse</span>
			<textarea bind:value={dlgBeskrivelse} rows="2" disabled={dlgGemmer}></textarea>
		</label>

		<label class="felt">
			<span class="felt-label">Antal dage</span>
			<input
				type="number"
				min="1"
				max="365"
				bind:value={dlgAntalDage}
				disabled={dlgGemmer}
			/>
		</label>

		<div class="felt">
			<span class="felt-label">Udstyr</span>
			<div class="chip-row">
				{#each UDSTYR as u (u.id)}
					<button
						class="chip"
						class:aktiv={dlgUdstyr.includes(u.id)}
						type="button"
						onclick={() => toggleUdstyr(u.id)}
						disabled={dlgGemmer}
					>
						{u.label}
					</button>
				{/each}
			</div>
		</div>

		<div class="felt">
			<span class="felt-label">Niveau</span>
			<div class="chip-row">
				{#each NIVEAUER as n (n.id)}
					<button
						class="chip"
						class:aktiv={dlgNiveau === n.id}
						type="button"
						onclick={() => (dlgNiveau = n.id)}
						disabled={dlgGemmer}
					>
						{n.label}
					</button>
				{/each}
			</div>
		</div>

		{#if dlgFejl}
			<div class="fejl-besked">{dlgFejl}</div>
		{/if}

		<div class="dialog-knapper">
			<button class="form-knap primary" type="button" onclick={opret} disabled={dlgGemmer}>
				{dlgGemmer ? 'Opretter...' : 'Opret'}
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

	.primary-knap.full {
		display: block;
		width: 100%;
		padding: 12px;
		font-size: 14px;
		font-weight: 600;
		border-radius: 10px;
		border: 1px dashed var(--terra);
		background: var(--tdim);
		color: var(--terra);
		cursor: pointer;
		font-family: var(--ff-b);
		margin-bottom: 14px;
	}

	.primary-knap.full:hover {
		background: var(--white);
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

	.program-liste {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.program-row {
		display: flex;
		align-items: stretch;
		gap: 8px;
	}

	.program-info {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		text-decoration: none;
		color: inherit;
	}

	.program-info:hover {
		background: var(--bg2);
	}

	.program-icon {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		background: #c9a07a;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.program-tekst {
		flex: 1;
		min-width: 0;
	}

	.program-navn {
		font-size: 14px;
		font-weight: 600;
		color: var(--text);
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.program-sub {
		font-size: 11.5px;
		color: var(--text3);
		margin-top: 2px;
	}

	.slet-mini {
		width: 32px;
		flex-shrink: 0;
		border: 1px solid #e8c8c1;
		background: var(--white);
		color: #b8503f;
		border-radius: 12px;
		font-size: 18px;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.slet-mini:hover {
		background: #fbeeea;
	}

	.badge {
		font-size: 9.5px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		padding: 2px 7px;
		border-radius: 99px;
		font-weight: 600;
	}

	.badge.inaktiv {
		background: var(--bg2);
		color: var(--text3);
	}

	.dialog-overlay {
		position: fixed;
		inset: 0;
		background: rgba(20, 14, 18, 0.7);
		z-index: 60;
		border: none;
	}

	.dialog {
		position: fixed;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		background: var(--white);
		border-radius: 16px;
		width: calc(100% - 24px);
		max-width: 520px;
		max-height: 92vh;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 18px;
		z-index: 61;
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
	}

	.dialog-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.form-titel {
		font-family: var(--ff-d);
		font-size: 18px;
		font-weight: 600;
		color: var(--text);
	}

	.ikon-knap {
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
	.felt textarea {
		padding: 10px 12px;
		font-size: 14px;
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-b);
		outline: none;
	}

	.felt textarea {
		resize: vertical;
		line-height: 1.5;
	}

	.felt input:focus,
	.felt textarea:focus {
		border-color: var(--terra);
	}

	.chip-row {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.chip {
		padding: 7px 12px;
		font-size: 12px;
		font-weight: 500;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text2);
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.chip.aktiv {
		background: var(--terra);
		color: #fff;
		border-color: var(--terra);
	}

	.chip:disabled {
		opacity: 0.6;
		cursor: not-allowed;
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
		display: flex;
		gap: 10px;
		justify-content: flex-end;
	}

	.form-knap {
		padding: 11px 18px;
		font-size: 14px;
		font-weight: 600;
		border-radius: 10px;
		border: none;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.form-knap.primary {
		background: var(--terra);
		color: #fff;
	}

	.form-knap:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
