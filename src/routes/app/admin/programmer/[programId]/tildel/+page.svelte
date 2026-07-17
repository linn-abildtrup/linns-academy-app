<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { page } from '$app/state';
	import { collection, getDocs } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import type { ProgramTildeling } from '$lib/content/tildelinger';
	import {
		fjernProgramTildeling,
		hentAlleProgramTildelinger,
		tildelProgram
	} from '$lib/firestore/tildelinger';
	import { hentMasterProgram } from '$lib/firestore/mikrotraening';
	import { alleProdukter } from '$lib/content/produkter';
	import { klientSoegeMatch } from '$lib/utils/klientSoegning';
	import Icon from '$lib/components/Icon.svelte';

	type Bruger = { uid: string; navn: string; email: string };
	type Hold = { forlobId: string; navn: string };

	const getUser = getContext<() => User | null>('user');
	const adminUser = $derived(getUser());
	const programId = $derived(page.params.programId ?? '');

	let programNavn = $state('');
	let tildelinger = $state<ProgramTildeling[]>([]);
	let hold = $state<Hold[]>([]);
	let brugere = $state<Bruger[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let travl = $state(false);

	let soeg = $state('');

	onMount(async () => {
		try {
			const [prog, alleTilds, usersSnap] = await Promise.all([
				hentMasterProgram(programId),
				hentAlleProgramTildelinger(),
				getDocs(collection(db, 'users'))
			]);
			if (!prog) {
				fejl = 'Programmet kunne ikke findes.';
				return;
			}
			programNavn = prog.program.navn;
			// Kun tildelinger af DETTE master-program.
			tildelinger = alleTilds.filter(
				(t) => t.programId === programId && (t.programKilde ?? 'forlob') === 'master'
			);
			hold = alleProdukter()
				.filter((p) => !!p.forlobId)
				.map((p) => ({ forlobId: p.forlobId as string, navn: p.navn }));
			brugere = usersSnap.docs
				.map((d) => {
					const data = d.data() as { firstName?: string; lastName?: string; email?: string };
					const navn = `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim();
					return { uid: d.id, navn: navn || (data.email ?? d.id), email: data.email ?? '' };
				})
				.sort((a, b) => a.navn.localeCompare(b.navn, 'da'));
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente data.';
		} finally {
			loading = false;
		}
	});

	const alleAppTildeling = $derived(tildelinger.find((t) => t.modtagerType === 'alle-app') ?? null);
	const kundeTildelinger = $derived(tildelinger.filter((t) => t.modtagerType === 'kunde'));
	const tildelteUids = $derived(new Set(kundeTildelinger.map((t) => t.modtagerId)));

	function forlobTildeling(forlobId: string): ProgramTildeling | null {
		return (
			tildelinger.find((t) => t.modtagerType === 'forlob' && t.modtagerId === forlobId) ?? null
		);
	}

	function brugerNavn(uid: string): string {
		return brugere.find((b) => b.uid === uid)?.navn ?? uid;
	}

	const soegeResultat = $derived.by(() => {
		const q = soeg.trim();
		if (q.length < 2) return [] as Bruger[];
		return brugere
			.filter((b) => !tildelteUids.has(b.uid))
			.filter((b) => klientSoegeMatch(`${b.navn} ${b.email}`, q))
			.slice(0, 8);
	});

	async function tilfoej(args: Omit<ProgramTildeling, 'id' | 'tildeltAt' | 'tildeltAf'>) {
		if (!adminUser || travl) return;
		travl = true;
		fejl = null;
		try {
			const ny = await tildelProgram({ ...args, tildeltAf: adminUser.uid });
			if (!tildelinger.some((t) => t.id === ny.id)) tildelinger = [...tildelinger, ny];
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke gemme tildelingen.';
		} finally {
			travl = false;
		}
	}

	async function fjern(id: string | undefined) {
		if (!id || travl) return;
		travl = true;
		fejl = null;
		try {
			await fjernProgramTildeling(id);
			tildelinger = tildelinger.filter((t) => t.id !== id);
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke fjerne tildelingen.';
		} finally {
			travl = false;
		}
	}

	function toggleAlleApp() {
		const eks = alleAppTildeling;
		if (eks) void fjern(eks.id);
		else
			void tilfoej({
				programId,
				forlobId: '',
				programKilde: 'master',
				modtagerType: 'alle-app',
				modtagerId: ''
			});
	}

	function toggleHold(forlobId: string) {
		const eks = forlobTildeling(forlobId);
		if (eks) void fjern(eks.id);
		else
			void tilfoej({
				programId,
				forlobId: '',
				programKilde: 'master',
				modtagerType: 'forlob',
				modtagerId: forlobId
			});
	}

	function tilfoejPerson(uid: string) {
		void tilfoej({
			programId,
			forlobId: '',
			programKilde: 'master',
			modtagerType: 'kunde',
			modtagerId: uid
		});
		soeg = '';
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin/programmer/{programId}">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Program</span>
		</a>
		<div class="eyebrow">Admin · Tildel program</div>
		<h1>Tildel program</h1>
		{#if programNavn}
			<p class="page-sub">{programNavn}</p>
		{/if}
	</header>

	{#if loading}
		<div class="status-besked">Henter...</div>
	{:else if fejl && !programNavn}
		<div class="status-besked fejl">{fejl}</div>
	{:else}
		{#if fejl}
			<div class="besked fejl">{fejl}</div>
		{/if}

		<section class="card">
			<div class="section-label">Alle app-brugere</div>
			<label class="switch-rad" class:disabled={travl}>
				<input
					type="checkbox"
					checked={!!alleAppTildeling}
					onchange={toggleAlleApp}
					disabled={travl}
				/>
				<span>Giv alle app-brugere (premium) adgang til programmet</span>
			</label>
		</section>

		<section class="card">
			<div class="section-label">Hold / forløb</div>
			<p class="hint">Sæt flueben ved de hold der skal have programmet.</p>
			<div class="hold-liste">
				{#each hold as h (h.forlobId)}
					<label class="switch-rad" class:disabled={travl}>
						<input
							type="checkbox"
							checked={!!forlobTildeling(h.forlobId)}
							onchange={() => toggleHold(h.forlobId)}
							disabled={travl}
						/>
						<span>{h.navn}</span>
					</label>
				{/each}
			</div>
		</section>

		<section class="card">
			<div class="section-label">Enkelte personer</div>
			{#if kundeTildelinger.length > 0}
				<div class="chip-liste">
					{#each kundeTildelinger as t (t.id)}
						<span class="person-chip">
							{brugerNavn(t.modtagerId)}
							<button
								type="button"
								aria-label="Fjern"
								onclick={() => fjern(t.id)}
								disabled={travl}>×</button
							>
						</span>
					{/each}
				</div>
			{/if}
			<input
				class="soeg"
				type="text"
				bind:value={soeg}
				placeholder="Søg efter navn eller email..."
				disabled={travl}
			/>
			{#if soeg.trim().length >= 2}
				{#if soegeResultat.length === 0}
					<div class="soeg-tom">Ingen match (eller allerede tilføjet).</div>
				{:else}
					<div class="soeg-liste">
						{#each soegeResultat as b (b.uid)}
							<button
								class="soeg-row"
								type="button"
								onclick={() => tilfoejPerson(b.uid)}
								disabled={travl}
							>
								<span class="soeg-navn">{b.navn}</span>
								<span class="soeg-email">{b.email}</span>
							</button>
						{/each}
					</div>
				{/if}
			{/if}
		</section>

		<p class="fodnote">
			Tildelinger gemmes med det samme. Kunderne ser først programmet når leveringen er koblet på
			(klods 3).
		</p>
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

	.page-sub {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		margin: 6px 0 0;
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
		margin-bottom: 14px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.section-label {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.hint {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin: 0;
	}

	.switch-rad {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text);
		cursor: pointer;
	}

	.switch-rad.disabled {
		opacity: 0.6;
		cursor: default;
	}

	.switch-rad input {
		width: 18px;
		height: 18px;
		accent-color: var(--terra);
		flex-shrink: 0;
	}

	.hold-liste {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.chip-liste {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.person-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 5px 6px 5px 12px;
		border-radius: 999px;
		background: var(--bg2);
		border: 1px solid var(--border);
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--text);
	}

	.person-chip button {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: none;
		background: var(--white);
		color: #b8665a;
		font-size: calc(14px * var(--fs-scale, 1));
		cursor: pointer;
		line-height: 1;
	}

	.soeg {
		padding: 10px 12px;
		font-size: calc(14px * var(--fs-scale, 1));
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-b);
		outline: none;
		width: 100%;
		box-sizing: border-box;
	}

	.soeg:focus {
		border-color: var(--terra);
	}

	.soeg-tom {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.soeg-liste {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.soeg-row {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 1px;
		padding: 8px 12px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--white);
		cursor: pointer;
		text-align: left;
		font-family: var(--ff-b);
	}

	.soeg-row:hover:not(:disabled) {
		background: var(--bg2);
	}

	.soeg-navn {
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.soeg-email {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.fodnote {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text4);
		line-height: 1.4;
		margin: 4px 2px 0;
	}

	.besked {
		padding: 8px 12px;
		border-radius: 10px;
		font-size: calc(12px * var(--fs-scale, 1));
		margin-bottom: 12px;
	}

	.besked.fejl {
		background: #fbeeea;
		color: #8a4a3e;
		border: 1px solid #f0d6cf;
	}
</style>
