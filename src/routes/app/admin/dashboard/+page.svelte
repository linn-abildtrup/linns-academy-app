<script lang="ts">
	import { onMount } from 'svelte';
	import { doc, getDoc } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';

	type SubResultat = { gnsBaseline: number; gnsSeneste: number; gnsAendring: number };
	type Rejsepunkt = { gns: number; antal: number };
	type SvaergradGruppe = { antal: number; gnsAendring: number };
	type Scope = {
		antalMedData: number;
		antalMedUdvikling: number;
		gnsBaseline: number;
		gnsSeneste: number;
		gnsAendring: number;
		andelForbedret: number;
		subskalaer: Record<'somatisk' | 'psykologisk' | 'urogenital', SubResultat>;
		rejse: Rejsepunkt[];
		baselineSvaergrad: Record<'mild' | 'moderat' | 'svaer', SvaergradGruppe>;
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
		prForlob: Forlob[];
	};

	let snapshot = $state<MrsSnapshot | null>(null);
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let aktivFane = $state<'alle' | 'forlob'>('alle');
	let valgtForlobId = $state<string | null>(null);

	onMount(async () => {
		try {
			const d = await getDoc(doc(db, 'adminStats', 'mrs'));
			if (d.exists()) {
				snapshot = d.data() as MrsSnapshot;
				valgtForlobId = snapshot.prForlob[0]?.forlobId ?? null;
			} else fejl = 'Ingen MRS-statistik endnu — kør scriptet for at generere den.';
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente statistik. Tjek at firestore-reglen for adminStats er deployet.';
		} finally {
			loading = false;
		}
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

	// --- Rejse-graf ---
	const FARVER = ['#6F9E7E', '#B87B6E', '#7A8CA0', '#C9A07A', '#8C5C7A', '#5C7A8C'];
	const G = { w: 600, h: 230, padL: 30, padR: 14, padT: 14, padB: 26 };

	const graf = $derived.by(() => {
		if (!snapshot) return null;
		// Linjer: 'Alle' (benchmark) altid med. Plus alle forløb (Alle-fanen)
		// eller kun det valgte (Vælg forløb-fanen).
		const linjer: { navn: string; farve: string; rejse: Rejsepunkt[]; fremhaev: boolean }[] = [
			{
				navn: 'Alle',
				farve: '#2d2a26',
				rejse: snapshot.samlet.rejse,
				fremhaev: aktivFane === 'alle'
			}
		];
		const forlob =
			aktivFane === 'alle'
				? snapshot.prForlob
				: snapshot.prForlob.filter((f) => f.forlobId === valgtForlobId);
		forlob.forEach((f, i) =>
			linjer.push({
				navn: f.navn,
				farve: FARVER[i % FARVER.length],
				rejse: f.rejse,
				fremhaev: true
			})
		);

		const maxP = Math.max(2, ...linjer.map((l) => l.rejse.length));
		const yMax = Math.max(...linjer.flatMap((l) => l.rejse.map((p) => p.gns)), 1) * 1.15;
		const gx = (i: number) => G.padL + (maxP <= 1 ? 0 : (i / (maxP - 1)) * (G.w - G.padL - G.padR));
		const gy = (v: number) => G.padT + (1 - v / yMax) * (G.h - G.padT - G.padB);

		return {
			gx,
			gy,
			linjer: linjer.map((l) => ({
				...l,
				pkt: l.rejse.map((p, i) => ({ x: gx(i), y: gy(p.gns), ...p })),
				path: l.rejse.map((p, i) => `${i === 0 ? 'M' : 'L'}${gx(i)},${gy(p.gns)}`).join(' ')
			})),
			yTicks: [0, yMax / 2, yMax].map((v) => ({ v: Math.round(v), y: gy(v) })),
			xLabels: Array.from({ length: maxP }, (_, i) => ({ x: gx(i), label: `${i + 1}.` }))
		};
	});

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
		<h1>MRS-udvikling</h1>
		<p class="page-sub">
			Menopause Rating Scale — lavere score betyder færre symptomer. Baseline er kundens første
			måling, sammenlignet med hendes seneste.
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
		<!-- Faner -->
		<div class="faner">
			<button class="fane" class:aktiv={aktivFane === 'alle'} onclick={() => (aktivFane = 'alle')}>
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
			<!-- Nøgletal -->
			<div class="kpi-grid">
				<div class="kpi-kort">
					<div class="kpi-tal">{s.antalMedData}</div>
					<div class="kpi-label">kunder målt</div>
				</div>
				<div class="kpi-kort">
					<div class="kpi-tal">{s.antalMedUdvikling}</div>
					<div class="kpi-label">har flere målinger</div>
				</div>
				<div class="kpi-kort fremhaev">
					<div class="kpi-tal">↓ {tal(Math.abs(s.gnsAendring))}</div>
					<div class="kpi-label">gns. forbedring</div>
					<div class="kpi-sub">{tal(s.gnsBaseline)} → {tal(s.gnsSeneste)} point</div>
				</div>
				<div class="kpi-kort fremhaev">
					<div class="kpi-tal">{s.andelForbedret}%</div>
					<div class="kpi-label">er blevet bedre</div>
				</div>
			</div>

			<!-- Rejse-graf -->
			{#if graf}
				<section class="card">
					<div class="kort-titel">Udvikling over målinger</div>
					<svg class="graf" viewBox="0 0 {G.w} {G.h}" preserveAspectRatio="xMidYMid meet">
						<!-- y-gitter -->
						{#each graf.yTicks as t (t.v)}
							<line x1={G.padL} y1={t.y} x2={G.w - G.padR} y2={t.y} class="gitter" />
							<text x={G.padL - 5} y={t.y + 3} class="akse-tekst" text-anchor="end">{t.v}</text>
						{/each}
						<!-- x-labels -->
						{#each graf.xLabels as x (x.label)}
							<text x={x.x} y={G.h - 8} class="akse-tekst" text-anchor="middle">{x.label}</text>
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
				{#each SVAERGRAD as grad (grad.key)}
					{@const g = s.baselineSvaergrad[grad.key]}
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
				<div class="kort-titel">Fordeling ({s.antalMedUdvikling} kunder)</div>
				<div class="fordeling-bar">
					<div
						class="fb-del meget"
						style="width:{fbProcent(s.forbedringsFordeling, 'megetBedre')}%"
					></div>
					<div
						class="fb-del lidt"
						style="width:{fbProcent(s.forbedringsFordeling, 'lidtBedre')}%"
					></div>
					<div
						class="fb-del uaendret"
						style="width:{fbProcent(s.forbedringsFordeling, 'uaendret')}%"
					></div>
					<div
						class="fb-del vaerre"
						style="width:{fbProcent(s.forbedringsFordeling, 'vaerre')}%"
					></div>
				</div>
				<div class="fordeling-tegnforklaring">
					<span
						><span class="fb-prik meget"></span>Meget bedre ({s.forbedringsFordeling
							.megetBedre})</span
					>
					<span
						><span class="fb-prik lidt"></span>Lidt bedre ({s.forbedringsFordeling.lidtBedre})</span
					>
					<span
						><span class="fb-prik uaendret"></span>Uændret ({s.forbedringsFordeling.uaendret})</span
					>
					<span><span class="fb-prik vaerre"></span>Værre ({s.forbedringsFordeling.vaerre})</span>
				</div>
				<p class="skala-note">"Meget bedre" = MRS faldt 5+ point.</p>
			</section>

			<!-- Subskalaer -->
			<section class="card">
				<div class="kort-titel">Hvor sker forbedringen?</div>
				{#each subskalaListe as key (key)}
					{@const sub = s.subskalaer[key]}
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
		{/if}

		<div class="opdateret">
			<span>Sidst opdateret: {datoTekst(snapshot.genereretAt)}</span>
			<span>Genberegn: <code>npx tsx scripts/generer-mrs-stats.ts</code></span>
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

	/* Graf */
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
</style>
