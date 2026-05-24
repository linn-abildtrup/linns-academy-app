<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { page } from '$app/state';
	import Icon from '$lib/components/Icon.svelte';
	import BekraeftModal from '$lib/components/BekraeftModal.svelte';
	import { hentForlob } from '$lib/firestore/forlob';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import {
		hentAdminVanerForForlob,
		sletAdminVane,
		tilfoejAdminVane,
		type AdminTildeltVane
	} from '$lib/firestore/admintildelteVaner';

	const getUser = getContext<() => User | null>('user');
	const adminUser = $derived(getUser());

	const forlobId = $derived(page.params.id ?? '');

	let forlob = $state<Forlob | null>(null);
	let vaner = $state<AdminTildeltVane[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);

	let nyLabel = $state('');
	let nyUgeNummer = $state<number | null>(null); // null = altid aktiv (bagudkompat)
	let gemmer = $state(false);
	let formFejl = $state<string | null>(null);

	const antalUger = $derived(forlob ? Math.max(1, Math.ceil(forlob.antalDage / 7)) : 1);

	// Grupperer vaner: én bucket pr uge + én "altid aktiv"-bucket for vaner uden ugeNummer.
	const grupper = $derived.by<{ ugeNummer: number | null; label: string; vaner: AdminTildeltVane[] }[]>(() => {
		const altidAktive = vaner.filter((v) => v.ugeNummer === undefined);
		const grupper: { ugeNummer: number | null; label: string; vaner: AdminTildeltVane[] }[] = [];
		for (let u = 1; u <= antalUger; u++) {
			const v = vaner.filter((x) => x.ugeNummer === u);
			grupper.push({ ugeNummer: u, label: `Uge ${u}`, vaner: v });
		}
		if (altidAktive.length > 0) {
			grupper.push({ ugeNummer: null, label: 'Altid aktive (uden uge-tilknytning)', vaner: altidAktive });
		}
		return grupper;
	});

	const VANER_PR_UGE_BLOED_GRAENSE = 5;

	async function indlaes() {
		loading = true;
		fejl = null;
		try {
			const [f, v] = await Promise.all([hentForlob(forlobId), hentAdminVanerForForlob(forlobId)]);
			forlob = f;
			vaner = v;
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente vaner.';
		} finally {
			loading = false;
		}
	}

	onMount(indlaes);

	async function tilfoej() {
		const label = nyLabel.trim();
		if (!label) {
			formFejl = 'Skriv en vane først.';
			return;
		}
		if (label.length > 80) {
			formFejl = 'Højst 80 tegn.';
			return;
		}
		if (!adminUser || gemmer) return;
		gemmer = true;
		formFejl = null;
		try {
			const ny = await tilfoejAdminVane(forlobId, label, adminUser.uid, nyUgeNummer ?? undefined);
			vaner = [...vaner, ny];
			nyLabel = '';
		} catch (e) {
			console.error(e);
			formFejl = 'Kunne ikke gemme vanen.';
		} finally {
			gemmer = false;
		}
	}

	let sletVane = $state<AdminTildeltVane | null>(null);
	let sletter = $state(false);
	function aabnSletBekraeft(v: AdminTildeltVane) {
		sletVane = v;
	}
	async function slet() {
		const v = sletVane;
		if (!v) return;
		sletter = true;
		try {
			await sletAdminVane(forlobId, v.id);
			vaner = vaner.filter((x) => x.id !== v.id);
			sletVane = null;
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke slette vanen.';
		} finally {
			sletter = false;
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin/forlob/{forlobId}">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Forløb</span>
		</a>
		<div class="eyebrow">Admin · Tildelte vaner</div>
		<h1>Tildelte vaner</h1>
		<p class="page-sub">
			Vaner du tildeler her får alle deltagere på {forlob?.navn ?? 'forløbet'} oveni deres egne 3
			selvvalgte vaner. Vælg hvilken uge vanen gælder for, eller lad den være altid aktiv.
		</p>
	</header>

	{#if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{/if}

	{#if loading}
		<div class="status-besked">Henter…</div>
	{:else}
		<section class="card">
			<div class="card-titel">Vaner på forløbet</div>
			{#if vaner.length === 0}
				<p class="hint">Ingen tildelte vaner endnu. Tilføj den første nedenfor.</p>
			{:else}
				{#each grupper as gruppe (gruppe.ugeNummer ?? 'altid')}
					{#if gruppe.vaner.length > 0}
						<div class="gruppe">
							<div class="gruppe-header">
								<span class="gruppe-titel">{gruppe.label}</span>
								<span
									class="gruppe-count"
									class:overskredet={gruppe.ugeNummer !== null &&
										gruppe.vaner.length > VANER_PR_UGE_BLOED_GRAENSE}
								>
									{gruppe.vaner.length}
									{gruppe.vaner.length === 1 ? 'vane' : 'vaner'}
									{#if gruppe.ugeNummer !== null && gruppe.vaner.length > VANER_PR_UGE_BLOED_GRAENSE}
										· over anbefalet ({VANER_PR_UGE_BLOED_GRAENSE})
									{/if}
								</span>
							</div>
							<div class="liste">
								{#each gruppe.vaner as v (v.id)}
									<div class="rad">
										<div class="rad-tekst">{v.label}</div>
										<button
											type="button"
											class="fjern-knap"
											onclick={() => aabnSletBekraeft(v)}
											aria-label="Slet vane"
										>
											Slet
										</button>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				{/each}
			{/if}

			<div class="tilfoj-form">
				<div class="form-grid">
					<label class="felt felt-label-stor">
						<span class="felt-label">Tilføj ny vane</span>
						<input
							type="text"
							bind:value={nyLabel}
							placeholder="Fx 'Drik 2 liter vand'"
							maxlength="80"
							disabled={gemmer}
						/>
					</label>
					<label class="felt felt-uge">
						<span class="felt-label">Uge</span>
						<select bind:value={nyUgeNummer} disabled={gemmer}>
							<option value={null}>Altid</option>
							{#each Array.from({ length: antalUger }, (_, i) => i + 1) as u (u)}
								<option value={u}>Uge {u}</option>
							{/each}
						</select>
					</label>
				</div>
				{#if formFejl}
					<div class="form-fejl">{formFejl}</div>
				{/if}
				<button
					type="button"
					class="primary-knap"
					onclick={tilfoej}
					disabled={gemmer || !nyLabel.trim()}
				>
					{gemmer ? 'Gemmer…' : 'Tilføj vane'}
				</button>
			</div>
		</section>
	{/if}
</div>

{#if sletVane}
	<BekraeftModal
		titel={'Slet vanen "' + sletVane.label + '"?'}
		beskrivelse="Vanen fjernes for alle deltagere på forløbet og kan ikke gendannes."
		bekraeftTekst="Slet"
		destruktiv
		arbejder={sletter}
		onBekraeft={() => void slet()}
		onAnnuller={() => (sletVane = null)}
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
	}

	.card-titel {
		font-size: calc(15px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		margin-bottom: 12px;
	}

	.hint {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		margin: 0 0 12px;
	}

	.gruppe {
		margin-bottom: 14px;
	}

	.gruppe-header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 6px;
		gap: 8px;
	}

	.gruppe-titel {
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.gruppe-count {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.gruppe-count.overskredet {
		color: #8a4a3e;
	}

	.liste {
		border: 1px solid var(--border);
		border-radius: 10px;
		overflow: hidden;
	}

	.rad {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		border-top: 1px solid var(--border);
	}

	.rad:first-child {
		border-top: none;
	}

	.rad-tekst {
		flex: 1;
		font-size: calc(14px * var(--fs-scale, 1));
		color: var(--text);
	}

	.fjern-knap {
		padding: 6px 12px;
		background: transparent;
		border: 1px solid var(--border);
		color: var(--text2);
		border-radius: 8px;
		font-size: calc(12px * var(--fs-scale, 1));
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.fjern-knap:hover {
		background: var(--bg2);
	}

	.tilfoj-form {
		padding-top: 14px;
		border-top: 1px dashed var(--border);
		margin-top: 8px;
	}

	.form-grid {
		display: grid;
		grid-template-columns: 1fr 110px;
		gap: 10px;
		margin-bottom: 10px;
	}

	.felt {
		display: block;
	}

	.felt-label {
		display: block;
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text3);
		margin-bottom: 4px;
	}

	.felt input,
	.felt select {
		width: 100%;
		padding: 10px 12px;
		font-size: calc(15px * var(--fs-scale, 1));
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-b);
		outline: none;
		box-sizing: border-box;
	}

	.felt input:focus,
	.felt select:focus {
		border-color: var(--terra);
	}

	.form-fejl {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: #8a4a3e;
		margin-bottom: 10px;
	}

	.primary-knap {
		display: block;
		width: 100%;
		padding: 12px;
		background: var(--terra);
		color: #fff;
		border: none;
		border-radius: 10px;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.primary-knap:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
