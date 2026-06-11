<script lang="ts">
	import { onMount } from 'svelte';
	import { doc, getDoc } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';

	type SubResultat = { gnsBaseline: number; gnsSeneste: number; gnsAendring: number };
	type Gruppe = {
		antalMedData: number;
		antalMedUdvikling: number;
		gnsBaseline: number;
		gnsSeneste: number;
		gnsAendring: number;
		andelForbedret: number;
		subskalaer: Record<'somatisk' | 'psykologisk' | 'urogenital', SubResultat>;
	};
	type MrsSnapshot = {
		genereretAt: number;
		kunderTjekket: number;
		samlet: Gruppe;
		prForlob: ({ forlobId: string; navn: string } & Gruppe)[];
	};

	let snapshot = $state<MrsSnapshot | null>(null);
	let loading = $state(true);
	let fejl = $state<string | null>(null);

	onMount(async () => {
		try {
			const d = await getDoc(doc(db, 'adminStats', 'mrs'));
			if (d.exists()) snapshot = d.data() as MrsSnapshot;
			else fejl = 'Ingen MRS-statistik endnu — kør scriptet for at generere den.';
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente statistik. Tjek at firestore-reglen for adminStats er deployet.';
		} finally {
			loading = false;
		}
	});

	const tal = (n: number) => n.toLocaleString('da-DK', { maximumFractionDigits: 1 });
	function datoTekst(ms: number): string {
		return new Date(ms).toLocaleString('da-DK', { dateStyle: 'long', timeStyle: 'short' });
	}
	// MRS total går 0-44; subskalaer er mindre. Søjlehøjde i % af et maks.
	function pct(v: number, maks: number): number {
		return Math.max(2, Math.round((v / maks) * 100));
	}

	const SUBSKALA_NAVN = {
		somatisk: 'Kropslige (somatisk)',
		psykologisk: 'Psykiske (psykologisk)',
		urogenital: 'Urogenitale'
	} as const;
	const subskalaListe = ['somatisk', 'psykologisk', 'urogenital'] as const;
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
			<code>npx tsx scripts/generer-mrs-stats.ts</code> — så genberegnes snapshottet.
		</div>
	{:else if snapshot}
		{@const s = snapshot.samlet}
		<!-- Nøgletal -->
		<div class="kpi-grid">
			<div class="kpi-kort">
				<div class="kpi-tal">{s.antalMedData}</div>
				<div class="kpi-label">kunder målt</div>
				<div class="kpi-sub">af {snapshot.kunderTjekket}</div>
			</div>
			<div class="kpi-kort">
				<div class="kpi-tal">{s.antalMedUdvikling}</div>
				<div class="kpi-label">har flere målinger</div>
				<div class="kpi-sub">grundlag for udvikling</div>
			</div>
			<div class="kpi-kort fremhaev">
				<div class="kpi-tal">↓ {tal(Math.abs(s.gnsAendring))}</div>
				<div class="kpi-label">gns. forbedring</div>
				<div class="kpi-sub">{tal(s.gnsBaseline)} → {tal(s.gnsSeneste)} point</div>
			</div>
			<div class="kpi-kort fremhaev">
				<div class="kpi-tal">{s.andelForbedret}%</div>
				<div class="kpi-label">er blevet bedre</div>
				<div class="kpi-sub">lavere MRS end ved start</div>
			</div>
		</div>

		<!-- Før → efter, samlet -->
		<section class="card">
			<div class="kort-titel">Samlet udvikling ({s.antalMedUdvikling} kunder)</div>
			<div class="foer-efter">
				<div class="be-soejle">
					<div class="be-tal">{tal(s.gnsBaseline)}</div>
					<div class="be-bar baseline" style="height:{pct(s.gnsBaseline, 44)}%"></div>
					<div class="be-navn">Baseline</div>
				</div>
				<div class="be-pil">
					<Icon name="chevron-r" size={18} color="var(--text3)" />
				</div>
				<div class="be-soejle">
					<div class="be-tal">{tal(s.gnsSeneste)}</div>
					<div class="be-bar seneste" style="height:{pct(s.gnsSeneste, 44)}%"></div>
					<div class="be-navn">Seneste</div>
				</div>
			</div>
			<p class="skala-note">Skala 0–44 · lavere = bedre</p>
		</section>

		<!-- Subskalaer -->
		<section class="card">
			<div class="kort-titel">Hvor sker forbedringen?</div>
			{#each subskalaListe as key (key)}
				{@const sub = s.subskalaer[key]}
				<div class="sub-rad">
					<div class="sub-navn">{SUBSKALA_NAVN[key]}</div>
					<div class="sub-tal">
						<span class="sub-foer">{tal(sub.gnsBaseline)}</span>
						<Icon name="chevron-r" size={12} color="var(--text3)" />
						<span class="sub-efter">{tal(sub.gnsSeneste)}</span>
						<span class="sub-aendring" class:bedre={sub.gnsAendring < 0}>
							{sub.gnsAendring < 0 ? '↓' : sub.gnsAendring > 0 ? '↑' : ''}
							{tal(Math.abs(sub.gnsAendring))}
						</span>
					</div>
				</div>
			{/each}
		</section>

		<!-- Pr forløb -->
		{#if snapshot.prForlob.length > 0}
			<section class="card">
				<div class="kort-titel">Pr. hold</div>
				<div class="tabel">
					<div class="tabel-head">
						<div class="t-navn">Forløb</div>
						<div class="t-tal">Udvikling</div>
						<div class="t-tal">Baseline → seneste</div>
						<div class="t-tal">Forbedret</div>
					</div>
					{#each snapshot.prForlob as g (g.forlobId)}
						<div class="tabel-rad">
							<div class="t-navn">{g.navn}</div>
							<div class="t-tal">{g.antalMedUdvikling}</div>
							<div class="t-tal">{tal(g.gnsBaseline)} → {tal(g.gnsSeneste)}</div>
							<div class="t-tal">{g.andelForbedret}%</div>
						</div>
					{/each}
				</div>
				<p class="skala-note">Hold med under 3 målinger er skjult.</p>
			</section>
		{/if}

		<div class="opdateret">
			<span>Sidst opdateret: {datoTekst(snapshot.genereretAt)}</span>
			<span class="opdateret-cmd">Genberegn: <code>npx tsx scripts/generer-mrs-stats.ts</code></span
			>
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

	/* KPI-kort */
	.kpi-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		margin-bottom: 16px;
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
		font-size: calc(26px * var(--fs-scale, 1));
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

	/* Før → efter */
	.foer-efter {
		display: flex;
		align-items: flex-end;
		justify-content: center;
		gap: 24px;
		height: 160px;
	}
	.be-soejle {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
		height: 100%;
		width: 90px;
	}
	.be-tal {
		font-family: var(--ff-d);
		font-size: calc(20px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		margin-bottom: 6px;
	}
	.be-bar {
		width: 64px;
		border-radius: 8px 8px 0 0;
		min-height: 4px;
	}
	.be-bar.baseline {
		background: #c9a07a;
	}
	.be-bar.seneste {
		background: #6f9e7e;
	}
	.be-navn {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text2);
		margin-top: 8px;
	}
	.be-pil {
		padding-bottom: 30px;
	}
	.skala-note {
		text-align: center;
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		margin: 12px 0 0;
	}

	/* Subskalaer */
	.sub-rad {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 0;
		border-bottom: 1px solid var(--border, #eee);
	}
	.sub-rad:last-child {
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

	/* Tabel */
	.tabel-head,
	.tabel-rad {
		display: grid;
		grid-template-columns: 1.6fr 1fr 1.4fr 1fr;
		gap: 8px;
		align-items: center;
	}
	.tabel-head {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text3);
		padding-bottom: 8px;
		border-bottom: 1px solid var(--border, #eee);
	}
	.tabel-rad {
		padding: 10px 0;
		border-bottom: 1px solid var(--border, #f0ece4);
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text);
	}
	.tabel-rad:last-child {
		border-bottom: none;
	}
	.t-tal {
		text-align: right;
		color: var(--text2);
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
