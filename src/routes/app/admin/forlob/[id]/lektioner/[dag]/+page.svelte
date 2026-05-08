<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import type { ForlobDag, LektionItem } from '$lib/content/forlob';
	import { nyLektion, tomForlobDag } from '$lib/content/forlob';
	import { gemForlobsdag, hentForlobsdag, sletForlobsdag } from '$lib/firestore/forlob';
	import Icon from '$lib/components/Icon.svelte';

	const forlobId = $derived(page.params.id ?? '');
	const dagNummer = $derived(parseInt(page.params.dag ?? '0', 10));

	let dag = $state<ForlobDag>(tomForlobDag(0));
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let gemmer = $state(false);
	let gemKvit = $state(false);
	let bekraefter = $state(false);

	$effect(() => {
		// Re-init når dagNummer ændrer sig (deep-link / navigation)
		dag = tomForlobDag(dagNummer);
	});

	onMount(async () => {
		await indlaes();
	});

	async function indlaes() {
		loading = true;
		fejl = null;
		try {
			const fundet = await hentForlobsdag(forlobId, dagNummer);
			dag = fundet ?? tomForlobDag(dagNummer);
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente dagen.';
		} finally {
			loading = false;
		}
	}

	function tilfoejLektion() {
		dag = { ...dag, lektioner: [...dag.lektioner, nyLektion()] };
	}

	function fjernLektion(id: string) {
		dag = { ...dag, lektioner: dag.lektioner.filter((l) => l.id !== id) };
	}

	function opdaterLektion<K extends keyof LektionItem>(
		id: string,
		felt: K,
		vaerdi: LektionItem[K]
	) {
		dag = {
			...dag,
			lektioner: dag.lektioner.map((l) => (l.id === id ? { ...l, [felt]: vaerdi } : l))
		};
	}

	async function gem() {
		gemmer = true;
		fejl = null;
		gemKvit = false;
		try {
			// Trim alle lektion-felter inden gemning
			const lektioner: LektionItem[] = dag.lektioner.map((l) => ({
				...l,
				titel: l.titel.trim(),
				beskrivelse: l.beskrivelse.trim(),
				format: l.format.trim(),
				url: l.url.trim()
			}));
			const renset: ForlobDag = {
				dagNummer: dag.dagNummer,
				uge: dag.uge,
				lektioner,
				noteFraLinn: dag.noteFraLinn.trim()
			};
			await gemForlobsdag(forlobId, renset);
			dag = renset;
			gemKvit = true;
			setTimeout(() => (gemKvit = false), 2000);
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke gemme.';
		} finally {
			gemmer = false;
		}
	}

	async function sletDag() {
		if (!bekraefter) {
			bekraefter = true;
			return;
		}
		gemmer = true;
		try {
			await sletForlobsdag(forlobId, dagNummer);
			goto(`/app/admin/forlob/${forlobId}/lektioner`);
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke slette.';
			gemmer = false;
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin/forlob/{forlobId}/lektioner">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Lektioner</span>
		</a>
		<div class="eyebrow">Admin · Lektioner</div>
		<h1>{dagNummer === 0 ? 'Baseline (dag 0)' : `Dag ${dagNummer}`}</h1>
		{#if dagNummer > 0}
			<p class="page-sub">Uge {dag.uge}</p>
		{/if}
	</header>

	{#if loading}
		<div class="status-besked">Henter...</div>
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else}
		<div class="form-card">
			<div class="form-titel">Note fra Linn (valgfri)</div>
			<textarea
				bind:value={dag.noteFraLinn}
				placeholder="Personlig note til klienterne for denne dag..."
				rows="4"
				disabled={gemmer}
			></textarea>
		</div>

		<div class="form-card">
			<div class="form-head">
				<div class="form-titel">Lektioner</div>
				<div class="form-tael">
					{dag.lektioner.length} lektion{dag.lektioner.length === 1 ? '' : 'er'}
				</div>
			</div>

			{#if dag.lektioner.length === 0}
				<p class="muted">Ingen lektioner endnu. Tilføj den første nedenfor.</p>
			{/if}

			{#each dag.lektioner as l (l.id)}
				<article class="lektion-edit">
					<header class="lektion-edit-head">
						<div class="lektion-edit-num">Lektion</div>
						<button
							class="ikon-knap fare"
							type="button"
							onclick={() => fjernLektion(l.id)}
							disabled={gemmer}
							aria-label="Fjern"
							title="Fjern lektion"
						>
							×
						</button>
					</header>

					<label class="felt">
						<span class="felt-label">Titel</span>
						<input
							type="text"
							value={l.titel}
							oninput={(e) => opdaterLektion(l.id, 'titel', e.currentTarget.value)}
							maxlength="140"
							disabled={gemmer}
						/>
					</label>

					<label class="felt">
						<span class="felt-label">Beskrivelse</span>
						<textarea
							value={l.beskrivelse}
							oninput={(e) => opdaterLektion(l.id, 'beskrivelse', e.currentTarget.value)}
							rows="3"
							maxlength="500"
							disabled={gemmer}
						></textarea>
					</label>

					<div class="felt-rad">
						<label class="felt">
							<span class="felt-label">Varighed (min)</span>
							<input
								type="number"
								min="0"
								max="600"
								value={l.varighedMin}
								oninput={(e) =>
									opdaterLektion(l.id, 'varighedMin', parseInt(e.currentTarget.value, 10) || 0)}
								disabled={gemmer}
							/>
						</label>
						<label class="felt">
							<span class="felt-label">Format</span>
							<input
								type="text"
								value={l.format}
								oninput={(e) => opdaterLektion(l.id, 'format', e.currentTarget.value)}
								placeholder="Video, lyd, tekst..."
								maxlength="40"
								disabled={gemmer}
							/>
						</label>
					</div>

					<label class="felt">
						<span class="felt-label">URL (valgfri)</span>
						<input
							type="url"
							value={l.url}
							oninput={(e) => opdaterLektion(l.id, 'url', e.currentTarget.value)}
							placeholder="https://..."
							disabled={gemmer}
						/>
					</label>
				</article>
			{/each}

			<button
				class="form-knap ghost"
				type="button"
				onclick={tilfoejLektion}
				style="border-style: dashed;"
				disabled={gemmer}
			>
				+ Tilføj lektion
			</button>
		</div>

		<div class="actions">
			{#if gemKvit}
				<div class="kvit-besked">Gemt ✓</div>
			{/if}
			<button class="form-knap primary full" type="button" onclick={gem} disabled={gemmer}>
				{gemmer ? 'Gemmer...' : 'Gem'}
			</button>

			<div class="slet-omraade">
				{#if !bekraefter}
					<button class="slet-knap" type="button" onclick={sletDag} disabled={gemmer}>
						Slet alt indhold for denne dag
					</button>
				{:else}
					<div class="slet-bekraeft">
						<div class="slet-tekst">
							Slet alle lektioner og note for dag {dagNummer}?
						</div>
						<div class="slet-knapper">
							<button
								class="form-knap ghost"
								type="button"
								onclick={() => (bekraefter = false)}
								disabled={gemmer}
							>
								Annuller
							</button>
							<button class="form-knap danger" type="button" onclick={sletDag} disabled={gemmer}>
								{gemmer ? 'Sletter...' : 'Ja, slet'}
							</button>
						</div>
					</div>
				{/if}
			</div>
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

	.form-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.form-titel {
		font-family: var(--ff-d);
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}

	.form-tael {
		font-size: 11px;
		color: var(--text3);
		font-variant-numeric: tabular-nums;
	}

	.muted {
		font-size: 12px;
		color: var(--text3);
		margin: 0;
		font-style: italic;
	}

	.lektion-edit {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 12px;
		background: var(--bg2);
		border: 1px solid var(--border);
		border-radius: 12px;
	}

	.lektion-edit-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.lektion-edit-num {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.ikon-knap {
		width: 28px;
		height: 28px;
		border-radius: 8px;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text2);
		font-size: 14px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.ikon-knap.fare:hover {
		background: #fbeeea;
		color: #8a4a3e;
		border-color: #f0d6cf;
	}

	.ikon-knap:disabled {
		opacity: 0.6;
		cursor: not-allowed;
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
	.felt textarea,
	.form-card > textarea {
		padding: 10px 12px;
		font-size: 14px;
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text);
		outline: none;
		font-family: var(--ff-b);
	}

	.felt textarea,
	.form-card > textarea {
		resize: vertical;
		min-height: 80px;
		line-height: 1.5;
	}

	.felt input:focus,
	.felt textarea:focus,
	.form-card > textarea:focus {
		border-color: var(--terra);
	}

	.felt-rad {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: 10px;
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

	.form-knap.full {
		width: 100%;
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

	.kvit-besked {
		padding: 8px 12px;
		background: var(--sdim);
		border-radius: 8px;
		font-size: 12px;
		color: var(--sage);
		text-align: center;
	}

	.slet-omraade {
		margin-top: 14px;
	}

	.slet-knap {
		background: none;
		border: 1px solid #e8c8c1;
		color: #b8503f;
		font-size: 12px;
		font-weight: 500;
		padding: 8px 14px;
		border-radius: 8px;
		cursor: pointer;
		font-family: var(--ff-b);
		width: 100%;
	}

	.slet-knap:hover {
		background: #fbeeea;
	}

	.slet-knap:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.slet-bekraeft {
		background: #fbeeea;
		border: 1px solid #f0d6cf;
		border-radius: 12px;
		padding: 14px;
	}

	.slet-tekst {
		font-size: 13px;
		color: #8a4a3e;
		margin-bottom: 10px;
	}

	.slet-knapper {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
</style>
