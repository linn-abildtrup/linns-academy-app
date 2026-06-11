<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { page } from '$app/state';
	import { collection, getDocs } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import type { Niveau, TrainingProgram, Udstyr } from '$lib/content/mikrotraening';
	import { tommeDageSkelet } from '$lib/content/mikrotraening';
	import {
		gemForlobsProgram,
		gemForlobsDage,
		hentForlobsProgrammer,
		sletForlobsProgram
	} from '$lib/firestore/mikrotraening';
	import { hentForlob } from '$lib/firestore/forlob';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import type { ProgramTildeling } from '$lib/content/tildelinger';
	import {
		fjernProgramTildeling,
		hentAlleProgramTildelinger,
		hentAlleProgrammerPaaTvaers,
		tildelProgram,
		type ProgramMedForlob
	} from '$lib/firestore/tildelinger';
	import { alleProdukter } from '$lib/content/produkter';
	import Icon from '$lib/components/Icon.svelte';
	import BekraeftModal from '$lib/components/BekraeftModal.svelte';

	type Deltager = {
		uid: string;
		email: string;
		firstName: string;
		lastName: string;
	};

	const UDSTYR: { id: Udstyr; label: string }[] = [
		{ id: 'ingen', label: 'Intet' },
		{ id: 'kettlebell', label: 'Kettlebell' },
		{ id: 'elastik', label: 'Elastik' },
		{ id: 'haandvaegte', label: 'Håndvægte' },
		{ id: 'forhojning', label: 'Forhøjning' }
	];

	const NIVEAUER: { id: Niveau; label: string }[] = [
		{ id: 'begynder', label: 'Begynder' },
		{ id: 'let_oevet', label: 'Let øvet' },
		{ id: 'oevet', label: 'Øvet' }
	];

	const getUser = getContext<() => User | null>('user');
	const adminUser = $derived(getUser());

	const forlobId = $derived(page.params.id ?? '');

	let forlob = $state<Forlob | null>(null);
	let programmer = $state<TrainingProgram[]>([]);
	let deltagere = $state<Deltager[]>([]);
	let alleProgrammerPaaTvaers = $state<ProgramMedForlob[]>([]);
	let programTildelinger = $state<ProgramTildeling[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);

	// Program-dialog state
	let viserDialog = $state(false);
	let dlgId = $state('');
	let dlgNavn = $state('');
	let dlgBeskrivelse = $state('');
	let dlgAntalDage = $state(21);
	let dlgUdstyr = $state<Udstyr[]>(['ingen']);
	let dlgNiveau = $state<Niveau>('begynder');
	let dlgGemmer = $state(false);
	let dlgFejl = $state<string | null>(null);

	// Tildelings-form state
	let valgtProgramKey = $state('');
	let tildelingsGemmer = $state(false);

	const forlobsProgramTildelinger = $derived(
		programTildelinger.filter((t) => t.modtagerType === 'forlob' && t.modtagerId === forlobId)
	);

	onMount(async () => {
		await indlaes();
	});

	async function indlaes() {
		loading = true;
		fejl = null;
		try {
			const [f, progs, allePaaTvaers, progTilds, usersSnap] = await Promise.all([
				hentForlob(forlobId),
				hentForlobsProgrammer(forlobId),
				hentAlleProgrammerPaaTvaers(),
				hentAlleProgramTildelinger(),
				getDocs(collection(db, 'users'))
			]);
			forlob = f;
			programmer = progs;
			alleProgrammerPaaTvaers = allePaaTvaers;
			programTildelinger = progTilds;
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
				.sort((a, b) => (a.firstName || a.email).localeCompare(b.firstName || b.email, 'da'));
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente data.';
		} finally {
			loading = false;
		}
	}

	function aabnDialog() {
		dlgId = '';
		dlgNavn = '';
		dlgBeskrivelse = '';
		dlgAntalDage = forlob?.antalDage ?? 21;
		dlgUdstyr = ['ingen'];
		dlgNiveau = 'begynder';
		dlgFejl = null;
		viserDialog = true;
	}

	function lukDialog() {
		viserDialog = false;
	}

	function toggleUdstyr(u: Udstyr) {
		dlgUdstyr = dlgUdstyr.includes(u) ? dlgUdstyr.filter((x) => x !== u) : [...dlgUdstyr, u];
	}

	async function opret() {
		const id = dlgId.trim();
		const navn = dlgNavn.trim();
		if (!id || !/^[a-z0-9_]+$/.test(id)) {
			dlgFejl = 'ID skal være snake_case (kun små bogstaver, tal og _).';
			return;
		}
		if (!navn) {
			dlgFejl = 'Navnet må ikke være tomt.';
			return;
		}
		if (dlgUdstyr.length === 0) {
			dlgFejl = 'Vælg mindst ét udstyr.';
			return;
		}
		if (programmer.some((p) => p.id === id)) {
			dlgFejl = 'Et program med dette ID findes allerede.';
			return;
		}
		dlgGemmer = true;
		dlgFejl = null;
		try {
			await gemForlobsProgram(forlobId, id, {
				navn,
				beskrivelse: dlgBeskrivelse.trim(),
				treaningsform: 'mikrotraening',
				antalDage: dlgAntalDage,
				dagligTid: 180,
				niveau: dlgNiveau,
				udstyr: dlgUdstyr,
				aktiv: true
			});
			await gemForlobsDage(forlobId, id, tommeDageSkelet(dlgAntalDage));
			lukDialog();
			await indlaes();
		} catch (e) {
			console.error(e);
			dlgFejl = 'Kunne ikke oprette programmet.';
		} finally {
			dlgGemmer = false;
		}
	}

	let sletProgram = $state<TrainingProgram | null>(null);
	let sletter = $state(false);
	function aabnSletBekraeft(p: TrainingProgram) {
		sletProgram = p;
	}
	async function bekraeftSlet() {
		const p = sletProgram;
		if (!p) return;
		sletter = true;
		try {
			await sletForlobsProgram(forlobId, p.id);
			await indlaes();
			sletProgram = null;
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke slette programmet.';
		} finally {
			sletter = false;
		}
	}

	async function tildelValgtProgramTilForlob() {
		if (!valgtProgramKey || !adminUser || tildelingsGemmer) return;
		const [progForlobId, programId] = valgtProgramKey.split('::');
		if (!progForlobId || !programId) return;
		tildelingsGemmer = true;
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
			tildelingsGemmer = false;
		}
	}

	async function fjernProgTildeling(id: string) {
		if (!id || tildelingsGemmer) return;
		tildelingsGemmer = true;
		try {
			await fjernProgramTildeling(id);
			programTildelinger = programTildelinger.filter((t) => t.id !== id);
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke fjerne tildeling.';
		} finally {
			tildelingsGemmer = false;
		}
	}

	function programNavn(progForlobId: string, programId: string): string {
		const p = alleProgrammerPaaTvaers.find(
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
		<a class="back" href="/app/admin/forlob/{forlobId}">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Forløb</span>
		</a>
		<div class="eyebrow">Admin · Træning</div>
		<h1>Træning</h1>
		<p class="page-sub">
			Programmer og tildelinger for {forlob?.navn ?? 'dette forløb'}.
		</p>
	</header>

	{#if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{/if}

	{#if loading}
		<div class="status-besked">Henter data…</div>
	{:else}
		<section class="sektion">
			<div class="sektion-titel">Programmer</div>
			<p class="sektion-sub">
				Programmer specifikke for {forlob?.navn ?? 'dette forløb'}. Klienten vælger imellem dem ved
				onboarding.
			</p>

			<button class="primary-knap full" type="button" onclick={aabnDialog}>+ Nyt program</button>

			{#if programmer.length === 0}
				<div class="status-besked">Ingen programmer endnu. Opret det første ovenfor.</div>
			{:else}
				<div class="program-liste">
					{#each programmer as p (p.id)}
						<div class="program-row">
							<a class="program-info" href="/app/admin/forlob/{forlobId}/traening/{p.id}">
								<div class="program-icon">
									<Icon name="flame" size={16} color="#fff" />
								</div>
								<div class="program-tekst">
									<div class="program-navn">
										{p.navn}
										{#if !p.aktiv}
											<span class="badge inaktiv">Inaktiv</span>
										{/if}
									</div>
									<div class="program-sub">
										{p.antalDage} dage · {p.udstyr.join(', ')}
									</div>
								</div>
								<Icon name="chevron-r" size={14} color="var(--text3)" />
							</a>
							<button
								class="slet-mini"
								type="button"
								onclick={() => aabnSletBekraeft(p)}
								aria-label="Slet program"
								title="Slet program"
							>
								×
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<section class="sektion">
			<div class="sektion-titel">Tildelinger til hele forløbet</div>
			<p class="sektion-sub">
				Tildelinger her gælder alle {deltagere.length} deltager{deltagere.length === 1 ? '' : 'e'} på
				forløbet.
			</p>

			{#if forlobsProgramTildelinger.length === 0}
				<p class="hint">Ingen programmer tildelt forløbet endnu.</p>
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
								onclick={() => fjernProgTildeling(t.id!)}
								disabled={tildelingsGemmer}
							>
								Fjern
							</button>
						</div>
					{/each}
				</div>
			{/if}

			<div class="tildel-form">
				<label class="felt">
					<span class="felt-label">Tildel et program til hele forløbet</span>
					<select class="felt-input" bind:value={valgtProgramKey} disabled={tildelingsGemmer}>
						<option value="">Vælg et program…</option>
						{#each alleProgrammerPaaTvaers as p (`${p.forlobId}::${p.program.id}`)}
							<option value={`${p.forlobId}::${p.program.id}`}>
								{p.program.navn} ({p.forlobNavn})
							</option>
						{/each}
					</select>
				</label>
				<button
					type="button"
					class="primary-knap full"
					onclick={tildelValgtProgramTilForlob}
					disabled={!valgtProgramKey || tildelingsGemmer}
				>
					{tildelingsGemmer ? 'Gemmer…' : 'Tildel til hele forløbet'}
				</button>
			</div>
		</section>

		<section class="sektion">
			<div class="sektion-titel">Deltagere ({deltagere.length})</div>
			<p class="sektion-sub">
				Klik på en deltager for at se og redigere hendes individuelle tildelinger.
			</p>

			{#if deltagere.length === 0}
				<p class="hint">Ingen deltagere på dette forløb endnu.</p>
			{:else}
				<div class="liste">
					{#each deltagere as d (d.uid)}
						{@const navn = `${d.firstName} ${d.lastName}`.trim()}
						<a class="rad" href={`/app/admin/forlob/${forlobId}/traening/kunde/${d.uid}`}>
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
	{/if}
</div>

{#if viserDialog}
	<div
		class="dialog-overlay"
		role="button"
		tabindex="0"
		onclick={lukDialog}
		onkeydown={(e) => e.key === 'Escape' && lukDialog()}
	></div>
	<div class="dialog" role="dialog" aria-modal="true">
		<header class="dialog-head">
			<div class="form-titel">Nyt træningsprogram</div>
			<button class="ikon-knap" type="button" onclick={lukDialog} aria-label="Luk">×</button>
		</header>

		<label class="felt">
			<span class="felt-label">ID (snake_case)</span>
			<input
				type="text"
				bind:value={dlgId}
				placeholder="fx traening_kettlebell"
				disabled={dlgGemmer}
			/>
		</label>

		<label class="felt">
			<span class="felt-label">Navn</span>
			<input
				type="text"
				bind:value={dlgNavn}
				placeholder="Træning med kettlebell"
				disabled={dlgGemmer}
			/>
		</label>

		<label class="felt">
			<span class="felt-label">Beskrivelse</span>
			<textarea bind:value={dlgBeskrivelse} rows="2" disabled={dlgGemmer}></textarea>
		</label>

		<label class="felt">
			<span class="felt-label">Antal dage</span>
			<input type="number" min="1" max="365" bind:value={dlgAntalDage} disabled={dlgGemmer} />
		</label>

		<div class="felt">
			<span class="felt-label">Udstyr</span>
			<div class="chip-row">
				{#each UDSTYR as u (u.id)}
					<button
						class="chip"
						class:aktiv={dlgUdstyr.includes(u.id)}
						type="button"
						onclick={() => toggleUdstyr(u.id)}
						disabled={dlgGemmer}
					>
						{u.label}
					</button>
				{/each}
			</div>
		</div>

		<div class="felt">
			<span class="felt-label">Niveau</span>
			<div class="chip-row">
				{#each NIVEAUER as n (n.id)}
					<button
						class="chip"
						class:aktiv={dlgNiveau === n.id}
						type="button"
						onclick={() => (dlgNiveau = n.id)}
						disabled={dlgGemmer}
					>
						{n.label}
					</button>
				{/each}
			</div>
		</div>

		{#if dlgFejl}
			<div class="fejl-besked">{dlgFejl}</div>
		{/if}

		<div class="dialog-knapper">
			<button class="form-knap primary" type="button" onclick={opret} disabled={dlgGemmer}>
				{dlgGemmer ? 'Opretter...' : 'Opret'}
			</button>
		</div>
	</div>
{/if}

{#if sletProgram}
	<BekraeftModal
		titel={'Slet "' + sletProgram.navn + '"?'}
		beskrivelse="Programmet og alle dets dage slettes permanent og kan ikke gendannes."
		bekraeftTekst="Slet"
		destruktiv
		arbejder={sletter}
		onBekraeft={() => void bekraeftSlet()}
		onAnnuller={() => (sletProgram = null)}
	/>
{/if}

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
		line-height: 1.05;
		color: var(--text);
	}

	.page-sub {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		margin: 6px 0 0;
		line-height: 1.4;
	}

	.sektion {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 16px;
		margin-bottom: 14px;
	}

	.sektion-titel {
		font-size: calc(15px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.sektion-sub {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		margin: 4px 0 12px;
		line-height: 1.4;
	}

	.hint {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		margin: 6px 0 0;
	}

	.primary-knap.full {
		display: block;
		width: 100%;
		padding: 12px;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 10px;
		border: 1px dashed var(--terra);
		background: var(--tdim);
		color: var(--terra);
		cursor: pointer;
		font-family: var(--ff-b);
		margin-bottom: 12px;
	}

	.primary-knap.full:hover {
		background: var(--white);
	}

	.primary-knap.full:disabled {
		opacity: 0.5;
		cursor: not-allowed;
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

	.program-liste {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.program-row {
		display: flex;
		align-items: stretch;
		gap: 8px;
	}

	.program-info {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		text-decoration: none;
		color: inherit;
	}

	.program-info:hover {
		background: var(--bg2);
	}

	.program-icon {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		background: #c9a07a;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.program-tekst {
		flex: 1;
		min-width: 0;
	}

	.program-navn {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.program-sub {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.slet-mini {
		width: 32px;
		flex-shrink: 0;
		border: 1px solid #e8c8c1;
		background: var(--white);
		color: #b8503f;
		border-radius: 12px;
		font-size: calc(18px * var(--fs-scale, 1));
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.slet-mini:hover {
		background: #fbeeea;
	}

	.badge {
		font-size: calc(9.5px * var(--fs-scale, 1));
		letter-spacing: 0.1em;
		text-transform: uppercase;
		padding: 2px 7px;
		border-radius: 99px;
		font-weight: 600;
	}

	.badge.inaktiv {
		background: var(--bg2);
		color: var(--text3);
	}

	.liste {
		border: 1px solid var(--border);
		border-radius: 10px;
		overflow: hidden;
		margin-bottom: 12px;
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
		font-family: var(--ff-b);
	}

	.fjern-knap:hover:not(:disabled) {
		background: var(--bg2);
	}

	.fjern-knap:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.tildel-form {
		margin-top: 8px;
		padding-top: 12px;
		border-top: 1px dashed var(--border);
		margin-bottom: 12px;
	}

	.felt {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-bottom: 10px;
	}

	.felt-label {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.felt-input,
	.felt input,
	.felt textarea {
		padding: 10px 12px;
		font-size: calc(14px * var(--fs-scale, 1));
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-b);
		outline: none;
	}

	.felt textarea {
		resize: vertical;
		line-height: 1.5;
	}

	.felt input:focus,
	.felt textarea:focus,
	.felt-input:focus {
		border-color: var(--terra);
	}

	.dialog-overlay {
		position: fixed;
		inset: 0;
		background: rgba(20, 14, 18, 0.7);
		z-index: 60;
		border: none;
	}

	.dialog {
		position: fixed;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		background: var(--white);
		border-radius: 16px;
		width: calc(100% - 24px);
		max-width: 520px;
		max-height: 92vh;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 18px;
		z-index: 61;
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
	}

	.dialog-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.form-titel {
		font-family: var(--ff-d);
		font-size: calc(18px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.ikon-knap {
		width: 32px;
		height: 32px;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text2);
		font-size: calc(18px * var(--fs-scale, 1));
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.chip-row {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.chip {
		padding: 7px 12px;
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 500;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text2);
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.chip.aktiv {
		background: var(--terra);
		color: #fff;
		border-color: var(--terra);
	}

	.chip:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.fejl-besked {
		padding: 10px 12px;
		background: #fbeeea;
		border: 1px solid #f0d6cf;
		border-radius: 8px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: #8a4a3e;
	}

	.dialog-knapper {
		display: flex;
		gap: 10px;
		justify-content: flex-end;
	}

	.form-knap {
		padding: 11px 18px;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 10px;
		border: none;
		cursor: pointer;
		font-family: var(--ff-b);
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
