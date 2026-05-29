<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { Timestamp } from 'firebase/firestore';
	import type { Challenge, ChallengeIndtastning } from '$lib/content/challenge';
	import { beregnStilling, challengeDisplayNavn } from '$lib/content/challenge';
	import {
		gemChallenge,
		hentAlleIndtastninger,
		hentBrugerePaaForlob,
		hentChallenge,
		sletChallenge
	} from '$lib/firestore/challenge';
	import { hentForlob } from '$lib/firestore/forlob';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import Icon from '$lib/components/Icon.svelte';

	const forlobId = $derived(page.params.id ?? '');
	const challengeId = $derived(page.params.challengeId ?? '');

	let forlob = $state<Forlob | null>(null);
	let challenge = $state<Challenge | null>(null);
	let brugere = $state<
		Array<{ uid: string; fornavn: string; efternavn: string; email: string }>
	>([]);
	let indtastninger = $state<ChallengeIndtastning[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let gemmer = $state(false);
	let gemKvit = $state(false);
	let bekraefter = $state(false);

	// Form-felter
	let navn = $state('');
	let beskrivelse = $state('');
	let startDato = $state('');
	let slutDato = $state('');
	let aktiv = $state(false);
	let fravalgte = $state<Set<string>>(new Set());

	onMount(async () => {
		try {
			const [f, c, b, i] = await Promise.all([
				hentForlob(forlobId),
				hentChallenge(forlobId, challengeId),
				hentBrugerePaaForlob(forlobId),
				hentAlleIndtastninger(forlobId, challengeId)
			]);
			forlob = f;
			if (!c) {
				fejl = 'Challenge ikke fundet.';
				loading = false;
				return;
			}
			challenge = c;
			brugere = b;
			indtastninger = i;
			navn = c.navn;
			beskrivelse = c.beskrivelse;
			startDato = toInputDato(c.startDato);
			slutDato = toInputDato(c.slutDato);
			aktiv = c.aktiv;
			fravalgte = new Set(c.fravalgteBrugere);
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente challenge.';
		} finally {
			loading = false;
		}
	});

	function toInputDato(t: Timestamp): string {
		if (!t) return '';
		const d = t.toDate();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	function fraInput(s: string): Timestamp | null {
		if (!s) return null;
		const [yyyy, mm, dd] = s.split('-').map((x) => parseInt(x, 10));
		if (!yyyy || !mm || !dd) return null;
		return Timestamp.fromDate(new Date(yyyy, mm - 1, dd));
	}

	function toggleFravalgt(uid: string) {
		const ny = new Set(fravalgte);
		if (ny.has(uid)) ny.delete(uid);
		else ny.add(uid);
		fravalgte = ny;
	}

	const stillingForhaandsvis = $derived.by(() => {
		const inputs = indtastninger.map((i) => {
			const b = brugere.find((bb) => bb.uid === i.uid);
			const fornavn = i.fornavn || b?.fornavn || '';
			const efternavn = i.efternavn || b?.efternavn || '';
			return {
				uid: i.uid,
				foedevarer: i.foedevarer,
				displayNavn: challengeDisplayNavn(fornavn, efternavn)
			};
		});
		return beregnStilling(inputs, [...fravalgte], null);
	});

	async function gem() {
		if (!challenge) return;
		gemmer = true;
		fejl = null;
		gemKvit = false;
		try {
			const start = fraInput(startDato);
			const slut = fraInput(slutDato);
			if (!start || !slut) {
				fejl = 'Vælg både start- og slutdato.';
				gemmer = false;
				return;
			}
			if (slut.toMillis() < start.toMillis()) {
				fejl = 'Slutdato kan ikke være før startdato.';
				gemmer = false;
				return;
			}
			const opd: Challenge = {
				...challenge,
				navn: navn.trim(),
				beskrivelse: beskrivelse.trim(),
				startDato: start,
				slutDato: slut,
				aktiv,
				fravalgteBrugere: [...fravalgte]
			};
			await gemChallenge(opd);
			challenge = opd;
			gemKvit = true;
			setTimeout(() => (gemKvit = false), 2000);
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke gemme.';
		} finally {
			gemmer = false;
		}
	}

	async function slet() {
		if (!bekraefter) {
			bekraefter = true;
			return;
		}
		gemmer = true;
		try {
			await sletChallenge(forlobId, challengeId);
			goto(`/app/admin/forlob/${forlobId}/challenges`);
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke slette.';
			gemmer = false;
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin/forlob/{forlobId}/challenges">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Challenges</span>
		</a>
		<div class="eyebrow">Admin · Challenge</div>
		<h1>{challenge?.navn || 'Challenge'}</h1>
	</header>

	{#if loading}
		<div class="status-besked">Henter...</div>
	{:else if fejl && !challenge}
		<div class="status-besked fejl">{fejl}</div>
	{:else if challenge}
		<div class="form-card">
			<label class="felt">
				<span class="felt-label">Navn</span>
				<input
					type="text"
					bind:value={navn}
					placeholder="Planter til tarmmikrobiom"
					maxlength="80"
					disabled={gemmer}
				/>
			</label>

			<label class="felt">
				<span class="felt-label">Beskrivelse</span>
				<textarea
					bind:value={beskrivelse}
					rows="3"
					maxlength="300"
					placeholder="Spis så mange forskellige frugter og grøntsager som muligt..."
					disabled={gemmer}
				></textarea>
			</label>

			<div class="felt-rad">
				<label class="felt">
					<span class="felt-label">Startdato</span>
					<input type="date" bind:value={startDato} disabled={gemmer} />
				</label>
				<label class="felt">
					<span class="felt-label">Slutdato</span>
					<input type="date" bind:value={slutDato} disabled={gemmer} />
				</label>
			</div>

			<label class="felt-checkbox">
				<input type="checkbox" bind:checked={aktiv} disabled={gemmer} />
				<span>Aktiv — vises på klienternes forside i perioden</span>
			</label>
		</div>

		<div class="form-card">
			<div class="form-titel">Deltagere</div>
			<p class="form-hint">
				Marker test- og demo-klienter herunder, så de ikke tæller med i stillingen.
				Klienter uden afkryds tæller med.
			</p>
			{#if brugere.length === 0}
				<p class="muted">Ingen registrerede brugere på dette forløb endnu.</p>
			{:else}
				<div class="bruger-liste">
					{#each brugere as b (b.uid)}
						{@const erFravalgt = fravalgte.has(b.uid)}
						<label class="bruger-row" class:fravalgt={erFravalgt}>
							<input
								type="checkbox"
								checked={erFravalgt}
								onchange={() => toggleFravalgt(b.uid)}
								disabled={gemmer}
							/>
							<div class="bruger-tekst">
								<div class="bruger-navn">
									{b.fornavn}
									{b.efternavn}
								</div>
								<div class="bruger-email">{b.email}</div>
							</div>
							{#if erFravalgt}
								<span class="fravalgt-pille">Fravalgt</span>
							{/if}
						</label>
					{/each}
				</div>
			{/if}
		</div>

		<div class="form-card">
			<div class="form-titel">Aktuel stilling</div>
			{#if stillingForhaandsvis.length === 0}
				<p class="muted">Ingen indtastninger endnu.</p>
			{:else}
				<ol class="stilling-liste">
					{#each stillingForhaandsvis as r, i (r.uid)}
						<li>
							<span class="placering">{i + 1}.</span>
							<span class="navn">{r.displayNavn}</span>
							<span class="score">{r.score}</span>
						</li>
					{/each}
				</ol>
			{/if}
		</div>

		<div class="actions">
			{#if gemKvit}
				<div class="kvit-besked">Gemt ✓</div>
			{/if}
			{#if fejl}
				<div class="status-besked fejl">{fejl}</div>
			{/if}
			<button class="form-knap primary full" type="button" onclick={gem} disabled={gemmer}>
				{gemmer ? 'Gemmer...' : 'Gem'}
			</button>

			<div class="slet-omraade">
				{#if !bekraefter}
					<button class="slet-knap" type="button" onclick={slet} disabled={gemmer}>
						Slet challenge
					</button>
				{:else}
					<div class="slet-bekraeft">
						<div>Slet denne challenge inkl. alle klienters indtastninger?</div>
						<div class="slet-knapper">
							<button
								class="form-knap ghost"
								type="button"
								onclick={() => (bekraefter = false)}
								disabled={gemmer}
							>
								Annuller
							</button>
							<button class="form-knap danger" type="button" onclick={slet} disabled={gemmer}>
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
		margin-bottom: 14px;
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
		color: var(--text);
	}

	.status-besked {
		padding: 12px;
		text-align: center;
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		background: var(--bg2);
		border-radius: 10px;
	}

	.status-besked.fejl {
		color: var(--terra);
		background: var(--tdim);
	}

	.form-card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 14px;
		margin-bottom: 14px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.form-titel {
		font-family: var(--ff-d);
		font-size: calc(16px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.form-hint {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		margin: -4px 0 0;
		line-height: 1.4;
	}

	.felt {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.felt-label {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text2);
		letter-spacing: 0.04em;
	}

	.felt input[type='text'],
	.felt input[type='date'],
	.felt textarea {
		padding: 10px 12px;
		font-size: calc(14px * var(--fs-scale, 1));
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-b);
	}

	.felt-rad {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.felt-checkbox {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
	}

	.felt-checkbox input {
		width: 18px;
		height: 18px;
		accent-color: var(--terra);
	}

	.muted {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		margin: 0;
		font-style: italic;
	}

	.bruger-liste {
		display: flex;
		flex-direction: column;
		max-height: 320px;
		overflow-y: auto;
	}

	.bruger-row {
		display: grid;
		grid-template-columns: 20px 1fr auto;
		align-items: center;
		gap: 10px;
		padding: 8px 4px;
		border-top: 1px solid var(--border);
		cursor: pointer;
	}

	.bruger-row:first-child {
		border-top: none;
	}

	.bruger-row.fravalgt {
		opacity: 0.6;
	}

	.bruger-row input[type='checkbox'] {
		width: 18px;
		height: 18px;
		accent-color: var(--terra);
	}

	.bruger-navn {
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.bruger-email {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.fravalgt-pille {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text3);
		background: var(--bg2);
		padding: 2px 7px;
		border-radius: 99px;
	}

	.stilling-liste {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.stilling-liste li {
		display: grid;
		grid-template-columns: 32px 1fr auto;
		align-items: center;
		gap: 10px;
		padding: 8px 10px;
		background: var(--bg2);
		border-radius: 8px;
	}

	.placering {
		font-family: var(--ff-d);
		font-weight: 700;
		color: var(--text2);
	}

	.navn {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text);
	}

	.score {
		font-family: var(--ff-d);
		font-weight: 700;
		font-size: calc(15px * var(--fs-scale, 1));
		color: var(--terra);
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.kvit-besked {
		text-align: center;
		color: var(--sage);
		font-size: calc(13px * var(--fs-scale, 1));
	}

	.form-knap {
		padding: 12px 14px;
		font-family: var(--ff-b);
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 12px;
		cursor: pointer;
		touch-action: manipulation;
		border: 1px solid transparent;
	}

	.form-knap.primary {
		background: var(--terra);
		color: var(--white);
		border-color: var(--terra);
	}

	.form-knap.ghost {
		background: var(--white);
		color: var(--text2);
		border-color: var(--border);
	}

	.form-knap.danger {
		background: #b8453a;
		color: var(--white);
		border-color: #b8453a;
	}

	.form-knap.full {
		width: 100%;
	}

	.form-knap:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.slet-omraade {
		margin-top: 8px;
	}

	.slet-knap {
		display: block;
		width: 100%;
		padding: 10px;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 10px;
		color: var(--text3);
		font-size: calc(12px * var(--fs-scale, 1));
		cursor: pointer;
		touch-action: manipulation;
	}

	.slet-knap:hover {
		color: var(--terra);
		border-color: var(--terra2);
	}

	.slet-bekraeft {
		padding: 12px;
		background: var(--tdim);
		border-radius: 10px;
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text);
	}

	.slet-knapper {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		margin-top: 10px;
	}
</style>
