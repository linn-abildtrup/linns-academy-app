<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import { hentMaaltiderIPeriode } from '$lib/firestore/kost';
	import {
		formatDatoKey,
		formatGram,
		type GemtMaaltid
	} from '$lib/content/kost';
	import {
		dagligeMalForBruger,
		NAERING_LABELS,
		NAERING_ENHEDER
	} from '$lib/content/naering';
	import Loading from '$lib/components/Loading.svelte';
	import { erModulbruger, harPremium } from '$lib/utils/userAdgang';
	import { hentAlleAboTraeninger } from '$lib/firestore/aboMikrotraening';
	import type { AboMikrotraeningTraening } from '$lib/content/aboMikrotraening';
	import { hentAboVaneOpsaetning, hentAlleAboVanedage } from '$lib/firestore/aboVaner';
	import type { AboVaneOpsaetning, AboVanedagEntry } from '$lib/content/aboVaner';
	import { hentAlleVanedage } from '$lib/firestore/vaner';
	import type { VanedagEntry, CheckinSvar } from '$lib/content/vaner';
	import { CHECKIN_SPORGSMAAL } from '$lib/content/vaner';

	const getUser = getContext<() => User | null>('user');
	const getUserDoc = getContext<() => UserDoc | null>('userDoc');
	const user = $derived(getUser());
	const userDoc = $derived(getUserDoc?.() ?? null);
	// Udvidet næring (kh/fedt/kcal) er kun for premium-brugere.
	const visUdvidet = $derived(harPremium(userDoc) && userDoc?.visUdvidetNaering === true);
	const dagligeMaal = $derived(dagligeMalForBruger(userDoc?.dagligeMaal));

	type Tab = 'syv' | 'tredive' | 'maal';
	let aktivTab = $state<Tab>('syv');

	type Metric = 'protein' | 'fiber' | 'kh' | 'fedt' | 'kcal';
	let aktivMetric = $state<Metric>('protein');

	const synligeMetrics = $derived<Metric[]>(
		visUdvidet ? ['protein', 'fiber', 'kh', 'fedt', 'kcal'] : ['protein', 'fiber']
	);

	$effect(() => {
		// Sørg for at aktivMetric altid er en synlig metric (når toggle skifter)
		if (!synligeMetrics.includes(aktivMetric)) {
			aktivMetric = synligeMetrics[0];
		}
	});

	let alle = $state<GemtMaaltid[]>([]);
	let aboTraeninger = $state<AboMikrotraeningTraening[]>([]);
	let aboVaneOpsaetning = $state<AboVaneOpsaetning | null>(null);
	let aboVanedage = $state<Map<string, AboVanedagEntry>>(new Map());
	let forlobsVanedage = $state<Map<number, VanedagEntry>>(new Map());
	let loading = $state(true);
	let fejl = $state<string | null>(null);

	const visAbo = $derived(erModulbruger(userDoc));
	// Vis baseline + check-in-historik hvis brugeren har gennemført forløb
	// (uanset om hun aktiv basis/premium/forløb eller udløbet i bonus).
	const harForlobsHistorik = $derived((userDoc?.forlobIds?.length ?? 0) > 0);

	// Find dage med checkin-data (baseline + ugentlige check-ins). For
	// Kickstart-forløb er det typisk dag 0, 7, 14, 21.
	const checkinDage = $derived.by(() => {
		const liste: { dagNummer: number; entry: VanedagEntry }[] = [];
		for (const [dagNummer, entry] of forlobsVanedage) {
			const c = entry.checkin as CheckinSvar | undefined;
			if (!c) continue;
			const harSlider = CHECKIN_SPORGSMAAL.some(
				(q) => typeof c[q.id as keyof CheckinSvar] === 'number'
			);
			if (harSlider) liste.push({ dagNummer, entry });
		}
		return liste.sort((a, b) => a.dagNummer - b.dagNummer);
	});

	const SLIDER_FARVER: Record<string, string> = {
		energi: '#b87b6e',
		mave: '#6f9e7e',
		cravings: '#c9a07a',
		humor: '#7e9bb3',
		sovn: '#9d6358'
	};

	function dageBack(antal: number): { fraDato: string; tilDato: string; dage: string[] } {
		const idag = new Date();
		idag.setHours(12, 0, 0, 0);
		const dage: string[] = [];
		for (let i = antal - 1; i >= 0; i--) {
			const d = new Date(idag);
			d.setDate(idag.getDate() - i);
			dage.push(formatDatoKey(d));
		}
		return {
			fraDato: dage[0],
			tilDato: dage[dage.length - 1],
			dage
		};
	}

	async function indlaes() {
		const u = user;
		if (!u) return;
		loading = true;
		try {
			const { fraDato, tilDato } = dageBack(30);
			// Træninger og vanedage hentes for 90 dage tilbage — udvikling-
			// tabbens views (7d/30d/Mål) ligger inden for det vindue. Hindrer
			// at langtidskunder henter års-historik på hver tab-åbning.
			const niDageSiden = new Date();
			niDageSiden.setDate(niDageSiden.getDate() - 90);
			const yyyy = niDageSiden.getFullYear();
			const mm = String(niDageSiden.getMonth() + 1).padStart(2, '0');
			const dd = String(niDageSiden.getDate()).padStart(2, '0');
			const cutoff = `${yyyy}-${mm}-${dd}`;
			const promiser: Promise<unknown>[] = [hentMaaltiderIPeriode(u.uid, fraDato, tilDato)];
			if (visAbo) {
				promiser.push(hentAlleAboTraeninger(u.uid, cutoff));
				promiser.push(hentAboVaneOpsaetning(u.uid));
				promiser.push(hentAlleAboVanedage(u.uid, cutoff));
			}
			// Forløbs-vanedage (baseline + ugentlige check-ins) hentes for
			// kunder der har gennemført et forløb — uanset deres nuværende
			// adgangsniveau. Bruges til 'Min udvikling siden baseline'-sektionen.
			if (harForlobsHistorik) {
				promiser.push(hentAlleVanedage(u.uid, 'kickstart'));
			}
			const r = await Promise.all(promiser);
			alle = r[0] as GemtMaaltid[];
			let idx = 1;
			if (visAbo) {
				aboTraeninger = r[idx++] as AboMikrotraeningTraening[];
				aboVaneOpsaetning = r[idx++] as AboVaneOpsaetning | null;
				aboVanedage = r[idx++] as Map<string, AboVanedagEntry>;
			}
			if (harForlobsHistorik) {
				forlobsVanedage = r[idx++] as Map<number, VanedagEntry>;
			}
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente data.';
		} finally {
			loading = false;
		}
	}

	onMount(indlaes);

	function metricVal(m: GemtMaaltid, metric: Metric): number {
		switch (metric) {
			case 'protein':
				return m.totalP;
			case 'fiber':
				return m.totalF;
			case 'kh':
				return m.totalKh ?? 0;
			case 'fedt':
				return m.totalFedt ?? 0;
			case 'kcal':
				return m.totalKcal ?? 0;
		}
	}

	function summerPrDag(metric: Metric, dage: string[]): number[] {
		const map = new Map<string, number>();
		for (const d of dage) map.set(d, 0);
		for (const m of alle) {
			if (!map.has(m.dato)) continue;
			map.set(m.dato, (map.get(m.dato) ?? 0) + metricVal(m, metric));
		}
		return dage.map((d) => map.get(d) ?? 0);
	}

	function formatVal(metric: Metric, v: number): string {
		if (metric === 'kcal') return Math.round(v) + ' kcal';
		return formatGram(v);
	}

	function ugedagKort(dato: string): string {
		const d = new Date(dato + 'T12:00:00');
		return ['Sø', 'Ma', 'Ti', 'On', 'To', 'Fr', 'Lø'][d.getDay()];
	}

	function dagNum(dato: string): string {
		const d = new Date(dato + 'T12:00:00');
		return String(d.getDate());
	}

	// 7-dages data
	const syvDageMeta = $derived(dageBack(7));
	const syvDageVaerdier = $derived(summerPrDag(aktivMetric, syvDageMeta.dage));
	const syvDageMax = $derived(
		Math.max(dagligeMaal[aktivMetric], ...syvDageVaerdier, 1)
	);

	// 30-dages data (linjegraf)
	const tredive = $derived(dageBack(30));
	const trediveVaerdier = $derived(summerPrDag(aktivMetric, tredive.dage));
	const trediveMax = $derived(
		Math.max(dagligeMaal[aktivMetric], ...trediveVaerdier, 1)
	);

	// Linje-path for 30-dages graf (SVG path)
	const linjePath = $derived.by(() => {
		const w = 100;
		const h = 60;
		const n = trediveVaerdier.length;
		if (n === 0) return '';
		const punkter = trediveVaerdier.map((v, i) => {
			const x = (i / (n - 1)) * w;
			const y = h - (v / trediveMax) * h;
			return `${x.toFixed(2)},${y.toFixed(2)}`;
		});
		return 'M ' + punkter.join(' L ');
	});

	// === Træning: 0/1 pr dag ===
	const traenetDatoer = $derived(new Set(aboTraeninger.map((t) => t.dato)));

	const syvDageTraening = $derived(
		syvDageMeta.dage.map((d) => (traenetDatoer.has(d) ? 1 : 0))
	);
	const trediveTraening = $derived(
		tredive.dage.map((d) => (traenetDatoer.has(d) ? 1 : 0))
	);
	const trediveTraeningPath = $derived.by(() => {
		const w = 100;
		const h = 60;
		const n = trediveTraening.length;
		if (n === 0) return '';
		const pkt = trediveTraening.map((v, i) => {
			const x = (i / (n - 1)) * w;
			const y = h - v * h;
			return `${x.toFixed(2)},${y.toFixed(2)}`;
		});
		return 'M ' + pkt.join(' L ');
	});

	// === Træning: pr uge (mandag-søndag) ===
	function ugeNoegle(d: Date): string {
		const kopi = new Date(d);
		const ugedag = kopi.getDay() === 0 ? 6 : kopi.getDay() - 1; // mandag = 0
		kopi.setDate(kopi.getDate() - ugedag);
		return formatDatoKey(kopi);
	}

	const traeningPrUge = $derived.by(() => {
		const map = new Map<string, number>();
		for (const t of aboTraeninger) {
			const noegle = ugeNoegle(new Date(t.dato + 'T12:00:00'));
			map.set(noegle, (map.get(noegle) ?? 0) + 1);
		}
		// Seneste 8 uger
		const r: { ugeStart: string; antal: number }[] = [];
		const idag = new Date();
		idag.setHours(12, 0, 0, 0);
		for (let i = 7; i >= 0; i--) {
			const d = new Date(idag);
			d.setDate(idag.getDate() - i * 7);
			const noegle = ugeNoegle(d);
			r.push({ ugeStart: noegle, antal: map.get(noegle) ?? 0 });
		}
		// Dedupe sidste hvis samme uge som forrige
		const unik: typeof r = [];
		for (const u of r) {
			if (unik.length === 0 || unik[unik.length - 1].ugeStart !== u.ugeStart) unik.push(u);
		}
		return unik;
	});

	// === Vaner: antal 'ja' pr dag ===
	const valgteVaner = $derived(aboVaneOpsaetning?.valgteVaner ?? []);
	const maxVaner = $derived(valgteVaner.length);

	function antalJaForDato(dato: string): number {
		const e = aboVanedage.get(dato);
		if (!e || valgteVaner.length === 0) return 0;
		return valgteVaner.filter((v) => e.checks?.[v.id] === 'ja').length;
	}

	const syvDageVaner = $derived(syvDageMeta.dage.map(antalJaForDato));
	const trediveVaner = $derived(tredive.dage.map(antalJaForDato));
	const trediveVanerPath = $derived.by(() => {
		const w = 100;
		const h = 60;
		const n = trediveVaner.length;
		if (n === 0 || maxVaner === 0) return '';
		const pkt = trediveVaner.map((v, i) => {
			const x = (i / (n - 1)) * w;
			const y = h - (v / maxVaner) * h;
			return `${x.toFixed(2)},${y.toFixed(2)}`;
		});
		return 'M ' + pkt.join(' L ');
	});

	// Streak-rapport for træning og vaner
	const traeningRapport = $derived.by(() => {
		const dage = tredive.dage;
		let dageNåetMaal = 0;
		let aktuelStreak = 0;
		let bedsteStreak = 0;
		let lokalStreak = 0;
		for (const d of dage) {
			if (traenetDatoer.has(d)) {
				dageNåetMaal++;
				lokalStreak++;
				bedsteStreak = Math.max(bedsteStreak, lokalStreak);
			} else {
				lokalStreak = 0;
			}
		}
		for (let i = dage.length - 1; i >= 0; i--) {
			if (traenetDatoer.has(dage[i])) aktuelStreak++;
			else break;
		}
		return { dageNåetMaal, aktuelStreak, bedsteStreak };
	});

	const vanerRapport = $derived.by(() => {
		const dage = tredive.dage;
		let dageNåetMaal = 0;
		let aktuelStreak = 0;
		let bedsteStreak = 0;
		let lokalStreak = 0;
		let dageMedData = 0;
		for (let i = 0; i < dage.length; i++) {
			const antal = antalJaForDato(dage[i]);
			const harIndtastet = aboVanedage.has(dage[i]);
			if (harIndtastet) dageMedData++;
			if (harIndtastet && antal === maxVaner && maxVaner > 0) {
				dageNåetMaal++;
				lokalStreak++;
				bedsteStreak = Math.max(bedsteStreak, lokalStreak);
			} else if (harIndtastet) {
				lokalStreak = 0;
			}
		}
		for (let i = dage.length - 1; i >= 0; i--) {
			if (!aboVanedage.has(dage[i])) continue;
			if (antalJaForDato(dage[i]) === maxVaner && maxVaner > 0) aktuelStreak++;
			else break;
		}
		return { dageNåetMaal, dageMedData, aktuelStreak, bedsteStreak };
	});

	// Mål-baseret data: streaks og totaler
	const malRapport = $derived.by(() => {
		const dage = dageBack(30).dage;
		const vaerdier = summerPrDag(aktivMetric, dage);
		const mal = dagligeMaal[aktivMetric];
		let dageNåetMaal = 0;
		let aktuelStreak = 0;
		let bedsteStreak = 0;
		let lokalStreak = 0;
		// Aktuel streak — fra slutningen af perioden, kun dage der har mindst ét måltid
		// Vi tæller IKKE dage uden måltider som "brudt streak" — kun dage med måltider
		const dageMedMaaltid = new Set(alle.map((m) => m.dato));
		for (let i = 0; i < dage.length; i++) {
			const harMaaltid = dageMedMaaltid.has(dage[i]);
			if (harMaaltid && vaerdier[i] >= mal) dageNåetMaal++;
			if (harMaaltid && vaerdier[i] >= mal) {
				lokalStreak++;
				bedsteStreak = Math.max(bedsteStreak, lokalStreak);
			} else if (harMaaltid) {
				lokalStreak = 0;
			}
		}
		// Aktuel streak fra slutningen
		for (let i = dage.length - 1; i >= 0; i--) {
			if (!dageMedMaaltid.has(dage[i])) continue;
			if (vaerdier[i] >= mal) aktuelStreak++;
			else break;
		}
		const dageMedData = vaerdier.filter((_, i) => dageMedMaaltid.has(dage[i])).length;
		const gennemsnit =
			dageMedData > 0
				? vaerdier.filter((_, i) => dageMedMaaltid.has(dage[i])).reduce((s, v) => s + v, 0) /
					dageMedData
				: 0;
		return {
			dageNåetMaal,
			dageMedData,
			aktuelStreak,
			bedsteStreak,
			gennemsnit
		};
	});
