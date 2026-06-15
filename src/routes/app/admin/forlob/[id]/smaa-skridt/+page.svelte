<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { page } from '$app/state';
	import Icon from '$lib/components/Icon.svelte';
	import BekraeftModal from '$lib/components/BekraeftModal.svelte';
	import { hentForlob } from '$lib/firestore/forlob';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import {
		hentSmaaSkridt,
		opretSmaaSkridt,
		opdaterSmaaSkridt,
		sletSmaaSkridt,
		synkSmaaSkridtTilDage
	} from '$lib/firestore/smaaSkridt';
	import {
		dageForPlan,
		planTekst,
		UGEDAGS_NAVNE,
		type SmaaSkridt,
		type SmaaSkridtPlan
	} from '$lib/content/smaaSkridt';

	const getUser = getContext<() => User | null>('user');
	const adminUser = $derived(getUser());
	const forlobId = $derived(page.params.id ?? '');

	let forlob = $state<Forlob | null>(null);
	let skridt = $state<SmaaSkridt[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);

	const antalUger = $derived(forlob ? Math.max(1, Math.ceil(forlob.antalDage / 7)) : 1);

	// Form-tilstand (bruges både til "ny" og "rediger")
	let redigererId = $state<string | null>(null);
	let formLabel = $state('');
	let formMode = $state<'alle' | 'uger' | 'interval' | 'ugedage' | 'dage'>('alle');
	let formUger = $state<number[]>([]);
	let formUgedage = $state<number[]>([]);
	let formFra = $state(1);
	let formTil = $state(7);
	let formTilSlut = $state(false);
	let formDageTekst = $state('');
	let gemmer = $state(false);
	let formFejl = $state<string | null>(null);

	// Parser "5, 8, 12" → [5, 8, 12] (gyldige dagnumre, unikke, sorterede).
	function parseDage(): number[] {
		const max = forlob?.antalDage ?? 0;
		const tal = formDageTekst
			.split(/[\s,]+/)
			.map((s) => parseInt(s, 10))
			.filter((n) => Number.isInteger(n) && n >= 1 && n <= max);
		return [...new Set(tal)].sort((a, b) => a - b);
	}

	function byggPlan(): SmaaSkridtPlan {
		if (formMode === 'uger') return { type: 'uger', uger: [...formUger] };
		if (formMode === 'ugedage') return { type: 'ugedage', ugedage: [...formUgedage] };
		if (formMode === 'interval')
			return { type: 'interval', fra: formFra, til: formTilSlut ? null : formTil };
		if (formMode === 'dage') return { type: 'dage', dage: parseDage() };
		return { type: 'alle' };
	}

	// Live-preview: hvor mange dage rammer den aktuelle plan?
	const ramteDage = $derived(
		forlob ? dageForPlan(byggPlan(), forlob.antalDage, forlob.startDato.toDate()) : []
	);

	function toggle(arr: number[], n: number): number[] {
		return arr.includes(n) ? arr.filter((x) => x !== n) : [...arr, n];
	}

	function nulstilForm() {
		redigererId = null;
		formLabel = '';
		formMode = 'alle';
		formUger = [];
		formUgedage = [];
		formFra = 1;
		formTil = 7;
		formTilSlut = false;
		formDageTekst = '';
		formFejl = null;
	}

	function startRediger(s: SmaaSkridt) {
		redigererId = s.id;
		formLabel = s.label;
		formMode = s.plan.type;
		formUger = s.plan.type === 'uger' ? [...s.plan.uger] : [];
		formUgedage = s.plan.type === 'ugedage' ? [...s.plan.ugedage] : [];
		formFra = s.plan.type === 'interval' ? s.plan.fra : 1;
		formTil = s.plan.type === 'interval' ? (s.plan.til ?? 7) : 7;
		formTilSlut = s.plan.type === 'interval' ? s.plan.til == null : false;
		formDageTekst = s.plan.type === 'dage' ? s.plan.dage.join(', ') : '';
		formFejl = null;
		if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	async function gem() {
		const label = formLabel.trim();
		if (!label) {
			formFejl = 'Skriv et lille skridt først.';
			return;
		}
		const plan = byggPlan();
		if (plan.type === 'uger' && plan.uger.length === 0) {
			formFejl = 'Vælg mindst én uge.';
			return;
		}
		if (plan.type === 'ugedage' && plan.ugedage.length === 0) {
			formFejl = 'Vælg mindst én ugedag.';
			return;
		}
		if (plan.type === 'interval' && !formTilSlut && formTil < formFra) {
			formFejl = '"Til"-dagen skal være efter "fra"-dagen.';
			return;
		}
		if (plan.type === 'dage' && plan.dage.length === 0) {
			formFejl = 'Skriv mindst ét gyldigt dagnummer.';
			return;
		}
		if (!adminUser || gemmer || !forlob) return;
		gemmer = true;
		formFejl = null;
		try {
			if (redigererId) {
				await opdaterSmaaSkridt(forlobId, redigererId, label, plan);
			} else {
				await opretSmaaSkridt(forlobId, label, plan, adminUser.uid);
			}
			skridt = await hentSmaaSkridt(forlobId);
			publResultat = null;
			nulstilForm();
		} catch (e) {
			console.error(e);
			formFejl = 'Kunne ikke gemme. Prøv igen.';
		} finally {
			gemmer = false;
		}
	}

	let sletKandidat = $state<SmaaSkridt | null>(null);
	let sletter = $state(false);
	let publicerer = $state(false);
	let publResultat = $state<string | null>(null);

	// Manuel publicering: skriver alle små skridt ind i dag-systemet, så kunderne
	// ser dem. Kører IKKE automatisk ved gem — admin bestemmer hvornår det går live.
	async function publicer() {
		if (!forlob || publicerer) return;
		publicerer = true;
		publResultat = null;
		try {
			const n = await synkSmaaSkridtTilDage(forlobId, forlob.antalDage, forlob.startDato.toDate());
			publResultat = `Publiceret ✓ — opdaterede ${n} dag${n === 1 ? '' : 'e'}.`;
		} catch (e) {
			console.error(e);
			publResultat = 'Kunne ikke publicere. Prøv igen.';
		} finally {
			publicerer = false;
		}
	}

	async function slet() {
		const s = sletKandidat;
		if (!s) return;
		sletter = true;
		try {
			await sletSmaaSkridt(forlobId, s.id);
			skridt = skridt.filter((x) => x.id !== s.id);
			publResultat = null;
			if (redigererId === s.id) nulstilForm();
			sletKandidat = null;
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke slette.';
		} finally {
			sletter = false;
		}
	}

	function antalDageForSkridt(s: SmaaSkridt): number {
		if (!forlob) return 0;
		return dageForPlan(s.plan, forlob.antalDage, forlob.startDato.toDate()).length;
	}

	onMount(async () => {
		try {
			const f = await hentForlob(forlobId);
			if (!f) {
				fejl = 'Forløbet findes ikke.';
				return;
			}
			forlob = f;
			skridt = await hentSmaaSkridt(forlobId);
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente data.';
		} finally {
			loading = false;
		}
	});
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin/forlob/{forlobId}">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>{forlob?.navn ?? 'Forløb'}</span>
		</a>
		<div class="eyebrow">Admin · {forlob?.navn ?? forlobId} · Små skridt</div>
		<h1>Små skridt</h1>
		<p class="page-sub">
			Tilføj et lille skridt og vælg hvilke dage det gælder. Det samme værktøj dækker både daglige
			vaner (alle dage) og uge-baserede skridt.
		</p>
	</header>

	{#if loading}
		<div class="status-besked">Henter...</div>
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if forlob}
		<!-- Form: ny / rediger -->
		<section class="form-card">
			<div class="form-titel">{redigererId ? 'Rediger lille skridt' : 'Nyt lille skridt'}</div>

			<label class="felt">
				<span class="felt-label">Tekst</span>
				<input
					type="text"
					bind:value={formLabel}
					placeholder="Fx 'Protein til morgenmad'"
					maxlength="120"
					disabled={gemmer}
				/>
			</label>

			<div class="felt">
				<span class="felt-label">Gælder</span>
				<div class="mode-toggle">
					{#each [['alle', 'Alle dage'], ['uger', 'Hele uger'], ['interval', 'Interval'], ['ugedage', 'Ugedage'], ['dage', 'Bestemte dage']] as [m, t] (m)}
						<button
							type="button"
							class="mode-knap"
							class:aktiv={formMode === m}
							onclick={() => (formMode = m as typeof formMode)}
							disabled={gemmer}
						>
							{t}
						</button>
					{/each}
				</div>
			</div>

			{#if formMode === 'uger'}
				<div class="chip-rad">
					{#each Array.from({ length: antalUger }, (_, i) => i + 1) as u (u)}
						<button
							type="button"
							class="chip"
							class:aktiv={formUger.includes(u)}
							onclick={() => (formUger = toggle(formUger, u))}
							disabled={gemmer}
						>
							Uge {u}
						</button>
					{/each}
				</div>
			{:else if formMode === 'ugedage'}
				<div class="chip-rad">
					{#each UGEDAGS_NAVNE as navn, i (navn)}
						<button
							type="button"
							class="chip"
							class:aktiv={formUgedage.includes(i + 1)}
							onclick={() => (formUgedage = toggle(formUgedage, i + 1))}
							disabled={gemmer}
						>
							{navn}
						</button>
					{/each}
				</div>
			{:else if formMode === 'interval'}
				<div class="interval-rad">
					<label class="felt felt-lille">
						<span class="felt-label">Fra dag</span>
						<input
							type="number"
							min="1"
							max={forlob.antalDage}
							bind:value={formFra}
							disabled={gemmer}
						/>
					</label>
					<label class="felt felt-lille">
						<span class="felt-label">Til dag</span>
						<input
							type="number"
							min="1"
							max={forlob.antalDage}
							bind:value={formTil}
							disabled={gemmer || formTilSlut}
						/>
					</label>
					<label class="checkbox-rad til-slut">
						<input type="checkbox" bind:checked={formTilSlut} disabled={gemmer} />
						<span>Til forløbets slut</span>
					</label>
				</div>
			{:else if formMode === 'dage'}
				<label class="felt">
					<span class="felt-label">Dagnumre (adskilt af komma)</span>
					<input
						type="text"
						bind:value={formDageTekst}
						placeholder="Fx 5, 8, 12"
						disabled={gemmer}
					/>
				</label>
			{/if}

			<div class="preview">
				Rammer <strong>{ramteDage.length}</strong> dag{ramteDage.length === 1 ? '' : 'e'}
				{#if ramteDage.length > 0 && ramteDage.length <= 14}
					· {ramteDage.map((d) => `dag ${d}`).join(', ')}
				{/if}
			</div>

			{#if formFejl}
				<div class="fejl-besked">{formFejl}</div>
			{/if}

			<div class="form-knapper">
				{#if redigererId}
					<button class="form-knap ghost" type="button" onclick={nulstilForm} disabled={gemmer}>
						Annuller
					</button>
				{/if}
				<button
					class="form-knap primary"
					type="button"
					onclick={gem}
					disabled={gemmer || !formLabel.trim()}
				>
					{gemmer ? 'Gemmer...' : redigererId ? 'Gem ændringer' : 'Tilføj lille skridt'}
				</button>
			</div>
		</section>

		<section class="publish-card">
			<div class="publish-tekst">
				<div class="publish-titel">Publicér til appen</div>
				<p class="publish-sub">
					Dine ændringer her er kun gemt som kladde. Først når du publicerer, skrives de små skridt
					ind på de rigtige dage og bliver synlige for kunderne (besvares Ja/Delvist/Nej).
				</p>
			</div>
			<button class="form-knap primary" type="button" onclick={publicer} disabled={publicerer}>
				{publicerer ? 'Publicerer…' : 'Publicér til appen'}
			</button>
			{#if publResultat}
				<div class="kvit-besked">{publResultat}</div>
			{/if}
		</section>

		<!-- Liste -->
		<section class="liste-card">
			<div class="form-head">
				<div class="form-titel">På dette forløb</div>
				<div class="form-tael">{skridt.length}</div>
			</div>

			{#if skridt.length === 0}
				<p class="muted">Ingen små skridt endnu. Tilføj det første ovenfor.</p>
			{:else}
				<div class="liste">
					{#each skridt as s (s.id)}
						<div class="rad" class:aktiv={redigererId === s.id}>
							<div class="rad-tekst">
								<div class="rad-label">{s.label}</div>
								<div class="rad-plan">
									{planTekst(s.plan)} · {antalDageForSkridt(s)} dage
								</div>
							</div>
							<div class="rad-knapper">
								<button type="button" class="mini-knap" onclick={() => startRediger(s)}>
									Rediger
								</button>
								<button type="button" class="mini-knap fare" onclick={() => (sletKandidat = s)}>
									Slet
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	{/if}
</div>

{#if sletKandidat}
	<BekraeftModal
		titel={'Slet "' + sletKandidat.label + '"?'}
		beskrivelse="Det lille skridt fjernes fra forløbet."
		bekraeftTekst="Slet"
		destruktiv
		arbejder={sletter}
		onBekraeft={() => void slet()}
		onAnnuller={() => (sletKandidat = null)}
	/>
{/if}

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 560px;
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

	.form-card,
	.liste-card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 16px;
		padding: 18px;
		display: flex;
		flex-direction: column;
		gap: 14px;
		margin-bottom: 14px;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
	}

	.form-titel {
		font-family: var(--ff-d);
		font-size: calc(16px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.form-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.form-tael {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		font-variant-numeric: tabular-nums;
	}

	.felt {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.felt-label {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.felt input {
		padding: 10px 12px;
		font-size: calc(14px * var(--fs-scale, 1));
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-b);
		outline: none;
		transition:
			border-color 0.12s ease,
			box-shadow 0.12s ease,
			background 0.12s ease;
	}

	.felt input:focus {
		border-color: var(--terra);
		background: var(--white);
		box-shadow: 0 0 0 3px var(--tdim);
	}

	.mode-toggle {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(84px, 1fr));
		gap: 6px;
	}

	.mode-knap {
		padding: 9px 6px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text2);
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.mode-knap:hover:not(:disabled) {
		border-color: var(--terra);
	}

	.mode-knap.aktiv {
		background: var(--tdim);
		border-color: var(--terra);
		color: var(--terra);
	}

	.chip-rad {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.chip {
		padding: 8px 12px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 99px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text2);
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.chip:hover:not(:disabled) {
		border-color: var(--terra);
	}

	.chip.aktiv {
		background: var(--terra);
		border-color: var(--terra);
		color: #fff;
	}

	.interval-rad {
		display: flex;
		align-items: flex-end;
		gap: 12px;
		flex-wrap: wrap;
	}

	.felt-lille {
		max-width: 110px;
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

	.til-slut {
		padding-bottom: 10px;
	}

	.preview {
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--text2);
		background: var(--bg2);
		border-radius: 10px;
		padding: 10px 12px;
		line-height: 1.4;
	}

	.preview strong {
		color: var(--terra);
	}

	.fejl-besked {
		padding: 10px 12px;
		background: #fbeeea;
		border: 1px solid #f0d6cf;
		border-radius: 8px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: #8a4a3e;
	}

	.form-knapper {
		display: flex;
		gap: 10px;
	}

	.form-knap {
		flex: 1;
		padding: 12px;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 10px;
		border: none;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.form-knap.ghost {
		flex: 0 0 auto;
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

	.muted {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		margin: 0;
		font-style: italic;
	}

	.liste {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.rad {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		background: var(--bg2);
		border: 1px solid transparent;
		border-radius: 10px;
	}

	.rad.aktiv {
		border-color: var(--terra);
		background: var(--tdim);
	}

	.rad-tekst {
		flex: 1;
		min-width: 0;
	}

	.rad-label {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.rad-plan {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.rad-knapper {
		display: flex;
		gap: 6px;
		flex-shrink: 0;
	}

	.mini-knap {
		padding: 6px 11px;
		background: var(--white);
		border: 1px solid var(--border);
		color: var(--text2);
		border-radius: 8px;
		font-size: calc(12px * var(--fs-scale, 1));
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.mini-knap:hover {
		border-color: var(--terra);
		color: var(--terra);
	}

	.mini-knap.fare:hover {
		border-color: #e8c8c1;
		color: #b8503f;
		background: #fbeeea;
	}

	.publish-card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 16px;
		padding: 18px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-bottom: 24px;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
	}

	.publish-titel {
		font-family: var(--ff-d);
		font-size: calc(16px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		margin-bottom: 4px;
	}

	.publish-sub {
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--text3);
		line-height: 1.5;
		margin: 0;
	}

	.kvit-besked {
		padding: 8px 12px;
		background: var(--sdim);
		border-radius: 8px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--sage);
		text-align: center;
	}
</style>
