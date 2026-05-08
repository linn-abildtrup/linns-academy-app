<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import type { Exercise, TrainingDay } from '$lib/content/mikrotraening';
	import { filtrerOvelserTilProgram, genererStandardProgram } from '$lib/content/mikrotraening';
	import {
		gemForlobsDage,
		gemForlobsProgram,
		hentAlleExercises,
		hentForlobsProgram,
		type ProgramMedDage
	} from '$lib/firestore/mikrotraening';
	import Icon from '$lib/components/Icon.svelte';

	const forlobId = $derived(page.params.id ?? '');
	const programId = $derived(page.params.programId ?? '');

	let programData = $state<ProgramMedDage | null>(null);
	let alleOvelser = $state<Exercise[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let genererStatus = $state<'klar' | 'arbejder' | 'gemt' | 'fejl'>('klar');
	let genererBesked = $state<string>('');

	// Metadata-redigering
	let formNavn = $state('');
	let formBeskrivelse = $state('');
	let formAktiv = $state(true);
	let metaGemmer = $state(false);
	let metaKvit = $state(false);
	let metaFejl = $state<string | null>(null);

	const tommeDage = $derived(programData?.dage.filter((d) => d.exercises.length === 0).length ?? 0);
	const altErTomt = $derived(programData !== null && tommeDage === programData.dage.length);

	onMount(async () => {
		try {
			const [data, ovelser] = await Promise.all([
				hentForlobsProgram(forlobId, programId),
				hentAlleExercises()
			]);
			programData = data;
			alleOvelser = ovelser;
			if (data) {
				formNavn = data.program.navn;
				formBeskrivelse = data.program.beskrivelse;
				formAktiv = data.program.aktiv;
			} else {
				fejl = 'Programmet kunne ikke findes.';
			}
		} catch (e) {
			fejl = 'Kunne ikke hente data.';
			console.error(e);
		} finally {
			loading = false;
		}
	});

	async function gemMetadata() {
		if (!programData) return;
		metaGemmer = true;
		metaKvit = false;
		metaFejl = null;
		const navn = formNavn.trim();
		if (!navn) {
			metaFejl = 'Navnet må ikke være tomt.';
			metaGemmer = false;
			return;
		}
		try {
			await gemForlobsProgram(forlobId, programId, {
				...programData.program,
				navn,
				beskrivelse: formBeskrivelse.trim(),
				aktiv: formAktiv
			});
			programData = {
				...programData,
				program: {
					...programData.program,
					navn,
					beskrivelse: formBeskrivelse.trim(),
					aktiv: formAktiv
				}
			};
			metaKvit = true;
			setTimeout(() => (metaKvit = false), 2000);
		} catch (e) {
			console.error(e);
			metaFejl = 'Kunne ikke gemme.';
		} finally {
			metaGemmer = false;
		}
	}

	async function genererStandardprogram() {
		if (!programData) return;
		const bekraeftet = confirm(
			`Det vil overskrive alle ${programData.dage.length} dage med et standardprogram. Er du sikker?`
		);
		if (!bekraeftet) return;

		genererStatus = 'arbejder';
		genererBesked = '';

		try {
			const filtrerede = filtrerOvelserTilProgram(alleOvelser, programData.program.udstyr);
			const nyeDage = genererStandardProgram(programData.program.antalDage, filtrerede);
			await gemForlobsDage(forlobId, programId, nyeDage);
			programData = { ...programData, dage: nyeDage };
			genererStatus = 'gemt';
			genererBesked = `${nyeDage.length} dage genereret og gemt.`;
		} catch (e) {
			genererStatus = 'fejl';
			genererBesked = e instanceof Error ? e.message : 'Kunne ikke generere program.';
			console.error(e);
		}
	}

	function ovelseNavn(exerciseId: string): string {
		return alleOvelser.find((e) => e.id === exerciseId)?.name ?? exerciseId;
	}

	function dagOpsummering(dag: TrainingDay): string {
		if (dag.exercises.length === 0) return 'Tom — ingen øvelser';
		return dag.exercises.map((e) => ovelseNavn(e.exerciseId)).join(' · ');
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin/forlob/{forlobId}/mikrotraening">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Programmer</span>
		</a>
		<div class="eyebrow">Admin · Mikrotræning</div>
		<h1>{programData?.program.navn ?? 'Henter...'}</h1>
		{#if programData}
			<p class="page-sub">{programData.program.beskrivelse}</p>
		{/if}
	</header>

	{#if loading}
		<div class="status-besked">Henter program...</div>
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if programData}
		<section class="form-card">
			<div class="section-label">Indstillinger</div>
			<label class="felt">
				<span class="felt-label">Navn</span>
				<input type="text" bind:value={formNavn} disabled={metaGemmer} />
			</label>
			<label class="felt">
				<span class="felt-label">Beskrivelse</span>
				<textarea bind:value={formBeskrivelse} rows="2" disabled={metaGemmer}></textarea>
			</label>
			<label class="checkbox-rad">
				<input type="checkbox" bind:checked={formAktiv} disabled={metaGemmer} />
				<span>Aktiv (kan vælges af klienter)</span>
			</label>
			{#if metaFejl}
				<div class="besked fejl">{metaFejl}</div>
			{/if}
			{#if metaKvit}
				<div class="besked ok">Gemt ✓</div>
			{/if}
			<button class="btn primary" type="button" onclick={gemMetadata} disabled={metaGemmer}>
				{metaGemmer ? 'Gemmer...' : 'Gem ændringer'}
			</button>
		</section>

		<section class="actions-card">
			<div class="section-label">Hurtige handlinger</div>
			<button
				class="btn primary"
				type="button"
				onclick={genererStandardprogram}
				disabled={genererStatus === 'arbejder'}
			>
				{#if genererStatus === 'arbejder'}
					Genererer...
				{:else if altErTomt}
					Auto-generér standardprogram
				{:else}
					Auto-generér igen (overskriver)
				{/if}
			</button>
			<p class="hint">
				Genererer 1 ben-, 1 overkrop- og 1 core/stabilitet-øvelse pr. dag, alle 3 sæt × 30s arbejde
				× 10s hvile. Du kan justere hver dag bagefter.
			</p>
			{#if genererStatus === 'gemt'}
				<div class="besked ok">{genererBesked}</div>
			{:else if genererStatus === 'fejl'}
				<div class="besked fejl">{genererBesked}</div>
			{/if}
		</section>

		<section class="dage-card">
			<div class="card-head">
				<div class="section-label">Dage ({programData.dage.length})</div>
				{#if tommeDage > 0}
					<div class="tom-tael">{tommeDage} tomme</div>
				{/if}
			</div>
			<div class="dage-liste">
				{#each programData.dage as dag (dag.dagNummer)}
					<a
						class="dag-row"
						class:tom={dag.exercises.length === 0}
						href="/app/admin/forlob/{forlobId}/mikrotraening/{programId}/{dag.dagNummer}"
					>
						<div class="dag-num">{dag.dagNummer}</div>
						<div class="dag-tekst">
							<div class="dag-titel">
								{dag.titel || `Dag ${dag.dagNummer}`}
							</div>
							<div class="dag-sub">{dagOpsummering(dag)}</div>
						</div>
						<Icon name="chevron-r" size={14} color="var(--text3)" />
					</a>
				{/each}
			</div>
		</section>
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
	}

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.form-card,
	.actions-card,
	.dage-card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 16px;
		margin-bottom: 14px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.section-label {
		font-size: 10px;
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

	.tom-tael {
		font-size: 11px;
		color: var(--terra);
		font-weight: 500;
	}

	.btn {
		display: block;
		width: 100%;
		padding: 12px 14px;
		font-size: 14px;
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

	.hint {
		font-size: 11px;
		color: var(--text4);
		margin: 0;
		line-height: 1.4;
	}

	.besked {
		padding: 8px 12px;
		border-radius: 10px;
		font-size: 12px;
	}

	.besked.ok {
		background: #eef5ef;
		color: #4a6b54;
		border: 1px solid #d6e6da;
	}

	.besked.fejl {
		background: #fbeeea;
		color: #8a4a3e;
		border: 1px solid #f0d6cf;
	}

	.dage-liste {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.dag-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: 10px;
		text-decoration: none;
		color: inherit;
		background: var(--white);
	}

	.dag-row.tom {
		border-style: dashed;
		opacity: 0.85;
	}

	.dag-row:hover {
		background: var(--bg2);
	}

	.dag-num {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: var(--bg2);
		color: var(--text2);
		font-size: 12px;
		font-weight: 600;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.dag-tekst {
		flex: 1;
		min-width: 0;
	}

	.dag-titel {
		font-size: 13px;
		font-weight: 600;
		color: var(--text);
	}

	.dag-sub {
		font-size: 11px;
		color: var(--text3);
		margin-top: 2px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