</script>

<div class="page">
	<header class="page-header">
		<div class="eyebrow">Min udvikling</div>
		<h1>Udvikling</h1>
		<p class="page-sub">Følg din udvikling over tid.</p>
	</header>

	<div class="tabs">
		<button class="tab-knap" class:aktiv={aktivTab === 'syv'} onclick={() => (aktivTab = 'syv')}>
			7 dage
		</button>
		<button
			class="tab-knap"
			class:aktiv={aktivTab === 'tredive'}
			onclick={() => (aktivTab = 'tredive')}
		>
			30 dage
		</button>
		<button class="tab-knap" class:aktiv={aktivTab === 'maal'} onclick={() => (aktivTab = 'maal')}>
			Mål
		</button>
	</div>

	{#if visAbo}
		<div class="sektion-titel">Næring</div>
	{/if}

	<div class="metric-rad">
		{#each synligeMetrics as m (m)}
			<button
				type="button"
				class="metric-chip"
				class:aktiv={aktivMetric === m}
				onclick={() => (aktivMetric = m)}
			>
				{NAERING_LABELS[m]}
			</button>
		{/each}
	</div>

	{#if loading}
		<Loading tekst="Henter data..." kompakt />
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if alle.length === 0}
		<div class="status-besked">
			Du har endnu ikke gemt nogen måltider. Brug 30-30 til at logge dine måltider, og kom tilbage her for at se din udvikling.
		</div>
	{:else if aktivTab === 'syv'}
		<section class="kort">
			<div class="kort-titel">
				{NAERING_LABELS[aktivMetric]} sidste 7 dage
				<span class="kort-mål">mål: {dagligeMaal[aktivMetric]} {NAERING_ENHEDER[aktivMetric]}</span>
			</div>
			<div class="soejler">
				{#each syvDageMeta.dage as d, i (d)}
					{@const v = syvDageVaerdier[i]}
					{@const pct = (v / syvDageMax) * 100}
					{@const opfyldt = v >= dagligeMaal[aktivMetric]}
					{@const harData = v > 0}
					<div class="soejle-spalte" title={formatVal(aktivMetric, v)}>
						<div class="soejle-tal" class:synlig={harData} class:opfyldt>
							{aktivMetric === 'kcal' ? Math.round(v) : (Math.round(v * 10) / 10)}
						</div>
						<div class="soejle-baar">
							<div class="soejle-fyld" class:opfyldt style:height="{pct}%"></div>
						</div>
						<div class="soejle-dag">{dagNum(d)}</div>
						<div class="soejle-uge">{ugedagKort(d)}</div>
					</div>
				{/each}
			</div>
			<div class="kort-statistik">
				<span>Højeste: <strong>{formatVal(aktivMetric, Math.max(...syvDageVaerdier))}</strong></span>
				<span>·</span>
				<span>Gennemsnit: <strong>{formatVal(aktivMetric, syvDageVaerdier.reduce((s, v) => s + v, 0) / 7)}</strong></span>
			</div>
		</section>
	{:else if aktivTab === 'tredive'}
		<section class="kort">
			<div class="kort-titel">
				{NAERING_LABELS[aktivMetric]} sidste 30 dage
				<span class="kort-mål">mål: {dagligeMaal[aktivMetric]} {NAERING_ENHEDER[aktivMetric]}</span>
			</div>
			<svg class="linje-graf" viewBox="0 0 100 60" preserveAspectRatio="none">
				<line
					x1="0"
					y1={60 - (dagligeMaal[aktivMetric] / trediveMax) * 60}
					x2="100"
					y2={60 - (dagligeMaal[aktivMetric] / trediveMax) * 60}
					stroke="var(--sage, #6f9e7e)"
					stroke-width="0.4"
					stroke-dasharray="1.5 1.5"
				/>
				<path d={linjePath} fill="none" stroke="var(--terra)" stroke-width="0.8" />
			</svg>
			<div class="linje-meta">
				<span>{tredive.dage[0]}</span>
				<span>i dag</span>
			</div>
			<div class="kort-statistik">
				<span>Højeste: <strong>{formatVal(aktivMetric, Math.max(...trediveVaerdier))}</strong></span>
				<span>·</span>
				<span>Gennemsnit: <strong>{formatVal(aktivMetric, trediveVaerdier.reduce((s, v) => s + v, 0) / trediveVaerdier.filter((v) => v > 0).length || 0)}</strong></span>
			</div>
		</section>
	{:else}
		<section class="kort">
			<div class="kort-titel">
				{NAERING_LABELS[aktivMetric]} mod målet
				<span class="kort-mål">mål: {dagligeMaal[aktivMetric]} {NAERING_ENHEDER[aktivMetric]}</span>
			</div>
			<div class="mal-grid">
				<div class="mal-kort">
					<div class="mal-tal">{malRapport.aktuelStreak}</div>
					<div class="mal-lbl">dage i træk lige nu</div>
				</div>
				<div class="mal-kort">
					<div class="mal-tal">{malRapport.bedsteStreak}</div>
					<div class="mal-lbl">længste streak (30 dage)</div>
				</div>
				<div class="mal-kort">
					<div class="mal-tal">{malRapport.dageNåetMaal} <span class="mal-tal-sub">/ {malRapport.dageMedData}</span></div>
					<div class="mal-lbl">dage hvor du nåede målet</div>
				</div>
				<div class="mal-kort">
					<div class="mal-tal">{formatVal(aktivMetric, malRapport.gennemsnit)}</div>
					<div class="mal-lbl">gennemsnit pr dag med data</div>
				</div>
			</div>
		</section>
	{/if}

	{#if visAbo && !loading && !fejl}
		<!-- TRÆNING -->
		<div class="sektion-titel">Træning</div>

		{#if aktivTab === 'syv'}
			<section class="kort">
				<div class="kort-titel">
					Trænet sidste 7 dage
					<span class="kort-mål">mål: 1 pr dag</span>
				</div>
				<div class="soejler">
					{#each syvDageMeta.dage as d, i (d)}
						{@const v = syvDageTraening[i]}
						<div class="soejle-spalte">
							<div class="soejle-tal" class:synlig={v > 0} class:opfyldt={v > 0}>
								{v ? '✓' : ''}
							</div>
							<div class="soejle-baar">
								<div class="soejle-fyld" class:opfyldt={v > 0} style:height="{v * 100}%"></div>
							</div>
							<div class="soejle-dag">{dagNum(d)}</div>
							<div class="soejle-uge">{ugedagKort(d)}</div>
						</div>
					{/each}
				</div>
				<div class="kort-statistik">
					<span>Trænet: <strong>{syvDageTraening.reduce<number>((s, v) => s + v, 0)} af 7 dage</strong></span>
				</div>
			</section>

			<section class="kort">
				<div class="kort-titel">
					Træningsdage pr uge (sidste 8 uger)
					<span class="kort-mål">{traeningPrUge[traeningPrUge.length - 1]?.antal ?? 0} denne uge</span>
				</div>
				<div class="soejler">
					{#each traeningPrUge as u (u.ugeStart)}
						{@const pct = (u.antal / 7) * 100}
						<div class="soejle-spalte">
							<div class="soejle-tal synlig" class:opfyldt={u.antal >= 5}>{u.antal}</div>
							<div class="soejle-baar">
								<div class="soejle-fyld" class:opfyldt={u.antal >= 5} style:height="{pct}%"></div>
							</div>
							<div class="soejle-uge">u{u.ugeStart.slice(8)}</div>
						</div>
					{/each}
				</div>
			</section>
		{:else if aktivTab === 'tredive'}
			<section class="kort">
				<div class="kort-titel">
					Trænet sidste 30 dage
					<span class="kort-mål">{trediveTraening.reduce<number>((s, v) => s + v, 0)} af 30 dage</span>
				</div>
				<svg class="linje-graf" viewBox="0 0 100 60" preserveAspectRatio="none">
					<path d={trediveTraeningPath} fill="none" stroke="var(--terra)" stroke-width="0.8" />
				</svg>
				<div class="linje-meta">
					<span>{tredive.dage[0]}</span>
					<span>i dag</span>
				</div>
			</section>
		{:else}
			<section class="kort">
				<div class="kort-titel">Træning mod målet (1 pr dag)</div>
				<div class="mal-grid">
					<div class="mal-kort">
						<div class="mal-tal">{traeningRapport.aktuelStreak}</div>
						<div class="mal-lbl">dage i træk lige nu</div>
					</div>
					<div class="mal-kort">
						<div class="mal-tal">{traeningRapport.bedsteStreak}</div>
						<div class="mal-lbl">længste streak (30 dage)</div>
					</div>
					<div class="mal-kort">
						<div class="mal-tal">{traeningRapport.dageNåetMaal} <span class="mal-tal-sub">/ 30</span></div>
						<div class="mal-lbl">dage trænet (30 dage)</div>
					</div>
				</div>
			</section>
		{/if}

		<!-- VANER -->
		{#if maxVaner > 0}
			<div class="sektion-titel">Vaner</div>

			{#if aktivTab === 'syv'}
				<section class="kort">
					<div class="kort-titel">
						Vaner med ja sidste 7 dage
						<span class="kort-mål">mål: {maxVaner} pr dag</span>
					</div>
					<div class="soejler">
						{#each syvDageMeta.dage as d, i (d)}
							{@const v = syvDageVaner[i]}
							{@const pct = (v / maxVaner) * 100}
							{@const opfyldt = v === maxVaner}
							{@const harData = aboVanedage.has(d)}
							<div class="soejle-spalte">
								<div class="soejle-tal" class:synlig={harData} class:opfyldt>{v}</div>
								<div class="soejle-baar">
									<div class="soejle-fyld" class:opfyldt style:height="{pct}%"></div>
								</div>
								<div class="soejle-dag">{dagNum(d)}</div>
								<div class="soejle-uge">{ugedagKort(d)}</div>
							</div>
						{/each}
					</div>
					<div class="kort-statistik">
						<span>Højeste: <strong>{Math.max(...syvDageVaner)} af {maxVaner}</strong></span>
					</div>
				</section>
			{:else if aktivTab === 'tredive'}
				<section class="kort">
					<div class="kort-titel">
						Vaner med ja sidste 30 dage
						<span class="kort-mål">mål: {maxVaner} pr dag</span>
					</div>
					<svg class="linje-graf" viewBox="0 0 100 60" preserveAspectRatio="none">
						<line
							x1="0"
							y1="0"
							x2="100"
							y2="0"
							stroke="var(--sage, #6f9e7e)"
							stroke-width="0.4"
							stroke-dasharray="1.5 1.5"
						/>
						<path d={trediveVanerPath} fill="none" stroke="var(--terra)" stroke-width="0.8" />
					</svg>
					<div class="linje-meta">
						<span>{tredive.dage[0]}</span>
						<span>i dag</span>
					</div>
				</section>
			{:else}
				<section class="kort">
					<div class="kort-titel">Vaner mod målet ({maxVaner} pr dag)</div>
					<div class="mal-grid">
						<div class="mal-kort">
							<div class="mal-tal">{vanerRapport.aktuelStreak}</div>
							<div class="mal-lbl">dage i træk med alle ja</div>
						</div>
						<div class="mal-kort">
							<div class="mal-tal">{vanerRapport.bedsteStreak}</div>
							<div class="mal-lbl">længste streak (30 dage)</div>
						</div>
						<div class="mal-kort">
							<div class="mal-tal">{vanerRapport.dageNåetMaal} <span class="mal-tal-sub">/ {vanerRapport.dageMedData}</span></div>
							<div class="mal-lbl">dage med alle vaner ja</div>
						</div>
					</div>
				</section>
			{/if}
		{/if}
	{/if}

	{#if harForlobsHistorik && checkinDage.length > 0}
		{@const grafBredde = 320}
		{@const grafHojde = 120}
		{@const padX = 26}
		{@const padY = 10}
		{@const innerW = grafBredde - padX * 2}
		{@const innerH = grafHojde - padY * 2}
		{@const n = checkinDage.length}
		{@const baselineKommentar = checkinDage.find((d) => d.dagNummer === 0)?.entry.checkin?.generelTekst}
		<div class="sektion-titel">Baseline + check-ins</div>
		<section class="kort">
			<div class="kort-titel">Din udvikling siden Kickstart-baseline</div>
			<p class="kort-sub">
				Sammenlign dine 5 baseline-svar (dag 0) med dine ugentlige check-ins.
				Skala 1-10, hvor 10 er bedst.
			</p>

			<div class="checkin-graf-wrap">
				<svg viewBox="0 0 {grafBredde} {grafHojde}" class="checkin-graf" preserveAspectRatio="xMidYMid meet">
					<!-- Y-akse grid: 1, 5, 10 -->
					<line x1={padX} y1={padY} x2={grafBredde - padX} y2={padY} stroke="var(--border)" stroke-width="0.5" />
					<line x1={padX} y1={padY + innerH / 2} x2={grafBredde - padX} y2={padY + innerH / 2} stroke="var(--border)" stroke-width="0.5" stroke-dasharray="2 2" />
					<line x1={padX} y1={padY + innerH} x2={grafBredde - padX} y2={padY + innerH} stroke="var(--border)" stroke-width="0.5" />
					<!-- Y-akse labels -->
					<text x={padX - 4} y={padY + 4} text-anchor="end" class="graf-y-label">10</text>
					<text x={padX - 4} y={padY + innerH / 2 + 4} text-anchor="end" class="graf-y-label">5</text>
					<text x={padX - 4} y={padY + innerH + 4} text-anchor="end" class="graf-y-label">1</text>

					<!-- X-akse labels (dag-numre) -->
					{#each checkinDage as d, i (d.dagNummer)}
						{@const x = n === 1 ? padX + innerW / 2 : padX + (i / (n - 1)) * innerW}
						<text x={x} y={grafHojde - 2} text-anchor="middle" class="graf-x-label">
							{d.dagNummer === 0 ? 'Base' : `D${d.dagNummer}`}
						</text>
					{/each}

					<!-- Linjer pr slider -->
					{#each CHECKIN_SPORGSMAAL as q (q.id)}
						{@const punkter = checkinDage.map((d, i) => {
							const v = d.entry.checkin[q.id as keyof CheckinSvar] as number | undefined;
							if (typeof v !== 'number') return null;
							const x = n === 1 ? padX + innerW / 2 : padX + (i / (n - 1)) * innerW;
							const y = padY + ((10 - v) / 9) * innerH;
							return { x, y, v };
						}).filter((p): p is { x: number; y: number; v: number } => p !== null)}
						{#if punkter.length > 0}
							<path
								d={'M ' + punkter.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')}
								stroke={SLIDER_FARVER[q.id]}
								stroke-width="2"
								fill="none"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
							{#each punkter as p (p.x)}
								<circle cx={p.x} cy={p.y} r="3" fill={SLIDER_FARVER[q.id]} />
							{/each}
						{/if}
					{/each}
				</svg>
			</div>

			<div class="graf-legend">
				{#each CHECKIN_SPORGSMAAL as q (q.id)}
					<div class="graf-legend-item">
						<span class="graf-legend-prik" style="background:{SLIDER_FARVER[q.id]}"></span>
						<span class="graf-legend-label">{q.label}</span>
					</div>
				{/each}
			</div>

			{#if baselineKommentar}
				<div class="checkin-tekst">
					<div class="checkin-tekst-label">Din baseline-kommentar (dag 0)</div>
					<div class="checkin-tekst-body">{baselineKommentar}</div>
				</div>
			{/if}
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
		margin-bottom: 14px;
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
		margin: 4px 0 6px;
		line-height: 1.05;
		color: var(--text);
	}

	.page-sub {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		margin: 0;
		line-height: 1.5;
	}

	.metric-rad {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 14px 0 10px;
	}

	.metric-chip {
		padding: 7px 12px;
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 500;
		font-family: var(--ff-b);
		background: var(--bg2);
		color: var(--text2);
		border: 1px solid var(--border);
		border-radius: 99px;
		cursor: pointer;
	}

	.metric-chip.aktiv {
		background: var(--terra);
		color: #fff;
		border-color: var(--terra);
	}

	.tabs {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		background: var(--bg2);
		padding: 4px;
		border-radius: 12px;
		gap: 4px;
		margin-bottom: 14px;
	}

	.tab-knap {
		padding: 9px 6px;
		font-size: calc(12px * var(--fs-scale, 1));
		font-family: var(--ff-b);
		font-weight: 500;
		color: var(--text2);
		background: transparent;
		border: none;
		border-radius: 9px;
		cursor: pointer;
	}

	.tab-knap.aktiv {
		background: var(--white);
		color: var(--text);
		font-weight: 600;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
	}

	.kort {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 16px 18px;
	}

	.kort-titel {
		font-family: var(--ff-d);
		font-size: calc(16px * var(--fs-scale, 1));
		font-weight: 500;
		color: var(--text);
		margin-bottom: 14px;
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 10px;
		flex-wrap: wrap;
	}

	.kort-mål {
		font-family: var(--ff-b);
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 500;
		color: var(--text3);
	}

	.soejler {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 6px;
		height: 160px;
		align-items: end;
		margin-bottom: 12px;
	}

	.soejle-spalte {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		height: 100%;
		justify-content: end;
	}

	.soejle-tal {
		font-family: var(--ff-d);
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--terra);
		line-height: 1;
		opacity: 0;
		min-height: 12px;
	}

	.soejle-tal.synlig {
		opacity: 1;
	}

	.soejle-tal.opfyldt {
		color: var(--sage, #6f9e7e);
	}

	.soejle-baar {
		width: 100%;
		flex: 1;
		display: flex;
		align-items: end;
	}

	.soejle-fyld {
		width: 100%;
		min-height: 2px;
		border-radius: 4px 4px 0 0;
		background: var(--terra);
	}

	.soejle-fyld.opfyldt {
		background: var(--sage, #6f9e7e);
	}

	.soejle-dag {
		font-family: var(--ff-d);
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.soejle-uge {
		font-size: calc(10px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.kort-statistik {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		padding-top: 10px;
		border-top: 1px solid var(--border);
	}

	.kort-statistik strong {
		color: var(--text);
		font-weight: 600;
	}

	.linje-graf {
		width: 100%;
		height: 140px;
		margin-bottom: 6px;
	}

	.linje-meta {
		display: flex;
		justify-content: space-between;
		font-size: calc(10.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-bottom: 12px;
	}

	.mal-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.mal-kort {
		padding: 14px;
		background: var(--bg2);
		border: 1px solid var(--border);
		border-radius: 12px;
		text-align: center;
	}

	.mal-tal {
		font-family: var(--ff-d);
		font-size: calc(28px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--terra);
		line-height: 1.05;
	}

	.mal-tal-sub {
		font-size: calc(16px * var(--fs-scale, 1));
		color: var(--text3);
		font-weight: 400;
	}

	.mal-lbl {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text2);
		margin-top: 6px;
		line-height: 1.35;
	}

	.status-besked {
		padding: 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		text-align: center;
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
	}

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.sektion-titel {
		font-family: var(--ff-d);
		font-size: calc(20px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		margin: 22px 0 10px;
	}

	.checkin-graf-wrap {
		margin: 8px 0 4px;
	}

	.checkin-graf {
		width: 100%;
		height: auto;
		display: block;
	}

	:global(.checkin-graf .graf-y-label),
	:global(.checkin-graf .graf-x-label) {
		font-size: 9px;
		fill: var(--text4);
		font-family: var(--ff-b);
	}

	.graf-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 12px;
		margin-top: 6px;
	}

	.graf-legend-item {
		display: inline-flex;
		align-items: center;
		gap: 5px;
	}

	.graf-legend-prik {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	.graf-legend-label {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text2);
	}

	.checkin-tekst {
		margin-top: 12px;
		padding: 10px 12px;
		background: var(--bg2);
		border-radius: 10px;
	}

	.checkin-tekst-label {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text3);
		margin-bottom: 4px;
	}

	.checkin-tekst-body {
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--text);
		line-height: 1.5;
		white-space: pre-wrap;
	}
</style>
