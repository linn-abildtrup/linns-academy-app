<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import type { UserProduct } from '$lib/content/mikrotraening';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import {
		beregnDagsFarve,
		beregnDagsStatus,
		beregnFlowerNiveau,
		beregnSamletFremgang,
		type DagsFarve,
		type FlowerNiveau,
		type VaneProgramDag,
		type VanedagEntry
	} from '$lib/content/vaner';
	import {
		beregnAboFlowerNiveau,
		aboTrendScore,
		aboVaneSamletProcent,
		beregnAboFremgang,
		dagensBonus,
		formaterDato,
		parseDato,
		type AboBonusForslag,
		type AboVaneOpsaetning,
		type AboVanedagEntry
	} from '$lib/content/aboVaner';
	import { unlockedDays } from '$lib/content/forlobAdgang';
	import { hentUserProduct } from '$lib/firestore/mikrotraening';
	import { hentAktivProduktType, hentForlob } from '$lib/firestore/forlob';
	import { hentAlleVanedage, hentVaneprogramForForlob } from '$lib/firestore/vaner';
	import {
		hentAboBonusPulje,
		hentAboVaneOpsaetning,
		hentAlleAboVanedage
	} from '$lib/firestore/aboVaner';
	import {
		filtrerVanerForUge,
		hentAdminVanerForForlob,
		hentAdminVanerForKunde,
		type AdminTildeltVane
	} from '$lib/firestore/admintildelteVaner';
	import {
		erForlobsklient,
		erModulbruger,
		harPremium
	} from '$lib/utils/userAdgang';
	import { effektivtUnlocket, getPreviewDag } from '$lib/utils/forlobPreview';
	import { isAdmin } from '$lib/admin';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';
	import PreviewBanner from '$lib/components/PreviewBanner.svelte';

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
	let adminVaner = $state<AdminTildeltVane[]>([]);
	let aboBonusPulje = $state<AboBonusForslag[]>([]);
	let aboEntries = $state<Map<string, AboVanedagEntry>>(new Map());

	let loading = $state(true);
	let fejl = $state<string | null>(null);

	// === Forløbs-derived ===
	const startDato = $derived(forlob?.startDato?.toDate() ?? null);
	const antalDage = $derived(forlob?.antalDage ?? 21);
	const naturligtUnlocket = $derived(unlockedDays(startDato, antalDage));
	const previewDag = $derived(getPreviewDag(page.url.searchParams, userDoc, isAdmin(user)));
	const unlocket = $derived(effektivtUnlocket(naturligtUnlocket, previewDag, antalDage));
	const erIkkeStartet = $derived(unlocket < 0);
	const kanStartePreview = $derived(
		previewDag === null &&
			isAdmin(user) &&
			userDoc?.adminKlientMode === 'forlob' &&
			!!userDoc?.adminKlientForlobId
	);
	const baselineDag = $derived(dage.find((d) => d.isBaseline) ?? null);
	const programDage = $derived(
		dage.filter((d) => !d.isBaseline).sort((a, b) => a.dagNummer - b.dagNummer)
	);
	const fremgang = $derived(beregnSamletFremgang(dage, entries, unlocket));

	// === Abo-derived ===
	const idag = $derived(formaterDato(new Date()));
	const idagBonus = $derived(dagensBonus(aboBonusPulje, idag));
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
		const sorteret = [...aboEntries.values()].sort((a, b) => a.dato.localeCompare(b.dato));
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
		const produktType = await hentAktivProduktType(userDoc?.forlobIds ?? []);
		const up = await hentUserProduct(uid, produktType);
		// Admin i klient-mode har ikke noedvendigvis et userProduct-doc.
		// I det tilfaelde bruger vi adminKlientForlobId direkte saa preview
		// stadig virker.
		const adminForlobId = userDoc?.adminKlientForlobId ?? null;
		if (!up && !adminForlobId) {
			fejl = 'Du har ikke adgang til vanetracker endnu.';
			return;
		}
		if (up) userProduct = up;

		const forlobId =
			(up as UserProduct & { forlobId?: string } | null)?.forlobId ?? adminForlobId;
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
		entries = await hentAlleVanedage(uid, produktType);

		try {
			adminVaner = await hentAdminVanerForForlob(forlobId);
		} catch (e) {
			console.warn('Kunne ikke hente admin-vaner:', e);
		}
	}

	async function indlaesAboData(uid: string) {
		const o = await hentAboVaneOpsaetning(uid);
		aboOpsaetning = o;
		try {
			adminVaner = await hentAdminVanerForKunde(userDoc?.forlobIds ?? []);
		} catch (e) {
			console.warn('Kunne ikke hente admin-vaner:', e);
		}
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
		farve: DagsFarve;
	} {
		if (erIkkeStartet || dag.dagNummer > unlocket) {
			return { status: 'locked', flower: 'none', farve: 'tom' };
		}
		const entry = entries.get(dag.dagNummer) ?? null;
		const extraVaner = filtrerVanerForUge(adminVaner, dag.uge);
		return {
			status: beregnDagsStatus(dag, entry),
			flower: beregnFlowerNiveau(dag, entry),
			farve: beregnDagsFarve(dag, entry, extraVaner)
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
		const m = new Map<number, VaneProgramDag[]>();
		for (const dag of programDage) {
			const u = Math.max(1, dag.uge);
			if (!m.has(u)) m.set(u, []);
			m.get(u)!.push(dag);
		}
		const ugeIder = [...m.keys()].sort((a, b) => a - b);
		return ugeIder.map((u) => m.get(u)!);
	}

	function kortDagLabel(datoStr: string): string {
		const d = parseDato(datoStr);
		return d.toLocaleDateString('da-DK', { weekday: 'short' }).slice(0, 2);
	}
</script>

{#if previewDag !== null}
	<PreviewBanner dagNummer={previewDag} {antalDage} />
{/if}

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

	{#if kanStartePreview}
		<a class="preview-launcher" href="?previewDag=0">
			<div class="preview-launcher-tekst">
				<div class="preview-launcher-titel">Forhåndsvis fremtidige dage</div>
				<div class="preview-launcher-sub">
					Som admin kan du se hvordan kunderne oplever dag 0-{antalDage}.
				</div>
			</div>
			<Icon name="chevron-r" size={14} color="var(--terra)" />
		</a>
	{/if}

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
								class="dag flower-{s.flower} status-{s.status} farve-{s.farve}"
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
						Vælg op til 3 vaner du vil arbejde med dagligt.
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

			<div class="dagslabel">{dagsLabel}</div>

			<section class="card">
				<div class="card-head">
					<div class="section-label">
						{aboFremgang7.iAlt < 7 ? 'Seneste dage' : 'Sidste 7 dage'}
					</div>
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

				<div class="farvekode">
					<div class="farvekode-titel">Hvad betyder farverne?</div>
					<div class="farvekode-liste">
						<div class="farvekode-rad">
							<span class="farvekode-prik flower-excellent"></span>
							<span class="farvekode-tekst">Alle vaner ramt</span>
						</div>
						<div class="farvekode-rad">
							<span class="farvekode-prik flower-good"></span>
							<span class="farvekode-tekst">Næsten alle ramt</span>
						</div>
						<div class="farvekode-rad">
							<span class="farvekode-prik flower-medium"></span>
							<span class="farvekode-tekst">Cirka halvdelen</span>
						</div>
						<div class="farvekode-rad">
							<span class="farvekode-prik flower-low"></span>
							<span class="farvekode-tekst">Få ramt</span>
						</div>
						<div class="farvekode-rad">
							<span class="farvekode-prik flower-poor"></span>
							<span class="farvekode-tekst">Næsten ingen</span>
						</div>
					</div>
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
					{#each adminVaner as v (v.id)}
						<li class="vane-item">
							<span class="vane-prik"></span>
							{v.label}
							<span class="fra-forlob-tag">Fra forløb</span>
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

	.preview-launcher {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 14px;
		background: var(--terra2);
		border: 1px solid var(--terra);
		border-radius: 12px;
		margin-bottom: 14px;
		text-decoration: none;
	}

	.preview-launcher-tekst {
		flex: 1;
	}

	.preview-launcher-titel {
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.preview-launcher-sub {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text2);
		margin-top: 1px;
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

	.farvekode {
		margin-top: 14px;
		padding-top: 12px;
		border-top: 1px solid var(--border);
	}

	.farvekode-titel {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.04em;
		color: var(--text3);
		margin-bottom: 8px;
	}

	.farvekode-liste {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.farvekode-rad {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.farvekode-prik {
		width: 14px;
		height: 14px;
		border-radius: 4px;
		border: 1px solid transparent;
		flex-shrink: 0;
	}

	.farvekode-tekst {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
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

	/* 3-niveau farve baseret paa dagens samlede vane-svar. Erstatter det
	   gamle flower-* 6-niveau system. Matcher svar-knappernes farver paa
	   forsiden (gron=sage, orange=c9a07a, rod=b87b6e). Skal staa EFTER
	   flower-*-reglerne saa de vinder specificity-kampen. */
	.dag.farve-gron {
		background: var(--sage);
		border-color: var(--sage);
		color: #fff;
	}
	.dag.farve-orange {
		background: #c9a07a;
		border-color: #c9a07a;
		color: #fff;
	}
	.dag.farve-rod {
		background: #b87b6e;
		border-color: #b87b6e;
		color: #fff;
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

	.fra-forlob-tag {
		font-size: calc(9.5px * var(--fs-scale, 1));
		letter-spacing: 0.08em;
		text-transform: uppercase;
		background: var(--tdim);
		color: var(--terra);
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
		padding: 10px 8px;
		border-top-color: transparent;
		border-radius: 8px 8px 0 0;
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
		padding: 8px 8px 12px;
		background: var(--bg2);
		border-radius: 0 0 8px 8px;
		box-sizing: border-box;
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
