<script lang="ts">
	import { onMount } from 'svelte';
	import { getAuth } from 'firebase/auth';
	import Icon from '$lib/components/Icon.svelte';
	import BekraeftModal from '$lib/components/BekraeftModal.svelte';
	import {
		hentAlleSpoergsmaal,
		opdaterSpoergsmaalStatus,
		sletSpoergsmaal,
		svarPaaSpoergsmaal,
		type KlientSpoergsmaal,
		type SpoergsmaalStatus
	} from '$lib/firestore/spoergsmaal';
	import { hentAlleForlob } from '$lib/firestore/forlob';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import { gemSvarHistorik } from '$lib/firestore/svarHistorik';
	import { klientSoegeMatch } from '$lib/utils/klientSoegning';

	interface AiUdkast {
		udkast: string;
		lavSikkerhed: boolean;
		skip: boolean;
		skipBegrundelse: string | null;
	}

	type Filter = 'alle' | SpoergsmaalStatus | 'ubesvarede';

	const FILTRE: { id: Filter; label: string }[] = [
		{ id: 'alle', label: 'Alle' },
		{ id: 'ny', label: 'Nye' },
		{ id: 'laest', label: 'Læste' },
		{ id: 'besvaret', label: 'Besvarede' },
		{ id: 'brugt', label: 'Brugte' },
		{ id: 'ubesvarede', label: 'Ubesvarede' }
	];

	const STATUS_LABELS: Record<SpoergsmaalStatus, string> = {
		ny: 'Ny',
		laest: 'Læst',
		besvaret: 'Besvaret',
		brugt: 'Brugt'
	};

	let alle = $state<KlientSpoergsmaal[]>([]);
	let alleForlob = $state<Forlob[]>([]);
	let aktivtFilter = $state<Filter>('alle');
	let klientSoeg = $state('');
	// Forløbs-filter: 'alle' (alt), 'modulbrugere', 'uden-forlob' eller et forlobId
	let aktivtForlobFilter = $state<string>('alle');
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let toast = $state<string | null>(null);

	// Svar-state pr spørgsmål-id (kun det åbne svar-felt vises ad gangen)
	let svarUdkast = $state<Record<string, string>>({});
	let svarSender = $state<string | null>(null);
	let aabenSvarId = $state<string | null>(null);
	let aiUdkast = $state<Record<string, AiUdkast>>({});
	let aiUdkastLoader = $state<Record<string, boolean>>({});
	let aiUdkastFejl = $state<Record<string, string>>({});
	let aiUdkastSkjult = $state<Record<string, boolean>>({});
	let aiUdkastBrugt = $state<Record<string, boolean>>({});

	// Hele-samtalen-pop-up: hvis sat, vises alle spørgsmål fra denne uid
	// kronologisk i en modal med samme svar-funktionalitet som hovedlisten.
	let visSamtaleForUid = $state<string | null>(null);
	const samtaleSpoergsmaal = $derived.by(() => {
		if (!visSamtaleForUid) return [] as KlientSpoergsmaal[];
		return alle
			.filter((q) => q.uid === visSamtaleForUid)
			.slice()
			.sort((a, b) => {
				const at = a.oprettet?.toDate?.()?.getTime() ?? 0;
				const bt = b.oprettet?.toDate?.()?.getTime() ?? 0;
				return at - bt;
			});
	});
	const samtaleEmail = $derived(samtaleSpoergsmaal[0]?.email ?? '');

	function aabnSamtale(uid: string) {
		visSamtaleForUid = uid;
	}

	function lukSamtale() {
		visSamtaleForUid = null;
	}

	function passerForlobFilter(q: KlientSpoergsmaal): boolean {
		if (aktivtForlobFilter === 'alle') return true;
		if (aktivtForlobFilter === 'modulbrugere') return q.kundeType === 'modulbruger';
		if (aktivtForlobFilter === 'uden-forlob') return !q.forlobId;
		return q.forlobId === aktivtForlobFilter;
	}

	// "Ubesvarede"-filter viser kun det NYESTE spm pr ubesvaret samtale
	// (inden for det aktive forløbs-filter). Et spm er "den ubesvarede" hvis
	// det er det seneste i sin kundes samtale OG hverken har svar-felt
	// udfyldt eller status='besvaret'/'brugt'. Beregnes pr filter-skift saa
	// kunden ser praecis hvad der venter i den valgte gruppe.
	const ubesvaredeSpmIds = $derived.by<Set<string>>(() => {
		const set = new Set<string>();
		const nyestePrUid = new Map<string, KlientSpoergsmaal>();
		for (const q of alle.filter(passerForlobFilter)) {
			const eks = nyestePrUid.get(q.uid);
			const qTime = q.oprettet?.toDate?.()?.getTime?.() ?? 0;
			const eksTime = eks?.oprettet?.toDate?.()?.getTime?.() ?? 0;
			if (!eks || qTime > eksTime) nyestePrUid.set(q.uid, q);
		}
		for (const q of nyestePrUid.values()) {
			if (q.svar) continue;
			if (q.status === 'besvaret' || q.status === 'brugt') continue;
			set.add(q.id);
		}
		return set;
	});

	const filtreret = $derived(
		alle
			.filter(passerForlobFilter)
			.filter((q) => {
				if (aktivtFilter === 'alle') return true;
				if (aktivtFilter === 'ubesvarede') return ubesvaredeSpmIds.has(q.id);
				return q.status === aktivtFilter;
			})
			.filter((q) => klientSoegeMatch(q.email ?? '', klientSoeg))
	);

	// Forløbs-grupper til dropdown-filter med antal og ubesvarede.
	// Bygges ud fra spørgsmålenes forlobId/forlobNavn-felter (snapshot ved
	// oprettelse), så et forløb der havde spørgsmål før vises selvom det
	// senere er slettet.
	type Gruppe = { value: string; label: string; antal: number; ubesvaret: number };
	const forlobsGrupper = $derived.by<Gruppe[]>(() => {
		// "Ubesvaret" tælles pr SAMTALE (uid), ikke pr enkelt spørgsmål.
		// Logik: hvis det NYESTE spørgsmål i en kundes samtale har et svar
		// ELLER er manuelt markeret status='besvaret'/'brugt', regner vi hele
		// samtalen som besvaret. Kommer der et nyt spørgsmål senere bliver
		// det nyeste igen ubesvaret, og samtalen tælles igen.
		function erBesvaret(q: KlientSpoergsmaal): boolean {
			if (q.svar) return true;
			if (q.status === 'besvaret' || q.status === 'brugt') return true;
			return false;
		}
		function forlobNoegle(q: KlientSpoergsmaal): string {
			if (q.forlobId) return q.forlobId;
			if (q.kundeType === 'modulbruger') return '__modulbrugere';
			return '__uden-forlob';
		}
		function getTime(q: KlientSpoergsmaal): number {
			return q.oprettet?.toDate?.()?.getTime?.() ?? 0;
		}
		// Nyeste spørgsmål pr uid (til 'Alle')
		const nyesteOverallPrUid = new Map<string, KlientSpoergsmaal>();
		// Nyeste spørgsmål pr (uid, forløb) — pr forløbsfilter
		const nyestePrUidOgForlob = new Map<string, KlientSpoergsmaal>();
		for (const q of alle) {
			const o = nyesteOverallPrUid.get(q.uid);
			if (!o || getTime(q) > getTime(o)) nyesteOverallPrUid.set(q.uid, q);
			const key = `${q.uid}::${forlobNoegle(q)}`;
			const i = nyestePrUidOgForlob.get(key);
			if (!i || getTime(q) > getTime(i)) nyestePrUidOgForlob.set(key, q);
		}
		const ubesvaredeOverall = [...nyesteOverallPrUid.values()].filter((q) => !erBesvaret(q)).length;
		const ubesvaredePrForlob = new Map<string, number>();
		for (const nyeste of nyestePrUidOgForlob.values()) {
			if (erBesvaret(nyeste)) continue;
			const fk = forlobNoegle(nyeste);
			ubesvaredePrForlob.set(fk, (ubesvaredePrForlob.get(fk) ?? 0) + 1);
		}

		const map = new Map<string, { navn: string; antal: number; ubesvaret: number }>();
		let modulAntal = 0;
		let udenAntal = 0;
		for (const q of alle) {
			if (q.forlobId) {
				const eks = map.get(q.forlobId);
				if (eks) {
					eks.antal += 1;
				} else {
					map.set(q.forlobId, {
						navn: q.forlobNavn ?? q.forlobId,
						antal: 1,
						ubesvaret: 0
					});
				}
			} else if (q.kundeType === 'modulbruger') {
				modulAntal += 1;
			} else {
				udenAntal += 1;
			}
		}
		// Sæt ubesvaret-tællerne fra samtale-baseret beregning
		for (const [forlobId, info] of map) {
			info.ubesvaret = ubesvaredePrForlob.get(forlobId) ?? 0;
		}
		const modulUbesvaret = ubesvaredePrForlob.get('__modulbrugere') ?? 0;
		const udenUbesvaret = ubesvaredePrForlob.get('__uden-forlob') ?? 0;

		const grupper: Gruppe[] = [
			{
				value: 'alle',
				label: `Alle (${alle.length}, ${ubesvaredeOverall} ubesvarede)`,
				antal: alle.length,
				ubesvaret: ubesvaredeOverall
			}
		];
		// Sikr at alle aktive forloeb i Firestore ogsaa optraeder — selv
		// hvis ingen klient har stillet sporgsmaal endnu (admin vil kunne
		// vaelge filtret for at se '0 sporgsmaal endnu' for det forloeb).
		for (const f of alleForlob) {
			if (!map.has(f.id)) {
				map.set(f.id, { navn: f.navn, antal: 0, ubesvaret: 0 });
			}
		}
		for (const [id, info] of [...map.entries()].sort((a, b) =>
			a[1].navn.localeCompare(b[1].navn, 'da')
		)) {
			grupper.push({
				value: id,
				label: `${info.navn} (${info.antal}, ${info.ubesvaret} ubesvarede)`,
				antal: info.antal,
				ubesvaret: info.ubesvaret
			});
		}
		if (modulAntal > 0) {
			grupper.push({
				value: 'modulbrugere',
				label: `Modulbrugere (${modulAntal}, ${modulUbesvaret} ubesvarede)`,
				antal: modulAntal,
				ubesvaret: modulUbesvaret
			});
		}
		if (udenAntal > 0) {
			grupper.push({
				value: 'uden-forlob',
				label: `Uden forløb (${udenAntal}, ${udenUbesvaret} ubesvarede)`,
				antal: udenAntal,
				ubesvaret: udenUbesvaret
			});
		}
		return grupper;
	});

	async function genindlaes() {
		loading = true;
		fejl = null;
		try {
			[alle, alleForlob] = await Promise.all([
				hentAlleSpoergsmaal(),
				hentAlleForlob().then((fs) => fs.filter((f) => f.aktiv !== false))
			]);
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente spørgsmål.';
		} finally {
			loading = false;
		}
	}

	function visToast(t: string) {
		toast = t;
		setTimeout(() => {
			if (toast === t) toast = null;
		}, 2200);
	}

	async function aendreStatus(id: string, ny: SpoergsmaalStatus) {
		try {
			await opdaterSpoergsmaalStatus(id, ny);
			alle = alle.map((q) => (q.id === id ? { ...q, status: ny } : q));
			visToast('Status opdateret');
		} catch (e) {
			console.error(e);
			visToast('Kunne ikke opdatere');
		}
	}

	let sletId = $state<string | null>(null);
	let sletter = $state(false);
	function aabnSletBekraeft(id: string) {
		sletId = id;
	}
	async function slet() {
		const id = sletId;
		if (!id) return;
		sletter = true;
		try {
			await sletSpoergsmaal(id);
			alle = alle.filter((q) => q.id !== id);
			sletId = null;
			visToast('Slettet');
		} catch (e) {
			console.error(e);
			visToast('Kunne ikke slette');
		} finally {
			sletter = false;
		}
	}

	function aabnSvar(q: KlientSpoergsmaal) {
		aabenSvarId = q.id;
		if (!(q.id in svarUdkast)) {
			svarUdkast[q.id] = q.svar ?? '';
		}
	}

	function lukSvar() {
		aabenSvarId = null;
	}

	async function genererUdkast(q: KlientSpoergsmaal, force = false) {
		aiUdkastLoader[q.id] = true;
		aiUdkastFejl[q.id] = '';
		try {
			const auth = getAuth();
			const idToken = await auth.currentUser?.getIdToken();
			if (!idToken) throw new Error('Du er ikke logget ind');
			const res = await fetch('/api/svar-udkast', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${idToken}`
				},
				body: JSON.stringify({ spoergsmaalId: q.id, force })
			});
			if (!res.ok) {
				const txt = await res.text();
				throw new Error(`AI-tjenesten svarede ${res.status}: ${txt}`);
			}
			const data = (await res.json()) as AiUdkast;
			aiUdkast[q.id] = data;
			aiUdkastSkjult[q.id] = false;
		} catch (e) {
			console.error(e);
			aiUdkastFejl[q.id] = e instanceof Error ? e.message : 'Kunne ikke generere udkast';
		} finally {
			aiUdkastLoader[q.id] = false;
		}
	}

	function brugUdkast(id: string) {
		const u = aiUdkast[id];
		if (!u) return;
		svarUdkast[id] = u.udkast;
		aiUdkastBrugt[id] = true;
		aiUdkastSkjult[id] = true;
	}

	function skjulUdkast(id: string) {
		aiUdkastSkjult[id] = true;
	}

	/** Genvej fra spørgsmål-kortet: åbn svar-formularen + start generering med ét klik. */
	async function aabnSvarOgGenerer(q: KlientSpoergsmaal) {
		aabnSvar(q);
		await genererUdkast(q);
	}

	async function sendSvar(id: string) {
		const tekst = (svarUdkast[id] ?? '').trim();
		if (!tekst) {
			visToast('Skriv et svar først');
			return;
		}
		const q = alle.find((x) => x.id === id);
		svarSender = id;
		try {
			await svarPaaSpoergsmaal(id, tekst);
			alle = alle.map((qx) =>
				qx.id === id
					? {
							...qx,
							svar: tekst,
							status: 'besvaret'
						}
					: qx
			);
			// Gem svarHistorik i baggrunden — bruges som few-shot stemme-eksempler
			if (q) {
				const u = aiUdkast[id];
				const brugte = aiUdkastBrugt[id] === true;
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
			aabenSvarId = null;
			visToast('Svar sendt');
		} catch (e) {
			console.error(e);
			visToast('Kunne ikke sende svar');
		} finally {
			svarSender = null;
		}
	}

	function formaterDato(t: { toDate?: () => Date } | null | undefined): string {
		if (!t || !t.toDate) return '—';
		const d = t.toDate();
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	function csvFelt(s: string): string {
		const trim = (s ?? '').toString();
		if (/[";\n\r]/.test(trim)) {
			return '"' + trim.replace(/"/g, '""') + '"';
		}
		return trim;
	}

	function eksporterCSV() {
		if (filtreret.length === 0) {
			visToast('Ingen spørgsmål at eksportere');
			return;
		}
		const header = ['Nr', 'Dato', 'Email', 'Spørgsmål', 'Status', 'Svar'];
		const rows = filtreret.map((q, i) => [
			String(i + 1),
			formaterDato(q.oprettet),
			q.email,
			q.spoergsmaal,
			STATUS_LABELS[q.status],
			''
		]);
		const csvLinjer = [header, ...rows].map((r) => r.map(csvFelt).join(';'));
		const csv = '﻿' + csvLinjer.join('\r\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		const now = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		const fname = `spoergsmaal-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.csv`;
		a.href = url;
		a.download = fname;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		visToast(`CSV downloadet (${filtreret.length})`);
	}

	onMount(() => {
		void genindlaes();
	});
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Admin</span>
		</a>
		<div class="head-row">
			<div>
				<div class="eyebrow">Admin · Spørgsmål</div>
				<h1>Spørgsmål fra <em>klienter</em></h1>
			</div>
			<button type="button" class="ghost-knap sm" onclick={genindlaes} disabled={loading}>
				{loading ? 'Henter...' : 'Opdater'}
			</button>
		</div>
	</header>

	<section class="filter-card">
		<label class="forlob-filter">
			<span class="forlob-filter-label">Forløb</span>
			<select bind:value={aktivtForlobFilter}>
				{#each forlobsGrupper as g (g.value)}
					<option value={g.value}>{g.label}</option>
				{/each}
			</select>
		</label>
		<div class="filter-rad">
			{#each FILTRE as f (f.id)}
				<button
					type="button"
					class="filter-chip"
					class:aktiv={aktivtFilter === f.id}
					onclick={() => (aktivtFilter = f.id)}
				>
					{f.label}
				</button>
			{/each}
		</div>
		<input
			class="klient-soeg"
			type="search"
			placeholder="Søg en klient frem (email)..."
			bind:value={klientSoeg}
		/>
		<button
			type="button"
			class="primary-knap"
			onclick={eksporterCSV}
			disabled={filtreret.length === 0}
		>
			Download som CSV
		</button>
		<div class="hint">
			Eksporterer {filtreret.length}
			{filtreret.length === 1 ? 'spørgsmål' : 'spørgsmål'} (følger filteret ovenfor)
		</div>
	</section>

	{#if loading}
		<div class="status-besked">Henter...</div>
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if filtreret.length === 0}
		<div class="status-besked">Ingen spørgsmål i dette filter</div>
	{:else}
		<div class="liste">
			{#each filtreret as q (q.id)}
				<article class="spq-kort spq-status-{q.status}">
					<div class="spq-meta">
						<span class="spq-pill spq-pill-{q.status}">{STATUS_LABELS[q.status]}</span>
						<span>·</span>
						<span class="spq-email">{q.email || 'ukendt'}</span>
						<span>·</span>
						<span>{formaterDato(q.oprettet)}</span>
						{#if q.forlobNavn}
							<span>·</span>
							<span class="spq-forlob">{q.forlobNavn}</span>
						{:else if q.kundeType === 'modulbruger'}
							<span>·</span>
							<span class="spq-forlob">Modulbruger</span>
						{/if}
					</div>
					<div class="spq-tekst">{q.spoergsmaal}</div>

					{#if q.aiSvar}
						<div class="ai-svar-vist">
							<div class="ai-svar-label">Linn AI svarede kunden</div>
							<div class="ai-svar-tekst">{q.aiSvar}</div>
						</div>
					{/if}

					{#if q.svar && aabenSvarId !== q.id}
						<div class="svar-vist">
							<div class="svar-label">Svar fra Linn</div>
							<div class="svar-tekst">{q.svar}</div>
						</div>
					{/if}

					{#if aabenSvarId === q.id}
						<div class="svar-form">
							{#if aiUdkast[q.id] && !aiUdkastSkjult[q.id]}
								{#if aiUdkast[q.id].skip}
									<div class="ai-boks ai-boks-skip">
										<div class="ai-boks-head">
											<span class="ai-label">AI foreslår: spring over</span>
											<button
												type="button"
												class="ai-knap-x"
												onclick={() => skjulUdkast(q.id)}
												aria-label="Skjul"
											>
												×
											</button>
										</div>
										<div class="ai-skip-tekst">
											{aiUdkast[q.id].skipBegrundelse ??
												'Beskeden kræver ikke nødvendigvis et substantielt svar.'}
										</div>
										<div class="ai-knapper">
											<button
												type="button"
												class="ghost-knap sm"
												onclick={() => void genererUdkast(q, true)}
												disabled={aiUdkastLoader[q.id]}
											>
												{aiUdkastLoader[q.id] ? 'Genererer...' : 'Generér alligevel'}
											</button>
										</div>
									</div>
								{:else}
									<div class="ai-boks">
										<div class="ai-boks-head">
											<span class="ai-label">AI-udkast</span>
											{#if aiUdkast[q.id].lavSikkerhed}
												<span class="ai-badge-lav">Lav sikkerhed</span>
											{/if}
											<button
												type="button"
												class="ai-knap-x"
												onclick={() => skjulUdkast(q.id)}
												aria-label="Skjul"
											>
												×
											</button>
										</div>
										<div class="ai-udkast-tekst">{aiUdkast[q.id].udkast}</div>
										<div class="ai-knapper">
											<button
												type="button"
												class="primary-knap sm"
												onclick={() => brugUdkast(q.id)}
											>
												Brug udkast
											</button>
											<button
												type="button"
												class="ghost-knap sm"
												onclick={() => void genererUdkast(q)}
												disabled={aiUdkastLoader[q.id]}
											>
												{aiUdkastLoader[q.id] ? 'Genererer...' : 'Generér igen'}
											</button>
										</div>
									</div>
								{/if}
							{/if}

							{#if aiUdkastFejl[q.id]}
								<div class="ai-fejl">{aiUdkastFejl[q.id]}</div>
							{/if}

							<label class="svar-label" for="svar-{q.id}">Svar til klienten</label>
							<textarea
								id="svar-{q.id}"
								class="svar-input"
								rows="4"
								placeholder="Skriv dit svar her..."
								bind:value={svarUdkast[q.id]}
								disabled={svarSender === q.id}
							></textarea>
							<div class="svar-knapper">
								<button
									type="button"
									class="primary-knap sm"
									onclick={() => sendSvar(q.id)}
									disabled={svarSender === q.id}
								>
									{svarSender === q.id ? 'Sender...' : q.svar ? 'Opdater svar' : 'Send svar'}
								</button>
								{#if !aiUdkast[q.id] && !aiUdkastLoader[q.id]}
									<button
										type="button"
										class="ghost-knap sm ai-trigger"
										onclick={() => void genererUdkast(q)}
										disabled={svarSender === q.id}
									>
										<span class="ai-trigger-sparkle">✦</span> Generér AI-udkast
									</button>
								{:else if aiUdkastLoader[q.id]}
									<button type="button" class="ghost-knap sm" disabled> AI tænker... </button>
								{:else if aiUdkastSkjult[q.id]}
									<button
										type="button"
										class="ghost-knap sm"
										onclick={() => (aiUdkastSkjult[q.id] = false)}
									>
										Vis AI-udkast igen
									</button>
								{/if}
								<button
									type="button"
									class="ghost-knap sm"
									onclick={lukSvar}
									disabled={svarSender === q.id}
								>
									Annullér
								</button>
							</div>
						</div>
					{/if}

					<div class="spq-knapper">
						{#if aabenSvarId !== q.id}
							<button type="button" class="primary-knap sm" onclick={() => aabnSvar(q)}>
								{q.svar ? 'Rediger svar' : 'Svar klienten'}
							</button>
							{#if !q.svar}
								<button
									type="button"
									class="ghost-knap sm ai-trigger"
									onclick={() => void aabnSvarOgGenerer(q)}
								>
									<span class="ai-trigger-sparkle">✦</span> AI-udkast
								</button>
							{/if}
						{/if}
						<button type="button" class="ghost-knap sm" onclick={() => aabnSamtale(q.uid)}>
							💬 Vis hele samtalen
						</button>
						{#if q.status !== 'laest'}
							<button
								type="button"
								class="ghost-knap sm"
								onclick={() => aendreStatus(q.id, 'laest')}
							>
								Markér som læst
							</button>
						{/if}
						{#if q.status !== 'besvaret'}
							<button
								type="button"
								class="ghost-knap sm"
								onclick={() => aendreStatus(q.id, 'besvaret')}
							>
								Markér som besvaret
							</button>
						{/if}
						{#if q.status !== 'brugt'}
							<button
								type="button"
								class="ghost-knap sm"
								onclick={() => aendreStatus(q.id, 'brugt')}
							>
								Markér som brugt
							</button>
						{/if}
						{#if q.status !== 'ny'}
							<button type="button" class="ghost-knap sm" onclick={() => aendreStatus(q.id, 'ny')}>
								Tilbage til ny
							</button>
						{/if}
						<button
							type="button"
							class="ghost-knap sm danger"
							onclick={() => aabnSletBekraeft(q.id)}
						>
							Slet
						</button>
					</div>
				</article>
			{/each}
		</div>
	{/if}

	{#if toast}
		<div class="toast" role="status">{toast}</div>
	{/if}
</div>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && visSamtaleForUid) lukSamtale();
	}}
/>

{#if visSamtaleForUid}
	<div class="modal-overlay" role="presentation" onclick={lukSamtale}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="samtale-modal"
			role="dialog"
			tabindex="-1"
			aria-modal="true"
			aria-labelledby="samtale-titel"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="samtale-head">
				<div>
					<div class="samtale-eyebrow">Hele samtalen</div>
					<h2 id="samtale-titel" class="samtale-titel">{samtaleEmail || 'ukendt klient'}</h2>
					<div class="samtale-sub">
						{samtaleSpoergsmaal.length}
						{samtaleSpoergsmaal.length === 1 ? 'spørgsmål' : 'spørgsmål'} i kronologisk rækkefølge
					</div>
				</div>
				<button class="samtale-luk" type="button" onclick={lukSamtale} aria-label="Luk">×</button>
			</div>

			<div class="samtale-body">
				{#each samtaleSpoergsmaal as q (q.id)}
					<article class="samtale-kort spq-status-{q.status}">
						<div class="spq-meta">
							<span class="spq-pill spq-pill-{q.status}">{STATUS_LABELS[q.status]}</span>
							<span>·</span>
							<span>{formaterDato(q.oprettet)}</span>
							{#if q.forlobNavn}
								<span>·</span>
								<span class="spq-forlob">{q.forlobNavn}</span>
							{:else if q.kundeType === 'modulbruger'}
								<span>·</span>
								<span class="spq-forlob">Modulbruger</span>
							{/if}
						</div>
						<div class="spq-tekst">{q.spoergsmaal}</div>

						{#if q.svar && aabenSvarId !== q.id}
							<div class="svar-vist">
								<div class="svar-label">Svar fra Linn</div>
								<div class="svar-tekst">{q.svar}</div>
							</div>
						{/if}

						{#if aabenSvarId === q.id}
							<div class="svar-form">
								{#if aiUdkast[q.id] && !aiUdkastSkjult[q.id]}
									{#if aiUdkast[q.id].skip}
										<div class="ai-boks ai-boks-skip">
											<div class="ai-boks-head">
												<span class="ai-label">AI foreslår: spring over</span>
												<button
													type="button"
													class="ai-knap-x"
													onclick={() => skjulUdkast(q.id)}
													aria-label="Skjul"
												>
													×
												</button>
											</div>
											<div class="ai-skip-tekst">
												{aiUdkast[q.id].skipBegrundelse ??
													'Beskeden kræver ikke nødvendigvis et substantielt svar.'}
											</div>
										</div>
									{:else}
										<div class="ai-boks">
											<div class="ai-boks-head">
												<span class="ai-label">AI-udkast</span>
												{#if aiUdkast[q.id].lavSikkerhed}
													<span class="ai-badge-lav">Lav sikkerhed</span>
												{/if}
												<button
													type="button"
													class="ai-knap-x"
													onclick={() => skjulUdkast(q.id)}
													aria-label="Skjul"
												>
													×
												</button>
											</div>
											<div class="ai-udkast-tekst">{aiUdkast[q.id].udkast}</div>
											<div class="ai-knapper">
												<button
													type="button"
													class="primary-knap sm"
													onclick={() => brugUdkast(q.id)}
												>
													Brug udkast
												</button>
												<button
													type="button"
													class="ghost-knap sm"
													onclick={() => void genererUdkast(q)}
													disabled={aiUdkastLoader[q.id]}
												>
													{aiUdkastLoader[q.id] ? 'Genererer...' : 'Generér igen'}
												</button>
											</div>
										</div>
									{/if}
								{/if}

								{#if aiUdkastFejl[q.id]}
									<div class="ai-fejl">{aiUdkastFejl[q.id]}</div>
								{/if}

								<label class="svar-label" for="samtale-svar-{q.id}">Svar til klienten</label>
								<textarea
									id="samtale-svar-{q.id}"
									class="svar-input"
									rows="4"
									placeholder="Skriv dit svar her..."
									bind:value={svarUdkast[q.id]}
									disabled={svarSender === q.id}
								></textarea>
								<div class="svar-knapper">
									<button
										type="button"
										class="primary-knap sm"
										onclick={() => sendSvar(q.id)}
										disabled={svarSender === q.id}
									>
										{svarSender === q.id ? 'Sender...' : q.svar ? 'Opdater svar' : 'Send svar'}
									</button>
									{#if !aiUdkast[q.id] && !aiUdkastLoader[q.id]}
										<button
											type="button"
											class="ghost-knap sm ai-trigger"
											onclick={() => void genererUdkast(q)}
											disabled={svarSender === q.id}
										>
											<span class="ai-trigger-sparkle">✦</span> Generér AI-udkast
										</button>
									{:else if aiUdkastLoader[q.id]}
										<button type="button" class="ghost-knap sm" disabled> AI tænker... </button>
									{:else if aiUdkastSkjult[q.id]}
										<button
											type="button"
											class="ghost-knap sm"
											onclick={() => (aiUdkastSkjult[q.id] = false)}
										>
											Vis AI-udkast igen
										</button>
									{/if}
									<button
										type="button"
										class="ghost-knap sm"
										onclick={lukSvar}
										disabled={svarSender === q.id}
									>
										Annullér
									</button>
								</div>
							</div>
						{/if}

						<div class="spq-knapper">
							{#if aabenSvarId !== q.id}
								<button type="button" class="primary-knap sm" onclick={() => aabnSvar(q)}>
									{q.svar ? 'Rediger svar' : 'Svar klienten'}
								</button>
								{#if !q.svar}
									<button
										type="button"
										class="ghost-knap sm ai-trigger"
										onclick={() => void aabnSvarOgGenerer(q)}
									>
										<span class="ai-trigger-sparkle">✦</span> AI-udkast
									</button>
								{/if}
							{/if}
							{#if q.status !== 'besvaret'}
								<button
									type="button"
									class="ghost-knap sm"
									onclick={() => aendreStatus(q.id, 'besvaret')}
								>
									Markér som besvaret
								</button>
							{/if}
						</div>
					</article>
				{/each}
			</div>
		</div>
	</div>
{/if}

{#if sletId}
	<BekraeftModal
		titel="Slet spørgsmålet?"
		beskrivelse="Spørgsmålet slettes permanent og kan ikke gendannes."
		bekraeftTekst="Slet"
		destruktiv
		arbejder={sletter}
		onBekraeft={() => void slet()}
		onAnnuller={() => (sletId = null)}
	/>
{/if}

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 600px;
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

	.head-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
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

	h1 em {
		font-style: italic;
		color: var(--terra);
		font-weight: 400;
	}

	.filter-card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 14px;
		margin-bottom: 14px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.klient-soeg {
		width: 100%;
		padding: 9px 12px;
		border: 1px solid var(--border);
		border-radius: 10px;
		font-family: var(--ff-b);
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text);
		background: var(--bg2);
	}

	.forlob-filter {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.forlob-filter-label {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.forlob-filter select {
		padding: 10px 12px;
		font-size: calc(14px * var(--fs-scale, 1));
		font-family: var(--ff-b);
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text);
		outline: none;
		cursor: pointer;
	}

	.forlob-filter select:focus {
		border-color: var(--terra);
	}

	.spq-forlob {
		display: inline-block;
		padding: 1px 8px;
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.04em;
		background: var(--tdim);
		color: var(--terra);
		border-radius: 99px;
	}

	.filter-rad {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.filter-chip {
		background: var(--bg2);
		border: 1px solid var(--border);
		color: var(--text2);
		border-radius: 99px;
		padding: 6px 12px;
		font-family: inherit;
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 500;
		cursor: pointer;
	}

	.filter-chip.aktiv {
		background: var(--terra);
		border-color: var(--terra);
		color: var(--white);
	}

	.primary-knap {
		background: var(--terra);
		color: var(--white);
		border: none;
		padding: 12px 14px;
		border-radius: 10px;
		font-family: inherit;
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		cursor: pointer;
	}

	.primary-knap:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.ghost-knap {
		background: var(--white);
		color: var(--text2);
		border: 1px solid var(--border);
		padding: 8px 12px;
		border-radius: 8px;
		font-family: inherit;
		font-size: calc(12px * var(--fs-scale, 1));
		cursor: pointer;
	}

	.ghost-knap.sm {
		padding: 6px 10px;
		font-size: calc(11.5px * var(--fs-scale, 1));
	}

	.ghost-knap.danger {
		color: #8a4a3e;
	}

	.ghost-knap:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.hint {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		text-align: center;
	}

	.status-besked {
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text3);
		font-size: calc(13px * var(--fs-scale, 1));
		text-align: center;
	}

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.liste {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.spq-kort {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 12px 14px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.spq-kort.spq-status-ny {
		border-color: var(--terra);
	}

	.spq-meta {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		flex-wrap: wrap;
	}

	.spq-email {
		color: var(--text2);
		font-weight: 500;
	}

	.spq-pill {
		padding: 2px 8px;
		border-radius: 99px;
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.spq-pill-ny {
		background: var(--terra);
		color: var(--white);
	}

	.spq-pill-laest {
		background: var(--bg2);
		color: var(--text2);
	}

	.spq-pill-besvaret {
		background: rgba(143, 168, 144, 0.2);
		color: #4f6f5b;
	}

	.spq-pill-brugt {
		background: rgba(160, 136, 120, 0.18);
		color: var(--text3);
	}

	.spq-tekst {
		font-size: calc(14px * var(--fs-scale, 1));
		color: var(--text);
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.spq-knapper {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.primary-knap.sm {
		padding: 8px 12px;
		font-size: calc(12px * var(--fs-scale, 1));
	}

	.svar-vist {
		background: var(--header);
		border-left: 3px solid var(--terra);
		padding: 10px 12px;
		border-radius: 8px;
	}

	.ai-svar-vist {
		background: var(--bg2);
		border-left: 3px solid var(--text3);
		padding: 10px 12px;
		border-radius: 8px;
		margin-top: 8px;
	}

	.ai-svar-label {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text3);
		margin-bottom: 4px;
		display: block;
	}

	.ai-svar-tekst {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.svar-label {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--terra);
		margin-bottom: 4px;
		display: block;
	}

	.svar-tekst {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text);
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.svar-form {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.svar-input {
		font-family: var(--ff-b);
		font-size: calc(13px * var(--fs-scale, 1));
		line-height: 1.5;
		padding: 10px 12px;
		border-radius: 8px;
		background: var(--bg2);
		border: 1px solid var(--border);
		color: var(--text);
		outline: none;
		resize: vertical;
		min-height: 80px;
	}

	.svar-input:focus {
		border-color: var(--terra);
	}

	.svar-knapper {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.ai-boks {
		background: linear-gradient(180deg, #fbf7f3 0%, #f6efe7 100%);
		border: 1px solid #e8dbc8;
		border-radius: 10px;
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.ai-boks-skip {
		background: var(--bg2);
		border-color: var(--border);
	}

	.ai-boks-head {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.ai-label {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--terra);
		flex: 1;
	}

	.ai-badge-lav {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		background: #f3e3d3;
		color: #8a4a3e;
		padding: 2px 8px;
		border-radius: 99px;
	}

	.ai-knap-x {
		background: transparent;
		border: none;
		color: var(--text3);
		font-size: 18px;
		cursor: pointer;
		padding: 0;
		width: 22px;
		height: 22px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
	}

	.ai-knap-x:hover {
		background: rgba(0, 0, 0, 0.05);
		color: var(--text2);
	}

	.ai-udkast-tekst {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text);
		line-height: 1.55;
		white-space: pre-wrap;
	}

	.ai-skip-tekst {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		font-style: italic;
	}

	.ai-knapper {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.ai-trigger {
		display: inline-flex;
		align-items: center;
		gap: 5px;
	}

	.ai-trigger-sparkle {
		color: var(--terra);
		font-size: 13px;
	}

	.ai-fejl {
		font-size: calc(12px * var(--fs-scale, 1));
		color: #8a4a3e;
		background: #fbeeea;
		border: 1px solid #f0d6cf;
		border-radius: 8px;
		padding: 8px 10px;
	}

	.toast {
		position: fixed;
		bottom: 80px;
		left: 50%;
		transform: translateX(-50%);
		background: var(--text);
		color: var(--white);
		padding: 8px 16px;
		border-radius: 99px;
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 500;
		z-index: 1000;
	}

	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 18px;
		z-index: 900;
	}

	.samtale-modal {
		background: var(--white);
		border-radius: 14px;
		width: 100%;
		max-width: 640px;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
	}

	.samtale-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 18px 20px 14px;
		border-bottom: 1px solid var(--border);
	}

	.samtale-eyebrow {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.samtale-titel {
		font-family: var(--ff-d);
		font-size: calc(18px * var(--fs-scale, 1));
		font-weight: 600;
		margin: 4px 0 2px;
		color: var(--text);
		word-break: break-all;
	}

	.samtale-sub {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.samtale-luk {
		background: none;
		border: none;
		font-size: 22px;
		color: var(--text2);
		cursor: pointer;
		padding: 0 4px;
		line-height: 1;
	}

	.samtale-body {
		overflow-y: auto;
		padding: 14px 20px 20px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.samtale-kort {
		padding: 14px;
		background: var(--bg2);
		border: 1px solid var(--border);
		border-radius: 12px;
	}
</style>
