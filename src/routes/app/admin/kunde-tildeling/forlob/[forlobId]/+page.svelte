<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { page } from '$app/state';
	import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import Icon from '$lib/components/Icon.svelte';
	import { alleProdukter } from '$lib/content/produkter';
	import type {
		CustomBuilderTildeling,
		ProgramTildeling
	} from '$lib/content/tildelinger';
	import {
		fjernCustomBuilderTildeling,
		fjernProgramTildeling,
		hentAlleCustomBuilderTildelinger,
		hentAlleProgramTildelinger,
		hentAlleProgrammerPaaTvaers,
		tildelCustomBuilder,
		tildelProgram,
		type ProgramMedForlob
	} from '$lib/firestore/tildelinger';

	type Deltager = {
		uid: string;
		email: string;
		firstName: string;
		lastName: string;
	};

	const getUser = getContext<() => User | null>('user');
	const adminUser = $derived(getUser());

	const forlobId = $derived(page.params.forlobId ?? '');

	let forlobNavn = $state('');
	let deltagere = $state<Deltager[]>([]);
	let alleProgrammer = $state<ProgramMedForlob[]>([]);
	let programTildelinger = $state<ProgramTildeling[]>([]);
	let customBuilderTildelinger = $state<CustomBuilderTildeling[]>([]);
	let indlaeser = $state(true);
	let fejl = $state<string | null>(null);

	let valgtProgramKey = $state('');
	let gemmer = $state(false);

	const forlobsProgramTildelinger = $derived(
		programTildelinger.filter(
			(t) => t.modtagerType === 'forlob' && t.modtagerId === forlobId
		)
	);
	const forlobsCustomBuilder = $derived(
		customBuilderTildelinger.find(
			(t) => t.modtagerType === 'forlob' && t.modtagerId === forlobId
		) ?? null
	);

	async function indlaesData() {
		indlaeser = true;
		fejl = null;
		try {
			// Forløbs-navn fra produkter (eller fra forløbs-doc hvis det findes)
			const produkt = alleProdukter().find((p) => p.forlobId === forlobId);
			forlobNavn = produkt?.navn ?? forlobId;
			const forlobSnap = await getDoc(doc(db, 'forlob', forlobId));
			if (forlobSnap.exists()) {
				const data = forlobSnap.data() as { navn?: string };
				if (data.navn) forlobNavn = data.navn;
			}

			// Deltagere — alle brugere hvis forlobIds inkluderer dette forløb
			const usersSnap = await getDocs(collection(db, 'users'));
			deltagere = usersSnap.docs
				.filter((d) => {
					const data = d.data() as { forlobIds?: string[] };
					return (data.forlobIds ?? []).includes(forlobId);
				})
				.map((d) => {
					const data = d.data() as {
						email?: string;
						firstName?: string;
						lastName?: string;
					};
					return {
						uid: d.id,
						email: data.email ?? '',
						firstName: data.firstName ?? '',
						lastName: data.lastName ?? ''
					};
				})
				.sort((a, b) =>
					(a.firstName || a.email).localeCompare(b.firstName || b.email, 'da')
				);

			[alleProgrammer, programTildelinger, customBuilderTildelinger] = await Promise.all([
				hentAlleProgrammerPaaTvaers(),
				hentAlleProgramTildelinger(),
				hentAlleCustomBuilderTildelinger()
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
		const [progForlobId, programId] = valgtProgramKey.split('::');
		if (!progForlobId || !programId) return;
		gemmer = true;
		try {
			const ny = await tildelProgram({
				programId,
				forlobId: progForlobId,
				modtagerType: 'forlob',
				modtagerId: forlobId,
				tildeltAf: adminUser.uid
			});
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

	async function toggleCustomBuilder() {
		if (!adminUser || gemmer) return;
		gemmer = true;
		try {
			if (forlobsCustomBuilder) {
				await fjernCustomBuilderTildeling(forlobsCustomBuilder.id!);
				customBuilderTildelinger = customBuilderTildelinger.filter(
					(t) => t.id !== forlobsCustomBuilder.id
				);
			} else {
				const ny = await tildelCustomBuilder({
					modtagerType: 'forlob',
					modtagerId: forlobId,
					tildeltAf: adminUser.uid
				});
				if (!customBuilderTildelinger.some((t) => t.id === ny.id)) {
					customBuilderTildelinger = [...customBuilderTildelinger, ny];
				}
			}
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke ændre custom-builder-adgang.';
		} finally {
			gemmer = false;
		}
	}

	function programNavn(progForlobId: string, programId: string): string {
		const p = alleProgrammer.find(
			(pr) => pr.forlobId === progForlobId && pr.program.id === programId
		);
		return p ? p.program.navn : programId;
	}

	function forlobNavnFor(id: string): string {
		const produkt = alleProdukter().find((p) => p.forlobId === id);
		return produkt?.navn ?? id;
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin/kunde-tildeling">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Kunde-tildeling</span>
		</a>
		<div class="eyebrow">Admin — forløb</div>
		<h1>{forlobNavn}</h1>
		<p class="page-sub">
			Tildelinger på dette niveau gælder alle deltagere på forløbet.
		</p>
	</header>

	{#if fejl}
		<div class="fejl">{fejl}</div>
	{/if}

	{#if indlaeser}
		<div class="status">Indlæser…</div>
	{:else}
		<section class="card">
			<div class="card-titel">Deltagere ({deltagere.length})</div>
			{#if deltagere.length === 0}
				<p class="card-sub">Ingen deltagere på dette forløb endnu.</p>
			{:else}
				<div class="liste">
					{#each deltagere as d (d.uid)}
						{@const navn = `${d.firstName} ${d.lastName}`.trim()}
						<a class="rad" href={`/app/admin/kunde-tildeling/kunde/${d.uid}`}>
							<div class="rad-tekst">
								<div class="rad-navn">{navn || '(uden navn)'}</div>
								<div class="rad-sub">{d.email}</div>
							</div>
							<Icon name="chevron-r" size={14} color="var(--text3)" />
						</a>
					{/each}
				</div>
			{/if}
		</section>

		<section class="card">
			<div class="card-titel">Program-tildelinger</div>
			<p class="card-sub">Gælder alle deltagere på forløbet.</p>

			{#if forlobsProgramTildelinger.length === 0}
				<p class="card-sub">Ingen programmer tildelt forløbet endnu.</p>
			{:else}
				<div class="liste">
					{#each forlobsProgramTildelinger as t (t.id)}
						<div class="rad">
							<div class="rad-tekst">
								<div class="rad-navn">{programNavn(t.forlobId, t.programId)}</div>
								<div class="rad-sub">Fra {forlobNavnFor(t.forlobId)}</div>
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
			{/if}

			<div class="tildel-form">
				<label class="felt">
					<span class="felt-label">Tildel et nyt program til hele forløbet</span>
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
					{gemmer ? 'Gemmer…' : 'Tildel til hele forløbet'}
				</button>
			</div>
		</section>

		<section class="card">
			<div class="card-titel">Custom-builder-adgang</div>
			<p class="card-sub">
				Når aktiveret kan alle deltagere på forløbet bygge eget træningsprogram.
			</p>

			<div class="status-rad">
				<div class="status-tekst">
					Status:
					{#if forlobsCustomBuilder}
						<strong>Aktiv for alle deltagere</strong>
					{:else}
						<strong>Ikke aktiv</strong>
					{/if}
				</div>
				<button
					type="button"
					class="sekundaer-knap"
					onclick={toggleCustomBuilder}
					disabled={gemmer}
				>
					{forlobsCustomBuilder ? 'Fjern adgang' : 'Aktivér for hele forløbet'}
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
		text-decoration: none;
		color: inherit;
	}

	.rad:first-child {
		border-top: none;
	}

	a.rad:hover {
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
		background: var(--accent, #B87B6E);
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

	.sekundaer-knap {
		padding: 8px 12px;
		background: var(--bg2);
		border: 1px solid var(--border);
		color: var(--text);
		border-radius: 8px;
		font-size: calc(13px * var(--fs-scale, 1));
		cursor: pointer;
	}

	.sekundaer-knap:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.status-rad {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.status-tekst {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
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
