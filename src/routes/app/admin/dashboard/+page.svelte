<script lang="ts">
	import { onMount } from 'svelte';
	import { doc, getDoc } from 'firebase/firestore';
	import { db, auth } from '$lib/firebase';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';

	type SubResultat = { gnsBaseline: number; gnsSeneste: number; gnsAendring: number };
	type Rejsepunkt = { gns: number; antal: number };
	type SegmentGruppe = { antal: number; gnsAendring: number };
	type SliderKey = 'energi' | 'mave' | 'cravings' | 'humor' | 'sovn';
	// Matchet check-in (som rapportens "uge for uge"): pr slutpunkt mod egen baseline.
	type CheckInMaal = {
		gnsBaseline: number;
		gnsCheckin: number;
		delta: number;
		forbedretPct: number;
	};
	type VelvCheckIn = {
		checkin: number;
		antalMatchede: number;
		perMaal: Record<SliderKey, CheckInMaal>;
		composite: CheckInMaal;
	};
	type Fordeling = { megetBedre: number; lidtBedre: number; uaendret: number; vaerre: number };
	// MRS-total-tallene — findes både på top-niveau (alle) og i mrsCompletere.
	type MrsTal = {
		antalMedUdvikling: number;
		gnsBaseline: number;
		gnsSeneste: number;
		gnsAendring: number;
		andelForbedret: number;
		subskalaer: Record<'somatisk' | 'psykologisk' | 'urogenital', SubResultat>;
		rejse: Rejsepunkt[];
		baselineSvaergrad: Record<'mild' | 'moderat' | 'svaer', SegmentGruppe>;
		demografi: {
			menopause: Record<string, SegmentGruppe>;
			alder: Record<string, SegmentGruppe>;
		};
		forbedringsFordeling: Fordeling;
	};
	type Scope = {
		antalMedData: number;
		// "Gennemførte" MRS: samme tal men kun kunder med fuldt skema ved hvert
		// rejse-punkt. Valgfrit (gamle snapshots har det ikke).
		mrsCompletere?: MrsTal & { antalGennemfoerte: number; maalingerKraevet: number };
		antalMedUdvikling: number;
		gnsBaseline: number;
		gnsSeneste: number;
		gnsAendring: number;
		andelForbedret: number;
		subskalaer: Record<'somatisk' | 'psykologisk' | 'urogenital', SubResultat>;
		rejse: Rejsepunkt[];
		baselineSvaergrad: Record<'mild' | 'moderat' | 'svaer', SegmentGruppe>;
		demografi: {
			menopause: Record<string, SegmentGruppe>;
			alder: Record<string, SegmentGruppe>;
		};
		velvaere: Record<SliderKey, SubResultat>;
		velvaereRejse: Record<SliderKey, Rejsepunkt[]>;
		velvaereSamletRejse: Rejsepunkt[];
		velvaereCheckIns?: VelvCheckIn[]; // valgfrit: gamle snapshots har det ikke
		antalVelvaere: number;
		// "Gennemførte": samme velvære-tal men kun kunder med en måling ved hvert
		// check-in. Valgfrit (gamle snapshots har det ikke).
		velvaereCompletere?: {
			velvaere: Record<SliderKey, SubResultat>;
			velvaereSamletRejse: Rejsepunkt[];
			velvaereCheckIns: VelvCheckIn[];
			antalVelvaere: number;
			antalGennemfoerte: number;
			checkInsKraevet: number;
		};
		forbedringsFordeling: {
			megetBedre: number;
			lidtBedre: number;
			uaendret: number;
			vaerre: number;
		};
	};
	type Forlob = { forlobId: string; navn: string } & Scope;
	type MrsSnapshot = {
		genereretAt: number;
		kunderTjekket: number;
		samlet: Scope;
		prType: { kickstart: Scope; kropsro: Scope };
		prForlob: Forlob[];
	};
	// Refleksions-aktivitet (eget snapshot, adminStats/refleksioner).
	type ReflScope = {
		antalRefleksioner: number;
		antalKunder: number;
		gnsPrKunde: number;
		gnsLaengde: number;
		prDag: { dagNummer: number; antal: number }[];
	};
	type ReflForlob = { forlobId: string; navn: string; type: 'kickstart' | 'kropsro' } & ReflScope;
	type ReflSnapshot = {
		genereretAt: number;
		samlet: ReflScope;
		prType: { kickstart: ReflScope; kropsro: ReflScope };
		prForlob: ReflForlob[];
	};

	let snapshot = $state<MrsSnapshot | null>(null);
	let reflSnapshot = $state<ReflSnapshot | null>(null);
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	// Måletype: MRS / velvære / refleksioner — hver sin fane allerøverst.
	let aktivMaaling = $state<'mrs' | 'velvaere' | 'refleksioner'>('mrs');
	// Refleksions-fanens udsnit: 'samlet', 'kickstart'/'kropsro' (alle af typen),
	// eller et specifikt forlobId.
	let reflValg = $state<string>('samlet');
	let aktivFane = $state<'alle' | 'forlob'>('alle');
	let valgtForlobId = $state<string | null>(null);
	let valgteLinjer = $state<Set<string>>(new Set(['alle', 'kickstart', 'kropsro']));
	let linjeVaelgerAaben = $state(false);
	let valgteVelvaereLinjer = $state<Set<string>>(new Set(['alle', 'kickstart', 'kropsro']));
	let velvaereVaelgerAaben = $state(false);
	// Velvære-population: alle slider-kunder, eller kun "gennemførte" (måling ved
	// hvert check-in). Styrer graf + begge tabeller i Velvære-fanen.
	let velvaerePop = $state<'alle' | 'gennemfoerte'>('alle');
	// Samme toggle for MRS-fanen: alle udviklings-kunder, eller kun dem med et
	// fuldt MRS-skema ved hvert rejse-punkt.
	let mrsPop = $state<'alle' | 'gennemfoerte'>('alle');

	async function indlaesSnapshot() {
		const [d, rd] = await Promise.all([
			getDoc(doc(db, 'adminStats', 'mrs')),
			getDoc(doc(db, 'adminStats', 'refleksioner'))
		]);
		if (d.exists()) {
			snapshot = d.data() as MrsSnapshot;
			if (!snapshot.prForlob.some((f) => f.forlobId === valgtForlobId)) {
				valgtForlobId = snapshot.prForlob[0]?.forlobId ?? null;
			}
		} else {
			fejl = 'Ingen MRS-statistik endnu — kør scriptet for at generere den.';
		}
		reflSnapshot = rd.exists() ? (rd.data() as ReflSnapshot) : null;
	}

	onMount(async () => {
		try {
			await indlaesSnapshot();
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente statistik. Tjek at firestore-reglen for adminStats er deployet.';
		} finally {
			loading = false;
		}
	});

	// Genberegnings-knapperne: 'incremental' (Opdater tal — kun nye målinger) eller
	// 'fuld' (læs alle kunder, fx efter profil-rettelser). Begge genindlæser
	// snapshottet med de friske tal bagefter.
	let opdaterer = $state<'incremental' | 'fuld' | null>(null);
	let opdaterBesked = $state<string | null>(null);
	async function genberegn(mode: 'incremental' | 'fuld') {
		if (opdaterer) return;
		if (
			mode === 'fuld' &&
			!confirm('Kør fuld genberegning? Den læser alle kunder og kan tage lidt længere.')
		)
			return;
		opdaterer = mode;
		opdaterBesked = null;
		try {
			const token = await auth.currentUser?.getIdToken();
			if (!token) throw new Error('Du er ikke logget ind som admin.');
			const url = '/api/admin/genberegn-mrs' + (mode === 'fuld' ? '?mode=fuld' : '');
			const res = await fetch(url, {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` }
			});
			if (!res.ok) {
				const fejltekst = await res.text();
				throw new Error(`Genberegning fejlede (${res.status}): ${fejltekst}`);
			}
			const data = (await res.json()) as { opdateredeKunder: number; kunderICache: number };
			await indlaesSnapshot();
			opdaterBesked =
				mode === 'fuld'
					? `Fuld genberegning færdig · ${data.kunderICache} kunder`
					: `Opdateret · ${data.opdateredeKunder} kunde(r) med nye målinger`;
		} catch (e) {
			console.error(e);
			opdaterBesked = e instanceof Error ? e.message : 'Kunne ikke opdatere tallene.';
		} finally {
			opdaterer = null;
		}
	}

	// AI-tema-opsummering (on-demand) for en produkt-dag i Refleksioner-fanen.
	let valgtDag = $state<number | null>(null);
	let aiKoerer = $state(false);
	let aiResultat = $state<{
		dag: number;
		spoergsmaal: string;
		antalSvar: number;
		opsummering: string;
	} | null>(null);
	let aiFejl = $state<string | null>(null);
	async function genererTemaer() {
		if (aiKoerer || valgtDag === null || reflValg === 'samlet') return;
		aiKoerer = true;
		aiFejl = null;
		aiResultat = null;
		try {
			const token = await auth.currentUser?.getIdToken();
			if (!token) throw new Error('Du er ikke logget ind som admin.');
			const res = await fetch('/api/admin/refleksion-temaer', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ valg: reflValg, dag: valgtDag })
			});
			if (!res.ok) throw new Error(`Kunne ikke opsummere (${res.status}): ${await res.text()}`);
			const data = (await res.json()) as {
				dag: number;
				spoergsmaal: string;
				antalSvar: number;
				opsummering: string;
			};
			aiResultat = data;
		} catch (e) {
			aiFejl = e instanceof Error ? e.message : 'Kunne ikke opsummere.';
		} finally {
			aiKoerer = false;
		}
	}
	// Skifter man forløb/type, nulstilles valgt dag + AI-resultat (de hører til
	// det forrige udsnit).
	$effect(() => {
		void reflValg;
		valgtDag = null;
		aiResultat = null;
		aiFejl = null;
	});

	const tal = (n: number) => n.toLocaleString('da-DK', { maximumFractionDigits: 1 });
	const datoTekst = (ms: number) =>
		new Date(ms).toLocaleString('da-DK', { dateStyle: 'long', timeStyle: 'short' });

	// Den valgte scope: samlet (Alle-fanen) eller det valgte forløb.
	const valgtForlob = $derived(
		snapshot?.prForlob.find((f) => f.forlobId === valgtForlobId) ?? null
	);
	const scope = $derived<Scope | null>(
		aktivFane === 'alle' ? (snapshot?.samlet ?? null) : valgtForlob
	);
	// Navn på det valgte udsnit — bruges i de dynamiske figur-beskrivelser.
	const scopeNavn = $derived(aktivFane === 'alle' ? 'alle hold samlet' : (valgtForlob?.navn ?? ''));

	// --- Rejse-graf ---
	const FORLOB_FARVER = ['#7A8CA0', '#C9A07A', '#8C5C7A', '#5C7A8C', '#9D6358', '#A37F66'];
	const G = { w: 600, h: 230, padL: 30, padR: 14, padT: 14, padB: 26 };

	// Alle linjer der kan vises: Alle / Alle Kickstart / Kropsro alle + hvert hold.
	// Hver linje har baade MRS-rejse og samlet velvaere-rejse.
	type GrafLinje = {
		id: string;
		navn: string;
		farve: string;
		rejse: Rejsepunkt[];
		velvaere: Rejsepunkt[];
	};
	const tilgaengeligeLinjer = $derived.by<GrafLinje[]>(() => {
		if (!snapshot) return [];
		const fra = (id: string, navn: string, farve: string, sc: Scope): GrafLinje => ({
			id,
			navn,
			farve,
			// Begge grafer følger hver sin Alle/Gennemførte-toggle.
			rejse: mrsPop === 'gennemfoerte' ? (sc.mrsCompletere?.rejse ?? []) : sc.rejse,
			velvaere:
				velvaerePop === 'gennemfoerte'
					? (sc.velvaereCompletere?.velvaereSamletRejse ?? [])
					: sc.velvaereSamletRejse
		});
		const linjer: GrafLinje[] = [
			fra('alle', 'Alle', '#2d2a26', snapshot.samlet),
			fra('kickstart', 'Alle Kickstart', '#6F9E7E', snapshot.prType.kickstart),
			fra('kropsro', 'Kropsro alle', '#B87B6E', snapshot.prType.kropsro)
		];
		snapshot.prForlob.forEach((f, i) =>
			linjer.push(fra(f.forlobId, f.navn, FORLOB_FARVER[i % FORLOB_FARVER.length], f))
		);
		return linjer;
	});

	// Faelles graf-bygger: valgte linjer (rejse-punkter) -> SVG-koordinater.
	// fastYMax sat (fx 10 for velvaere-skalaen) ellers dynamisk efter data.
	type ValgtLinje = { navn: string; farve: string; rejse: Rejsepunkt[]; fremhaev: boolean };
	function bygGraf(valgte: ValgtLinje[], fastYMax: number | null) {
		const maxP = Math.max(2, ...valgte.map((v) => v.rejse.length));
		const alleGns = valgte.flatMap((v) => v.rejse.map((p) => p.gns));
		const yMax = fastYMax ?? (alleGns.length ? Math.max(...alleGns) * 1.15 : 20);
		const gx = (i: number) => G.padL + (maxP <= 1 ? 0 : (i / (maxP - 1)) * (G.w - G.padL - G.padR));
		const gy = (v: number) => G.padT + (1 - v / yMax) * (G.h - G.padT - G.padB);
		return {
			linjer: valgte.map((l) => ({
				navn: l.navn,
				farve: l.farve,
				fremhaev: l.fremhaev,
				pkt: l.rejse.map((p, i) => ({ x: gx(i), y: gy(p.gns), ...p })),
				path: l.rejse.map((p, i) => `${i === 0 ? 'M' : 'L'}${gx(i)},${gy(p.gns)}`).join(' ')
			})),
			yTicks: [0, yMax / 2, yMax].map((v) => ({ v: Math.round(v), y: gy(v) })),
			xLabels: Array.from({ length: maxP }, (_, i) => ({ x: gx(i), label: `${i + 1}.` }))
		};
	}

	// Vaelger linjerne ud fra fanen + valgte-saet. Alle-fanen: de afkrydsede.
	// Vaelg-forloeb-fanen: 'Alle' (nedtonet benchmark) + det valgte hold.
	function valgteLinjerFor(
		valgtSaet: Set<string>,
		rejseFelt: (l: GrafLinje) => Rejsepunkt[]
	): ValgtLinje[] {
		if (aktivFane === 'alle') {
			return tilgaengeligeLinjer
				.filter((l) => valgtSaet.has(l.id))
				.map((l) => ({ navn: l.navn, farve: l.farve, rejse: rejseFelt(l), fremhaev: true }));
		}
		const alle = tilgaengeligeLinjer.find((l) => l.id === 'alle');
		const f = tilgaengeligeLinjer.find((l) => l.id === valgtForlobId);
		return [
			...(alle
				? [{ navn: alle.navn, farve: alle.farve, rejse: rejseFelt(alle), fremhaev: false }]
				: []),
			...(f ? [{ navn: f.navn, farve: f.farve, rejse: rejseFelt(f), fremhaev: true }] : [])
		];
	}

	const graf = $derived(
		snapshot
			? bygGraf(
					valgteLinjerFor(valgteLinjer, (l) => l.rejse),
					null
				)
			: null
	);
	const velvaereGraf = $derived(
		snapshot
			? bygGraf(
					valgteLinjerFor(valgteVelvaereLinjer, (l) => l.velvaere),
					10
				)
			: null
	);

	function toggle(saet: Set<string>, id: string): Set<string> {
		const ny = new Set(saet);
		if (ny.has(id)) ny.delete(id);
		else ny.add(id);
		return ny;
	}
	function toggleLinje(id: string) {
		valgteLinjer = toggle(valgteLinjer, id);
	}
	function toggleVelvaereLinje(id: string) {
		valgteVelvaereLinjer = toggle(valgteVelvaereLinjer, id);
	}

	const SUBSKALA_NAVN = {
		somatisk: 'Kropslige (somatisk)',
		psykologisk: 'Psykiske (psykologisk)',
		urogenital: 'Urogenitale'
	} as const;
	const subskalaListe = ['somatisk', 'psykologisk', 'urogenital'] as const;
	const SVAERGRAD = [
		{ key: 'mild', navn: 'Mild', interval: '0–8' },
		{ key: 'moderat', navn: 'Moderat', interval: '9–16' },
		{ key: 'svaer', navn: 'Svær', interval: '17+' }
	] as const;
	const MENOPAUSE = [
		{ key: 'praemenopause', navn: 'Præmenopause' },
		{ key: 'perimenopause', navn: 'Perimenopause' },
		{ key: 'postmenopause', navn: 'Postmenopause' },
		{ key: 'ukendt', navn: 'Ukendt' }
	];
	const ALDER_ORDEN = ['0-40', '41-45', '46-50', '51-55', '56-60', '60+', 'ukendt'];
	const VELVAERE = [
		{ key: 'energi', navn: 'Energi', farve: '#C9A07A' },
		{ key: 'mave', navn: 'Mave & fordøjelse', farve: '#6F9E7E' },
		{ key: 'cravings', navn: 'Cravings', farve: '#B87B6E' },
		{ key: 'humor', navn: 'Humør & overskud', farve: '#7A8CA0' },
		{ key: 'sovn', navn: 'Søvn', farve: '#8C5C7A' }
	] as const;

	function fbProcent(
		f: { megetBedre: number; lidtBedre: number; uaendret: number; vaerre: number },
		key: 'megetBedre' | 'lidtBedre' | 'uaendret' | 'vaerre'
	): number {
		const sum = Math.max(1, f.megetBedre + f.lidtBedre + f.uaendret + f.vaerre);
		return (f[key] / sum) * 100;
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Admin</span>
		</a>
		<div class="eyebrow">Dashboard</div>
		<h1>Kunders udvikling</h1>
		<p class="page-sub">
			{#if aktivMaaling === 'mrs'}
				Menopause Rating Scale — lavere score betyder færre symptomer. Baseline er kundens første
				måling, sammenlignet med hendes seneste.
			{:else if aktivMaaling === 'velvaere'}
				Vores egen velvære-måling (energi, mave, cravings, humør, søvn) — højere score er bedre. En
				anden måling end MRS.
			{:else}
				Hvor flittigt klienterne skriver dagens refleksion i forløbet (abo-kunder skriver ikke).
			{/if}
		</p>
	</header>

	{#if loading}
		<Loading tekst="Henter statistik..." />
	{:else if fejl}
		<div class="status-besked">{fejl}</div>
		<div class="hint-kort">
			<strong>Sådan opdaterer du tallene:</strong> kør
			<code>npx tsx scripts/generer-mrs-stats.ts</code>
		</div>
	{:else if snapshot && scope}
		<!-- Måletype-faner: MRS vs vores egen velvære-måling (to forskellige mål) -->
		<div class="faner maaletype">
			<button
				class="fane"
				class:aktiv={aktivMaaling === 'mrs'}
				onclick={() => (aktivMaaling = 'mrs')}
			>
				MRS-udvikling
			</button>
			<button
				class="fane"
				class:aktiv={aktivMaaling === 'velvaere'}
				onclick={() => (aktivMaaling = 'velvaere')}
			>
				Velvære-udvikling
			</button>
			<button
				class="fane"
				class:aktiv={aktivMaaling === 'refleksioner'}
				onclick={() => (aktivMaaling = 'refleksioner')}
			>
				Refleksioner
			</button>
		</div>

		{#if aktivMaaling === 'refleksioner'}
			{#if !reflSnapshot}
				<div class="hint-kort">
					Ingen refleksions-tal endnu — tryk "Opdater tal" eller "Fuld genberegning" nedenfor.
				</div>
			{:else}
				{@const rs =
					reflValg === 'kickstart'
						? reflSnapshot.prType.kickstart
						: reflValg === 'kropsro'
							? reflSnapshot.prType.kropsro
							: reflValg === 'samlet'
								? reflSnapshot.samlet
								: (reflSnapshot.prForlob.find((f) => f.forlobId === reflValg) ??
									reflSnapshot.samlet)}
				<select class="forlob-vaelg" bind:value={reflValg}>
					<option value="samlet">Samlet ({reflSnapshot.samlet.antalKunder} kunder)</option>
					<option value="kickstart">
						Alle Kickstart ({reflSnapshot.prType.kickstart.antalKunder})
					</option>
					<option value="kropsro">Alle Kropsro ({reflSnapshot.prType.kropsro.antalKunder})</option>
					{#each reflSnapshot.prForlob as f (f.forlobId)}
						<option value={f.forlobId}>{f.navn} ({f.antalKunder})</option>
					{/each}
				</select>
				<div class="kpi-grid">
					<div class="kpi-kort">
						<div class="kpi-tal">{rs.antalRefleksioner}</div>
						<div class="kpi-label">refleksioner i alt</div>
					</div>
					<div class="kpi-kort">
						<div class="kpi-tal">{rs.antalKunder}</div>
						<div class="kpi-label">kunder skrev</div>
					</div>
					<div class="kpi-kort fremhaev">
						<div class="kpi-tal">{tal(rs.gnsPrKunde)}</div>
						<div class="kpi-label">refleksioner pr. kunde</div>
					</div>
					<div class="kpi-kort fremhaev">
						<div class="kpi-tal">{rs.gnsLaengde}</div>
						<div class="kpi-label">tegn i snit</div>
					</div>
				</div>
				<p class="figur-note">
					En refleksion = en forløbsdag hvor kunden skrev et svar. Vist for {reflValg === 'samlet'
						? 'alle forløb'
						: reflValg === 'kickstart'
							? 'alle Kickstart-hold'
							: reflValg === 'kropsro'
								? 'alle Kropsro-hold'
								: (reflSnapshot.prForlob.find((f) => f.forlobId === reflValg)?.navn ?? 'forløbet')}.
				</p>
				{#if rs.prDag.length > 0}
					{@const maxAntal = Math.max(...rs.prDag.map((d) => d.antal))}
					<section class="card">
						<div class="kort-titel">Engagement pr. forløbsdag</div>
						<p class="figur-note">
							Hvor mange kunder skrev en refleksion på hver dag i forløbet — viser hvornår
							engagementet topper og falder.
						</p>
						<svg class="graf" viewBox="0 0 {G.w} {G.h}" preserveAspectRatio="xMidYMid meet">
							{#each rs.prDag as d, i (d.dagNummer)}
								{@const bw = (G.w - G.padL - G.padR) / rs.prDag.length}
								{@const h = (d.antal / maxAntal) * (G.h - G.padT - G.padB)}
								<rect
									x={G.padL + i * bw + 1}
									y={G.h - G.padB - h}
									width={Math.max(1, bw - 2)}
									height={h}
									class="refl-bar"
								/>
							{/each}
							<line
								x1={G.padL}
								y1={G.h - G.padB}
								x2={G.w - G.padR}
								y2={G.h - G.padB}
								class="gitter"
							/>
						</svg>
						<div class="refl-akse">
							<span>Dag {rs.prDag[0].dagNummer}</span>
							<span>Dag {rs.prDag[rs.prDag.length - 1].dagNummer}</span>
						</div>
						<p class="skala-note">Højeste søjle = {maxAntal} kunder. Hver søjle = én forløbsdag.</p>
					</section>
				{/if}
				<section class="card">
					<div class="kort-titel">AI-temaer for en dag</div>
					{#if reflValg === 'samlet'}
						<p class="figur-note">
							Vælg et <strong>forløb</strong> eller <strong>alle Kickstart/Kropsro</strong> ovenfor for
							at opsummere en bestemt dags refleksioner.
						</p>
					{:else}
						<p class="figur-note">
							Vælg en dag — Claude læser dagens anonyme svar og opsummerer temaerne. Kun selve
							svar-teksten sendes (ingen navne).
						</p>
						<div class="ai-raekke">
							<select class="forlob-vaelg" bind:value={valgtDag}>
								<option value={null} disabled>Vælg dag…</option>
								{#each rs.prDag as d (d.dagNummer)}
									<option value={d.dagNummer}>Dag {d.dagNummer} ({d.antal} svar)</option>
								{/each}
							</select>
							<button
								class="opdater-knap"
								onclick={genererTemaer}
								disabled={aiKoerer || valgtDag === null}
							>
								{aiKoerer ? 'Opsummerer…' : 'Opsummer temaer'}
							</button>
						</div>
						{#if aiFejl}<p class="ai-fejl">{aiFejl}</p>{/if}
						{#if aiResultat}
							<div class="ai-resultat">
								{#if aiResultat.spoergsmaal}<p class="ai-spm">"{aiResultat.spoergsmaal}"</p>{/if}
								<p class="skala-note" style="margin-top:0">
									Dag {aiResultat.dag} · baseret på {aiResultat.antalSvar} svar.
								</p>
								<div class="ai-tekst">{aiResultat.opsummering}</div>
							</div>
						{/if}
					{/if}
				</section>
			{/if}
		{:else}
			<!-- Scope-faner: gælder inden i begge måletyper -->
			<div class="faner">
				<button
					class="fane"
					class:aktiv={aktivFane === 'alle'}
					onclick={() => (aktivFane = 'alle')}
				>
					Alle resultater
				</button>
				<button
					class="fane"
					class:aktiv={aktivFane === 'forlob'}
					onclick={() => (aktivFane = 'forlob')}
				>
					Vælg forløb
				</button>
			</div>

			{#if aktivFane === 'forlob'}
				<select class="forlob-vaelg" bind:value={valgtForlobId}>
					{#each snapshot.prForlob as f (f.forlobId)}
						<option value={f.forlobId}>{f.navn} ({f.antalMedUdvikling})</option>
					{/each}
				</select>
			{/if}

			{#if aktivFane === 'forlob' && !valgtForlob}
				<div class="status-besked">Ingen hold med nok data endnu.</div>
			{:else}
				{@const s = scope}
				{#if aktivMaaling === 'mrs'}
					{@const mrsData = mrsPop === 'gennemfoerte' && s.mrsCompletere ? s.mrsCompletere : s}
					{@const harNokMrs = mrsData.antalMedUdvikling >= 5}
					<!-- Alle / Gennemførte (fuldt MRS-skema ved hvert målepunkt) -->
					<div class="velv-toggle">
						<button class:aktiv={mrsPop === 'alle'} onclick={() => (mrsPop = 'alle')}>
							Alle ({s.antalMedUdvikling})
						</button>
						<button
							class:aktiv={mrsPop === 'gennemfoerte'}
							onclick={() => (mrsPop = 'gennemfoerte')}
							disabled={!s.mrsCompletere || s.mrsCompletere.antalGennemfoerte === 0}
						>
							Gennemførte ({s.mrsCompletere?.antalGennemfoerte ?? 0})
						</button>
					</div>
					<!-- Nøgletal -->
					<div class="kpi-grid">
						<div class="kpi-kort">
							<div class="kpi-tal">{s.antalMedData}</div>
							<div class="kpi-label">kunder målt</div>
						</div>
						<div class="kpi-kort">
							<div class="kpi-tal">{mrsData.antalMedUdvikling}</div>
							<div class="kpi-label">
								{mrsPop === 'gennemfoerte' ? 'gennemførte alle' : 'har flere målinger'}
							</div>
						</div>
						<div class="kpi-kort fremhaev">
							<div class="kpi-tal">↓ {tal(Math.abs(mrsData.gnsAendring))}</div>
							<div class="kpi-label">gns. forbedring</div>
							<div class="kpi-sub">
								{tal(mrsData.gnsBaseline)} → {tal(mrsData.gnsSeneste)} point
							</div>
						</div>
						<div class="kpi-kort fremhaev">
							<div class="kpi-tal">{mrsData.andelForbedret}%</div>
							<div class="kpi-label">er blevet bedre</div>
						</div>
					</div>

					<p class="figur-note">
						MRS-score 0–44, hvor <strong>lavere = færre symptomer</strong>. Regnet over {mrsData.antalMedUdvikling}
						{mrsPop === 'gennemfoerte'
							? 'kunder der lavede et fuldt MRS-skema ved hvert målepunkt'
							: 'kunder med mindst 2 MRS-skemaer'} ({scopeNavn}). Gns. forbedring = hvor mange point
						scoren i snit er faldet; er blevet bedre = andelen der er gået ned.
					</p>
					{#if harNokMrs}
						<!-- Rejse-graf -->
						{#if graf}
							<section class="card">
								<div class="graf-top">
									<div class="kort-titel" style="margin:0">Udvikling over målinger</div>
									{#if aktivFane === 'alle'}
										<div class="linje-vaelger">
											<button
												class="linje-vaelger-knap"
												onclick={() => (linjeVaelgerAaben = !linjeVaelgerAaben)}
											>
												Vælg linjer ({valgteLinjer.size})
												<Icon name="chevron-d" size={12} color="var(--text2)" />
											</button>
											{#if linjeVaelgerAaben}
												<div class="linje-menu">
													{#each tilgaengeligeLinjer as l, i (l.id)}
														{#if i === 3}<div class="linje-divider">Enkelte hold</div>{/if}
														<label class="linje-option">
															<input
																type="checkbox"
																checked={valgteLinjer.has(l.id)}
																onchange={() => toggleLinje(l.id)}
															/>
															<span class="linje-prik" style="background:{l.farve}"></span>
															{l.navn}
														</label>
													{/each}
												</div>
											{/if}
										</div>
									{/if}
								</div>
								<p class="figur-note">
									Gennemsnitlig MRS-score ved kundernes 1., 2. og 3. måling — <strong
										>lavere kurve = færre symptomer</strong
									>.
									{mrsPop === 'gennemfoerte' ? 'Kun gennemførte kunder. ' : ''}{aktivFane === 'alle'
										? 'Vælg hvilke hold der vises i menuen.'
										: 'Den sorte linje er alle hold til sammenligning.'}
								</p>
								<svg class="graf" viewBox="0 0 {G.w} {G.h}" preserveAspectRatio="xMidYMid meet">
									<!-- y-gitter -->
									{#each graf.yTicks as t (t.v)}
										<line x1={G.padL} y1={t.y} x2={G.w - G.padR} y2={t.y} class="gitter" />
										<text x={G.padL - 5} y={t.y + 3} class="akse-tekst" text-anchor="end"
											>{t.v}</text
										>
									{/each}
									<!-- x-labels -->
									{#each graf.xLabels as x (x.label)}
										<text x={x.x} y={G.h - 8} class="akse-tekst" text-anchor="middle"
											>{x.label}</text
										>
									{/each}
									<!-- linjer -->
									{#each graf.linjer as l (l.navn)}
										<path
											d={l.path}
											fill="none"
											stroke={l.farve}
											stroke-width={l.fremhaev ? 2.5 : 1.5}
											stroke-opacity={l.fremhaev ? 1 : 0.5}
											stroke-linecap="round"
											stroke-linejoin="round"
										/>
										{#each l.pkt as p (p.x)}
											<circle cx={p.x} cy={p.y} r={l.fremhaev ? 4 : 3} fill={l.farve} />
										{/each}
									{/each}
								</svg>
								{#if graf.linjer.length === 0}
									<p class="skala-note">
										Vælg en eller flere linjer i menuen for at se udviklingen.
									</p>
								{/if}
								<div class="legende">
									{#each graf.linjer as l (l.navn)}
										<span class="legende-item">
											<span class="legende-prik" style="background:{l.farve}"></span>
											{l.navn}
										</span>
									{/each}
								</div>
								<p class="skala-note">
									Hvert punkt = kundens 1., 2., 3. måling · tal ved punkterne = antal kunder bag
								</p>
								<div class="punkt-antal">
									{#each graf.linjer.find((l) => l.fremhaev)?.pkt ?? [] as p, i (i)}
										<span>{i + 1}. måling: {p.antal} kunder</span>
									{/each}
								</div>
							</section>
						{/if}

						<!-- Baseline-sværhedsgrad -->
						<section class="card">
							<div class="kort-titel">Hvem forbedres mest? (efter start-sværhedsgrad)</div>
							<p class="figur-note">
								Kunderne delt efter hvor høj MRS de havde ved start. Tallet til højre = gns.
								ændring; ↓ = forbedring (færre symptomer).
							</p>
							{#each SVAERGRAD as grad (grad.key)}
								{@const g = mrsData.baselineSvaergrad[grad.key]}
								<div class="svaer-rad">
									<div class="svaer-navn">
										{grad.navn} <span class="svaer-interval">{grad.interval}</span>
									</div>
									<div class="svaer-antal">{g.antal} kunder</div>
									<div class="svaer-aendring" class:bedre={g.gnsAendring < 0}>
										{g.gnsAendring < 0 ? '↓' : g.gnsAendring > 0 ? '↑' : '–'}
										{tal(Math.abs(g.gnsAendring))}
									</div>
								</div>
							{/each}
							<p class="skala-note">Tallet til højre er gns. ændring i MRS-point.</p>
						</section>

						<!-- Forbedrings-fordeling -->
						<section class="card">
							<div class="kort-titel">Fordeling ({mrsData.antalMedUdvikling} kunder)</div>
							<p class="figur-note">
								Hvor mange kunder der er blevet meget bedre, lidt bedre, uændret eller værre fra
								start til seneste MRS-måling.
							</p>
							<div class="fordeling-bar">
								<div
									class="fb-del meget"
									style="width:{fbProcent(mrsData.forbedringsFordeling, 'megetBedre')}%"
								></div>
								<div
									class="fb-del lidt"
									style="width:{fbProcent(mrsData.forbedringsFordeling, 'lidtBedre')}%"
								></div>
								<div
									class="fb-del uaendret"
									style="width:{fbProcent(mrsData.forbedringsFordeling, 'uaendret')}%"
								></div>
								<div
									class="fb-del vaerre"
									style="width:{fbProcent(mrsData.forbedringsFordeling, 'vaerre')}%"
								></div>
							</div>
							<div class="fordeling-tegnforklaring">
								<span
									><span class="fb-prik meget"></span>Meget bedre ({mrsData.forbedringsFordeling
										.megetBedre} ·
									{Math.round(fbProcent(mrsData.forbedringsFordeling, 'megetBedre'))}%)</span
								>
								<span
									><span class="fb-prik lidt"></span>Lidt bedre ({mrsData.forbedringsFordeling
										.lidtBedre} ·
									{Math.round(fbProcent(mrsData.forbedringsFordeling, 'lidtBedre'))}%)</span
								>
								<span
									><span class="fb-prik uaendret"></span>Uændret ({mrsData.forbedringsFordeling
										.uaendret} ·
									{Math.round(fbProcent(mrsData.forbedringsFordeling, 'uaendret'))}%)</span
								>
								<span
									><span class="fb-prik vaerre"></span>Værre ({mrsData.forbedringsFordeling.vaerre} ·
									{Math.round(fbProcent(mrsData.forbedringsFordeling, 'vaerre'))}%)</span
								>
							</div>
							<p class="skala-note">"Meget bedre" = MRS faldt 5+ point.</p>
						</section>

						<!-- Demografi: menopause-status -->
						<section class="card">
							<div class="kort-titel">Forbedring efter menopause-status</div>
							<p class="figur-note">
								Gns. MRS-ændring fordelt på menopause-status. ↓ = færre symptomer.
							</p>
							{#each MENOPAUSE as m (m.key)}
								{@const g = mrsData.demografi.menopause[m.key]}
								{#if g && g.antal > 0}
									<div class="svaer-rad">
										<div class="svaer-navn">{m.navn}</div>
										<div class="svaer-antal">{g.antal} kunder</div>
										<div class="svaer-aendring" class:bedre={g.gnsAendring < 0}>
											{g.gnsAendring < 0 ? '↓' : g.gnsAendring > 0 ? '↑' : '–'}
											{tal(Math.abs(g.gnsAendring))}
										</div>
									</div>
								{/if}
							{/each}
						</section>

						<!-- Demografi: alder -->
						<section class="card">
							<div class="kort-titel">Forbedring efter aldersgruppe</div>
							<p class="figur-note">
								Gns. MRS-ændring fordelt på aldersgruppe. ↓ = færre symptomer.
							</p>
							{#each ALDER_ORDEN as key (key)}
								{@const g = mrsData.demografi.alder[key]}
								{#if g && g.antal > 0}
									<div class="svaer-rad">
										<div class="svaer-navn">{key === 'ukendt' ? 'Ukendt' : `${key} år`}</div>
										<div class="svaer-antal">{g.antal} kunder</div>
										<div class="svaer-aendring" class:bedre={g.gnsAendring < 0}>
											{g.gnsAendring < 0 ? '↓' : g.gnsAendring > 0 ? '↑' : '–'}
											{tal(Math.abs(g.gnsAendring))}
										</div>
									</div>
								{/if}
							{/each}
							<p class="skala-note">
								"Ukendt" = kunder uden udfyldt profil. Tallet er gns. MRS-ændring.
							</p>
						</section>

						<!-- Subskalaer -->
						<section class="card">
							<div class="kort-titel">Hvor sker forbedringen?</div>
							<p class="figur-note">
								MRS opdelt i tre symptom-grupper — gennemsnit ved start → seneste. ↓ = færre
								symptomer.
							</p>
							{#each subskalaListe as key (key)}
								{@const sub = mrsData.subskalaer[key]}
								<div class="sub-rad">
									<div class="sub-navn">{SUBSKALA_NAVN[key]}</div>
									<div class="sub-tal">
										<span>{tal(sub.gnsBaseline)}</span>
										<Icon name="chevron-r" size={12} color="var(--text3)" />
										<span>{tal(sub.gnsSeneste)}</span>
										<span class="sub-aendring" class:bedre={sub.gnsAendring < 0}>
											{sub.gnsAendring < 0 ? '↓' : sub.gnsAendring > 0 ? '↑' : ''}
											{tal(Math.abs(sub.gnsAendring))}
										</span>
									</div>
								</div>
							{/each}
						</section>
					{:else}
						<div class="hint-kort">
							Dette hold har ikke nok fulde MRS-skemaer endnu — skift til "Velvære-udvikling"
							ovenfor for at se deres ugentlige velvære-check.
						</div>
					{/if}
				{:else}
					<!-- Velvære-udvikling: vores egen måling (højere = bedre) -->
					{#if s.antalVelvaere > 0}
						{@const velvData =
							velvaerePop === 'gennemfoerte' && s.velvaereCompletere
								? {
										antal: s.velvaereCompletere.antalGennemfoerte,
										velvaere: s.velvaereCompletere.velvaere,
										checkIns: s.velvaereCompletere.velvaereCheckIns
									}
								: {
										antal: s.antalVelvaere,
										velvaere: s.velvaere,
										checkIns: s.velvaereCheckIns ?? []
									}}
						<!-- Alle / Gennemførte (måling ved hvert check-in) -->
						<div class="velv-toggle">
							<button class:aktiv={velvaerePop === 'alle'} onclick={() => (velvaerePop = 'alle')}>
								Alle ({s.antalVelvaere})
							</button>
							<button
								class:aktiv={velvaerePop === 'gennemfoerte'}
								onclick={() => (velvaerePop = 'gennemfoerte')}
								disabled={!s.velvaereCompletere || s.velvaereCompletere.antalGennemfoerte === 0}
							>
								Gennemførte ({s.velvaereCompletere?.antalGennemfoerte ?? 0})
							</button>
						</div>
						{#if velvData.antal > 0}
							<section class="card">
								<div class="graf-top">
									<div class="kort-titel" style="margin:0">Velvære ({velvData.antal} kunder)</div>
									{#if aktivFane === 'alle'}
										<div class="linje-vaelger">
											<button
												class="linje-vaelger-knap"
												onclick={() => (velvaereVaelgerAaben = !velvaereVaelgerAaben)}
											>
												Vælg linjer ({valgteVelvaereLinjer.size})
												<Icon name="chevron-d" size={12} color="var(--text2)" />
											</button>
											{#if velvaereVaelgerAaben}
												<div class="linje-menu">
													{#each tilgaengeligeLinjer as l, i (l.id)}
														{#if i === 3}<div class="linje-divider">Enkelte hold</div>{/if}
														<label class="linje-option">
															<input
																type="checkbox"
																checked={valgteVelvaereLinjer.has(l.id)}
																onchange={() => toggleVelvaereLinje(l.id)}
															/>
															<span class="linje-prik" style="background:{l.farve}"></span>
															{l.navn}
														</label>
													{/each}
												</div>
											{/if}
										</div>
									{/if}
								</div>
								<p class="figur-note">
									Samlet velvære (gns. af de 5 mål) ved hver måling — <strong
										>højere = bedre trivsel</strong
									>.
									{velvaerePop === 'gennemfoerte' ? 'Kun gennemførte kunder.' : ''}
								</p>
								{#if velvaereGraf}
									<svg class="graf" viewBox="0 0 {G.w} {G.h}" preserveAspectRatio="xMidYMid meet">
										{#each velvaereGraf.yTicks as t (t.v)}
											<line x1={G.padL} y1={t.y} x2={G.w - G.padR} y2={t.y} class="gitter" />
											<text x={G.padL - 5} y={t.y + 3} class="akse-tekst" text-anchor="end"
												>{t.v}</text
											>
										{/each}
										{#each velvaereGraf.xLabels as x (x.label)}
											<text x={x.x} y={G.h - 8} class="akse-tekst" text-anchor="middle"
												>{x.label}</text
											>
										{/each}
										{#each velvaereGraf.linjer as l (l.navn)}
											<path
												d={l.path}
												fill="none"
												stroke={l.farve}
												stroke-width={l.fremhaev ? 2.5 : 1.5}
												stroke-opacity={l.fremhaev ? 1 : 0.5}
												stroke-linecap="round"
												stroke-linejoin="round"
											/>
											{#each l.pkt as p (p.x)}
												<circle cx={p.x} cy={p.y} r={l.fremhaev ? 4 : 3} fill={l.farve} />
											{/each}
										{/each}
									</svg>
									{#if velvaereGraf.linjer.length === 0}
										<p class="skala-note">
											Vælg en eller flere linjer i menuen for at se udviklingen.
										</p>
									{/if}
									<div class="legende">
										{#each velvaereGraf.linjer as l (l.navn)}
											<span class="legende-item"
												><span class="legende-prik" style="background:{l.farve}"
												></span>{l.navn}</span
											>
										{/each}
									</div>
									<p class="skala-note">
										Samlet velvære (gns. af de 5 mål) · skala 1–10 · højere = bedre
									</p>
								{/if}
								<div class="rubrik-titel">Samlet: baseline → seneste måling</div>
								<p class="figur-note">
									Hver kundes FØRSTE velvære-måling vs. hendes SENESTE (blander tidlige og sene
									målinger). Skala 1–10, højere = bedre.
								</p>
								{#each VELVAERE as v (v.key)}
									{@const vv = velvData.velvaere[v.key]}
									<div class="sub-rad">
										<div class="sub-navn">{v.navn}</div>
										<div class="sub-tal">
											<span>{tal(vv.gnsBaseline)}</span>
											<Icon name="chevron-r" size={12} color="var(--text3)" />
											<span>{tal(vv.gnsSeneste)}</span>
											<span class="sub-aendring" class:bedre={vv.gnsAendring > 0}>
												{vv.gnsAendring > 0 ? '↑' : vv.gnsAendring < 0 ? '↓' : ''}
												{tal(Math.abs(vv.gnsAendring))}
											</span>
										</div>
									</div>
								{/each}
								<p class="skala-note">
									Skala 1–10 · højere = bedre. Egen måling, så flere kunder end MRS-totalen.
								</p>
							</section>

							<!-- Check-in for check-in: matchet/parret pr slutpunkt mod egen baseline
					     (som den eksterne statistik-rapports "udvikling uge for uge"). Hvert
					     slutpunkt bruger kun de kunder der nåede dertil — derfor stiger
					     forbedringen jo længere ud man kommer, modsat samlet-tabellen. -->
							{@const checkIns = velvData.checkIns}
							{#if checkIns.length > 0}
								<section class="card">
									<div class="kort-titel">Check-in for check-in</div>
									<p class="skala-note" style="margin-top:0">
										Hvert slutpunkt sammenligner kun de kunder der nåede dertil, mod deres egen
										baseline — samme metode som statistik-rapporten. Derfor vokser forbedringen
										udad.
									</p>
									{#each checkIns as ci (ci.checkin)}
										{@const c = ci.composite}
										<div class="ci-blok">
											<div class="rubrik-titel">
												Baseline → check-in {ci.checkin}
												<span class="ci-antal">{ci.antalMatchede} matchede</span>
											</div>
											<table class="ci-tabel">
												<thead>
													<tr>
														<th>Mål</th>
														<th>Baseline</th>
														<th>Check-in {ci.checkin}</th>
														<th>Δ</th>
														<th>Forbedret</th>
													</tr>
												</thead>
												<tbody>
													{#each VELVAERE as v (v.key)}
														{@const m = ci.perMaal[v.key]}
														<tr>
															<td class="ci-navn">{v.navn}</td>
															<td>{tal(m.gnsBaseline)}</td>
															<td>{tal(m.gnsCheckin)}</td>
															<td class="ci-delta" class:bedre={m.delta > 0}>
																{m.delta > 0 ? '+' : ''}{tal(m.delta)}
															</td>
															<td>{m.forbedretPct}%</td>
														</tr>
													{/each}
													<tr class="ci-samlet">
														<td class="ci-navn">Samlet</td>
														<td>{tal(c.gnsBaseline)}</td>
														<td>{tal(c.gnsCheckin)}</td>
														<td class="ci-delta" class:bedre={c.delta > 0}>
															{c.delta > 0 ? '+' : ''}{tal(c.delta)}
														</td>
														<td>{c.forbedretPct}%</td>
													</tr>
												</tbody>
											</table>
										</div>
									{/each}
									<p class="skala-note">
										Skala 1–10 · højere = bedre. "Forbedret" = andel hvis værdi er steget fra
										baseline.
									</p>
								</section>
							{/if}
						{:else}
							<div class="hint-kort">Ingen gennemførte kunder i dette valg endnu.</div>
						{/if}
					{:else}
						<div class="hint-kort">Ingen velvære-data for dette valg endnu.</div>
					{/if}
				{/if}
			{/if}
		{/if}

		<div class="opdateret">
			<div class="opdateret-rad">
				<span>Sidst opdateret: {datoTekst(snapshot.genereretAt)}</span>
				<div class="opdater-knapper">
					<button
						class="opdater-knap"
						onclick={() => genberegn('incremental')}
						disabled={!!opdaterer}
					>
						{opdaterer === 'incremental' ? 'Opdaterer…' : 'Opdater tal'}
					</button>
					<button
						class="opdater-knap sekundaer"
						onclick={() => genberegn('fuld')}
						disabled={!!opdaterer}
					>
						{opdaterer === 'fuld' ? 'Genberegner alt…' : 'Fuld genberegning'}
					</button>
				</div>
			</div>
			{#if opdaterBesked}
				<span class="opdater-besked">{opdaterBesked}</span>
			{/if}
			<span class="opdateret-note">
				<strong>Opdater tal</strong> henter kun kunder med nye målinger (dagligt).
				<strong>Fuld genberegning</strong> læser alle kunder — brug den efter profil-rettelser eller slettede
				målinger.
			</span>
		</div>
	{/if}
</div>

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
		padding: 16px;
		background: var(--surface2, #f4f1ec);
		border-radius: 12px;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
	}
	.hint-kort {
		margin-top: 12px;
		padding: 14px 16px;
		background: var(--surface2, #f4f1ec);
		border-radius: 12px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.5;
	}
	code {
		font-family: ui-monospace, monospace;
		font-size: 0.9em;
		background: rgba(0, 0, 0, 0.05);
		padding: 2px 6px;
		border-radius: 5px;
	}

	/* Faner */
	.faner {
		display: flex;
		gap: 6px;
		margin-bottom: 14px;
		background: var(--surface2, #f4f1ec);
		padding: 4px;
		border-radius: 12px;
	}
	.fane {
		flex: 1;
		padding: 9px 12px;
		border: none;
		background: transparent;
		border-radius: 9px;
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text2);
		cursor: pointer;
	}
	.fane.aktiv {
		background: var(--white, #fff);
		color: var(--text);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}
	/* Måletype-fanerne er det primære valg — fremhævet med accent-farve. */
	.faner.maaletype {
		margin-bottom: 8px;
	}
	.faner.maaletype .fane {
		font-size: calc(14px * var(--fs-scale, 1));
		padding: 11px 12px;
	}
	.faner.maaletype .fane.aktiv {
		background: var(--accent, #b87b6e);
		color: var(--white, #fff);
	}
	.forlob-vaelg {
		width: 100%;
		padding: 11px 14px;
		border: 1px solid var(--border, #e7e2d9);
		border-radius: 12px;
		background: var(--white, #fff);
		font-size: calc(14px * var(--fs-scale, 1));
		color: var(--text);
		margin-bottom: 14px;
	}

	/* KPI-kort */
	.kpi-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		margin-bottom: 14px;
	}
	.kpi-kort {
		background: var(--surface, #fff);
		border: 1px solid var(--border, #e7e2d9);
		border-radius: 14px;
		padding: 14px 16px;
	}
	.kpi-kort.fremhaev {
		background: var(--accent-soft, #eef3ee);
		border-color: transparent;
	}
	.kpi-tal {
		font-family: var(--ff-d);
		font-size: calc(24px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		line-height: 1;
	}
	.kpi-label {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
		margin-top: 4px;
	}
	.kpi-sub {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	/* Kort */
	.card {
		background: var(--surface, #fff);
		border: 1px solid var(--border, #e7e2d9);
		border-radius: 14px;
		padding: 16px;
		margin-bottom: 14px;
	}
	.kort-titel {
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		margin-bottom: 14px;
	}

	/* Rubrik-titel: mindre overskrift inde i et kort (adskiller to tabeller) */
	.rubrik-titel {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text2);
		margin: 18px 0 8px;
	}
	.rubrik-titel:first-child {
		margin-top: 0;
	}
	.ci-antal {
		font-weight: 500;
		color: var(--text3);
	}

	/* Check-in for check-in-tabel */
	.ci-blok + .ci-blok {
		margin-top: 6px;
	}
	.ci-tabel {
		width: 100%;
		border-collapse: collapse;
		font-size: calc(12.5px * var(--fs-scale, 1));
	}
	.ci-tabel th {
		text-align: right;
		font-weight: 500;
		color: var(--text3);
		padding: 4px 6px;
		border-bottom: 1px solid var(--border, #e7e2d9);
	}
	.ci-tabel th:first-child {
		text-align: left;
	}
	.ci-tabel td {
		text-align: right;
		padding: 5px 6px;
		color: var(--text);
		border-bottom: 1px solid var(--surface2, #f4f1ec);
	}
	.ci-navn {
		text-align: left !important;
		color: var(--text2) !important;
	}
	.ci-delta {
		color: var(--text3);
	}
	.ci-delta.bedre {
		color: var(--accent, #b87b6e);
		font-weight: 600;
	}
	.ci-samlet td {
		font-weight: 600;
		border-bottom: none;
	}

	/* Alle / Gennemførte-toggle i Velvære-fanen */
	.velv-toggle {
		display: flex;
		gap: 6px;
		background: var(--surface2, #f4f1ec);
		padding: 4px;
		border-radius: 12px;
		margin-bottom: 14px;
	}
	.velv-toggle button {
		flex: 1;
		padding: 8px 12px;
		border: none;
		background: transparent;
		border-radius: 9px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text2);
		cursor: pointer;
	}
	.velv-toggle button.aktiv {
		background: var(--white, #fff);
		color: var(--text);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}
	.velv-toggle button:disabled {
		opacity: 0.45;
		cursor: default;
	}

	/* Graf */
	.graf-top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 10px;
		margin-bottom: 14px;
	}
	.linje-vaelger {
		position: relative;
		flex-shrink: 0;
	}
	.linje-vaelger-knap {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		border: 1px solid var(--border, #e7e2d9);
		border-radius: 9px;
		background: var(--white, #fff);
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text);
		cursor: pointer;
		white-space: nowrap;
	}
	.linje-menu {
		position: absolute;
		right: 0;
		top: calc(100% + 4px);
		z-index: 10;
		min-width: 190px;
		background: var(--white, #fff);
		border: 1px solid var(--border, #e7e2d9);
		border-radius: 11px;
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
		padding: 6px;
	}
	.linje-divider {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text3);
		padding: 8px 8px 4px;
	}
	.linje-option {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 7px 8px;
		border-radius: 7px;
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text);
		cursor: pointer;
	}
	.linje-option:hover {
		background: var(--bg2, #f4f1ec);
	}
	.linje-prik {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.graf {
		width: 100%;
		height: auto;
		display: block;
	}
	.gitter {
		stroke: var(--border, #eee);
		stroke-width: 1;
	}
	.akse-tekst {
		font-size: 11px;
		fill: var(--text3);
	}
	.legende {
		display: flex;
		flex-wrap: wrap;
		gap: 10px 16px;
		margin-top: 12px;
	}
	.legende-item {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
	}
	.legende-prik {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.punkt-antal {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
		margin-top: 8px;
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
	}
	.skala-note {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		margin: 10px 0 0;
	}
	/* Kort, dynamisk forklaring under en figur-titel — så intet misforstås. */
	.figur-note {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.5;
		margin: -6px 0 12px;
	}
	/* Refleksions-engagement: søjlediagram pr forløbsdag */
	.refl-bar {
		fill: var(--accent, #b87b6e);
	}
	/* AI-temaer */
	.ai-raekke {
		display: flex;
		gap: 8px;
		align-items: center;
		flex-wrap: wrap;
	}
	.ai-raekke .forlob-vaelg {
		flex: 1;
		min-width: 140px;
		margin: 0;
	}
	.ai-fejl {
		color: var(--danger, #b04a4a);
		font-size: calc(12px * var(--fs-scale, 1));
		margin: 10px 0 0;
	}
	.ai-resultat {
		margin-top: 14px;
		padding: 14px;
		border-radius: 12px;
		background: var(--accent-soft, #eef3ee);
	}
	.ai-spm {
		font-style: italic;
		color: var(--text2);
		margin: 0 0 6px;
	}
	.ai-tekst {
		white-space: pre-wrap;
		line-height: 1.55;
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text);
		margin-top: 6px;
	}
	.refl-akse {
		display: flex;
		justify-content: space-between;
		font-size: calc(10.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	/* Sværhedsgrad */
	.svaer-rad {
		display: grid;
		grid-template-columns: 1.5fr 1fr auto;
		gap: 8px;
		align-items: center;
		padding: 10px 0;
		border-bottom: 1px solid var(--border, #f0ece4);
	}
	.svaer-rad:last-of-type {
		border-bottom: none;
	}
	.svaer-navn {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text);
	}
	.svaer-interval {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
	}
	.svaer-antal {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
		text-align: right;
	}
	.svaer-aendring {
		font-weight: 600;
		color: var(--text3);
		min-width: 44px;
		text-align: right;
	}
	.svaer-aendring.bedre {
		color: #6f9e7e;
	}

	/* Fordeling */
	.fordeling-bar {
		display: flex;
		height: 22px;
		border-radius: 7px;
		overflow: hidden;
		margin-bottom: 12px;
	}
	.fb-del.meget {
		background: #5b8c6e;
	}
	.fb-del.lidt {
		background: #a9cdb4;
	}
	.fb-del.uaendret {
		background: #d8d2c6;
	}
	.fb-del.vaerre {
		background: #c98b7a;
	}
	.fordeling-tegnforklaring {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 14px;
	}
	.fordeling-tegnforklaring span {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
	}
	.fb-prik {
		width: 10px;
		height: 10px;
		border-radius: 3px;
		flex-shrink: 0;
	}
	.fb-prik.meget {
		background: #5b8c6e;
	}
	.fb-prik.lidt {
		background: #a9cdb4;
	}
	.fb-prik.uaendret {
		background: #d8d2c6;
	}
	.fb-prik.vaerre {
		background: #c98b7a;
	}

	/* Subskalaer */
	.sub-rad {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 0;
		border-bottom: 1px solid var(--border, #f0ece4);
	}
	.sub-rad:last-of-type {
		border-bottom: none;
	}
	.sub-navn {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text);
	}
	.sub-tal {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
	}
	.sub-aendring {
		font-weight: 600;
		color: var(--text3);
		min-width: 42px;
		text-align: right;
	}
	.sub-aendring.bedre {
		color: #6f9e7e;
	}

	.opdateret {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-top: 18px;
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
	}
	.opdateret-rad {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}
	.opdater-knapper {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		justify-content: flex-end;
	}
	.opdater-knap {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 7px 14px;
		border: none;
		border-radius: 9px;
		background: var(--accent, #b87b6e);
		color: var(--white, #fff);
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
	}
	/* Fuld genberegning = sekundær (sjælden, tungere handling) */
	.opdater-knap.sekundaer {
		background: transparent;
		color: var(--text2);
		border: 1px solid var(--border, #e7e2d9);
	}
	.opdater-knap:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.opdater-besked {
		color: var(--accent, #b87b6e);
		font-weight: 600;
	}
	.opdateret-note {
		line-height: 1.5;
	}
</style>
