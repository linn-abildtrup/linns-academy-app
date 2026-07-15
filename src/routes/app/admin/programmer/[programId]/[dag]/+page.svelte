<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import type { DayExercise, Exercise, TrainingDay } from '$lib/content/mikrotraening';
	import {
		gemMasterDag,
		hentAlleExercises,
		hentMasterProgram,
		type ProgramMedDage
	} from '$lib/firestore/mikrotraening';
	import Icon from '$lib/components/Icon.svelte';

	const programId = $derived(page.params.programId ?? '');
	const dagNummer = $derived(parseInt(page.params.dag ?? '', 10));

	let programData = $state<ProgramMedDage | null>(null);
	let alleOvelser = $state<Exercise[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);

	let titel = $state('');
	let indledning = $state('');
	let exercises = $state<DayExercise[]>([]);
	let valgtNyOvelse = $state('');

	let gemStatus = $state<'klar' | 'gemmer' | 'gemt' | 'fejl'>('klar');
	let gemBesked = $state('');

	const totalSekunder = $derived(
		exercises.reduce((sum, ex) => sum + ex.sets * ex.workSec + (ex.sets - 1) * ex.restSec, 0)
	);
	const totalMinutter = $derived(Math.round(totalSekunder / 60));

	onMount(async () => {
		try {
			const [data, ovelser] = await Promise.all([
				hentMasterProgram(programId),
				hentAlleExercises()
			]);
			programData = data;
			alleOvelser = ovelser;
			if (!data) {
				fejl = 'Programmet kunne ikke findes.';
				return;
			}
			const dag = data.dage.find((d) => d.dagNummer === dagNummer);
			if (!dag) {
				fejl = `Dag ${dagNummer} kunne ikke findes.`;
				return;
			}
			titel = dag.titel ?? '';
			indledning = dag.indledning ?? '';
			exercises = dag.exercises.map((e) => ({ ...e }));
		} catch (e) {
			fejl = 'Kunne ikke hente data.';
			console.error(e);
		} finally {
			loading = false;
		}
	});

	function ovelseNavn(exerciseId: string): string {
		return alleOvelser.find((e) => e.id === exerciseId)?.name ?? exerciseId;
	}

	function tilfoejOvelse() {
		if (!valgtNyOvelse) return;
		exercises = [
			...exercises,
			{
				exerciseId: valgtNyOvelse,
				sets: 3,
				workSec: 30,
				restSec: 10,
				bonus: false
			}
		];
		valgtNyOvelse = '';
	}

	function slet(index: number) {
		exercises = exercises.filter((_, i) => i !== index);
	}

	function flytOp(index: number) {
		if (index === 0) return;
		const nye = [...exercises];
		[nye[index - 1], nye[index]] = [nye[index], nye[index - 1]];
		exercises = nye;
	}

	function flytNed(index: number) {
		if (index === exercises.length - 1) return;
		const nye = [...exercises];
		[nye[index], nye[index + 1]] = [nye[index + 1], nye[index]];
		exercises = nye;
	}

	async function gem() {
		if (!programData) return;
		gemStatus = 'gemmer';
		gemBesked = '';
		try {
			const dag: TrainingDay = {
				dagNummer,
				titel,
				indledning,
				exercises
			};
			await gemMasterDag(programId, dagNummer, dag);
			gemStatus = 'gemt';
			gemBesked = 'Gemt.';
		} catch (e) {
			gemStatus = 'fejl';
			gemBesked = e instanceof Error ? e.message : 'Kunne ikke gemme.';
			console.error(e);
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin/programmer/{programId}">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Program</span>
		</a>
		<div class="eyebrow">Admin · Dag {dagNummer}</div>
		<h1>Rediger dag</h1>
		{#if programData}
			<p class="page-sub">{programData.program.navn}</p>
		{/if}
	</header>

	{#if loading}
		<div class="status-besked">Henter dag...</div>
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else}
		<section class="card">
			<label class="label">
				Titel (valgfri)
				<input class="input" type="text" bind:value={titel} placeholder="fx Overkrop" />
			</label>
			<label class="label">
				Indledning (valgfri)
				<textarea
					class="input"
					rows="2"
					bind:value={indledning}
					placeholder="Kort beskrivelse af dagen..."
				></textarea>
			</label>
		</section>

		<section class="card">
			<div class="card-head">
				<div class="section-label">Øvelser ({exercises.length})</div>
				<div class="meta">~{totalMinutter} min</div>
			</div>

			{#if exercises.length === 0}
				<div class="status-besked tom">Ingen øvelser endnu. Tilføj én nedenfor.</div>
			{:else}
				<div class="ovelse-liste">
					{#each exercises as ex, i (i)}
						<article class="ovelse-row">
							<div class="ovelse-head">
								<div class="ovelse-num">{i + 1}</div>
								<div class="ovelse-navn">{ovelseNavn(ex.exerciseId)}</div>
								<div class="ovelse-actions">
									<button
										class="icon-btn"
										type="button"
										aria-label="Flyt op"
										disabled={i === 0}
										onclick={() => flytOp(i)}>↑</button
									>
									<button
										class="icon-btn"
										type="button"
										aria-label="Flyt ned"
										disabled={i === exercises.length - 1}
										onclick={() => flytNed(i)}>↓</button
									>
									<button
										class="icon-btn slet"
										type="button"
										aria-label="Slet"
										onclick={() => slet(i)}>×</button
									>
								</div>
							</div>
							<div class="ovelse-fields">
								<label class="field">
									<span>Sæt</span>
									<input class="input sm" type="number" min="1" max="10" bind:value={ex.sets} />
								</label>
								<label class="field">
									<span>Arbejde (s)</span>
									<input class="input sm" type="number" min="5" max="300" bind:value={ex.workSec} />
								</label>
								<label class="field">
									<span>Hvile (s)</span>
									<input class="input sm" type="number" min="0" max="120" bind:value={ex.restSec} />
								</label>
								<label class="field bonus-toggle">
									<input type="checkbox" bind:checked={ex.bonus} />
									<span>Bonus</span>
								</label>
							</div>
						</article>
					{/each}
				</div>
			{/if}

			<div class="tilfoej-rad">
				<select class="input select" bind:value={valgtNyOvelse}>
					<option value="">Vælg en øvelse...</option>
					{#each alleOvelser as ovelse (ovelse.id)}
						<option value={ovelse.id}>{ovelse.name} ({ovelse.catLabel})</option>
					{/each}
				</select>
				<button class="btn" type="button" onclick={tilfoejOvelse} disabled={!valgtNyOvelse}>
					Tilføj
				</button>
			</div>
		</section>

		<button
			class="btn primary gem-btn"
			type="button"
			onclick={gem}
			disabled={gemStatus === 'gemmer'}
		>
			{gemStatus === 'gemmer' ? 'Gemmer...' : 'Gem dag'}
		</button>
		{#if gemStatus === 'gemt'}
			<div class="besked ok">{gemBesked}</div>
		{:else if gemStatus === 'fejl'}
			<div class="besked fejl">{gemBesked}</div>
		{/if}
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

	.status-besked {
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
		text-align: center;
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

	.card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 16px;
		margin-bottom: 14px;
	}

	.card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12px;
	}

	.section-label {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.meta {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.label {
		display: block;
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text2);
		margin-bottom: 12px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.label:last-child {
		margin-bottom: 0;
	}

	.input {
		display: block;
		width: 100%;
		margin-top: 6px;
		padding: 10px 12px;
		font-size: calc(13px * var(--fs-scale, 1));
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--white);
		color: var(--text);
		font-family: var(--ff-b);
		text-transform: none;
		letter-spacing: normal;
		font-weight: 400;
	}

	.input:focus {
		outline: none;
		border-color: var(--terra);
	}

	.input.sm {
		padding: 6px 8px;
		font-size: calc(12px * var(--fs-scale, 1));
		margin-top: 4px;
	}

	.input.select {
		flex: 1;
		margin-top: 0;
	}

	.ovelse-liste {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-bottom: 14px;
	}

	.ovelse-row {
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 10px 12px;
		background: var(--white);
	}

	.ovelse-head {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 8px;
	}

	.ovelse-num {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--bg2);
		color: var(--text2);
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.ovelse-navn {
		flex: 1;
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.ovelse-actions {
		display: flex;
		gap: 4px;
		flex-shrink: 0;
	}

	.icon-btn {
		width: 26px;
		height: 26px;
		border-radius: 6px;
		border: 1px solid var(--border);
		background: var(--white);
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--ff-b);
	}

	.icon-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.icon-btn:hover:not(:disabled) {
		background: var(--bg2);
	}

	.icon-btn.slet {
		color: #b8665a;
	}

	.ovelse-fields {
		display: grid;
		grid-template-columns: repeat(3, 1fr) auto;
		gap: 8px;
	}

	.field {
		display: flex;
		flex-direction: column;
		font-size: calc(10px * var(--fs-scale, 1));
		color: var(--text3);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-weight: 600;
	}

	.field.bonus-toggle {
		flex-direction: row;
		align-items: center;
		gap: 4px;
		text-transform: none;
		letter-spacing: normal;
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 500;
		color: var(--text2);
	}

	.field.bonus-toggle input {
		margin: 0;
	}

	.tilfoej-rad {
		display: flex;
		gap: 8px;
		align-items: stretch;
	}

	.btn {
		padding: 10px 14px;
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 8px;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text);
		cursor: pointer;
		font-family: var(--ff-b);
		white-space: nowrap;
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

	.btn:hover:not(:disabled) {
		filter: brightness(0.95);
	}

	.gem-btn {
		display: block;
		width: 100%;
		padding: 14px;
		font-size: calc(14px * var(--fs-scale, 1));
	}

	.besked {
		margin-top: 10px;
		padding: 8px 12px;
		border-radius: 10px;
		font-size: calc(12px * var(--fs-scale, 1));
		text-align: center;
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
</style>
