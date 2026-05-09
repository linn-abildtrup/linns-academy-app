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

	const getUser = getContext<() => User | null>('user');
	const getUserDoc = getContext<() => UserDoc | null>('userDoc');
	const user = $derived(getUser());
	const userDoc = $derived(getUserDoc?.() ?? null);
	const visUdvidet = $derived(userDoc?.visUdvidetNaering === true);
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
	let loading = $state(true);
	let fejl = $state<string | null>(null);

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
			alle = await hentMaaltiderIPeriode(u.uid, fraDato, tilDato);
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
		<p class="page-sub">Følg din næringsdata over tid og se hvordan du klarer dig mod dine mål.</p>
	</header>

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

	{#if loading}
		<Loading tekst="Henter data..." kompakt />
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if alle.length === 0}
		<div class="status-besked">
			Du har endnu ikke gemt nogen måltider. Brug 30-30-3 til at logge dine måltider, og kom tilbage her for at se din udvikling.
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
</style>
