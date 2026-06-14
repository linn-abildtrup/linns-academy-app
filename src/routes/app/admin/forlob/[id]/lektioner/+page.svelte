<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import type { ForlobDag } from '$lib/content/forlob';
	import { tomForlobDag } from '$lib/content/forlob';
	import { hentForlob, hentForlobsdage } from '$lib/firestore/forlob';
	import { hentVaneprogramForForlob } from '$lib/firestore/vaner';
	import type { VaneProgramDag } from '$lib/content/vaner';
	import { hentSmaaSkridt } from '$lib/firestore/smaaSkridt';
	import { dageForPlan, type SmaaSkridt } from '$lib/content/smaaSkridt';
	import Icon from '$lib/components/Icon.svelte';

	const forlobId = $derived(page.params.id ?? '');

	let forlob = $state<Forlob | null>(null);
	let dage = $state<ForlobDag[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let kunTomme = $state(false);
	let vpDage = $state<VaneProgramDag[]>([]);
	let smaaListe = $state<SmaaSkridt[]>([]);

	const dagsmap = $derived.by<Map<number, ForlobDag>>(() => {
		const m = new Map<number, ForlobDag>();
		for (const d of dage) m.set(d.dagNummer, d);
		return m;
	});

	const programDage = $derived.by<ForlobDag[]>(() => {
		if (!forlob) return [];
		const ud: ForlobDag[] = [];
		for (let i = 0; i <= forlob.antalDage; i++) {
			ud.push(dagsmap.get(i) ?? tomForlobDag(i));
		}
		return ud;
	});

	const baselineDag = $derived<ForlobDag | null>(programDage[0] ?? null);

	// Grupper dag 1..antalDage i uger af 7 til kalender-gridet.
	const uger = $derived.by<{ uge: number; dage: ForlobDag[] }[]>(() => {
		if (!forlob) return [];
		const grupper: { uge: number; dage: ForlobDag[] }[] = [];
		for (let start = 1; start <= forlob.antalDage; start += 7) {
			const dageIUge: ForlobDag[] = [];
			for (let nr = start; nr < start + 7 && nr <= forlob.antalDage; nr++) {
				dageIUge.push(dagsmap.get(nr) ?? tomForlobDag(nr));
			}
			grupper.push({ uge: Math.floor((start - 1) / 7) + 1, dage: dageIUge });
		}
		return grupper;
	});

	// Ugedags-navne til kolonne-overskrifterne. Da hver uge er præcis 7 dage,
	// falder Dag 1, 8, 15 ... altid på samme ugedag, så kolonnerne passer til
	// faste ugedage gennem hele forløbet.
	const ugedage = $derived.by<string[]>(() => {
		if (!forlob) return [];
		const start = forlob.startDato.toDate();
		const navne: string[] = [];
		for (let i = 1; i <= 7; i++) {
			const d = new Date(start);
			d.setDate(d.getDate() + i);
			const n = d.toLocaleDateString('da-DK', { weekday: 'short' }).replace('.', '');
			navne.push(n.charAt(0).toUpperCase() + n.slice(1));
		}
		return navne;
	});

	// Dage med refleksionstekst.
	const refleksionDage = $derived.by<Set<number>>(() => {
		const s = new Set<number>();
		for (const d of vpDage) if ((d.reflection ?? '').trim()) s.add(d.dagNummer);
		return s;
	});

	// Dage dækket af mindst ét lille skridt.
	const smaaSkridtDage = $derived.by<Set<number>>(() => {
		const s = new Set<number>();
		if (!forlob) return s;
		const start = forlob.startDato.toDate();
		for (const sk of smaaListe)
			for (const dnr of dageForPlan(sk.plan, forlob.antalDage, start)) s.add(dnr);
		return s;
	});

	function dagPrikker(d: ForlobDag) {
		return {
			lektion: d.lektioner.length > 0,
			refleksion: refleksionDage.has(d.dagNummer),
			smaaskridt: smaaSkridtDage.has(d.dagNummer)
		};
	}

	function harIndhold(d: ForlobDag): boolean {
		return (
			d.lektioner.length > 0 ||
			!!d.noteFraLinn ||
			refleksionDage.has(d.dagNummer) ||
			smaaSkridtDage.has(d.dagNummer)
		);
	}

	function dagState(d: ForlobDag): 'lektion' | 'note' | 'tom' {
		if (d.lektioner.length > 0) return 'lektion';
		if (d.noteFraLinn) return 'note';
		return 'tom';
	}

	const antalMedIndhold = $derived(
		programDage.filter((d) => d.dagNummer >= 1 && harIndhold(d)).length
	);

	const tommeDage = $derived(programDage.filter((d) => !harIndhold(d)));

	// Hvilken dag er forløbet nået til lige nu? null hvis vi er uden for forløbet.
	const idagDag = $derived.by<number | null>(() => {
		if (!forlob) return null;
		const start = forlob.startDato.toDate();
		start.setHours(0, 0, 0, 0);
		const nu = new Date();
		nu.setHours(0, 0, 0, 0);
		const diff = Math.round((nu.getTime() - start.getTime()) / 86400000);
		return diff >= 0 && diff <= forlob.antalDage ? diff : null;
	});

	// Beregn kalenderdato for et dag-nummer ud fra forløbets startDato.
	// Konvention: startDato = baseline (Dag 0). Dag 1 = startDato + 1 osv.
	function datoForDag(dagNummer: number): string {
		if (!forlob) return '';
		const start = forlob.startDato.toDate();
		const d = new Date(start);
		d.setDate(d.getDate() + dagNummer);
		return d.toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' });
	}

	function celleTitel(d: ForlobDag): string {
		const dato = datoForDag(d.dagNummer);
		const navn = d.dagNummer === 0 ? 'Baseline' : `Dag ${d.dagNummer}`;
		const tael = d.lektioner.length;
		const status =
			tael > 0
				? `${tael} lektion${tael === 1 ? '' : 'er'}`
				: d.noteFraLinn
					? 'kun note fra Linn'
					: 'intet indhold endnu';
		return `${navn} · ${dato} · ${status}`;
	}

	function scrollTilIdag() {
		if (idagDag === null) return;
		kunTomme = false;
		requestAnimationFrame(() => {
			document
				.getElementById(`dag-${idagDag}`)
				?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		});
	}

	onMount(async () => {
		try {
			const f = await hentForlob(forlobId);
			if (!f) {
				fejl = 'Forløbet findes ikke.';
				loading = false;
				return;
			}
			forlob = f;
			const [fd, vp, ss] = await Promise.all([
				hentForlobsdage(forlobId),
				hentVaneprogramForForlob(forlobId),
				hentSmaaSkridt(forlobId)
			]);
			dage = fd;
			vpDage = vp;
			smaaListe = ss;
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente data.';
		} finally {
			loading = false;
		}
	});
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin/forlob/{forlobId}">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>{forlob?.navn ?? 'Forløb'}</span>
		</a>
		<div class="eyebrow">Admin · {forlob?.navn ?? forlobId} · Lektioner</div>
		<h1>Lektioner</h1>
		<p class="page-sub">
			Klik på en dag for at redigere. Prikkerne viser hvad dagen indeholder: lektion, refleksion og
			små skridt.
		</p>
	</header>

	{#if loading}
		<div class="status-besked">Henter...</div>
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if forlob}
		<div class="vaerktoej">
			<div class="tael">
				<strong>{antalMedIndhold}</strong> af {forlob.antalDage} dage har indhold
			</div>
			<div class="vk-knapper">
				{#if idagDag !== null}
					<button class="vk-knap" onclick={scrollTilIdag}>I dag</button>
				{/if}
				<button class="vk-knap" class:aktiv={kunTomme} onclick={() => (kunTomme = !kunTomme)}>
					{kunTomme ? 'Vis alle' : 'Vis kun tomme'}
				</button>
			</div>
		</div>

		{#if kunTomme}
			{#if tommeDage.length === 0}
				<div class="status-besked">Alle dage har indhold 🎉</div>
			{:else}
				<div class="tomme-liste">
					{#each tommeDage as d (d.dagNummer)}
						<a class="tom-chip" href="/app/admin/forlob/{forlobId}/lektioner/{d.dagNummer}">
							{d.dagNummer === 0 ? 'Baseline' : `Dag ${d.dagNummer}`}
						</a>
					{/each}
				</div>
			{/if}
		{:else}
			{#if baselineDag}
				<a
					id="dag-0"
					class="baseline-row"
					class:idag={idagDag === 0}
					href="/app/admin/forlob/{forlobId}/lektioner/0"
				>
					<div class="celle stat-{dagState(baselineDag)} baseline-celle">0</div>
					<div class="baseline-tekst">
						<div class="baseline-titel">
							Baseline <span class="baseline-dato">· {datoForDag(0)}</span>
						</div>
						<div class="baseline-sub">
							{#if baselineDag.lektioner.length > 0}
								{baselineDag.lektioner.length} lektion{baselineDag.lektioner.length === 1
									? ''
									: 'er'}
							{:else if baselineDag.noteFraLinn}
								Kun note fra Linn
							{:else}
								Intet indhold endnu
							{/if}
						</div>
					</div>
					<Icon name="chevron-r" size={14} color="var(--text3)" />
				</a>
			{/if}

			<div class="grid-wrap">
				<div class="grid-row grid-head">
					<div class="uge-label"></div>
					{#each ugedage as navn, i (i)}
						<div class="ugedag-label">{navn}</div>
					{/each}
				</div>
				{#each uger as u (u.uge)}
					<div class="grid-row">
						<div class="uge-label">Uge {u.uge}</div>
						{#each u.dage as d (d.dagNummer)}
							{@const t = dagPrikker(d)}
							<a
								id="dag-{d.dagNummer}"
								class="celle"
								class:tom={!t.lektion && !t.refleksion && !t.smaaskridt}
								class:idag={d.dagNummer === idagDag}
								href="/app/admin/forlob/{forlobId}/lektioner/{d.dagNummer}"
								title={celleTitel(d)}
							>
								<span class="nr">{d.dagNummer}</span>
								<span class="prikker">
									{#if t.lektion}<span class="prik lektion"></span>{/if}
									{#if t.refleksion}<span class="prik refleksion"></span>{/if}
									{#if t.smaaskridt}<span class="prik smaaskridt"></span>{/if}
								</span>
							</a>
						{/each}
					</div>
				{/each}
			</div>

			<div class="legend">
				<span class="legend-item"><span class="prik lektion"></span> Lektion</span>
				<span class="legend-item"><span class="prik refleksion"></span> Refleksion</span>
				<span class="legend-item"><span class="prik smaaskridt"></span> Små skridt</span>
			</div>
		{/if}
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

	.status-besked {
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
		text-align: center;
	}

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	/* Værktøjslinje: tæller + knapper */
	.vaerktoej {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		flex-wrap: wrap;
		margin-bottom: 12px;
	}

	.tael {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
	}

	.tael strong {
		color: var(--text);
		font-weight: 700;
	}

	.vk-knapper {
		display: flex;
		gap: 8px;
	}

	.vk-knap {
		font-family: inherit;
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text2);
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 9px;
		padding: 7px 12px;
		cursor: pointer;
	}

	.vk-knap:hover {
		background: var(--bg2);
	}

	.vk-knap.aktiv {
		background: var(--text);
		color: var(--white);
		border-color: var(--text);
	}

	/* Kalender-grid */
	.grid-wrap {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 12px;
		margin-bottom: 12px;
	}

	.grid-row {
		display: grid;
		grid-template-columns: 46px repeat(7, 1fr);
		gap: 6px;
		align-items: center;
		margin-bottom: 6px;
	}

	.grid-row:last-child {
		margin-bottom: 0;
	}

	.uge-label {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text3);
	}

	.grid-head {
		margin-bottom: 8px;
	}

	.ugedag-label {
		text-align: center;
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.celle {
		aspect-ratio: 1 / 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 3px;
		border-radius: 9px;
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-d);
		font-weight: 700;
		font-size: calc(13px * var(--fs-scale, 1));
		text-decoration: none;
		min-width: 0;
	}

	.celle.tom {
		color: var(--text3);
	}

	.celle .nr {
		line-height: 1;
	}

	.prikker {
		display: flex;
		gap: 3px;
		min-height: 5px;
		align-items: center;
	}

	.prik {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		display: inline-block;
		flex-shrink: 0;
	}

	.prik.lektion {
		background: var(--sage);
	}

	.prik.refleksion {
		background: var(--gold);
	}

	.prik.smaaskridt {
		background: var(--terra);
	}

	.legend-item .prik {
		width: 9px;
		height: 9px;
	}

	.celle:hover {
		filter: brightness(0.96);
	}

	.celle.idag {
		box-shadow: 0 0 0 2px var(--text);
	}

	.stat-lektion {
		background: var(--sage);
		color: #fff;
	}

	.stat-note {
		background: var(--tdim);
		color: var(--terra);
	}

	.stat-tom {
		background: var(--bg2);
		color: var(--text3);
	}

	/* Baseline-række (dag 0) over gridet */
	.baseline-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		text-decoration: none;
		color: inherit;
		margin-bottom: 12px;
	}

	.baseline-row:hover {
		background: var(--bg2);
	}

	.baseline-row.idag {
		box-shadow: 0 0 0 2px var(--text);
	}

	.baseline-celle {
		width: 36px;
		height: 36px;
		aspect-ratio: auto;
		flex-shrink: 0;
	}

	.baseline-tekst {
		flex: 1;
		min-width: 0;
	}

	.baseline-titel {
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.baseline-dato {
		color: var(--text3);
		font-weight: 400;
	}

	.baseline-sub {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	/* Legende */
	.legend {
		display: flex;
		gap: 16px;
		flex-wrap: wrap;
		padding: 0 2px;
	}

	.legend-item {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
	}

	/* "Vis kun tomme"-liste */
	.tomme-liste {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.tom-chip {
		font-size: calc(12.5px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text2);
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 9px;
		padding: 8px 12px;
		text-decoration: none;
	}

	.tom-chip:hover {
		background: var(--bg2);
	}
</style>
