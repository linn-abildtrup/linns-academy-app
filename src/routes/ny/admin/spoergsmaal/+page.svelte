<script lang="ts">
	// ============================================================
	// Spoergsmaal fra kunder, i det nye design.
	//
	// Foerste af de 19 gamle admin-sider der laves om. Linns valg 1.
	// september 2026: den bruges mest, og den staar som det foerste tal paa
	// admin-forsiden.
	//
	// DEN GAMLE SIDE PAA /app/admin/spoergsmaal ER UROERT og bliver
	// staaende. Saa kan Linn sammenligne, og gaar noget galt her, er der en
	// vej tilbage der virker. Det er ogsaa hele grunden til at de to
	// admin-flader maa koere ved siden af hinanden.
	//
	// LOGIKKEN ER FLYTTET, IKKE SKREVET OM. Der kaldes praecis de samme
	// funktioner som den gamle side: svarPaaSpoergsmaal, sendSvarNoti3 og
	// gemSvarHistorik. Skrev jeg dem forfra, ville to sider kunne komme til
	// at gemme forskelligt, og det er kundedata.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import { getAuth } from 'firebase/auth';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import {
		hentAlleSpoergsmaal,
		opdaterSpoergsmaalStatus,
		sletSpoergsmaal,
		svarPaaSpoergsmaal,
		type KlientSpoergsmaal,
		type SpoergsmaalStatus
	} from '$lib/firestore/spoergsmaal';
	import { hentAlleForlob, hentNavnePerEmail } from '$lib/firestore/forlob';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import { gemSvarHistorik } from '$lib/firestore/svarHistorik';
	import { sendSvarNoti3 } from '$lib/utils/sendSvarNoti3';
	import { klientSoegeMatch } from '$lib/utils/klientSoegning';
	import AdmSide from '$lib/components/admin/AdmSide.svelte';
	import AdmKort from '$lib/components/admin/AdmKort.svelte';
	import AdmKnap from '$lib/components/admin/AdmKnap.svelte';
	import AdmMaerkat from '$lib/components/admin/AdmMaerkat.svelte';
	import AdmSoeg from '$lib/components/admin/AdmSoeg.svelte';
	import AdmTom from '$lib/components/admin/AdmTom.svelte';

	const hentUser = getContext<() => User | null>('user');
	const maaVaereHer = $derived(isAdmin(hentUser()));

	interface AiUdkast {
		udkast: string;
		lavSikkerhed: boolean;
		skip: boolean;
		skipBegrundelse: string | null;
		antalKundeHistorik?: number;
		antalRelevanteSvar?: number;
	}

	type Filter = 'ubesvarede' | 'alle' | SpoergsmaalStatus;

	const FILTRE: { id: Filter; label: string }[] = [
		{ id: 'ubesvarede', label: 'Venter på dig' },
		{ id: 'alle', label: 'Alle' },
		{ id: 'ny', label: 'Nye' },
		{ id: 'laest', label: 'Læste' },
		{ id: 'besvaret', label: 'Besvarede' },
		{ id: 'brugt', label: 'Brugte' }
	];

	const STATUS_LABELS: Record<SpoergsmaalStatus, string> = {
		ny: 'Ny',
		laest: 'Læst',
		besvaret: 'Besvaret',
		brugt: 'Brugt'
	};

	let alle = $state<KlientSpoergsmaal[]>([]);
	let alleForlob = $state<Forlob[]>([]);
	let navnePerEmail = $state<Map<string, string>>(new Map());
	let henter = $state(true);
	let fejl = $state('');
	let besked = $state('');

	// Starter paa dem der venter. Det er det man kommer for.
	let aktivtFilter = $state<Filter>('ubesvarede');
	let forlobFilter = $state('alle');
	let soeg = $state('');

	let aaben = $state('');
	let udkast = $state<Record<string, string>>({});
	let sender = $state('');
	let ai = $state<Record<string, AiUdkast>>({});
	let aiHenter = $state<Record<string, boolean>>({});
	let aiFejl = $state<Record<string, string>>({});
	let aiBrugt = $state<Record<string, boolean>>({});
	let sletId = $state('');
	let sletter = $state(false);
	let samtaleUid = $state('');

	onMount(() => void genindlaes());

	async function genindlaes() {
		henter = true;
		fejl = '';
		try {
			[alle, alleForlob, navnePerEmail] = await Promise.all([
				hentAlleSpoergsmaal(),
				hentAlleForlob().then((fs) => fs.filter((f) => f.aktiv !== false)),
				hentNavnePerEmail().catch(() => new Map<string, string>())
			]);
		} catch (e) {
			console.error('[admin] spørgsmål', e);
			fejl = 'Kunne ikke hente spørgsmålene.';
		} finally {
			henter = false;
		}
	}

	function sigTil(t: string) {
		besked = t;
		setTimeout(() => {
			if (besked === t) besked = '';
		}, 2400);
	}

	function navnFor(q: KlientSpoergsmaal): string {
		return navnePerEmail.get((q.email ?? '').toLowerCase()) ?? q.email ?? 'Ukendt';
	}

	function passerForlob(q: KlientSpoergsmaal): boolean {
		if (forlobFilter === 'alle') return true;
		if (forlobFilter === 'modulbrugere') return q.kundeType === 'modulbruger';
		if (forlobFilter === 'uden-forlob') return !q.forlobId;
		return q.forlobId === forlobFilter;
	}

	// Det NYESTE spoergsmaal pr kunde der ikke er besvaret. Uden det ville
	// en samtale med fem spoergsmaal fylde fem raekker i listen over hvad
	// der venter, selv om der kun er ét svar at skrive.
	const venterIds = $derived.by<Set<string>>(() => {
		const set = new Set<string>();
		const nyeste = new Map<string, KlientSpoergsmaal>();
		for (const q of alle.filter(passerForlob)) {
			const eks = nyeste.get(q.uid);
			const t = q.oprettet?.toMillis?.() ?? 0;
			const et = eks?.oprettet?.toMillis?.() ?? 0;
			if (!eks || t > et) nyeste.set(q.uid, q);
		}
		for (const q of nyeste.values()) {
			if (q.svar) continue;
			if (q.status === 'besvaret' || q.status === 'brugt') continue;
			set.add(q.id);
		}
		return set;
	});

	const listen = $derived(
		alle
			.filter(passerForlob)
			.filter((q) => {
				if (aktivtFilter === 'alle') return true;
				if (aktivtFilter === 'ubesvarede') return venterIds.has(q.id);
				return q.status === aktivtFilter;
			})
			.filter((q) => klientSoegeMatch(`${navnFor(q)} ${q.email ?? ''}`, soeg))
	);

	const samtale = $derived(
		samtaleUid
			? alle
					.filter((q) => q.uid === samtaleUid)
					.sort((a, b) => (a.oprettet?.toMillis?.() ?? 0) - (b.oprettet?.toMillis?.() ?? 0))
			: []
	);

	function dato(t: { toDate?: () => Date } | null | undefined): string {
		const d = t?.toDate?.();
		if (!d) return '—';
		return d.toLocaleDateString('da-DK', {
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function aabnSvar(q: KlientSpoergsmaal) {
		aaben = q.id;
		if (udkast[q.id] === undefined) udkast[q.id] = q.svar ?? '';
	}

	async function genererUdkast(q: KlientSpoergsmaal, force = false) {
		aiHenter[q.id] = true;
		aiFejl[q.id] = '';
		try {
			const idToken = await getAuth().currentUser?.getIdToken();
			if (!idToken) throw new Error('Du er ikke logget ind');
			const res = await fetch('/api/svar-udkast', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
				body: JSON.stringify({ spoergsmaalId: q.id, force })
			});
			if (!res.ok) throw new Error(`AI-tjenesten svarede ${res.status}`);
			ai[q.id] = (await res.json()) as AiUdkast;
		} catch (e) {
			console.error('[admin] udkast', e);
			aiFejl[q.id] = e instanceof Error ? e.message : 'Kunne ikke lave et udkast';
		} finally {
			aiHenter[q.id] = false;
		}
	}

	function brugUdkast(id: string) {
		const u = ai[id];
		if (!u) return;
		udkast[id] = u.udkast;
		aiBrugt[id] = true;
	}

	async function sendSvar(id: string) {
		const tekst = (udkast[id] ?? '').trim();
		if (!tekst) {
			sigTil('Skriv et svar først');
			return;
		}
		const q = alle.find((x) => x.id === id);
		sender = id;
		try {
			await svarPaaSpoergsmaal(id, tekst);
			// Sig til paa kundens telefon. Kun 3.0-kunder der har sagt ja
			// faar noget, og fejler det, er svaret stadig gemt.
			if (q)
				void sendSvarNoti3(q.uid, tekst, {
					spoergsmaal: q.spoergsmaal,
					sendtMs: q.oprettet?.toDate?.().getTime()
				});
			alle = alle.map((x) => (x.id === id ? { ...x, svar: tekst, status: 'besvaret' } : x));
			// Gemmes i baggrunden. Det er de her svar AI'en laerer din stemme
			// af, saa de maa ikke springes over.
			if (q) {
				const u = ai[id];
				const brugte = aiBrugt[id] === true;
				void gemSvarHistorik({
					spoergsmaalId: id,
					forlobId: q.forlobId ?? '',
					klientUid: q.uid,
					klientEmail: q.email,
					spoergsmaalTekst: q.spoergsmaal,
					udkastTekst: u ? u.udkast : null,
					endeligTekst: tekst,
					brugteUdkast: brugte,
					redigeretEfterBrug: brugte && u ? tekst !== u.udkast : false,
					lavSikkerhed: u?.lavSikkerhed === true
				}).catch((e) => console.warn('Kunne ikke gemme svarHistorik:', e));
			}
			aaben = '';
			sigTil('Svaret er sendt');
		} catch (e) {
			console.error('[admin] send svar', e);
			sigTil('Kunne ikke sende svaret. Prøv igen');
		} finally {
			sender = '';
		}
	}

	async function saetStatus(id: string, ny: SpoergsmaalStatus) {
		try {
			await opdaterSpoergsmaalStatus(id, ny);
			alle = alle.map((q) => (q.id === id ? { ...q, status: ny } : q));
			sigTil('Status er rettet');
		} catch (e) {
			console.error('[admin] status', e);
			sigTil('Kunne ikke rette status');
		}
	}

	async function slet() {
		if (!sletId) return;
		sletter = true;
		try {
			await sletSpoergsmaal(sletId);
			alle = alle.filter((q) => q.id !== sletId);
			sletId = '';
			sigTil('Spørgsmålet er slettet');
		} catch (e) {
			console.error('[admin] slet', e);
			sigTil('Kunne ikke slette');
		} finally {
			sletter = false;
		}
	}

	function csvFelt(s: string): string {
		return `"${(s ?? '').replace(/"/g, '""')}"`;
	}

	function eksporter() {
		const raekker = [
			['Dato', 'Navn', 'Email', 'Forløb', 'Spørgsmål', 'Svar', 'Status'].join(';'),
			...listen.map((q) =>
				[
					csvFelt(dato(q.oprettet)),
					csvFelt(navnFor(q)),
					csvFelt(q.email ?? ''),
					csvFelt(q.forlobNavn ?? ''),
					csvFelt(q.spoergsmaal),
					csvFelt(q.svar ?? ''),
					csvFelt(STATUS_LABELS[q.status] ?? q.status)
				].join(';')
			)
		].join('\n');
		const url = URL.createObjectURL(new Blob(['﻿' + raekker], { type: 'text/csv' }));
		const a = document.createElement('a');
		a.href = url;
		a.download = `spoergsmaal-${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<svelte:head><title>Spørgsmål · Admin</title></svelte:head>

{#if !maaVaereHer}
	<p class="sp-kun">Siden er kun for admin.</p>
{:else}
	<AdmSide
		titel="Spørgsmål fra kunder"
		under="Svar, og send som besked. Kunder på 3.0 der har sagt ja får også en besked på telefonen."
		bred
	>
		{#snippet handling()}
			<AdmKnap onclick={eksporter} disabled={listen.length === 0}>Hent som CSV</AdmKnap>
		{/snippet}

		{#if besked}<div class="sp-besked">{besked}</div>{/if}

		<div class="sp-filtre">
			{#each FILTRE as f (f.id)}
				<button
					type="button"
					class="sp-chip"
					class:paa={aktivtFilter === f.id}
					onclick={() => (aktivtFilter = f.id)}
				>
					{f.label}
					{#if f.id === 'ubesvarede' && venterIds.size > 0}
						<span class="sp-tal">{venterIds.size}</span>
					{/if}
				</button>
			{/each}
		</div>

		<div class="sp-raek">
			<AdmSoeg bind:vaerdi={soeg} placeholder="Søg efter navn eller mail…" />
			<select class="sp-vaelg" bind:value={forlobFilter}>
				<option value="alle">Alle forløb</option>
				<option value="modulbrugere">Abonnenter</option>
				<option value="uden-forlob">Uden forløb</option>
				{#each alleForlob as f (f.id)}
					<option value={f.id}>{f.navn}</option>
				{/each}
			</select>
		</div>

		<p class="sp-antal">
			{listen.length}
			{listen.length === 1 ? 'spørgsmål' : 'spørgsmål'}
		</p>

		<!-- SIDSTE UDVEJ. Kaeden skal altid tegne noget, ellers staar man
		     med en blank side. Se AdmTom. -->
		{#if henter}
			<AdmTom tekst="Henter spørgsmålene…" />
		{:else if fejl}
			<AdmTom tekst={fejl} fejl>
				{#snippet handling()}
					<AdmKnap onclick={genindlaes}>Prøv igen</AdmKnap>
				{/snippet}
			</AdmTom>
		{:else if listen.length === 0}
			<AdmTom
				tekst={aktivtFilter === 'ubesvarede'
					? 'Der er ingen spørgsmål der venter på dig. Alt er besvaret.'
					: 'Ingen spørgsmål matcher det du har valgt.'}
			/>
		{:else}
			{#each listen as q (q.id)}
				<AdmKort vigtig={false} ro={venterIds.has(q.id)}>
					<div class="sp-hoved">
						<div>
							<button type="button" class="sp-navn" onclick={() => (samtaleUid = q.uid)}>
								{navnFor(q)}
							</button>
							<div class="sp-meta">
								{dato(q.oprettet)}
								{#if q.forlobNavn}· {q.forlobNavn}{/if}
							</div>
						</div>
						<AdmMaerkat farve={q.svar ? 'klar' : venterIds.has(q.id) ? 'ro' : 'stille'}>
							{q.svar ? 'Besvaret' : (STATUS_LABELS[q.status] ?? q.status)}
						</AdmMaerkat>
					</div>

					<p class="sp-tekst">{q.spoergsmaal}</p>

					{#if q.aiSvar}
						<details class="sp-ai-svar">
							<summary>Hun var ikke tilfreds med AI'ens svar. Se hvad den skrev</summary>
							<p>{q.aiSvar}</p>
						</details>
					{/if}

					{#if q.svar && aaben !== q.id}
						<div class="sp-svar">
							<span class="sp-svar-mrk">Dit svar</span>
							<p>{q.svar}</p>
						</div>
					{/if}

					{#if aaben === q.id}
						<div class="sp-form">
							{#if ai[q.id]}
								<div class="sp-udkast">
									<div class="sp-udkast-top">
										<span>AI'ens udkast</span>
										{#if ai[q.id].lavSikkerhed}
											<AdmMaerkat farve="fare">Usikker</AdmMaerkat>
										{/if}
									</div>
									{#if ai[q.id].skip}
										<p class="sp-skip">
											{ai[q.id].skipBegrundelse ??
												'AI en foreslår at du selv skriver det her svar.'}
										</p>
									{:else}
										<p>{ai[q.id].udkast}</p>
										<div class="sp-udkast-knap">
											<AdmKnap onclick={() => brugUdkast(q.id)}>Brug udkastet</AdmKnap>
											<AdmKnap onclick={() => genererUdkast(q, true)}>Lav et nyt</AdmKnap>
										</div>
										<p class="sp-grundlag">
											Bygget på {ai[q.id].antalKundeHistorik ?? 0} tidligere svar til hende og
											{ai[q.id].antalRelevanteSvar ?? 0} lignende svar fra arkivet.
										</p>
									{/if}
								</div>
							{:else if aiHenter[q.id]}
								<p class="sp-henter">Laver et udkast…</p>
							{:else}
								<AdmKnap onclick={() => genererUdkast(q)}>Lav et udkast med AI</AdmKnap>
							{/if}

							{#if aiFejl[q.id]}<p class="sp-ai-fejl">{aiFejl[q.id]}</p>{/if}

							<textarea
								class="sp-felt"
								rows="6"
								placeholder="Skriv dit svar…"
								bind:value={udkast[q.id]}
								disabled={sender === q.id}
							></textarea>

							<div class="sp-knapper">
								<AdmKnap slags="primaer" disabled={sender === q.id} onclick={() => sendSvar(q.id)}>
									{sender === q.id ? 'Sender…' : 'Send svaret'}
								</AdmKnap>
								<AdmKnap disabled={sender === q.id} onclick={() => (aaben = '')}>Annuller</AdmKnap>
							</div>
						</div>
					{:else}
						<div class="sp-knapper">
							<AdmKnap slags="primaer" onclick={() => aabnSvar(q)}>
								{q.svar ? 'Ret svaret' : 'Svar'}
							</AdmKnap>
							{#if q.status !== 'laest' && !q.svar}
								<AdmKnap onclick={() => saetStatus(q.id, 'laest')}>Marker som læst</AdmKnap>
							{/if}
							<AdmKnap onclick={() => (samtaleUid = q.uid)}>Se hele samtalen</AdmKnap>
							{#if sletId === q.id}
								<AdmKnap slags="fare" disabled={sletter} onclick={slet}>
									{sletter ? 'Sletter…' : 'Ja, slet'}
								</AdmKnap>
								<AdmKnap onclick={() => (sletId = '')}>Fortryd</AdmKnap>
							{:else}
								<AdmKnap slags="fare" onclick={() => (sletId = q.id)}>Slet</AdmKnap>
							{/if}
						</div>
					{/if}
				</AdmKort>
			{/each}
		{/if}

		{#if samtaleUid}
			<div class="sp-samtale">
				<div class="sp-samtale-top">
					<h2>Hele samtalen</h2>
					<AdmKnap onclick={() => (samtaleUid = '')}>Luk</AdmKnap>
				</div>
				{#each samtale as s (s.id)}
					<div class="sp-s-post">
						<div class="sp-meta">{dato(s.oprettet)}</div>
						<p class="sp-tekst">{s.spoergsmaal}</p>
						{#if s.svar}
							<div class="sp-svar">
								<span class="sp-svar-mrk">Dit svar</span>
								<p>{s.svar}</p>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</AdmSide>
{/if}

<style>
	.sp-kun {
		padding: 24px 18px;
		color: var(--ink-2);
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
	}

	.sp-besked {
		margin-bottom: 12px;
		padding: 11px 15px;
		background: var(--sage-tint, #e7efe5);
		border-radius: 12px;
		color: var(--sage-tekst, #46603f);
		font-size: calc(13.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
	}

	.sp-filtre {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 10px;
	}

	/* Baggrunden staar eksplicit. Se noten i AdmKnap. */
	.sp-chip {
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 8px 14px;
		background: var(--paper-2, #f6f0e7);
		border: 1px solid var(--line, #e8dfd1);
		border-radius: 99px;
		color: var(--ink-2, #6f5f57);
		font-size: calc(12.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-family: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.sp-chip.paa {
		background: var(--plum, #7c4f63);
		border-color: var(--plum, #7c4f63);
		color: #fff;
	}

	.sp-tal {
		padding: 0 7px;
		border-radius: 99px;
		background: var(--honey, #d6a15e);
		color: #fff;
		font-size: calc(11px * var(--fs-scale, 1) * var(--adm-skala, 1));
	}

	.sp-chip.paa .sp-tal {
		background: rgba(255, 255, 255, 0.26);
	}

	.sp-raek {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		margin-bottom: 10px;
	}

	.sp-raek :global(.asg) {
		flex: 1 1 220px;
		width: auto;
	}

	.sp-vaelg {
		padding: 11px 15px;
		background: var(--paper-2, #f6f0e7);
		border: 1px solid var(--line, #e8dfd1);
		border-radius: 99px;
		color: var(--espresso, #382c2a);
		font-size: calc(13.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-family: inherit;
	}

	.sp-antal {
		margin: 0 0 12px;
		font-size: calc(12px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3, #a3948a);
	}

	.sp-hoved {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 8px;
	}

	.sp-navn {
		padding: 0;
		background: none;
		border: none;
		color: var(--espresso, #382c2a);
		font-size: calc(14.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-family: inherit;
		font-weight: 600;
		cursor: pointer;
		text-align: left;
	}

	.sp-meta {
		margin-top: 2px;
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3, #a3948a);
	}

	.sp-tekst {
		margin: 0 0 10px;
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.sp-svar {
		padding: 11px 14px;
		background: var(--paper, #fbf8f2);
		border-radius: 12px;
		margin-bottom: 10px;
	}

	.sp-svar-mrk {
		display: block;
		font-size: calc(10.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 700;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--ink-3, #a3948a);
		margin-bottom: 4px;
	}

	.sp-svar p {
		margin: 0;
		font-size: calc(13.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.sp-ai-svar {
		margin-bottom: 10px;
		font-size: calc(12.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-2, #6f5f57);
	}

	.sp-ai-svar summary {
		cursor: pointer;
		color: var(--ink-3, #a3948a);
	}

	.sp-ai-svar p {
		margin: 7px 0 0;
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.sp-form {
		margin-top: 4px;
	}

	.sp-udkast {
		padding: 13px 15px;
		background: var(--plum-tint, #f1e5e8);
		border-radius: 12px;
		margin-bottom: 10px;
	}

	.sp-udkast-top {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: calc(10.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 700;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--plum-deep, #5e3a4b);
		margin-bottom: 6px;
	}

	.sp-udkast p {
		margin: 0;
		font-size: calc(13.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.sp-udkast-knap {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		margin-top: 10px;
	}

	.sp-grundlag,
	.sp-skip,
	.sp-henter {
		margin: 8px 0 0;
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3, #a3948a);
		line-height: 1.45;
	}

	.sp-ai-fejl {
		margin: 8px 0;
		font-size: calc(12px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ler-tekst, #8a5439);
		font-weight: 600;
	}

	.sp-felt {
		display: block;
		width: 100%;
		margin: 10px 0;
		padding: 12px 14px;
		background: var(--paper, #fbf8f2);
		border: 1px solid var(--line, #e8dfd1);
		border-radius: 12px;
		color: var(--espresso, #382c2a);
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-family: inherit;
		line-height: 1.5;
		box-sizing: border-box;
		resize: vertical;
	}

	.sp-knapper {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.sp-samtale {
		margin-top: 22px;
		padding: 18px 20px;
		background: var(--paper-2, #f6f0e7);
		border-radius: 16px;
	}

	.sp-samtale-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 12px;
	}

	.sp-samtale-top h2 {
		margin: 0;
		font-size: calc(16px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
	}

	.sp-s-post {
		padding: 12px 0;
		border-top: 1px solid var(--line, #e8dfd1);
	}
</style>
