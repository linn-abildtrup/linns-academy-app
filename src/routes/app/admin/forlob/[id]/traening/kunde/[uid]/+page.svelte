<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { page } from '$app/state';
	import { doc, getDoc } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import Icon from '$lib/components/Icon.svelte';
	import { alleProdukter } from '$lib/content/produkter';
	import type { ProgramTildeling } from '$lib/content/tildelinger';
	import {
		fjernProgramTildeling,
		hentAlleProgramTildelinger,
		hentAlleProgrammerPaaTvaers,
		tildelProgram,
		type ProgramMedForlob
	} from '$lib/firestore/tildelinger';

	type KundeInfo = {
		uid: string;
		email: string;
		firstName: string;
		lastName: string;
		forlobIds: string[];
	};

	const getUser = getContext<() => User | null>('user');
	const adminUser = $derived(getUser());

	const uid = $derived(page.params.uid ?? '');
	const forlobId = $derived(page.params.id ?? '');

	let kunde = $state<KundeInfo | null>(null);
	let alleProgrammer = $state<ProgramMedForlob[]>([]);
	let programTildelinger = $state<ProgramTildeling[]>([]);
	let indlaeser = $state(true);
	let fejl = $state<string | null>(null);

	// Form state
	let valgtProgramKey = $state(''); // "forlobId::programId"
	let gemmer = $state(false);

	const direkteProgramTildelinger = $derived(
		programTildelinger.filter((t) => t.modtagerType === 'kunde' && t.modtagerId === uid)
	);
	const forlobsProgramTildelinger = $derived(
		programTildelinger.filter(
			(t) => t.modtagerType === 'forlob' && (kunde?.forlobIds ?? []).includes(t.modtagerId)
		)
	);
	const forlobNavne = $derived.by(() => {
		const map = new Map<string, string>();
		for (const p of alleProdukter()) {
			if (p.forlobId) map.set(p.forlobId, p.navn);
		}
		return map;
	});

	async function indlaesData() {
		indlaeser = true;
		fejl = null;
		try {
			const userSnap = await getDoc(doc(db, 'users', uid));
			if (!userSnap.exists()) {
				fejl = 'Kunden findes ikke.';
				kunde = null;
				return;
			}
			const data = userSnap.data() as {
				email?: string;
				firstName?: string;
				lastName?: string;
				forlobIds?: string[];
			};
			kunde = {
				uid,
				email: data.email ?? '',
				firstName: data.firstName ?? '',
				lastName: data.lastName ?? '',
				forlobIds: data.forlobIds ?? []
			};

			[alleProgrammer, programTildelinger] = await Promise.all([
				hentAlleProgrammerPaaTvaers(),
				hentAlleProgramTildelinger()
			]);
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke indlæse data.';
		} finally {
			indlaeser = false;
		}
	}

	onMount(indlaesData);

	async function tildelValgtProgram() {
		if (!valgtProgramKey || !adminUser || gemmer) return;
		const [forlobId, programId] = valgtProgramKey.split('::');
		if (!forlobId || !programId) return;
		gemmer = true;
		try {
			const ny = await tildelProgram({
				programId,
				forlobId,
				modtagerType: 'kunde',
				modtagerId: uid,
				tildeltAf: adminUser.uid
			});
			// Tilføj kun hvis ikke allerede i listen (dublet-beskyttelsen returnerer eksisterende)
			if (!programTildelinger.some((t) => t.id === ny.id)) {
				programTildelinger = [...programTildelinger, ny];
			}
			valgtProgramKey = '';
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke tildele program.';
		} finally {
			gemmer = false;
		}
	}

	async function fjernTildeling(id: string) {
		if (!id || gemmer) return;
		gemmer = true;
		try {
			await fjernProgramTildeling(id);
			programTildelinger = programTildelinger.filter((t) => t.id !== id);
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke fjerne tildeling.';
		} finally {
			gemmer = false;
		}
	}

	function programNavn(forlobId: string, programId: string): string {
		const p = alleProgrammer.find((pr) => pr.forlobId === forlobId && pr.program.id === programId);
		return p ? p.program.navn : programId;
	}

	const fuldtNavn = $derived(
		kunde ? `${kunde.firstName} ${kunde.lastName}`.trim() || kunde.email : ''
	);
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin/forlob/{forlobId}/traening">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Træning</span>
		</a>
		<div class="eyebrow">Admin · Træning</div>
		<h1>{fuldtNavn || 'Kunde'}</h1>
		{#if kunde}
			<p class="page-sub">{kunde.email}</p>
			{#if kunde.forlobIds.length > 0}
				<p class="page-sub">
					Forløb: {kunde.forlobIds.map((id) => forlobNavne.get(id) ?? id).join(', ')}
				</p>
			{:else}
				<p class="page-sub">Ingen aktive forløb.</p>
			{/if}
		{/if}
	</header>

	{#if fejl}
		<div class="fejl">{fejl}</div>
	{/if}

	{#if indlaeser}
		<div class="status">Indlæser…</div>
	{:else if kunde}
		<section class="card">
			<div class="card-titel">Program-tildelinger</div>

			{#if direkteProgramTildelinger.length === 0 && forlobsProgramTildelinger.length === 0}
				<p class="card-sub">Ingen programmer tildelt endnu.</p>
			{/if}

			{#if direkteProgramTildelinger.length > 0}
				<div class="undergruppe">
					<div class="undergruppe-label">Direkte til {fuldtNavn}</div>
					<div class="liste">
						{#each direkteProgramTildelinger as t (t.id)}
							<div class="rad">
								<div class="rad-tekst">
									<div class="rad-navn">{programNavn(t.forlobId, t.programId)}</div>
									<div class="rad-sub">{forlobNavne.get(t.forlobId) ?? t.forlobId}</div>
								</div>
								<button
									type="button"
									class="fjern-knap"
									onclick={() => fjernTildeling(t.id!)}
									disabled={gemmer}
								>
									Fjern
								</button>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if forlobsProgramTildelinger.length > 0}
				<div class="undergruppe">
					<div class="undergruppe-label">Arvet via forløb</div>
					<div class="liste">
						{#each forlobsProgramTildelinger as t (t.id)}
							<div class="rad arvet">
								<div class="rad-tekst">
									<div class="rad-navn">{programNavn(t.forlobId, t.programId)}</div>
									<div class="rad-sub">
										Tildelt hele {forlobNavne.get(t.modtagerId) ?? t.modtagerId}
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<div class="tildel-form">
				<label class="felt">
					<span class="felt-label">Tildel et nyt program</span>
					<select class="felt-input" bind:value={valgtProgramKey} disabled={gemmer}>
						<option value="">Vælg et program…</option>
						{#each alleProgrammer as p (`${p.forlobId}::${p.program.id}`)}
							<option value={`${p.forlobId}::${p.program.id}`}>
								{p.program.navn} ({p.forlobNavn})
							</option>
						{/each}
					</select>
				</label>
				<button
					type="button"
					class="primary-knap"
					onclick={tildelValgtProgram}
					disabled={!valgtProgramKey || gemmer}
				>
					{gemmer ? 'Gemmer…' : 'Tildel'}
				</button>
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
		gap: 4px;
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
		margin-bottom: 4px;
	}

	.card-sub {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		margin: 0 0 12px;
		line-height: 1.4;
	}

	.undergruppe {
		margin-bottom: 14px;
	}

	.undergruppe-label {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text3);
		margin-bottom: 6px;
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

	.rad.arvet {
		background: var(--bg2);
	}

	.rad-tekst {
		flex: 1;
		min-width: 0;
	}

	.rad-navn {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.rad-sub {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.fjern-knap {
		background: transparent;
		border: 1px solid var(--border);
		color: var(--text2);
		padding: 6px 10px;
		border-radius: 8px;
		font-size: calc(12px * var(--fs-scale, 1));
		cursor: pointer;
	}

	.fjern-knap:hover:not(:disabled) {
		background: var(--bg2);
	}

	.fjern-knap:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.tildel-form {
		margin-top: 14px;
		padding-top: 14px;
		border-top: 1px dashed var(--border);
	}

	.felt {
		display: block;
		margin-bottom: 10px;
	}

	.felt-label {
		display: block;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		margin-bottom: 4px;
	}

	.felt-input {
		width: 100%;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: 10px;
		font-size: calc(15px * var(--fs-scale, 1));
		background: var(--bg2);
		color: var(--text);
		box-sizing: border-box;
	}

	.primary-knap {
		display: block;
		width: 100%;
		padding: 11px 14px;
		background: var(--accent, #b87b6e);
		color: white;
		border: none;
		border-radius: 10px;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		cursor: pointer;
	}

	.primary-knap:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.status {
		text-align: center;
		padding: 30px 0;
		color: var(--text3);
		font-size: calc(13px * var(--fs-scale, 1));
	}

	.fejl {
		background: #f8e8e6;
		border: 1px solid #d4978c;
		color: #8a3a2a;
		padding: 10px 12px;
		border-radius: 10px;
		font-size: calc(13px * var(--fs-scale, 1));
		margin-bottom: 14px;
	}
</style>
