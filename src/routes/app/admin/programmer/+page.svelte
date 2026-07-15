<script lang="ts">
	import { onMount } from 'svelte';
	import type { Niveau, TrainingProgram, Udstyr } from '$lib/content/mikrotraening';
	import { tommeDageSkelet } from '$lib/content/mikrotraening';
	import {
		gemMasterProgram,
		gemMasterDage,
		hentAlleMasterProgrammer,
		sletMasterProgram
	} from '$lib/firestore/mikrotraening';
	import Icon from '$lib/components/Icon.svelte';
	import BekraeftModal from '$lib/components/BekraeftModal.svelte';

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

	let programmer = $state<TrainingProgram[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);

	// Opret-dialog state
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
			programmer = await hentAlleMasterProgrammer();
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
		dlgAntalDage = 21;
		dlgUdstyr = ['ingen'];
		dlgNiveau = 'begynder';
		dlgFejl = null;
		viserDialog = true;
	}

	function lukDialog() {
		viserDialog = false;
	}

	function toggleUdstyr(u: Udstyr) {
		dlgUdstyr = dlgUdstyr.includes(u) ? dlgUdstyr.filter((x) => x !== u) : [...dlgUdstyr, u];
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
		if (dlgAntalDage < 1) {
			dlgFejl = 'Programmet skal have mindst 1 dag.';
			return;
		}
		if (programmer.some((p) => p.id === id)) {
			dlgFejl = 'Et program med dette ID findes allerede.';
			return;
		}
		dlgGemmer = true;
		dlgFejl = null;
		try {
			await gemMasterProgram(id, {
				navn,
				beskrivelse: dlgBeskrivelse.trim(),
				treaningsform: 'mikrotraening',
				antalDage: dlgAntalDage,
				dagligTid: 180,
				niveau: dlgNiveau,
				udstyr: dlgUdstyr,
				aktiv: true
			});
			await gemMasterDage(id, tommeDageSkelet(dlgAntalDage));
			lukDialog();
			await indlaes();
		} catch (e) {
			console.error(e);
			dlgFejl = 'Kunne ikke oprette programmet.';
		} finally {
			dlgGemmer = false;
		}
	}

	let sletKandidat = $state<TrainingProgram | null>(null);
	let sletter = $state(false);
	async function bekraeftSlet() {
		const p = sletKandidat;
		if (!p) return;
		sletter = true;
		try {
			await sletMasterProgram(p.id);
			await indlaes();
			sletKandidat = null;
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke slette programmet.';
		} finally {
			sletter = false;
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Admin</span>
		</a>
		<div class="eyebrow">Admin · Mine programmer</div>
		<h1>Mine programmer</h1>
		<p class="page-sub">
			Byg dine egne træningsprogrammer her. De hører ikke til et bestemt forløb og kan tildeles
			bredt. Bygges med den samme øvelsesbank som forløbs-træningen.
		</p>
	</header>

	<button class="btn primary" type="button" onclick={aabnDialog}>+ Nyt program</button>

	{#if loading}
		<div class="status-besked">Henter programmer...</div>
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if programmer.length === 0}
		<div class="status-besked tom">Ingen programmer endnu. Opret dit første ovenfor.</div>
	{:else}
		<div class="prog-liste">
			{#each programmer as p (p.id)}
				<div class="prog-row" class:inaktiv={!p.aktiv}>
					<a class="prog-link" href="/app/admin/programmer/{p.id}">
						<div class="prog-tekst">
							<div class="prog-navn">
								{p.navn}
								{#if !p.aktiv}<span class="inaktiv-tag">skjult</span>{/if}
							</div>
							<div class="prog-sub">{p.antalDage} dage · {p.beskrivelse || 'Ingen beskrivelse'}</div>
						</div>
						<Icon name="chevron-r" size={14} color="var(--text3)" />
					</a>
					<button
						class="slet-btn"
						type="button"
						aria-label="Slet program"
						onclick={() => (sletKandidat = p)}>×</button
					>
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if viserDialog}
	<div
		class="overlay"
		role="button"
		tabindex="0"
		onclick={lukDialog}
		onkeydown={(e) => e.key === 'Escape' && lukDialog()}
	>
		<div
			class="dialog"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={() => {}}
		>
			<div class="section-label">Nyt program</div>
			<label class="felt">
				<span class="felt-label">ID (snake_case)</span>
				<input type="text" bind:value={dlgId} placeholder="fx sommer_styrke" disabled={dlgGemmer} />
			</label>
			<label class="felt">
				<span class="felt-label">Navn</span>
				<input type="text" bind:value={dlgNavn} placeholder="fx Sommer styrke" disabled={dlgGemmer} />
			</label>
			<label class="felt">
				<span class="felt-label">Beskrivelse (valgfri)</span>
				<textarea bind:value={dlgBeskrivelse} rows="2" disabled={dlgGemmer}></textarea>
			</label>
			<label class="felt">
				<span class="felt-label">Antal dage</span>
				<input type="number" min="1" max="120" bind:value={dlgAntalDage} disabled={dlgGemmer} />
			</label>
			<div class="felt">
				<span class="felt-label">Udstyr</span>
				<div class="chip-rad">
					{#each UDSTYR as u (u.id)}
						<button
							type="button"
							class="chip"
							class:valgt={dlgUdstyr.includes(u.id)}
							onclick={() => toggleUdstyr(u.id)}
							disabled={dlgGemmer}>{u.label}</button
						>
					{/each}
				</div>
			</div>
			<label class="felt">
				<span class="felt-label">Niveau</span>
				<select bind:value={dlgNiveau} disabled={dlgGemmer}>
					{#each NIVEAUER as n (n.id)}
						<option value={n.id}>{n.label}</option>
					{/each}
				</select>
			</label>
			{#if dlgFejl}
				<div class="besked fejl">{dlgFejl}</div>
			{/if}
			<div class="dialog-actions">
				<button class="btn" type="button" onclick={lukDialog} disabled={dlgGemmer}>Annuller</button>
				<button class="btn primary" type="button" onclick={opret} disabled={dlgGemmer}>
					{dlgGemmer ? 'Opretter...' : 'Opret'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if sletKandidat}
	<BekraeftModal
		titel="Slet programmet?"
		beskrivelse={`"${sletKandidat.navn}" slettes med alle sine dage. Eventuelle tildelinger af programmet fjernes ikke automatisk. Kan ikke fortrydes.`}
		bekraeftTekst="Slet"
		destruktiv
		arbejder={sletter}
		onBekraeft={() => void bekraeftSlet()}
		onAnnuller={() => (sletKandidat = null)}
	/>
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

	.page-sub {
		font-size: calc(13px * var(--fs-scale, 1));
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
		font-size: calc(13px * var(--fs-scale, 1));
		text-align: center;
		margin-top: 14px;
	}

	.status-besked.tom {
		background: var(--bg2);
		border-style: dashed;
	}

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.prog-liste {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 14px;
	}

	.prog-row {
		display: flex;
		align-items: stretch;
		gap: 6px;
	}

	.prog-link {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		border: 1px solid var(--border);
		border-radius: 12px;
		text-decoration: none;
		color: inherit;
		background: var(--white);
		min-width: 0;
	}

	.prog-link:hover {
		background: var(--bg2);
	}

	.prog-row.inaktiv .prog-link {
		opacity: 0.7;
	}

	.prog-tekst {
		flex: 1;
		min-width: 0;
	}

	.prog-navn {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.inaktiv-tag {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text3);
		background: var(--bg2);
		border-radius: 6px;
		padding: 1px 6px;
	}

	.prog-sub {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.slet-btn {
		width: 40px;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--white);
		color: #b8665a;
		font-size: calc(18px * var(--fs-scale, 1));
		cursor: pointer;
		flex-shrink: 0;
	}

	.slet-btn:hover {
		background: #fbeeea;
	}

	.btn {
		display: block;
		width: 100%;
		padding: 12px 14px;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 12px;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text);
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.btn.primary {
		background: var(--terra);
		color: #fff;
		border-color: var(--terra);
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.35);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 18px;
		z-index: 100;
	}

	.dialog {
		background: var(--white);
		border-radius: 16px;
		padding: 18px;
		width: 100%;
		max-width: 420px;
		max-height: 90vh;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.section-label {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text3);
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

	.felt input,
	.felt textarea,
	.felt select {
		padding: 10px 12px;
		font-size: calc(14px * var(--fs-scale, 1));
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-b);
		outline: none;
		width: 100%;
		box-sizing: border-box;
	}

	.felt textarea {
		resize: vertical;
		line-height: 1.5;
	}

	.felt input:focus,
	.felt textarea:focus,
	.felt select:focus {
		border-color: var(--terra);
	}

	.chip-rad {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.chip {
		padding: 7px 12px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		border-radius: 999px;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text2);
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.chip.valgt {
		background: var(--terra);
		color: #fff;
		border-color: var(--terra);
	}

	.chip:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.dialog-actions {
		display: flex;
		gap: 8px;
		margin-top: 4px;
	}

	.besked {
		padding: 8px 12px;
		border-radius: 10px;
		font-size: calc(12px * var(--fs-scale, 1));
	}

	.besked.fejl {
		background: #fbeeea;
		color: #8a4a3e;
		border: 1px solid #f0d6cf;
	}
</style>
