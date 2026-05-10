<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import type { UserProduct } from '$lib/content/mikrotraening';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import {
		beregnDagsStatus,
		beregnFlowerNiveau,
		beregnSamletFremgang,
		type FlowerNiveau,
		type VaneProgramDag,
		type VanedagEntry
	} from '$lib/content/vaner';
	import {
		beregnAboFlowerNiveau,
		beregnAboFremgang,
		dagensBonus,
		erUgentligCheckinDag,
		formaterDato,
		parseDato,
		type AboBonusForslag,
		type AboVaneOpsaetning,
		type AboVanedagEntry
	} from '$lib/content/aboVaner';
	import { unlockedDays } from '$lib/content/forlobAdgang';
	import { hentUserProduct } from '$lib/firestore/mikrotraening';
	import { hentForlob } from '$lib/firestore/forlob';
	import { hentAlleVanedage, hentVaneprogramForForlob } from '$lib/firestore/vaner';
	import {
		hentAboBonusPulje,
		hentAboVaneOpsaetning,
		hentAlleAboVanedage
	} from '$lib/firestore/aboVaner';
	import {
		erForlobsklient,
		erModulbruger,
		harPremium
	} from '$lib/utils/userAdgang';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';

	const getUser = getContext<() => User | null>('user');
	const getUserDoc = getContext<() => UserDoc | null>('userDoc');
	const user = $derived(getUser());
	const userDoc = $derived(getUserDoc());

	type Gren = 'forlob' | 'abo' | 'ingen';
	const gren = $derived<Gren>(
		erForlobsklient(userDoc) ? 'forlob' : erModulbruger(userDoc) ? 'abo' : 'ingen'
	);

	// === Forløbs-state ===
	let userProduct = $state<UserProduct | null>(null);
	let forlob = $state<Forlob | null>(null);
	let dage = $state<VaneProgramDag[]>([]);
	let entries = $state<Map<number, VanedagEntry>>(new Map());

	// === Abo-state ===
	let aboOpsaetning = $state<AboVaneOpsaetning | null>(null);
	let aboBonusPulje = $state<AboBonusForslag[]>([]);
	let aboEntries = $state<Map<string, AboVanedagEntry>>(new Map());

	let loading = $state(true);
	let fejl = $state<string | null>(null);

	// === Forløbs-derived ===
	const startDato = $derived(forlob?.startDato?.toDate() ?? null);
	const antalDage = $derived(forlob?.antalDage ?? 21);
	const unlocket = $derived(unlockedDays(startDato, antalDage));
	const erIkkeStartet = $derived(unlocket < 0);
	const baselineDag = $derived(dage.find((d) => d.isBaseline) ?? null);
	const programDage = $derived(
		dage.filter((d) => !d.isBaseline).sort((a, b) => a.dagNummer - b.dagNummer)
	);
	const fremgang = $derived(beregnSamletFremgang(dage, entries, unlocket));

	// === Abo-derived ===
	const idag = $derived(formaterDato(new Date()));
	const idagBonus = $derived(dagensBonus(aboBonusPulje, idag));
	const erIdagCheckin = $derived(erUgentligCheckinDag(new Date()));
	const idagEntry = $derived(aboEntries.get(idag) ?? null);

	const sidste7Dage = $derived.by(() => {
		const r: { dato: string; flower: FlowerNiveau }[] = [];
		const d = new Date();
		for (let i = 6; i >= 0; i--) {
			const cur = new Date(d);
			cur.setDate(cur.getDate() - i);
			const datoStr = formaterDato(cur);
			const entry = aboEntries.get(datoStr) ?? null;
			r.push({
				dato: datoStr,
				flower: aboOpsaetning
					? beregnAboFlowerNiveau(aboOpsaetning.valgteVaner, entry)
					: 'none'
			});
		}
		return r;
	});

	const aboFremgang7 = $derived.by(() => {
		if (!aboOpsaetning) return { gennemforte: 0, iAlt: 0 };
		const til = new Date();
		const fra = new Date(til);
		fra.setDate(fra.getDate() - 6);
		return beregnAboFremgang(
			aboOpsaetning.valgteVaner,
			aboEntries,
			aboBonusPulje,
			formaterDato(fra),
			formaterDato(til)
		);
	});

	const dagsLabel = $derived.by(() => {
		const d = new Date();
		return d.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' });
	});

	onMount(async () => {
		const u = user;
		if (!u) {
			fejl = 'Du skal være logget ind.';
			loading = false;
			return;
		}

		try {
			if (gren === 'forlob') {
				await indlaesForlobsData(u.uid);
			} else if (gren === 'abo') {
				await indlaesAboData(u.uid);
			}
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente data. Prøv igen.';
		} finally {
			loading = false;
		}
	});

	async function indlaesForlobsData(uid: string) {
		const up = await hentUserProduct(uid, 'kickstart');
		if (!up) {
			fejl = 'Du har ikke adgang til vanetracker endnu.';
			return;
		}
		userProduct = up;

		const forlobId = (up as UserProduct & { forlobId?: string }).forlobId;
		if (!forlobId) {
			fejl = 'Du er ikke tilknyttet et forløb endnu. Kontakt Linn.';
			return;
		}

		const f = await hentForlob(forlobId);
		if (!f) {
			fejl = 'Forløbet kunne ikke findes.';
			return;
		}
		forlob = f;

		const programDage = await hentVaneprogramForForlob(forlobId);
		if (programDage.length === 0) {
			fejl = 'Vaneprogrammet er ikke sat op for dette forløb endnu.';
			return;
		}
		dage = programDage;
		entries = await hentAlleVanedage(uid, 'kickstart');
	}

	async function indlaesAboData(uid: string) {
		const o = await hentAboVaneOpsaetning(uid);
		aboOpsaetning = o;
		if (o) {
			[aboBonusPulje, aboEntries] = await Promise.all([
				hentAboBonusPulje(o.produktType),
				hentAlleAboVanedage(uid)
			]);
		}
	}

	// ==== Forløbs-funktioner (uændret) ====
	function dagState(dag: VaneProgramDag): {
		status: 'locked' | ReturnType<typeof beregnDagsStatus>;
		flower: FlowerNiveau;
	} {
		if (erIkkeStartet || dag.dagNummer > unlocket) {
			return { status: 'locked', flower: 'none' };
		}
		const entry = entries.get(dag.dagNummer) ?? null;
		return {
			status: beregnDagsStatus(dag, entry),
			flower: beregnFlowerNiveau(dag, entry)
		};
	}

	function naesteDagNummer(): number | null {
		if (erIkkeStartet) return null;
		if (baselineDag) {
			const s = dagState(baselineDag);
			if (s.status === 'empty' || s.status === 'partial') return 0;
		}
		for (const dag of programDage) {
			if (dag.dagNummer > unlocket) break;
			const s = dagState(dag);
			if (s.status === 'empty' || s.status === 'partial') return dag.dagNummer;
		}
		return null;
	}

	const naeste = $derived(naesteDagNummer());

	function uger(): VaneProgramDag[][] {
		const r: VaneProgramDag[][] = [[], [], []];
		for (const dag of programDage) {
			const ugeIdx = Math.min(2, Math.max(0, dag.uge - 1));
			r[ugeIdx].push(dag);
		}
		return r;
	}

	function kortDagLabel(datoStr: string): string {
		const d = parseDato(datoStr);
		return d.toLocaleDateString('da-DK', { weekday: 'short' }).slice(0, 2);
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/moduler">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Moduler</span>
		</a>
		<div class="eyebrow">{gren === 'forlob' ? 'Forløb' : 'Daglig'}</div>
		<h1>Vaner</h1>
		<p class="page-sub">
			{#if gren === 'forlob'}
				Tre små vaner, hver dag i 21 dage. Tjek ind når du har lavet dem.
			{:else if gren === 'abo'}
				Dine personlige vaner. Tjek ind hver dag — uge for uge.
			{:else}
				Vaner-modulet kræver et abonnement eller forløb.
			{/if}
		</p>
	</header>

	{#if loading}
		<Loading tekst="Henter dine vaner..." />
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if gren === 'forlob' && forlob && dage.length > 0}
		{#if erIkkeStartet}
			<div class="info-banner">
				<div class="banner-titel">Forløbet er ikke startet endnu</div>
				<div class="banner-tekst">
					Vi går i gang {forlob.startDato.toDate().toLocaleDateString('da-DK', {
						day: 'numeric',
						month: 'long'
					})}.
				</div>
			</div>
		{:else if naeste !== null}
			<a class="start-knap" href="/app/moduler/vaner/{naeste}">
				{naeste === 0 ? 'Start dit baseline-check-in' : `Åbn dag ${naeste}`}
				<Icon name="arrow" size={14} color="#fff" />
			</a>
		{:else}
			<div class="start-knap faerdig">
				<Icon name="check" size={14} color="#fff" />
				Du er ajour med dine vaner
			</div>
		{/if}

		{#if baselineDag}
			{@const baselineState = dagState(baselineDag)}
			<a
				class="baseline-row {baselineState.status === 'locked' ? 'laast' : ''}"
				class:done={baselineState.status === 'completed'}
				href={baselineState.status === 'locked' ? '#' : `/app/moduler/vaner/0`}
				aria-disabled={baselineState.status === 'locked'}
			>
				<div class="baseline-icon">
					{#if baselineState.status === 'completed'}
						<Icon name="check" size={14} color="#fff" />
					{:else}
						0
					{/if}
				</div>
				<div class="baseline-tekst">
					<div class="baseline-titel">Baseline</div>
					<div class="baseline-sub">
						{baselineState.status === 'completed'
							? 'Udfyldt — du har dit udgangspunkt'
							: baselineState.status === 'partial'
								? 'Delvist udfyldt'
								: 'Mærk efter før du starter'}
					</div>
				</div>
				<Icon name="chevron-r" size={14} color="var(--text3)" />
			</a>
		{/if}

		<section class="card">
			<div class="card-head">
				<div class="section-label">Din fremgang</div>
				<div class="card-tael">{fremgang.gennemforte} / {antalDage}</div>
			</div>
			<div class="prog-bar">
				<div
					class="prog-fill"
					style="width: {antalDage > 0
						? Math.round((fremgang.gennemforte / antalDage) * 100)
						: 0}%"
				></div>
			</div>
			<p class="hint">Klik på en dag for at åbne den</p>

			{#each uger() as ugeDage, i (i)}
				{#if ugeDage.length > 0}
					<div class="uge-label">Uge {i + 1}</div>
					<div class="uge-grid">
						{#each ugeDage as dag (dag.dagNummer)}
							{@const s = dagState(dag)}
							<a
								class="dag flower-{s.flower} status-{s.status}"
								class:laast={s.status === 'locked'}
								class:naeste={dag.dagNummer === naeste}
								href={s.status === 'locked' ? '#' : `/app/moduler/vaner/${dag.dagNummer}`}
								aria-disabled={s.status === 'locked'}
							>
								<span class="dag-num">{dag.dagNummer}</span>
								{#if s.status === 'completed'}
									<Icon name="check" size={10} color="#fff" />
								{:else if s.status === 'locked'}
									<Icon name="lock" size={10} color="var(--text4)" />
								{/if}
							</a>
						{/each}
					</div>
				{/if}
			{/each}
		</section>
	{:else if gren === 'abo'}
		{#if !aboOpsaetning}
			<div class="onboarding-card">
				<div class="onboarding-titel">Velkommen til vanetrackeren</div>
				<p class="onboarding-tekst">
					{#if harPremium(userDoc)}
						Vælg op til 7 vaner du vil arbejde med dagligt.
					{:else}
						Vælg de 3 vaner du vil arbejde med dagligt.
					{/if}
					Dine vaner er låst i 21 dage så du har tid til at danne dem som vaner.
				</p>
				<a class="start-knap" href="/app/moduler/vaner/opsaetning">
					Vælg dine vaner
					<Icon name="arrow" size={14} color="#fff" />
				</a>
			</div>
		{:else}
			<a class="start-knap" href="/app/moduler/vaner/abo/{idag}">
				{idagEntry ? 'Åbn dagen' : 'Tjek ind for i dag'}
				<Icon name="arrow" size={14} color="#fff" />
			</a>

			<div class="dagslabel">{dagsLabel}{erIdagCheckin ? ' · ugentligt check-in' : ''}</div>

			<section class="card">
				<div class="card-head">
					<div class="section-label">Sidste 7 dage</div>
					<div class="card-tael">{aboFremgang7.gennemforte} / 7</div>
				</div>
				<div class="prog-bar">
					<div
						class="prog-fill"
						style="width: {Math.round((aboFremgang7.gennemforte / 7) * 100)}%"
					></div>
				</div>
				<div class="uge-grid uge-grid-7">
					{#each sidste7Dage as d (d.dato)}
						<a
							class="dag flower-{d.flower}"
							class:idag={d.dato === idag}
							href="/app/moduler/vaner/abo/{d.dato}"
						>
							<span class="dag-num">{kortDagLabel(d.dato)}</span>
						</a>
					{/each}
				</div>
				<p class="hint">Klik på en dag for at åbne den</p>
			</section>

			<section class="card">
				<div class="section-label">Dine vaner</div>
				<ul class="vane-liste">
					{#each aboOpsaetning.valgteVaner as v (v.id)}
						<li class="vane-item">
							<span class="vane-prik"></span>
							{v.label}
							{#if v.kilde === 'egen'}
								<span class="egen-tag">Egen</span>
							{/if}
						</li>
					{/each}
				</ul>
				<a class="rediger-link" href="/app/moduler/vaner/opsaetning">
					Rediger vaner
					<Icon name="chevron-r" size={12} color="var(--text3)" />
				</a>
			</section>
		{/if}
	{:else}
		<div class="status-besked">
			Du har ikke adgang til vanetracker. Køb basis- eller premium-app for at komme i gang.
		</div>
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

	.back:hover {
		color: var(--text);
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

	.info-banner {
		padding: 14px 16px;
		background: var(--tdim);
		border: 1px solid var(--tdim2);
		border-radius: 12px;
		margin-bottom: 14px;
	}

	.banner-titel {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		margin-bottom: 4px;
	}

	.banner-tekst {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
	}

	.start-knap {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 14px;
		background: var(--terra);
		color: #fff;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 12px;
		text-decoration: none;
		margin-bottom: 14px;
		border: none;
		cursor: pointer;
		font-family: var(--ff-b);
		box-sizing: border-box;
	}

	.start-knap:hover {
		filter: brightness(0.95);
	}

	.start-knap.faerdig {
		background: var(--sage);
		cursor: default;
	}

	.dagslabel {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		text-align: center;
		margin: -6px 0 12px;
	}

	.baseline-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		margin-bottom: 14px;
		text-decoration: none;
		color: inherit;
	}

	.baseline-row:hover {
		background: var(--bg2);
	}

	.baseline-row.laast {
		opacity: 0.5;
		pointer-events: none;
	}

	.baseline-row.done {
		background: var(--sdim);
		border-color: var(--sage);
	}

	.baseline-icon {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--bg2);
		color: var(--text2);
		font-family: var(--ff-d);
		font-size: calc(16px * var(--fs-scale, 1));
		font-weight: 600;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.baseline-row.done .baseline-icon {
		background: var(--sage);
		color: #fff;
	}

	.baseline-tekst {
		flex: 1;
		min-width: 0;
	}

	.baseline-titel {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.baseline-sub {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 16px;
		margin-bottom: 14px;
	}

	.card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
	}

	.section-label {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.card-tael {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.prog-bar {
		height: 6px;
		background: var(--bg2);
		border-radius: 3px;
		overflow: hidden;
		margin-bottom: 8px;
	}

	.prog-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--terra2), var(--terra));
		border-radius: 3px;
		transition: width 0.4s ease;
	}

	.hint {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text4);
		letter-spacing: 0.04em;
		margin: 0 0 14px;
	}

	.uge-label {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text3);
		margin-top: 10px;
		margin-bottom: 6px;
	}

	.uge-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 6px;
	}

	.uge-grid-7 {
		margin-top: 6px;
	}

	.dag {
		aspect-ratio: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		border-radius: 10px;
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		text-decoration: none;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text2);
		transition: transform 0.1s ease;
	}

	.dag:active {
		transform: scale(0.95);
	}

	.dag.laast {
		opacity: 0.45;
		pointer-events: none;
		background: var(--bg2);
		color: var(--text4);
	}

	.dag.naeste,
	.dag.idag {
		outline: 2px solid var(--terra);
		outline-offset: -2px;
	}

	.dag-num {
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 600;
	}

	.flower-excellent {
		background: #6f9e7e;
		color: #fff;
		border-color: #6f9e7e;
	}

	.flower-good {
		background: #92b39e;
		color: #fff;
		border-color: #92b39e;
	}

	.flower-medium {
		background: #c9a07a;
		color: #fff;
		border-color: #c9a07a;
	}

	.flower-low {
		background: #d4b59a;
		color: #fff;
		border-color: #d4b59a;
	}

	.flower-poor {
		background: #e0d0c0;
		color: var(--text2);
		border-color: #d4c0aa;
	}

	.flower-none.status-empty {
		background: var(--white);
	}

	.flower-none.status-partial,
	.flower-none.status-completed {
		background: var(--bg2);
		border-color: var(--border2, var(--border));
		color: var(--text3);
	}

	.onboarding-card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 18px;
		margin-bottom: 14px;
	}

	.onboarding-titel {
		font-family: var(--ff-d);
		font-size: calc(18px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		margin-bottom: 6px;
	}

	.onboarding-tekst {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.5;
		margin: 0 0 14px;
	}

	.vane-liste {
		list-style: none;
		padding: 0;
		margin: 0 0 12px;
	}

	.vane-item {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 0;
		border-top: 1px solid var(--border);
		font-size: calc(13.5px * var(--fs-scale, 1));
		color: var(--text);
	}

	.vane-item:first-child {
		border-top: none;
	}

	.vane-prik {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--terra);
		flex-shrink: 0;
	}

	.egen-tag {
		font-size: calc(9.5px * var(--fs-scale, 1));
		letter-spacing: 0.08em;
		text-transform: uppercase;
		background: var(--bg2);
		color: var(--text3);
		padding: 2px 7px;
		border-radius: 99px;
		font-weight: 600;
		margin-left: auto;
	}

	.rediger-link {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text2);
		text-decoration: none;
	}

	.rediger-link:hover {
		color: var(--terra);
	}
</style>
