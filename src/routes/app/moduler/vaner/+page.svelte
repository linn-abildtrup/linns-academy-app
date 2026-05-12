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
	import { CHECKIN_SPORGSMAAL, type CheckinSvar } from '$lib/content/vaner';
	import {
		alleCheckins,
		beregnAboFlowerNiveau,
		aboTrendScore,
		aboVaneSamletProcent,
		beregnAboFremgang,
		dagensBonus,
		erUgentligCheckinDag,
		formaterDato,
		forsteCheckin,
		parseDato,
		senesteCheckin,
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
		hentAlleAboVanedage,
		nulstilAboBaseline
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

	// Dage før vanetrackeren blev oprettet vises ikke — brugeren har ikke haft
	// appen før det tidspunkt, så det giver ingen mening at klikke der.
	const tidligsteSyngligDato = $derived(
		aboOpsaetning?.oprettetAt ? formaterDato(aboOpsaetning.oprettetAt.toDate()) : null
	);

	const sidste7Dage = $derived.by(() => {
		const r: { dato: string; flower: FlowerNiveau }[] = [];
		const d = new Date();
		for (let i = 6; i >= 0; i--) {
			const cur = new Date(d);
			cur.setDate(cur.getDate() - i);
			const datoStr = formaterDato(cur);
			if (tidligsteSyngligDato && datoStr < tidligsteSyngligDato) continue;
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
		const fraStr = formaterDato(fra);
		const effFraStr =
			tidligsteSyngligDato && fraStr < tidligsteSyngligDato ? tidligsteSyngligDato : fraStr;
		return beregnAboFremgang(
			aboOpsaetning.valgteVaner,
			aboEntries,
			aboBonusPulje,
			effFraStr,
			formaterDato(til)
		);
	});

	function entriesIInterval(dage: number): AboVanedagEntry[] {
		const til = new Date();
		const fra = new Date(til);
		fra.setDate(fra.getDate() - (dage - 1));
		const r: AboVanedagEntry[] = [];
		const cur = new Date(fra);
		while (cur <= til) {
			const e = aboEntries.get(formaterDato(cur));
			if (e) r.push(e);
			cur.setDate(cur.getDate() + 1);
		}
		return r;
	}

	const trend7 = $derived(aboTrendScore(entriesIInterval(7)));
	const trend30 = $derived(aboTrendScore(entriesIInterval(30)));

	const alleAboEntriesArr = $derived(Array.from(aboEntries.values()));
	const samletProcent = $derived.by(() => {
		if (!aboOpsaetning) return { antalDage: 0, score: 0 };
		return aboVaneSamletProcent(aboOpsaetning.valgteVaner, alleAboEntriesArr);
	});

	let aabenMaaned = $state<string | null>(null);

	const dageGruperetPrMaaned = $derived.by(() => {
		const grupper = new Map<string, { dato: string; flower: FlowerNiveau }[]>();
		const sorteret = [...aboEntries.values()].sort((a, b) => b.dato.localeCompare(a.dato));
		for (const e of sorteret) {
			const harSvar = aboOpsaetning?.valgteVaner.some((v) => e.checks?.[v.id]) ?? false;
			if (!harSvar) continue;
			const maaned = e.dato.slice(0, 7); // YYYY-MM
			if (!grupper.has(maaned)) grupper.set(maaned, []);
			grupper.get(maaned)!.push({
				dato: e.dato,
				flower: aboOpsaetning ? beregnAboFlowerNiveau(aboOpsaetning.valgteVaner, e) : 'none'
			});
		}
		return Array.from(grupper.entries()).sort((a, b) => b[0].localeCompare(a[0]));
	});

	function maanedLabel(maaned: string): string {
		const [aar, m] = maaned.split('-').map(Number);
		const dt = new Date(aar, m - 1, 1);
		return dt.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' });
	}

	function dagINummer(dato: string): string {
		const [, , d] = dato.split('-');
		return String(parseInt(d, 10));
	}

	const baselineFraDato = $derived(
		aboOpsaetning?.baselineNulstilletAt
			? formaterDato(aboOpsaetning.baselineNulstilletAt.toDate())
			: undefined
	);
	const baseline = $derived(forsteCheckin(alleAboEntriesArr, baselineFraDato));
	const seneste = $derived(senesteCheckin(alleAboEntriesArr));
	const harFlereCheckins = $derived(
		baseline !== null && seneste !== null && baseline.dato !== seneste.dato
	);

	type GrafPeriode = '1m' | '3m' | '6m' | '12m' | 'alt';
	let grafPeriode = $state<GrafPeriode>('3m');

	const grafEntries = $derived.by(() => {
		const cutoff = (() => {
			if (grafPeriode === 'alt') return baselineFraDato;
			const d = new Date();
			const m = grafPeriode === '1m' ? 1 : grafPeriode === '3m' ? 3 : grafPeriode === '6m' ? 6 : 12;
			d.setMonth(d.getMonth() - m);
			const fra = formaterDato(d);
			// Hvis brugeren har nulstillet baseline efter cutoff, brug nulstillingsdatoen
			return baselineFraDato && baselineFraDato > fra ? baselineFraDato : fra;
		})();
		return alleCheckins(alleAboEntriesArr, cutoff);
	});

	let nulstillerBaseline = $state(false);

	async function nulstilBaseline() {
		const u = user;
		if (!u || nulstillerBaseline) return;
		const bekraeftet = confirm(
			'Vil du nulstille baseline? Dit næste komplette check-in bliver den nye baseline du sammenligner med.'
		);
		if (!bekraeftet) return;
		nulstillerBaseline = true;
		try {
			await nulstilAboBaseline(u.uid);
			await indlaesAboData(u.uid);
		} catch (e) {
			console.error(e);
		} finally {
			nulstillerBaseline = false;
		}
	}

	const SLIDER_FARVER: Record<string, string> = {
		energi: '#b87b6e',
		mave: '#6f9e7e',
		cravings: '#c9a07a',
		humor: '#7e9bb3',
		sovn: '#9d6358'
	};

	function grafPath(sliderId: keyof CheckinSvar): string {
		if (grafEntries.length === 0) return '';
		const w = 300;
		const h = 100;
		const padX = 10;
		const padY = 8;
		const innerW = w - padX * 2;
		const innerH = h - padY * 2;

		const n = grafEntries.length;
		const points = grafEntries.map((e, i) => {
			const val = (e.checkin[sliderId] as number) ?? 5;
			const x = n === 1 ? padX + innerW / 2 : padX + (i / (n - 1)) * innerW;
			// Y-akse: 1 nederst, 10 øverst — så højere værdi = højere op
			const y = padY + ((10 - val) / 9) * innerH;
			return `${x.toFixed(1)},${y.toFixed(1)}`;
		});
		return 'M ' + points.join(' L ');
	}

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
					<div class="section-label">
						{aboFremgang7.iAlt < 7 ? 'Siden du startede' : 'Sidste 7 dage'}
					</div>
					<div class="card-tael">{aboFremgang7.gennemforte} / {aboFremgang7.iAlt}</div>
				</div>
				<div class="prog-bar">
					<div
						class="prog-fill"
						style="width: {aboFremgang7.iAlt > 0
							? Math.round((aboFremgang7.gennemforte / aboFremgang7.iAlt) * 100)
							: 0}%"
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

			{#if dageGruperetPrMaaned.length > 0}
				<section class="card historik-card">
					<div class="card-head">
						<div class="section-label">Måneds-arkiv</div>
					</div>
					<div class="maaned-liste">
						{#each dageGruperetPrMaaned as [maaned, dage] (maaned)}
							{@const aaben = aabenMaaned === maaned}
							<button
								class="maaned-knap"
								class:aaben
								onclick={() => (aabenMaaned = aaben ? null : maaned)}
							>
								<span class="maaned-navn">{maanedLabel(maaned)}</span>
								<span class="maaned-tael">{dage.length} {dage.length === 1 ? 'dag' : 'dage'}</span>
								<Icon name={aaben ? 'chevron-d' : 'chevron-r'} size={12} color="var(--text3)" />
							</button>
							{#if aaben}
								<div class="maaned-dage">
									{#each dage as d (d.dato)}
										<a
											class="maaned-dag flower-{d.flower}"
											href="/app/moduler/vaner/abo/{d.dato}"
										>
											{dagINummer(d.dato)}
										</a>
									{/each}
								</div>
							{/if}
						{/each}
					</div>
				</section>
			{/if}

			{#if samletProcent.antalDage > 0}
				<section class="card procent-card">
					<div class="card-head">
						<div class="section-label">Vaner opnået</div>
						<div class="card-tael">{samletProcent.antalDage} {samletProcent.antalDage === 1 ? 'dag' : 'dage'} indtastet</div>
					</div>
					<div class="procent-stor">{samletProcent.score}%</div>
					<p class="hint procent-hint">
						Beregnet på tværs af alle de dage du har indtastet. Hver vane vægtes
						lige — 'ja' tæller som 1, 'delvist' som 0,5, 'nej' som 0.
					</p>
				</section>
			{/if}

			{#if baseline && seneste}
				<section class="card">
					<div class="card-head">
						<div class="section-label">Din udvikling</div>
						{#if harFlereCheckins}
							<div class="card-tael">Skala 1-10</div>
						{/if}
					</div>
					{#if !harFlereCheckins}
						<p class="hint">
							Dette er dit første check-in (baseline). Tag et nyt ugentligt check-in
							om søndagen for at se din udvikling siden.
						</p>
					{/if}
					<div class="udvikling-liste">
						{#each CHECKIN_SPORGSMAAL as q (q.id)}
							{@const id = q.id as keyof CheckinSvar}
							{@const baseVal = baseline.checkin[id] as number}
							{@const senesteVal = seneste.checkin[id] as number}
							{@const delta = senesteVal - baseVal}
							<div class="udvikling-row">
								<div class="udvikling-label">
									<span class="udvikling-prik" style="background:{SLIDER_FARVER[q.id]}"></span>
									{q.label}
								</div>
								<div class="udvikling-skala">
									<span class="udvikling-baseline" title="Baseline">{baseVal}</span>
									{#if harFlereCheckins}
										<span class="udvikling-pil">→</span>
										<span class="udvikling-seneste" title="Seneste">{senesteVal}</span>
										{#if delta > 0}
											<span class="udvikling-delta op">+{delta}</span>
										{:else if delta < 0}
											<span class="udvikling-delta ned">{delta}</span>
										{:else}
											<span class="udvikling-delta nul">±0</span>
										{/if}
									{/if}
								</div>
							</div>
						{/each}
					</div>

					{#if grafEntries.length >= 2}
						<div class="periode-vaelger">
							{#each ['1m', '3m', '6m', '12m', 'alt'] as p}
								<button
									class="periode-knap"
									class:aktiv={grafPeriode === p}
									onclick={() => (grafPeriode = p as GrafPeriode)}
								>
									{p === 'alt' ? 'Alt' : p}
								</button>
							{/each}
						</div>

						<div class="graf-wrap">
							<svg viewBox="0 0 300 100" class="graf" preserveAspectRatio="none">
								<line x1="10" y1="8" x2="290" y2="8" stroke="var(--border)" stroke-width="0.5" />
								<line x1="10" y1="54" x2="290" y2="54" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="2 2" />
								<line x1="10" y1="92" x2="290" y2="92" stroke="var(--border)" stroke-width="0.5" />
								{#each CHECKIN_SPORGSMAAL as q (q.id)}
									<path
										d={grafPath(q.id as keyof CheckinSvar)}
										stroke={SLIDER_FARVER[q.id]}
										stroke-width="1.6"
										fill="none"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								{/each}
							</svg>
							<div class="graf-skala">
								<span>10</span>
								<span>5</span>
								<span>1</span>
							</div>
						</div>
						<div class="graf-meta">
							{grafEntries.length} check-ins · {grafEntries[0]?.dato} → {grafEntries[grafEntries.length - 1]?.dato}
						</div>
					{/if}

					<button class="reset-knap" type="button" onclick={nulstilBaseline} disabled={nulstillerBaseline}>
						{nulstillerBaseline ? 'Nulstiller...' : 'Nulstil baseline'}
					</button>
				</section>
			{/if}

			{#if trend7.antal > 0 || trend30.antal > 0}
				<section class="card trend-card">
					<div class="card-head">
						<div class="section-label">Velvære-trend</div>
					</div>
					<div class="trend-grid">
						<div class="trend-blok">
							<div class="trend-tal">{trend7.antal > 0 ? trend7.score : '–'}{trend7.antal > 0 ? '%' : ''}</div>
							<div class="trend-label">Sidste 7 dage</div>
							<div class="trend-sub">
								{trend7.antal} {trend7.antal === 1 ? 'svar' : 'svar'}
							</div>
						</div>
						<div class="trend-blok">
							<div class="trend-tal">{trend30.antal > 0 ? trend30.score : '–'}{trend30.antal > 0 ? '%' : ''}</div>
							<div class="trend-label">Sidste 30 dage</div>
							<div class="trend-sub">
								{trend30.antal} {trend30.antal === 1 ? 'svar' : 'svar'}
							</div>
						</div>
					</div>
					<p class="hint trend-hint">
						Procent positive svar på dagens bonus-spørgsmål. Et samlet billede af
						dit velvære over tid.
					</p>
				</section>
			{/if}

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

	.trend-card {
		background: linear-gradient(180deg, var(--white) 0%, var(--bg2) 100%);
	}

	.trend-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		margin-top: 4px;
	}

	.trend-blok {
		text-align: center;
		padding: 14px 8px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
	}

	.trend-tal {
		font-family: var(--ff-d);
		font-size: calc(28px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--terra);
		line-height: 1.1;
	}

	.trend-label {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text2);
		margin-top: 6px;
	}

	.trend-sub {
		font-size: calc(10.5px * var(--fs-scale, 1));
		color: var(--text4);
		margin-top: 2px;
	}

	.trend-hint {
		margin-top: 10px;
		margin-bottom: 0;
	}

	.procent-card {
		text-align: center;
	}

	.procent-stor {
		font-family: var(--ff-d);
		font-size: calc(48px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--terra);
		line-height: 1;
		margin: 8px 0;
	}

	.procent-hint {
		margin-top: 6px;
		margin-bottom: 0;
		text-align: center;
	}

	.udvikling-liste {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.udvikling-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 9px 0;
		border-top: 1px solid var(--border);
	}

	.udvikling-row:first-child {
		border-top: none;
	}

	.udvikling-skala {
		display: flex;
		align-items: center;
		gap: 6px;
		font-family: var(--ff-d);
		font-weight: 600;
	}

	.udvikling-baseline {
		font-size: calc(15px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.udvikling-pil {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text4);
	}

	.udvikling-seneste {
		font-size: calc(18px * var(--fs-scale, 1));
		color: var(--terra);
	}

	.udvikling-delta {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		padding: 2px 7px;
		border-radius: 99px;
		min-width: 32px;
		text-align: center;
	}

	.udvikling-delta.op {
		background: var(--sdim);
		color: #4a6b54;
	}

	.udvikling-delta.ned {
		background: #fbeeea;
		color: #8a4a3e;
	}

	.udvikling-delta.nul {
		background: var(--bg2);
		color: var(--text3);
	}

	.udvikling-label {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text);
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.udvikling-prik {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.periode-vaelger {
		display: flex;
		gap: 4px;
		margin: 14px 0 8px;
	}

	.periode-knap {
		flex: 1;
		padding: 6px 8px;
		font-size: calc(11.5px * var(--fs-scale, 1));
		font-weight: 600;
		font-family: var(--ff-b);
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text2);
		border-radius: 6px;
		cursor: pointer;
	}

	.periode-knap.aktiv {
		background: var(--terra);
		color: #fff;
		border-color: var(--terra);
	}

	.graf-wrap {
		position: relative;
		margin: 6px 0 4px;
	}

	.graf {
		width: 100%;
		height: 110px;
		display: block;
	}

	.graf-skala {
		position: absolute;
		right: 4px;
		top: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		font-size: calc(9px * var(--fs-scale, 1));
		color: var(--text4);
		pointer-events: none;
		padding: 4px 0;
	}

	.graf-meta {
		font-size: calc(10.5px * var(--fs-scale, 1));
		color: var(--text4);
		text-align: center;
		margin-bottom: 10px;
	}

	.reset-knap {
		display: block;
		width: 100%;
		margin-top: 10px;
		padding: 9px;
		background: var(--white);
		color: var(--text2);
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 8px;
		border: 1px solid var(--border);
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.reset-knap:hover:not(:disabled) {
		border-color: var(--terra);
		color: var(--terra);
	}

	.reset-knap:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.maaned-liste {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.maaned-knap {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 4px;
		border: none;
		border-top: 1px solid var(--border);
		background: var(--white);
		color: var(--text);
		text-align: left;
		cursor: pointer;
		font-family: var(--ff-b);
		width: 100%;
	}

	.maaned-knap:first-child {
		border-top: none;
	}

	.maaned-knap.aaben {
		background: var(--bg2);
		margin: 0 -8px;
		padding: 10px 8px;
		border-top-color: transparent;
	}

	.maaned-navn {
		flex: 1;
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		text-transform: capitalize;
	}

	.maaned-tael {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.maaned-dage {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 6px;
		padding: 8px 0 12px;
		margin: 0 -8px;
		padding-left: 8px;
		padding-right: 8px;
		background: var(--bg2);
	}

	.maaned-dag {
		aspect-ratio: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 8px;
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 600;
		text-decoration: none;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text2);
	}

	.maaned-dag.flower-excellent {
		background: #6f9e7e;
		color: #fff;
		border-color: #6f9e7e;
	}

	.maaned-dag.flower-good {
		background: #92b39e;
		color: #fff;
		border-color: #92b39e;
	}

	.maaned-dag.flower-medium {
		background: #c9a07a;
		color: #fff;
		border-color: #c9a07a;
	}

	.maaned-dag.flower-low {
		background: #d4b59a;
		color: #fff;
		border-color: #d4b59a;
	}

	.maaned-dag.flower-poor {
		background: #e0d0c0;
		color: var(--text2);
		border-color: #d4c0aa;
	}
</style>
