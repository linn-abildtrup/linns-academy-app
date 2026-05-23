<script lang="ts">
	import { onMount } from 'svelte';
	import {
		hentAlleModulbrugerLektioner,
		hentModulbrugerLektion,
		gemModulbrugerLektion,
		sletModulbrugerLektion
	} from '$lib/firestore/modulbrugerLektioner';
	import type { ModulbrugerLektion } from '$lib/content/modulbrugerLektioner';
	import { tomLektion } from '$lib/content/modulbrugerLektioner';
	import Icon from '$lib/components/Icon.svelte';
	import BekraeftModal from '$lib/components/BekraeftModal.svelte';
	import Loading from '$lib/components/Loading.svelte';

	let lektioner = $state<ModulbrugerLektion[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);

	let redigerer = $state<ModulbrugerLektion | null>(null);
	let viserOpretForm = $state(false);
	let nyDato = $state<string>(idagStr());
	let gemmer = $state(false);
	let sletter = $state<string | null>(null);

	function idagStr(): string {
		const d = new Date();
		const aar = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const dag = String(d.getDate()).padStart(2, '0');
		return `${aar}-${m}-${dag}`;
	}

	function visningsDato(dato: string): string {
		const [aar, m, d] = dato.split('-').map(Number);
		const dt = new Date(aar, m - 1, d);
		return dt.toLocaleDateString('da-DK', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	onMount(() => {
		void indlaes();
	});

	async function indlaes() {
		loading = true;
		fejl = null;
		try {
			lektioner = await hentAlleModulbrugerLektioner();
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente lektioner.';
		} finally {
			loading = false;
		}
	}

	async function aabnRediger(dato: string) {
		try {
			const eks = await hentModulbrugerLektion(dato);
			redigerer = eks ?? tomLektion(dato);
			viserOpretForm = false;
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente lektionen.';
		}
	}

	function aabnOpret() {
		nyDato = idagStr();
		viserOpretForm = true;
		redigerer = null;
	}

	function fortsaetOpret() {
		const eks = lektioner.find((l) => l.dato === nyDato);
		redigerer = eks ?? tomLektion(nyDato);
		viserOpretForm = false;
	}

	function annullerRediger() {
		redigerer = null;
		viserOpretForm = false;
	}

	async function gemLektion() {
		if (!redigerer) return;
		if (!redigerer.titel.trim()) {
			fejl = 'Lektionen skal have en titel.';
			return;
		}
		gemmer = true;
		fejl = null;
		try {
			await gemModulbrugerLektion(redigerer);
			redigerer = null;
			await indlaes();
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke gemme lektionen.';
		} finally {
			gemmer = false;
		}
	}

	let sletDato = $state<string | null>(null);
	function aabnSletBekraeft(dato: string) {
		sletDato = dato;
	}
	async function slet() {
		const dato = sletDato;
		if (!dato) return;
		sletDato = null;
		sletter = dato;
		try {
			await sletModulbrugerLektion(dato);
			await indlaes();
			if (redigerer?.dato === dato) redigerer = null;
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke slette lektionen.';
		} finally {
			sletter = null;
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Admin</span>
		</a>
		<div class="eyebrow">Modulbrugere</div>
		<h1>Daglige lektioner</h1>
		<p class="page-sub">
			Lektioner du opretter her vises på forsiden for basis- og premium-app-brugere
			på den valgte dato. Slet en lektion for at fjerne den fra forsiden.
		</p>
	</header>

	{#if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{/if}

	{#if redigerer}
		<section class="form-card">
			<div class="form-head">
				<div>
					<div class="form-eyebrow">Redigerer lektion</div>
					<div class="form-dato">{visningsDato(redigerer.dato)}</div>
				</div>
				<button class="form-luk" type="button" onclick={annullerRediger} aria-label="Luk">×</button>
			</div>

			<label class="felt">
				<span class="label">Dato</span>
				<input type="date" bind:value={redigerer.dato} disabled={gemmer} />
			</label>

			<label class="felt">
				<span class="label">Titel</span>
				<input type="text" bind:value={redigerer.titel} disabled={gemmer} maxlength="100" />
			</label>

			<label class="felt">
				<span class="label">Kort beskrivelse</span>
				<textarea
					rows="2"
					bind:value={redigerer.beskrivelse}
					disabled={gemmer}
					maxlength="300"
				></textarea>
			</label>

			<label class="felt">
				<span class="label">Indhold (vises i lektion-overlay)</span>
				<textarea rows="6" bind:value={redigerer.indhold} disabled={gemmer}></textarea>
			</label>

			<div class="felt-rad">
				<label class="felt felt-flex">
					<span class="label">URL (valgfri)</span>
					<input
						type="url"
						bind:value={redigerer.url}
						disabled={gemmer}
						placeholder="https://..."
					/>
				</label>
				<label class="felt felt-fixed">
					<span class="label">Format</span>
					<input
						type="text"
						bind:value={redigerer.format}
						disabled={gemmer}
						placeholder="Video / Læsestof / Lyd"
						maxlength="20"
					/>
				</label>
				<label class="felt felt-fixed">
					<span class="label">Varighed (min)</span>
					<input
						type="number"
						min="0"
						bind:value={redigerer.varighedMin}
						disabled={gemmer}
					/>
				</label>
			</div>

			<div class="form-knapper">
				<button class="ghost-knap" type="button" onclick={annullerRediger} disabled={gemmer}>
					Annullér
				</button>
				<button class="primary-knap" type="button" onclick={gemLektion} disabled={gemmer}>
					{gemmer ? 'Gemmer...' : 'Gem lektion'}
				</button>
			</div>
		</section>
	{:else if viserOpretForm}
		<section class="form-card">
			<div class="form-head">
				<div class="form-eyebrow">Opret lektion</div>
				<button class="form-luk" type="button" onclick={annullerRediger} aria-label="Luk">×</button>
			</div>
			<label class="felt">
				<span class="label">Hvilken dato?</span>
				<input type="date" bind:value={nyDato} />
			</label>
			<div class="form-knapper">
				<button class="ghost-knap" type="button" onclick={annullerRediger}>Annullér</button>
				<button class="primary-knap" type="button" onclick={fortsaetOpret}>Fortsæt</button>
			</div>
		</section>
	{:else}
		<button class="primary-knap full" type="button" onclick={aabnOpret}>
			+ Opret ny lektion
		</button>
	{/if}

	{#if loading}
		<Loading tekst="Henter lektioner..." kompakt />
	{:else if lektioner.length === 0}
		<div class="status-besked">
			Du har ikke oprettet nogen lektioner endnu. Klik 'Opret ny lektion' for at lægge en op.
		</div>
	{:else}
		<div class="liste">
			{#each lektioner as l (l.dato)}
				<div class="lektion-row">
					<div class="lektion-tekst">
						<div class="lektion-dato">{visningsDato(l.dato)}</div>
						<div class="lektion-titel">{l.titel || '(uden titel)'}</div>
						{#if l.beskrivelse}
							<div class="lektion-beskrivelse">{l.beskrivelse}</div>
						{/if}
					</div>
					<div class="lektion-knapper">
						<button class="row-knap" type="button" onclick={() => aabnRediger(l.dato)}>
							Rediger
						</button>
						<button
							class="row-knap row-knap-slet"
							type="button"
							onclick={() => aabnSletBekraeft(l.dato)}
							disabled={sletter === l.dato}
						>
							{sletter === l.dato ? 'Sletter...' : 'Slet'}
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if sletDato}
	<BekraeftModal
		titel="Slet lektion?"
		beskrivelse={'Lektionen for ' + visningsDato(sletDato) + ' slettes permanent.'}
		bekraeftTekst="Slet"
		destruktiv
		arbejder={sletter === sletDato}
		onBekraeft={() => void slet()}
		onAnnuller={() => (sletDato = null)}
	/>
{/if}

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 640px;
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
		margin-bottom: 14px;
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
		margin-bottom: 18px;
	}

	.form-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 12px;
	}

	.form-eyebrow {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.form-dato {
		font-family: var(--ff-d);
		font-weight: 600;
		font-size: calc(15px * var(--fs-scale, 1));
		margin-top: 2px;
		text-transform: capitalize;
	}

	.form-luk {
		background: var(--bg2);
		border: none;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		font-size: 18px;
		cursor: pointer;
		color: var(--text2);
	}

	.felt {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-bottom: 10px;
	}

	.label {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text2);
		letter-spacing: 0.04em;
	}

	.felt input,
	.felt textarea {
		font-family: var(--ff-b);
		font-size: calc(13px * var(--fs-scale, 1));
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--white);
		color: var(--text);
	}

	.felt input:focus,
	.felt textarea:focus {
		outline: 2px solid var(--terra);
		outline-offset: -2px;
	}

	.felt-rad {
		display: flex;
		gap: 8px;
		margin-bottom: 10px;
	}

	.felt-flex {
		flex: 1;
		margin-bottom: 0;
	}

	.felt-fixed {
		width: 110px;
		flex-shrink: 0;
		margin-bottom: 0;
	}

	.form-knapper {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 14px;
	}

	.primary-knap {
		padding: 10px 16px;
		background: var(--terra);
		color: #fff;
		border: none;
		border-radius: 8px;
		font-family: var(--ff-b);
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		cursor: pointer;
	}

	.primary-knap:hover:not(:disabled) {
		filter: brightness(0.95);
	}

	.primary-knap:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.primary-knap.full {
		display: block;
		width: 100%;
		margin-bottom: 18px;
	}

	.ghost-knap {
		padding: 10px 16px;
		background: var(--white);
		color: var(--text2);
		border: 1px solid var(--border);
		border-radius: 8px;
		font-family: var(--ff-b);
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		cursor: pointer;
	}

	.liste {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		overflow: hidden;
	}

	.lektion-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px;
		border-top: 1px solid var(--border);
	}

	.lektion-row:first-child {
		border-top: none;
	}

	.lektion-tekst {
		flex: 1;
		min-width: 0;
	}

	.lektion-dato {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text3);
		margin-bottom: 2px;
	}

	.lektion-titel {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.lektion-beskrivelse {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
		margin-top: 2px;
		line-height: 1.4;
	}

	.lektion-knapper {
		display: flex;
		gap: 6px;
		flex-shrink: 0;
	}

	.row-knap {
		padding: 7px 10px;
		font-size: calc(12px * var(--fs-scale, 1));
		font-family: var(--ff-b);
		font-weight: 600;
		background: var(--bg2);
		color: var(--text2);
		border: none;
		border-radius: 7px;
		cursor: pointer;
	}

	.row-knap:hover {
		background: var(--border);
	}

	.row-knap-slet:hover {
		background: #fbeeea;
		color: #8a4a3e;
	}

	.row-knap:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
