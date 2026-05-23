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
	let gemmer = $state(false);
	let formFejl = $state<string | null>(null);

	async function indlaes() {
		loading = true;
		fejl = null;
		try {
			const [f, v] = await Promise.all([
				hentForlob(forlobId),
				hentAdminVanerForForlob(forlobId)
			]);
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
			const ny = await tilfoejAdminVane(forlobId, label, adminUser.uid);
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
			Vaner du tildeler her får alle deltagere på {forlob?.navn ?? 'forløbet'} oveni deres
			egne 3 selvvalgte vaner. Kunden kan ikke fjerne dem fra sin opsætning.
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
				<div class="liste">
					{#each vaner as v (v.id)}
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
			{/if}

			<div class="tilfoj-form">
				<label class="felt">
					<span class="felt-label">Tilføj ny vane</span>
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
		margin-bottom: 8px;
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
		margin-bottom: 16px;
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
	}

	.felt {
		display: block;
		margin-bottom: 10px;
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
