<script lang="ts">
	import { onMount } from 'svelte';
	import type {
		Exercise,
		ExerciseCategory,
		Treaningsform,
		Udstyr
	} from '$lib/content/mikrotraening';
	import {
		gemExercise,
		hentAlleExercises,
		sletExercise
	} from '$lib/firestore/mikrotraening';
	import Icon from '$lib/components/Icon.svelte';

	const KATEGORIER: { id: ExerciseCategory; label: string }[] = [
		{ id: 'ben', label: 'Ben' },
		{ id: 'overkrop', label: 'Overkrop' },
		{ id: 'core', label: 'Core' },
		{ id: 'stabilitet', label: 'Stabilitet' }
	];

	const UDSTYR: { id: Udstyr; label: string }[] = [
		{ id: 'ingen', label: 'Intet' },
		{ id: 'kettlebell', label: 'Kettlebell' },
		{ id: 'elastik', label: 'Elastik' },
		{ id: 'haandvaegte', label: 'Håndvægte' },
		{ id: 'forhojning', label: 'Forhøjning' }
	];

	const TRAENINGSFORMER: { id: Treaningsform; label: string }[] = [
		{ id: 'mikrotraening', label: 'Mikrotræning' },
		{ id: 'yoga', label: 'Yoga' },
		{ id: 'styrke', label: 'Styrke' },
		{ id: 'mobilitet', label: 'Mobilitet' }
	];

	let oevelser = $state<Exercise[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);

	let soegning = $state('');
	let valgtKategori = $state<ExerciseCategory | 'alle'>('alle');

	let viserDialog = $state(false);
	let dialogId = $state<string | null>(null);
	let dlgIdField = $state('');
	let dlgName = $state('');
	let dlgDesc = $state('');
	let dlgHow = $state('');
	let dlgCat = $state<ExerciseCategory>('ben');
	let dlgCatLabel = $state('');
	let dlgTags = $state('');
	let dlgVideoPath = $state('');
	let dlgUdstyr = $state<Udstyr[]>(['ingen']);
	let dlgTreaningsformer = $state<Treaningsform[]>(['mikrotraening']);
	let dlgAktiv = $state(true);
	let dlgGemmer = $state(false);
	let dlgFejl = $state<string | null>(null);
	let bekraefterSlet = $state(false);

	const filtreredeOevelser = $derived.by<Exercise[]>(() => {
		const q = soegning.trim().toLowerCase();
		return oevelser.filter((ex) => {
			if (valgtKategori !== 'alle' && ex.cat !== valgtKategori) return false;
			if (!q) return true;
			return (
				ex.name.toLowerCase().includes(q) ||
				ex.desc.toLowerCase().includes(q) ||
				ex.tags.some((t) => t.toLowerCase().includes(q))
			);
		});
	});

	onMount(async () => {
		await indlaes();
	});

	async function indlaes() {
		loading = true;
		fejl = null;
		try {
			oevelser = await hentAlleExercises();
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente øvelser.';
		} finally {
			loading = false;
		}
	}

	function aabnNy() {
		dialogId = null;
		dlgIdField = '';
		dlgName = '';
		dlgDesc = '';
		dlgHow = '';
		dlgCat = 'ben';
		dlgCatLabel = '';
		dlgTags = '';
		dlgVideoPath = '';
		dlgUdstyr = ['ingen'];
		dlgTreaningsformer = ['mikrotraening'];
		dlgAktiv = true;
		dlgFejl = null;
		bekraefterSlet = false;
		viserDialog = true;
	}

	function aabnRediger(ex: Exercise) {
		dialogId = ex.id;
		dlgIdField = ex.id;
		dlgName = ex.name;
		dlgDesc = ex.desc;
		dlgHow = ex.how.join('\n');
		dlgCat = ex.cat;
		dlgCatLabel = ex.catLabel ?? '';
		dlgTags = ex.tags.join(', ');
		dlgVideoPath = ex.videoPath ?? '';
		dlgUdstyr = ex.udstyr ?? ['ingen'];
		dlgTreaningsformer = ex.treaningsformer ?? ['mikrotraening'];
		dlgAktiv = ex.aktiv;
		dlgFejl = null;
		bekraefterSlet = false;
		viserDialog = true;
	}

	function lukDialog() {
		viserDialog = false;
		dlgFejl = null;
		bekraefterSlet = false;
	}

	function toggleUdstyr(u: Udstyr) {
		dlgUdstyr = dlgUdstyr.includes(u)
			? dlgUdstyr.filter((x) => x !== u)
			: [...dlgUdstyr, u];
	}

	function toggleTreaningsform(t: Treaningsform) {
		dlgTreaningsformer = dlgTreaningsformer.includes(t)
			? dlgTreaningsformer.filter((x) => x !== t)
			: [...dlgTreaningsformer, t];
	}

	async function gem() {
		const id = (dialogId ?? dlgIdField).trim();
		const name = dlgName.trim();
		if (!id || !/^[a-z0-9_]+$/.test(id)) {
			dlgFejl = 'ID skal være snake_case (kun små bogstaver, tal og _).';
			return;
		}
		if (!name) {
			dlgFejl = 'Navnet må ikke være tomt.';
			return;
		}
		if (dlgUdstyr.length === 0) {
			dlgFejl = 'Vælg mindst ét udstyr (eller "Intet").';
			return;
		}
		if (dlgTreaningsformer.length === 0) {
			dlgFejl = 'Vælg mindst én træningsform.';
			return;
		}
		dlgGemmer = true;
		dlgFejl = null;
		try {
			await gemExercise(id, {
				name,
				desc: dlgDesc.trim(),
				how: dlgHow
					.split('\n')
					.map((s) => s.trim())
					.filter(Boolean),
				cat: dlgCat,
				catLabel: dlgCatLabel.trim() || dlgCat,
				tags: dlgTags
					.split(',')
					.map((s) => s.trim())
					.filter(Boolean),
				videoPath: dlgVideoPath.trim(),
				udstyr: dlgUdstyr,
				treaningsformer: dlgTreaningsformer,
				aktiv: dlgAktiv
			});
			lukDialog();
			await indlaes();
		} catch (e) {
			console.error(e);
			dlgFejl = 'Kunne ikke gemme.';
		} finally {
			dlgGemmer = false;
		}
	}

	async function slet() {
		if (!dialogId) return;
		if (!bekraefterSlet) {
			bekraefterSlet = true;
			return;
		}
		dlgGemmer = true;
		dlgFejl = null;
		try {
			await sletExercise(dialogId);
			lukDialog();
			await indlaes();
		} catch (e) {
			console.error(e);
			dlgFejl = 'Kunne ikke slette.';
		} finally {
			dlgGemmer = false;
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Admin</span>
		</a>
		<div class="eyebrow">Admin · Træningsmodul</div>
		<h1>Øvelsesbank</h1>
		<p class="page-sub">
			Alle øvelser der kan bruges i mikrotræningsprogrammer på tværs af forløb.
		</p>
	</header>

	<div class="filter-rad">
		<input
			type="search"
			class="soeg-input"
			placeholder="Søg på navn, beskrivelse eller tag..."
			bind:value={soegning}
		/>
	</div>

	<div class="kat-chips">
		<button
			class="kat-chip"
			class:aktiv={valgtKategori === 'alle'}
			type="button"
			onclick={() => (valgtKategori = 'alle')}
		>
			Alle
		</button>
		{#each KATEGORIER as k (k.id)}
			<button
				class="kat-chip"
				class:aktiv={valgtKategori === k.id}
				type="button"
				onclick={() => (valgtKategori = k.id)}
			>
				{k.label}
			</button>
		{/each}
	</div>

	<button class="primary-knap full" type="button" onclick={aabnNy}>+ Ny øvelse</button>

	{#if loading}
		<div class="status-besked">Henter øvelser...</div>
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if filtreredeOevelser.length === 0}
		<div class="status-besked">
			{soegning || valgtKategori !== 'alle' ? 'Ingen match.' : 'Ingen øvelser endnu.'}
		</div>
	{:else}
		<div class="oevelse-liste">
			{#each filtreredeOevelser as ex (ex.id)}
				<button class="oevelse-row" type="button" onclick={() => aabnRediger(ex)}>
					<div class="oevelse-info">
						<div class="oevelse-navn">
							{ex.name}
							{#if !ex.aktiv}
								<span class="badge inaktiv">Inaktiv</span>
							{/if}
						</div>
						<div class="oevelse-meta">
							{ex.catLabel || ex.cat} · {ex.udstyr.join(', ')}
						</div>
					</div>
					<Icon name="chevron-r" size={14} color="var(--text3)" />
				</button>
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
			<div class="form-titel">{dialogId ? 'Rediger øvelse' : 'Ny øvelse'}</div>
			<button class="ikon-knap" type="button" onclick={lukDialog} aria-label="Luk">×</button>
		</header>

		{#if !dialogId}
			<label class="felt">
				<span class="felt-label">ID (snake_case)</span>
				<input
					type="text"
					bind:value={dlgIdField}
					placeholder="fx goblet_squat"
					disabled={dlgGemmer}
				/>
				<span class="felt-hint">Bruges som dokument-ID i Firestore — kan ikke ændres senere.</span>
			</label>
		{/if}

		<label class="felt">
			<span class="felt-label">Navn</span>
			<input type="text" bind:value={dlgName} maxlength="80" disabled={dlgGemmer} />
		</label>

		<label class="felt">
			<span class="felt-label">Beskrivelse</span>
			<textarea bind:value={dlgDesc} rows="2" maxlength="400" disabled={dlgGemmer}></textarea>
		</label>

		<label class="felt">
			<span class="felt-label">Sådan gør du (én linje pr trin)</span>
			<textarea bind:value={dlgHow} rows="4" disabled={dlgGemmer}></textarea>
		</label>

		<div class="felt">
			<span class="felt-label">Kategori</span>
			<div class="chip-row">
				{#each KATEGORIER as k (k.id)}
					<button
						class="chip"
						class:aktiv={dlgCat === k.id}
						type="button"
						onclick={() => (dlgCat = k.id)}
						disabled={dlgGemmer}
					>
						{k.label}
					</button>
				{/each}
			</div>
		</div>

		<label class="felt">
			<span class="felt-label">Kategori-label (frit, vises på kort)</span>
			<input
				type="text"
				bind:value={dlgCatLabel}
				placeholder="fx Ben & balle"
				maxlength="40"
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
			<span class="felt-label">Træningsformer</span>
			<div class="chip-row">
				{#each TRAENINGSFORMER as t (t.id)}
					<button
						class="chip"
						class:aktiv={dlgTreaningsformer.includes(t.id)}
						type="button"
						onclick={() => toggleTreaningsform(t.id)}
						disabled={dlgGemmer}
					>
						{t.label}
					</button>
				{/each}
			</div>
		</div>

		<label class="felt">
			<span class="felt-label">Tags (komma-adskilte)</span>
			<input
				type="text"
				bind:value={dlgTags}
				placeholder="ben, squat, kettlebell"
				disabled={dlgGemmer}
			/>
		</label>

		<label class="felt">
			<span class="felt-label">Video-fil (i Firebase Storage /exercises/)</span>
			<input
				type="text"
				bind:value={dlgVideoPath}
				placeholder="goblet_squat.mp4"
				disabled={dlgGemmer}
			/>
		</label>

		<label class="checkbox-rad">
			<input type="checkbox" bind:checked={dlgAktiv} disabled={dlgGemmer} />
			<span>Aktiv (kan vælges i programmer)</span>
		</label>

		{#if dlgFejl}
			<div class="fejl-besked">{dlgFejl}</div>
		{/if}

		<div class="dialog-knapper">
			{#if dialogId}
				{#if !bekraefterSlet}
					<button
						class="form-knap danger"
						type="button"
						onclick={slet}
						disabled={dlgGemmer}
					>
						Slet
					</button>
				{:else}
					<button
						class="form-knap danger"
						type="button"
						onclick={slet}
						disabled={dlgGemmer}
					>
						{dlgGemmer ? 'Sletter...' : 'Bekræft slet'}
					</button>
				{/if}
			{/if}
			<button class="form-knap primary" type="button" onclick={gem} disabled={dlgGemmer}>
				{dlgGemmer ? 'Gemmer...' : 'Gem'}
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

	.filter-rad {
		margin: 14px 0 10px;
	}

	.soeg-input {
		width: 100%;
		padding: 10px 12px;
		font-size: 13px;
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

	.kat-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 14px;
	}

	.kat-chip {
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

	.kat-chip.aktiv {
		background: var(--terra);
		color: #fff;
		border-color: var(--terra);
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

	.oevelse-liste {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.oevelse-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 14px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		text-align: left;
		font-family: inherit;
		color: inherit;
		cursor: pointer;
		width: 100%;
	}

	.oevelse-row:hover {
		background: var(--bg2);
	}

	.oevelse-info {
		flex: 1;
		min-width: 0;
	}

	.oevelse-navn {
		font-size: 14px;
		font-weight: 600;
		color: var(--text);
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.oevelse-meta {
		font-size: 11.5px;
		color: var(--text3);
		margin-top: 2px;
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

	.felt-hint {
		font-size: 11px;
		color: var(--text3);
		font-style: italic;
		margin-top: 2px;
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
		font-family: var(--ff-b);
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

	.form-knap.danger {
		background: #b8503f;
		color: #fff;
	}

	.form-knap:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
