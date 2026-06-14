<script lang="ts">
	// Små skridt-fane på en forløbsdag. Små skridt (tidl. "tildelte vaner") ligger
	// pr UGE — så denne fane viser ugens skridt for den uge dagen tilhører.
	// Redigering gælder hele ugen (alle 7 dage). Baseline (dag 0) har ingen uge.
	import { getContext } from 'svelte';
	import type { User } from 'firebase/auth';
	import BekraeftModal from '$lib/components/BekraeftModal.svelte';
	import {
		hentAdminVanerForForlob,
		sletAdminVane,
		tilfoejAdminVane,
		type AdminTildeltVane
	} from '$lib/firestore/admintildelteVaner';

	let { forlobId, uge }: { forlobId: string; uge: number } = $props();

	const getUser = getContext<() => User | null>('user');
	const adminUser = $derived(getUser());

	let vaner = $state<AdminTildeltVane[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let nyLabel = $state('');
	let gemmer = $state(false);
	let formFejl = $state<string | null>(null);

	const ugeSkridt = $derived(vaner.filter((v) => v.ugeNummer === uge));
	const altidAktive = $derived(vaner.filter((v) => v.ugeNummer === undefined));

	$effect(() => {
		indlaes(forlobId);
	});

	async function indlaes(fid: string) {
		loading = true;
		fejl = null;
		try {
			vaner = await hentAdminVanerForForlob(fid);
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente små skridt.';
		} finally {
			loading = false;
		}
	}

	async function tilfoej() {
		const label = nyLabel.trim();
		if (!label) {
			formFejl = 'Skriv et lille skridt først.';
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
			const ny = await tilfoejAdminVane(forlobId, label, adminUser.uid, uge);
			vaner = [...vaner, ny];
			nyLabel = '';
		} catch (e) {
			console.error(e);
			formFejl = 'Kunne ikke gemme.';
		} finally {
			gemmer = false;
		}
	}

	let sletVane = $state<AdminTildeltVane | null>(null);
	let sletter = $state(false);
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
			fejl = 'Kunne ikke slette.';
		} finally {
			sletter = false;
		}
	}
</script>

{#if fejl}
	<div class="status-besked fejl">{fejl}</div>
{/if}

{#if loading}
	<div class="status-besked">Henter…</div>
{:else if uge === 0}
	<div class="status-besked">
		Små skridt tilknyttes en uge. Baseline-dagen (dag 0) hører ikke til en uge, så her er der ingen
		små skridt.
	</div>
{:else}
	<section class="card">
		<div class="card-titel">Små skridt — uge {uge}</div>
		<p class="hint">
			Gælder hele uge {uge} (alle 7 dage). Deltagerne får dem oveni deres egne 3 selvvalgte.
		</p>
		{#if ugeSkridt.length === 0}
			<p class="hint">Ingen små skridt for uge {uge} endnu.</p>
		{:else}
			<div class="liste">
				{#each ugeSkridt as v (v.id)}
					<div class="rad">
						<div class="rad-tekst">{v.label}</div>
						<button
							type="button"
							class="fjern-knap"
							onclick={() => (sletVane = v)}
							aria-label="Slet"
						>
							Slet
						</button>
					</div>
				{/each}
			</div>
		{/if}

		<div class="tilfoj-form">
			<label class="felt">
				<span class="felt-label">Tilføj lille skridt (uge {uge})</span>
				<input
					type="text"
					bind:value={nyLabel}
					placeholder="Fx 'Drik 2 liter vand'"
					maxlength="80"
					disabled={gemmer}
				/>
			</label>
			{#if formFejl}
				<div class="form-fejl">{formFejl}</div>
			{/if}
			<button
				type="button"
				class="primary-knap"
				onclick={tilfoej}
				disabled={gemmer || !nyLabel.trim()}
			>
				{gemmer ? 'Gemmer…' : 'Tilføj'}
			</button>
		</div>
	</section>

	{#if altidAktive.length > 0}
		<section class="card">
			<div class="card-titel">Altid aktive (alle uger)</div>
			<div class="liste">
				{#each altidAktive as v (v.id)}
					<div class="rad">
						<div class="rad-tekst">{v.label}</div>
						<button
							type="button"
							class="fjern-knap"
							onclick={() => (sletVane = v)}
							aria-label="Slet"
						>
							Slet
						</button>
					</div>
				{/each}
			</div>
		</section>
	{/if}
{/if}

{#if sletVane}
	<BekraeftModal
		titel={'Slet "' + sletVane.label + '"?'}
		beskrivelse="Fjernes for alle deltagere på forløbet og kan ikke gendannes."
		bekraeftTekst="Slet"
		destruktiv
		arbejder={sletter}
		onBekraeft={() => void slet()}
		onAnnuller={() => (sletVane = null)}
	/>
{/if}

<style>
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
		margin-bottom: 14px;
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
		margin-top: 12px;
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

	.felt input {
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

	.felt input:focus {
		border-color: var(--terra);
	}

	.form-fejl {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: #8a4a3e;
		margin: 10px 0;
	}

	.primary-knap {
		display: block;
		width: 100%;
		padding: 12px;
		margin-top: 10px;
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
