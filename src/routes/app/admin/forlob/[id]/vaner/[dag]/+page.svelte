<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { Bonus, Vane, VaneProgramDag } from '$lib/content/vaner';
	import { gemVaneprogramDag, hentVaneprogramDag } from '$lib/firestore/vaner';
	import Icon from '$lib/components/Icon.svelte';

	const forlobId = $derived(page.params.id ?? '');
	const dagNummer = $derived(parseInt(page.params.dag ?? '', 10));

	let dag = $state<VaneProgramDag | null>(null);
	let formReflection = $state('');
	let formUge = $state(1);
	let formIsCheckin = $state(false);
	let formIsBaseline = $state(false);
	let formIsWin = $state(false);
	let formChecks = $state<Vane[]>([]);
	let formBonus = $state<Bonus | null>(null);

	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let gemmer = $state(false);
	let gemFejl = $state<string | null>(null);
	let gemKvit = $state(false);

	onMount(async () => {
		try {
			const fundet = await hentVaneprogramDag(forlobId, dagNummer);
			if (!fundet) {
				fejl = `Dag ${dagNummer} findes ikke i programmet.`;
				loading = false;
				return;
			}
			dag = fundet;
			formReflection = fundet.reflection;
			formUge = fundet.uge;
			formIsCheckin = fundet.isCheckin;
			formIsBaseline = fundet.isBaseline;
			formIsWin = fundet.isWin;
			formChecks = fundet.checks.map((c) => ({ ...c }));
			formBonus = fundet.bonus ? { ...fundet.bonus } : null;
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente dagen.';
		} finally {
			loading = false;
		}
	});

	function tilfoejVane() {
		const nyId = `vane${formChecks.length + 1}_${Date.now().toString(36).slice(-4)}`;
		formChecks = [...formChecks, { id: nyId, label: '' }];
	}

	function fjernVane(index: number) {
		formChecks = formChecks.filter((_, i) => i !== index);
	}

	function aktiverBonus() {
		if (!formBonus) {
			formBonus = { id: `b${dagNummer}`, label: '' };
		}
	}

	function fjernBonus() {
		formBonus = null;
	}

	async function gem() {
		gemFejl = null;
		gemKvit = false;
		gemmer = true;
		try {
			const renseChecks = formChecks
				.map((c) => ({ id: c.id.trim(), label: c.label.trim() }))
				.filter((c) => c.id && c.label);
			const renseBonus =
				formBonus && formBonus.id.trim() && formBonus.label.trim()
					? { id: formBonus.id.trim(), label: formBonus.label.trim() }
					: null;

			const opdateret: VaneProgramDag = {
				dagNummer,
				uge: formUge,
				reflection: formReflection.trim(),
				checks: renseChecks,
				bonus: renseBonus,
				isCheckin: formIsCheckin,
				isBaseline: formIsBaseline,
				isWin: formIsWin
			};

			await gemVaneprogramDag(forlobId, opdateret);
			dag = opdateret;
			gemKvit = true;
			setTimeout(() => (gemKvit = false), 2000);
		} catch (e) {
			console.error(e);
			gemFejl = 'Kunne ikke gemme. Prøv igen.';
		} finally {
			gemmer = false;
		}
	}

	function tilbage() {
		goto(`/app/admin/forlob/${forlobId}/vaner`);
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin/forlob/{forlobId}/vaner">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Programdage</span>
		</a>
		<div class="eyebrow">Admin · {forlobId} · Vaner</div>
		<h1>{formIsBaseline ? 'Baseline' : `Dag ${dagNummer}`}</h1>
	</header>

	{#if loading}
		<div class="status-besked">Henter dagen...</div>
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if dag}
		<section class="card">
			<div class="form-titel">Generelt</div>

			<label class="felt">
				<span class="felt-label">Refleksionsspørgsmål</span>
				<textarea
					class="textarea"
					bind:value={formReflection}
					rows="3"
					disabled={gemmer}
					placeholder="Hvad skal brugeren reflektere over?"
				></textarea>
			</label>

			<div class="felt-rad">
				<label class="felt">
					<span class="felt-label">Uge</span>
					<input
						type="number"
						min="0"
						max="3"
						bind:value={formUge}
						disabled={gemmer || formIsBaseline}
					/>
				</label>
			</div>

			<div class="checkbox-gruppe">
				<label class="checkbox-rad">
					<input type="checkbox" bind:checked={formIsCheckin} disabled={gemmer} />
					<span>Check-in dag (5 sliders)</span>
				</label>
				<label class="checkbox-rad">
					<input type="checkbox" bind:checked={formIsBaseline} disabled={gemmer} />
					<span>Baseline-dag (dag 0)</span>
				</label>
				<label class="checkbox-rad">
					<input type="checkbox" bind:checked={formIsWin} disabled={gemmer} />
					<span>#win-dag</span>
				</label>
			</div>
		</section>

		<section class="card">
			<div class="form-titel">Faste vaner</div>
			<p class="hint">
				Brugeren svarer Ja / Delvist / Nej for hver vane. Brug korte ID'er (fx 'pm', 'fi') så
				de kan genanvendes på tværs af dage.
			</p>
			{#each formChecks as v, i (v.id)}
				<div class="check-form">
					<div class="check-form-rad">
						<input
							class="check-id"
							type="text"
							placeholder="id"
							bind:value={formChecks[i].id}
							disabled={gemmer}
						/>
						<input
							class="check-label-input"
							type="text"
							placeholder="Synlig label, fx 'Protein til morgenmad'"
							bind:value={formChecks[i].label}
							disabled={gemmer}
						/>
						<button
							class="ikon-knap"
							type="button"
							onclick={() => fjernVane(i)}
							disabled={gemmer}
							aria-label="Fjern vane"
						>
							×
						</button>
					</div>
				</div>
			{/each}
			<button class="ghost-knap" type="button" onclick={tilfoejVane} disabled={gemmer}>
				+ Tilføj vane
			</button>
		</section>

		<section class="card">
			<div class="form-titel">Bonus-skridt</div>
			{#if formBonus}
				<div class="check-form">
					<div class="check-form-rad">
						<input
							class="check-id"
							type="text"
							placeholder="id"
							bind:value={formBonus.id}
							disabled={gemmer}
						/>
						<input
							class="check-label-input"
							type="text"
							placeholder="Bonus-spørgsmål"
							bind:value={formBonus.label}
							disabled={gemmer}
						/>
						<button
							class="ikon-knap"
							type="button"
							onclick={fjernBonus}
							disabled={gemmer}
							aria-label="Fjern bonus"
						>
							×
						</button>
					</div>
				</div>
			{:else}
				<button class="ghost-knap" type="button" onclick={aktiverBonus} disabled={gemmer}>
					+ Tilføj bonus
				</button>
			{/if}
		</section>

		{#if gemFejl}
			<div class="fejl-besked">{gemFejl}</div>
		{/if}
		{#if gemKvit}
			<div class="kvit-besked">Gemt ✓</div>
		{/if}

		<div class="bund-knapper">
			<button class="form-knap ghost" type="button" onclick={tilbage} disabled={gemmer}>
				Annuller
			</button>
			<button class="form-knap primary" type="button" onclick={gem} disabled={gemmer}>
				{gemmer ? 'Gemmer...' : 'Gem dag'}
			</button>
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

	.card {
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
		font-size: calc(16px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.hint {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin: 0 0 6px;
		line-height: 1.45;
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
	.textarea {
		padding: 10px 12px;
		font-size: calc(14px * var(--fs-scale, 1));
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-b);
		outline: none;
	}

	.textarea {
		resize: vertical;
		line-height: 1.5;
	}

	.felt input:focus,
	.textarea:focus {
		border-color: var(--terra);
	}

	.felt-rad {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.checkbox-gruppe {
		display: flex;
		flex-direction: column;
		gap: 8px;
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

	.check-form {
		padding: 4px 0;
	}

	.check-form-rad {
		display: grid;
		grid-template-columns: 80px 1fr 32px;
		gap: 6px;
		align-items: center;
	}

	.check-id {
		font-family: ui-monospace, monospace;
		font-size: calc(12px * var(--fs-scale, 1));
	}

	.check-label-input {
		font-size: calc(13px * var(--fs-scale, 1));
	}

	.ikon-knap {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		background: var(--bg2);
		border: 1px solid var(--border);
		color: var(--text3);
		font-size: calc(18px * var(--fs-scale, 1));
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.ikon-knap:hover {
		background: #fbeeea;
		color: #8a4a3e;
	}

	.ghost-knap {
		padding: 10px 14px;
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 500;
		border-radius: 10px;
		background: var(--bg2);
		border: 1px dashed var(--border);
		color: var(--text2);
		cursor: pointer;
		font-family: var(--ff-b);
		align-self: flex-start;
	}

	.ghost-knap:hover {
		background: var(--white);
		border-color: var(--terra);
		color: var(--terra);
	}

	.fejl-besked {
		padding: 10px 12px;
		background: #fbeeea;
		border: 1px solid #f0d6cf;
		border-radius: 8px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: #8a4a3e;
		margin-bottom: 12px;
	}

	.kvit-besked {
		padding: 8px 12px;
		background: var(--sdim);
		border-radius: 8px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--sage);
		text-align: center;
		margin-bottom: 12px;
	}

	.bund-knapper {
		display: grid;
		grid-template-columns: 1fr 1.4fr;
		gap: 10px;
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
</style>
