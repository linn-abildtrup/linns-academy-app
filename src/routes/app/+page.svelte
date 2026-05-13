<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import type { ForlobDag } from '$lib/content/forlob';
	import type { UserProduct } from '$lib/content/mikrotraening';
	import Icon from '$lib/components/Icon.svelte';
	import { getCurrentDay, tomForlobDag } from '$lib/content/forlob';
	import { hentForlob, hentForlobsdage } from '$lib/firestore/forlob';
	import { hentUserProduct } from '$lib/firestore/mikrotraening';
	import { hentMineSpoergsmaal, type KlientSpoergsmaal } from '$lib/firestore/spoergsmaal';
	import { hentMaaltiderIPeriode } from '$lib/firestore/kost';
	import { hentAlleAboVanedage } from '$lib/firestore/aboVaner';
	import { hentAlleAboTraeninger } from '$lib/firestore/aboMikrotraening';
	import { formaterDato } from '$lib/content/aboVaner';
	import Loading from '$lib/components/Loading.svelte';
	import { effektivState } from '$lib/utils/userAdgang';

	const getUserDoc = getContext<() => UserDoc | null>('userDoc');
	const getUser = getContext<() => User | null>('user');

	const userDoc = $derived(getUserDoc());
	const user = $derived(getUser());
	const userState = $derived(effektivState(userDoc));

	let forlob = $state<Forlob | null>(null);
	let forlobsdage = $state<ForlobDag[]>([]);
	let userProduct = $state<UserProduct | null>(null);
	// Initialiseres fra ?dag=N query-param så valget bevares når brugeren
	// går væk og tilbage (fx via history.back fra lektion-overlay).
	let valgtDagNummer = $state<number | null>(dagFraQuery());
	let mineSpoergsmaal = $state<KlientSpoergsmaal[]>([]);

	function dagFraQuery(): number | null {
		if (typeof window === 'undefined') return null;
		const v = new URL(window.location.href).searchParams.get('dag');
		if (v === null) return null;
		const n = parseInt(v, 10);
		return Number.isFinite(n) && n >= 0 ? n : null;
	}

	const ubeskrivedeSpoergsmaal = $derived.by<KlientSpoergsmaal[]>(() => {
		const senest = userDoc?.senestSpoergsmaalLaestAt ?? 0;
		return mineSpoergsmaal.filter((q) => {
			if (!q.svar || !q.besvaretAt) return false;
			const besvaretMs = q.besvaretAt.toDate().getTime();
			return besvaretMs > senest;
		});
	});

	const nyestUbeskrevneSvar = $derived(ubeskrivedeSpoergsmaal[0] ?? null);

	const aktivDagNummer = $derived.by<number | null>(() => {
		if (!forlob) return null;
		const startDato = forlob.startDato.toDate().toISOString().slice(0, 10);
		return getCurrentDay({ startDato, antalDage: forlob.antalDage });
	});

	// Bagudkompatibel alias indtil vi får ryddet i template'n
	const dayNumber = $derived(aktivDagNummer);

	const dagsmap = $derived.by<Map<number, ForlobDag>>(() => {
		const m = new Map<number, ForlobDag>();
		for (const d of forlobsdage) m.set(d.dagNummer, d);
		return m;
	});

	const valgtDag = $derived.by<ForlobDag | null>(() => {
		const n = valgtDagNummer ?? aktivDagNummer;
		if (n === null) return null;
		return dagsmap.get(n) ?? tomForlobDag(n);
	});

	// Bagudkompatibel alias
	const dagensDag = $derived(valgtDag);

	function vaelgDag(n: number) {
		if (aktivDagNummer === null) return;
		if (n > aktivDagNummer) return;
		valgtDagNummer = n;
		opdaterUrlMedDag(n);
	}

	function nulstilTilIDag() {
		valgtDagNummer = null;
		opdaterUrlMedDag(null);
	}

	function opdaterUrlMedDag(n: number | null) {
		if (typeof window === 'undefined') return;
		const url = new URL(page.url);
		if (n === null) {
			url.searchParams.delete('dag');
		} else {
			url.searchParams.set('dag', String(n));
		}
		replaceState(url, page.state);
	}

	// Bygger strip-data for alle dage i forløbet (inkl baseline 0)
	const stripDage = $derived.by<{ dagNummer: number; dato: Date; status: 'fortid' | 'aktiv' | 'fremtid' }[]>(() => {
		if (!forlob) return [];
		const start = forlob.startDato.toDate();
		const out: { dagNummer: number; dato: Date; status: 'fortid' | 'aktiv' | 'fremtid' }[] = [];
		for (let i = 0; i <= forlob.antalDage; i++) {
			const d = new Date(start);
			d.setHours(12, 0, 0, 0);
			d.setDate(start.getDate() + i);
			let status: 'fortid' | 'aktiv' | 'fremtid' = 'fremtid';
			if (aktivDagNummer !== null) {
				if (i < aktivDagNummer) status = 'fortid';
				else if (i === aktivDagNummer) status = 'aktiv';
			}
			out.push({ dagNummer: i, dato: d, status });
		}
		return out;
	});

	const UGEDAGE_KORT = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];

	function formatStripChipDato(d: Date): { dag: string; ugedag: string } {
		return {
			dag: d.getDate() + '/' + (d.getMonth() + 1),
			ugedag: UGEDAGE_KORT[d.getDay()]
		};
	}

	function formatLangDato(d: Date): string {
		return d.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' });
	}

	const valgtErIDag = $derived(
		valgtDagNummer === null || valgtDagNummer === aktivDagNummer
	);

	// Auto-scroll strip til aktiv dag når data er klar
	let stripEl = $state<HTMLDivElement | null>(null);
	$effect(() => {
		if (!stripEl || aktivDagNummer === null || stripDage.length === 0) return;
		const target = stripEl.querySelector<HTMLElement>(
			`[data-dag="${valgtDagNummer ?? aktivDagNummer}"]`
		);
		if (target) {
			const left = target.offsetLeft - stripEl.clientWidth / 2 + target.offsetWidth / 2;
			stripEl.scrollLeft = Math.max(0, left);
		}
	});

	type ActionGenvej = {
		modul: 'kost' | 'traening' | 'vaner';
		eyebrow: string;
		titel: string;
		meta: string;
		href: string;
	};

	// Genveje tilpasses den valgte dag i strippen:
	//   Dag 0 (baseline): kun baseline check-in (under Vaner)
	//   Dag 1-antalDage: Kost, Træning og Vaner. Vaner-href peger på den
	//     specifikke dag så Linn kan rette tilbage i tidligere dages svar.
	//   Andet (ingen forløb / efter forløbet): ingen genveje
	const actions = $derived.by<ActionGenvej[]>(() => {
		const n = valgtDagNummer ?? aktivDagNummer;
		const antal = forlob?.antalDage ?? 21;
		if (n === null) return [];

		if (n === 0) {
			return [
				{
					modul: 'vaner',
					eyebrow: 'Vaner',
					titel: 'Baseline check-in',
					meta: 'Mærk dit udgangspunkt før forløbet starter',
					href: '/app/moduler/vaner/0'
				}
			];
		}

		if (n >= 1 && n <= antal) {
			const harProgramValg = !!userProduct?.programValg?.mikrotraening;
			const traeningHrefForN = harProgramValg
				? `/app/moduler/traening/mikrotraening/${n}`
				: '/app/moduler/traening/mikrotraening';
			return [
				{
					modul: 'kost',
					eyebrow: 'Kost',
					titel: 'Log dagens måltider',
					meta: '30-30 beregner, byg måltid og se opskrifter',
					href: '/app/moduler/30-30-3'
				},
				{
					modul: 'traening',
					eyebrow: 'Træning',
					titel: 'Mikrotræning',
					meta: 'Korte daglige sessioner',
					href: traeningHrefForN
				},
				{
					modul: 'vaner',
					eyebrow: 'Vaner',
					titel: 'Tjek dagens vaner',
					meta: 'Refleksion og daglige checks',
					href: `/app/moduler/vaner/${n}`
				}
			];
		}

		return [];
	});


	type TidligereKob = {
		navn: string;
		meta: string;
		expires: string;
		ikon: 'path' | 'check';
		accent: string;
		dim: string;
	};

	const tidligereKob: TidligereKob[] = [
		{
			navn: 'Kickstart en sund overgangsalder',
			meta: 'Forløb · købt okt. 2025',
			expires: 'Adgang til 15. nov. 2026',
			ikon: 'path',
			accent: '#9D6358',
			dim: 'rgba(157,99,88,.10)'
		},
		{
			navn: 'Vanetracker',
			meta: 'Modul · købt jan. 2026',
			expires: 'Læseadgang · ingen tracking',
			ikon: 'check',
			accent: '#6F9E7E',
			dim: 'rgba(111,158,126,.10)'
		}
	];

	function getActionAccent(modul: 'kost' | 'traening' | 'vaner'): string {
		if (modul === 'kost') return 'var(--sage)';
		if (modul === 'traening') return 'var(--terra)';
		return '#6F9E7E';
	}

	function getActionAccentDim(modul: 'kost' | 'traening' | 'vaner'): string {
		if (modul === 'kost') return 'var(--sdim)';
		if (modul === 'traening') return 'var(--tdim)';
		return 'rgba(111,158,126,.10)';
	}

	function getActionIcon(modul: 'kost' | 'traening' | 'vaner') {
		if (modul === 'kost') return 'leaf';
		if (modul === 'traening') return 'flame';
		return 'check';
	}

	$effect(() => {
		// Kun for forløbskunder skal vi hente forløb og dagens lektion
		const u = user;
		const ud = userDoc;
		if (!u || ud?.state !== 'forlobskunde') {
			forlob = null;
			forlobsdage = [];
			userProduct = null;
			valgtDagNummer = null;
			mineSpoergsmaal = [];
			return;
		}
		void indlaesForlob(u.uid);
		void indlaesMineSpoergsmaal(u.uid);
	});

	// ============================================================
	// Modulbruger-forside (basis-app + premium-app)
	// ============================================================
	// Strip fra kontooprettelse til 3 dage frem. Faded historik-dage uden
	// indtastninger og fremtidige dage. Klik på en dag for at åbne 'Dagens
	// små skridt' med dato-specifikke links til Kost, Vaner og Mikrotræning.
	type ModulbrugerStripDag = {
		dato: string;
		erIDag: boolean;
		erFremtid: boolean;
		harData: boolean;
	};

	let modulbrugerDage = $state<ModulbrugerStripDag[]>([]);
	let modulbrugerValgtDato = $state<string | null>(null);
	let modulbrugerStripEl = $state<HTMLDivElement | null>(null);

	const modulbrugerIDag = $derived(formaterDato(new Date()));
	const modulbrugerAktivDato = $derived(modulbrugerValgtDato ?? modulbrugerIDag);
	const modulbrugerErIDag = $derived(modulbrugerAktivDato === modulbrugerIDag);

	function formatModulbrugerChipDato(dato: string): { dag: string; ugedag: string } {
		const [aar, m, d] = dato.split('-').map(Number);
		const dt = new Date(aar, m - 1, d);
		return {
			dag: dt.getDate() + '/' + (dt.getMonth() + 1),
			ugedag: UGEDAGE_KORT[dt.getDay()]
		};
	}

	function vaelgModulbrugerDato(dato: string) {
		modulbrugerValgtDato = dato;
	}

	function nulstilModulbrugerTilIDag() {
		modulbrugerValgtDato = null;
	}

	type ModulbrugerAction = {
		modul: 'kost' | 'traening' | 'vaner';
		eyebrow: string;
		titel: string;
		meta: string;
		href: string;
	};

	const modulbrugerActions = $derived.by<ModulbrugerAction[]>(() => {
		const dato = modulbrugerAktivDato;
		return [
			{
				modul: 'kost',
				eyebrow: 'Kost',
				titel: 'Log dagens måltider',
				meta: '30-30 beregner, byg måltid og se opskrifter',
				href: `/app/moduler/30-30-3?tab=dagbog`
			},
			{
				modul: 'traening',
				eyebrow: 'Træning',
				titel: 'Dagens mikrotræning',
				meta: 'Korte daglige sessioner',
				href: `/app/moduler/traening/mikrotraening/abo/${dato}`
			},
			{
				modul: 'vaner',
				eyebrow: 'Vaner',
				titel: 'Tjek dagens vaner',
				meta: 'Refleksion og daglige checks',
				href: `/app/moduler/vaner/abo/${dato}`
			}
		];
	});

	$effect(() => {
		const u = user;
		const ud = userDoc;
		if (!u || ud?.state !== 'modulbruger' || !ud.createdAt) {
			modulbrugerDage = [];
			modulbrugerValgtDato = null;
			return;
		}
		void indlaesModulbrugerStrip(u.uid, ud.createdAt);
	});

	async function indlaesModulbrugerStrip(uid: string, createdAt: number) {
		const idag = formaterDato(new Date());
		const start = new Date(createdAt);
		start.setHours(12, 0, 0, 0);
		const slut = new Date();
		slut.setHours(12, 0, 0, 0);
		slut.setDate(slut.getDate() + 3);

		// Hent datoer med aktivitet i baggrunden — best effort, fejler én
		// query skal de andre stadig virke.
		const fraStr = formaterDato(start);
		const [maaltider, vaner, traeninger] = await Promise.all([
			hentMaaltiderIPeriode(uid, fraStr, idag).catch((e) => {
				console.warn('Kunne ikke hente måltider til strip:', e);
				return [];
			}),
			hentAlleAboVanedage(uid).catch((e) => {
				console.warn('Kunne ikke hente vaner til strip:', e);
				return new Map();
			}),
			hentAlleAboTraeninger(uid).catch((e) => {
				console.warn('Kunne ikke hente træninger til strip:', e);
				return [];
			})
		]);

		const dataSet = new Set<string>();
		for (const m of maaltider) dataSet.add(m.dato);
		for (const dato of vaner.keys()) dataSet.add(dato);
		for (const t of traeninger) dataSet.add(t.dato);

		const dage: ModulbrugerStripDag[] = [];
		const cur = new Date(start);
		while (cur <= slut) {
			const dato = formaterDato(cur);
			dage.push({
				dato,
				erIDag: dato === idag,
				erFremtid: dato > idag,
				harData: dataSet.has(dato)
			});
			cur.setDate(cur.getDate() + 1);
		}
		modulbrugerDage = dage;
	}

	// Auto-scroll modulbruger-strippen til i dag når den loades
	$effect(() => {
		if (!modulbrugerStripEl || modulbrugerDage.length === 0) return;
		const target = modulbrugerStripEl.querySelector<HTMLElement>(
			`[data-dato="${modulbrugerAktivDato}"]`
		);
		if (target) {
			const left =
				target.offsetLeft - modulbrugerStripEl.clientWidth / 2 + target.offsetWidth / 2;
			modulbrugerStripEl.scrollLeft = Math.max(0, left);
		}
	});

	async function indlaesMineSpoergsmaal(uid: string) {
		try {
			mineSpoergsmaal = await hentMineSpoergsmaal(uid);
		} catch (e) {
			console.warn('Kunne ikke hente egne spørgsmål til forsiden:', e);
		}
	}

	async function indlaesForlob(uid: string) {
		try {
			const up = await hentUserProduct(uid, 'kickstart');
			if (!up) return;
			userProduct = up;
			const forlobId = (up as UserProduct & { forlobId?: string }).forlobId;
			if (!forlobId) return;
			const [f, dage] = await Promise.all([
				hentForlob(forlobId),
				hentForlobsdage(forlobId)
			]);
			if (!f) return;
			forlob = f;
			forlobsdage = dage;
		} catch (e) {
			console.error('Kunne ikke hente forløb til forsiden:', e);
		}
	}
</script>

{#if userState === 'forlobskunde'}
	<div class="forside-a1">
		{#if forlob}
			<header class="forside-header">
				{#if dayNumber !== null}
					<a class="forlob-badge" href="/app/moduler/forlob">
						<span class="badge-dot"></span>
						{forlob.navn} · dag {dayNumber} af {forlob.antalDage}
					</a>
				{:else}
					<a class="forlob-badge" href="/app/moduler/forlob">
						<span class="badge-dot"></span>
						{forlob.navn} · starter snart
					</a>
				{/if}
			</header>
		{/if}

		<div class="forside-body">
			{#if forlob && stripDage.length > 0}
				<section class="strip-section">
					<div class="strip-head">
						<div class="eyebrow eyebrow-muted">Forløbet</div>
						{#if !valgtErIDag}
							<button class="strip-tilbage" type="button" onclick={nulstilTilIDag}>
								Tilbage til i dag
							</button>
						{/if}
					</div>
					<div class="strip" bind:this={stripEl}>
						{#each stripDage as chip (chip.dagNummer)}
							{@const fmt = formatStripChipDato(chip.dato)}
							{@const erValgt = (valgtDagNummer ?? aktivDagNummer) === chip.dagNummer}
							<button
								type="button"
								class="strip-chip"
								class:erValgt
								class:erIDag={chip.status === 'aktiv'}
								class:erFremtid={chip.status === 'fremtid'}
								disabled={chip.status === 'fremtid'}
								data-dag={chip.dagNummer}
								onclick={() => vaelgDag(chip.dagNummer)}
								aria-label="Dag {chip.dagNummer}, {fmt.ugedag} {fmt.dag}."
							>
								<span class="chip-ugedag">{fmt.ugedag}</span>
								<span class="chip-dag">{fmt.dag}</span>
								<span class="chip-num">
									{chip.dagNummer === 0 ? 'Start' : 'D' + chip.dagNummer}
								</span>
							</button>
						{/each}
					</div>
				</section>
			{/if}

			{#if dagensDag && dagensDag.lektioner.length > 0}
				{@const flere = dagensDag.lektioner.length > 1}
				{@const langDato = formatLangDato(stripDage[dagensDag.dagNummer]?.dato ?? new Date())}
				<section class="lektion-section">
					<div class="eyebrow eyebrow-terra">
						{#if valgtErIDag}
							{flere ? 'Dagens lektioner' : 'Dagens lektion'}
						{:else}
							{flere ? 'Lektioner for ' + langDato : 'Lektion for ' + langDato}
						{/if}
					</div>
					{#each dagensDag.lektioner as lektion, i (lektion.id)}
						<a
							class="lektion-card"
							data-tone={i % 3}
							href="/app/moduler/forlob?lektion={lektion.id}"
						>
							<div class="lektion-decoration lektion-decoration-1"></div>
							<div class="lektion-decoration lektion-decoration-2"></div>
							<div class="lektion-content">
								<div class="lektion-meta">Dag {dagensDag.dagNummer} · uge {dagensDag.uge}</div>
								<div class="lektion-title">{lektion.titel}</div>
								{#if lektion.beskrivelse}
									<div class="lektion-description">{lektion.beskrivelse}</div>
								{/if}
								<div class="lektion-actions">
									<span class="lektion-button">
										<Icon name="play" size={12} color="var(--terra)" filled />
										Begynd
									</span>
									{#if lektion.varighedMin > 0 || lektion.format}
										<span class="lektion-duration">
											{lektion.varighedMin > 0 ? lektion.varighedMin + ' min' : ''}{lektion.varighedMin > 0 && lektion.format ? ' · ' : ''}{lektion.format}
										</span>
									{/if}
								</div>
							</div>
						</a>
					{/each}
				</section>
			{:else if dagensDag && !valgtErIDag}
				<section class="lektion-section">
					<div class="eyebrow eyebrow-muted">
						Lektion for {formatLangDato(stripDage[dagensDag.dagNummer]?.dato ?? new Date())}
					</div>
					<div class="ingen-lektion">Ingen lektion lagt op for denne dag.</div>
				</section>
			{/if}

			{#if nyestUbeskrevneSvar}
				<section class="nyt-svar-section">
					<a class="nyt-svar-card" href="/app/beskeder">
						<div class="nyt-svar-eyebrow">
							<span class="nyt-svar-prik"></span>
							Nyt svar fra Linn
						</div>
						<div class="nyt-svar-spoergsmaal">{nyestUbeskrevneSvar.spoergsmaal}</div>
						<div class="nyt-svar-tekst">{nyestUbeskrevneSvar.svar}</div>
						<div class="nyt-svar-link">Læs alle dine spørgsmål
							<Icon name="arrow" size={12} color="var(--terra)" />
						</div>
					</a>
				</section>
			{/if}

			{#if actions.length > 0}
				<section class="actions-section">
					<div class="actions-header">
						<div class="eyebrow eyebrow-muted">Dagens små skridt</div>
					</div>
					<div class="actions-list">
						{#each actions as action (action.modul)}
							<a class="action-card" href={action.href}>
								<div
									class="action-icon"
									style="background: {getActionAccentDim(action.modul)}"
								>
									<Icon
										name={getActionIcon(action.modul)}
										size={15}
										color={getActionAccent(action.modul)}
									/>
								</div>
								<div class="action-text">
									<div
										class="action-eyebrow"
										style="color: {getActionAccent(action.modul)}"
									>
										{action.eyebrow}
									</div>
									<div class="action-title">{action.titel}</div>
									<div class="action-meta">{action.meta}</div>
								</div>
								<Icon name="chevron-r" size={14} color="var(--text3)" />
							</a>
						{/each}
					</div>
				</section>
			{/if}

			{#if dagensDag && dagensDag.noteFraLinn}
				<section class="note-section">
					<div class="note-badge">L</div>
					<div class="note-content">
						<div class="note-eyebrow">Note fra Linn</div>
						<div class="note-text">{dagensDag.noteFraLinn}</div>
					</div>
				</section>
			{/if}

			<section class="coaching-section">
				<div class="eyebrow eyebrow-muted">Personlig coaching</div>
				<a
					class="coaching-knap"
					href="https://linn.simplero.com/coaching-1-1-45-min"
					target="_blank"
					rel="noopener"
				>
					<div class="coaching-venstre">
						<div class="coaching-ikon" aria-hidden="true">🎯</div>
						<div class="coaching-tekst">
							<div class="coaching-titel">Book 1:1 online coaching</div>
							<div class="coaching-sub">Personlig træning med Linn</div>
						</div>
					</div>
					<div class="coaching-arrow">
						<Icon name="arrow" size={14} color="#fff" />
					</div>
				</a>
			</section>

		</div>
	</div>
{:else if userState === 'modulbruger'}
	<div class="forside-b1">
		<div class="forside-body">
			{#if modulbrugerDage.length > 0}
				<section class="strip-section">
					<div class="strip-head">
						<div class="eyebrow eyebrow-muted">Din rejse</div>
						{#if !modulbrugerErIDag}
							<button
								class="strip-tilbage"
								type="button"
								onclick={nulstilModulbrugerTilIDag}
							>
								Tilbage til i dag
							</button>
						{/if}
					</div>
					<div class="strip" bind:this={modulbrugerStripEl}>
						{#each modulbrugerDage as chip (chip.dato)}
							{@const fmt = formatModulbrugerChipDato(chip.dato)}
							{@const erValgt = modulbrugerAktivDato === chip.dato}
							{@const erFadet = chip.erFremtid || (!chip.erIDag && !chip.harData)}
							<button
								type="button"
								class="strip-chip"
								class:erValgt
								class:erIDag={chip.erIDag}
								class:erFremtid={chip.erFremtid}
								class:erFadet
								disabled={chip.erFremtid}
								data-dato={chip.dato}
								onclick={() => vaelgModulbrugerDato(chip.dato)}
								aria-label={`${fmt.ugedag} ${fmt.dag}`}
							>
								<span class="chip-ugedag">{fmt.ugedag}</span>
								<span class="chip-dag">{fmt.dag}</span>
							</button>
						{/each}
					</div>
				</section>
			{/if}

			<section class="actions-section">
				<div class="actions-header">
					<div class="eyebrow eyebrow-muted">Dagens små skridt</div>
				</div>
				<div class="actions-list">
					{#each modulbrugerActions as action (action.modul)}
						<a class="action-card" href={action.href}>
							<div
								class="action-icon"
								style="background: {getActionAccentDim(action.modul)}"
							>
								<Icon
									name={getActionIcon(action.modul)}
									size={15}
									color={getActionAccent(action.modul)}
								/>
							</div>
							<div class="action-text">
								<div
									class="action-eyebrow"
									style="color: {getActionAccent(action.modul)}"
								>
									{action.eyebrow}
								</div>
								<div class="action-title">{action.titel}</div>
								<div class="action-meta">{action.meta}</div>
							</div>
							<Icon name="chevron-r" size={14} color="var(--text3)" />
						</a>
					{/each}
				</div>
			</section>

			<section class="coaching-section">
				<div class="eyebrow eyebrow-muted">Personlig coaching</div>
				<a
					class="coaching-knap"
					href="https://linn.simplero.com/coaching-1-1-45-min"
					target="_blank"
					rel="noopener"
				>
					<div class="coaching-venstre">
						<div class="coaching-ikon" aria-hidden="true">🎯</div>
						<div class="coaching-tekst">
							<div class="coaching-titel">Book 1:1 online coaching</div>
							<div class="coaching-sub">Personlig træning med Linn</div>
						</div>
					</div>
					<div class="coaching-arrow">
						<Icon name="arrow" size={14} color="#fff" />
					</div>
				</a>
			</section>
		</div>
	</div>
{:else if userState === 'udlobet'}
	<div class="forside-c1">
		<div class="forside-body">
			<section class="c1-greeting">
				<p class="c1-tagline">Det er længe siden — godt at se dig igen.</p>
			</section>

			<section class="tilbud-card">
				<div class="tilbud-decoration"></div>
				<div class="tilbud-content">
					<div class="tilbud-eyebrow">
						<Icon name="sparkle" size={10} color="#fff" />
						KUN FOR DIG
					</div>
					<div class="tilbud-title">−30% den første måned</div>
					<div class="tilbud-description">Fortsæt hvor du slap — alle moduler, fri adgang.</div>
					<button class="tilbud-button">Se mit tilbud</button>
				</div>
			</section>

			<section class="kob-section">
				<div class="kob-header">
					<div class="eyebrow eyebrow-muted">Mine køb</div>
					<div class="kob-title">Stadig dine — i 2 måneder til</div>
				</div>
				<div class="kob-list">
					{#each tidligereKob as kob (kob.navn)}
						<button class="kob-card">
							<div class="kob-icon" style="background: {kob.dim}">
								<Icon name={kob.ikon} size={16} color={kob.accent} />
							</div>
							<div class="kob-text">
								<div class="kob-name">{kob.navn}</div>
								<div class="kob-meta">{kob.meta}</div>
								<div class="kob-expires">{kob.expires}</div>
							</div>
							<Icon name="chevron-r" size={14} color="var(--text3)" />
						</button>
					{/each}
				</div>
			</section>

			<div class="c1-disclaimer">Ingen forpligtelse — du bestemmer selv tempoet.</div>

			<section class="coaching-section">
				<div class="eyebrow eyebrow-muted">Personlig coaching</div>
				<a
					class="coaching-knap"
					href="https://linn.simplero.com/coaching-1-1-45-min"
					target="_blank"
					rel="noopener"
				>
					<div class="coaching-venstre">
						<div class="coaching-ikon" aria-hidden="true">🎯</div>
						<div class="coaching-tekst">
							<div class="coaching-titel">Book 1:1 online coaching</div>
							<div class="coaching-sub">Personlig træning med Linn</div>
						</div>
					</div>
					<div class="coaching-arrow">
						<Icon name="arrow" size={14} color="#fff" />
					</div>
				</a>
			</section>
		</div>
	</div>
{:else}
	<div class="placeholder-page">
		<Loading tekst="Et øjeblik..." />
	</div>
{/if}

<style>
	/* ── Fælles forside-body ───────────────────────────────────── */

	.forside-a1,
	.forside-b1,
	.forside-c1 {
		min-height: 100%;
		display: flex;
		flex-direction: column;
	}

	.forside-body {
		flex: 1;
		padding: 14px 20px 18px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	/* ── Coaching og spørgsmål-sektioner ───────────────────────── */

	.coaching-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.coaching-knap {
		background: var(--terra);
		border-radius: 14px;
		padding: 14px 16px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		text-decoration: none;
	}

	.coaching-knap:active {
		opacity: 0.9;
	}

	.coaching-venstre {
		display: flex;
		align-items: center;
		gap: 12px;
		flex: 1;
		min-width: 0;
	}

	.coaching-ikon {
		width: 40px;
		height: 40px;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.18);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: calc(20px * var(--fs-scale, 1));
		flex-shrink: 0;
	}

	.coaching-tekst {
		min-width: 0;
	}

	.coaching-titel {
		font-family: var(--ff-d);
		font-size: calc(15px * var(--fs-scale, 1));
		font-weight: 500;
		color: var(--white);
	}

	.coaching-sub {
		font-size: calc(11px * var(--fs-scale, 1));
		color: rgba(255, 255, 255, 0.72);
		font-weight: 400;
	}

	.coaching-arrow {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.2);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.nyt-svar-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.nyt-svar-card {
		background: var(--header);
		border: 1px solid var(--terra);
		border-radius: 14px;
		padding: 14px 16px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		text-decoration: none;
		color: inherit;
	}

	.nyt-svar-eyebrow {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--terra);
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.nyt-svar-prik {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--terra);
		display: inline-block;
	}

	.nyt-svar-spoergsmaal {
		font-size: calc(12px * var(--fs-scale, 1));
		font-style: italic;
		color: var(--text2);
		line-height: 1.45;
		border-left: 2px solid var(--border);
		padding-left: 10px;
	}

	.nyt-svar-tekst {
		font-family: var(--ff-d);
		font-size: calc(14px * var(--fs-scale, 1));
		color: var(--text);
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.nyt-svar-link {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--terra);
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}

	/* ── A1 header ─────────────────────────────────────────────── */

	.forside-header {
		padding: 8px 20px 14px;
		background: var(--header);
		border-bottom: 1px solid var(--border);
	}

	.forlob-badge {
		margin-top: 6px;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 3px 10px;
		border-radius: 99px;
		background: var(--tdim);
		color: var(--terra);
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.04em;
		text-decoration: none;
	}

	.forlob-badge:hover {
		filter: brightness(0.95);
	}

	.badge-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--terra);
	}


	/* ── C1 hilsen ─────────────────────────────────────────────── */

	.c1-greeting {
		max-width: 320px;
	}

	.c1-tagline {
		font-family: var(--ff-d);
		font-style: italic;
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		margin: 0;
		line-height: 1.45;
	}

	/* ── Eyebrow-labels ────────────────────────────────────────── */

	.eyebrow {
		font-size: calc(9px * var(--fs-scale, 1));
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		margin-bottom: 8px;
	}

	.eyebrow-terra {
		color: var(--terra);
	}

	.eyebrow-muted {
		color: var(--text3);
	}

	/* ── Dato-strip ────────────────────────────────────────────── */

	.strip-section {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.strip-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 18px;
	}

	.strip-tilbage {
		background: none;
		border: none;
		color: var(--terra);
		font-family: var(--ff-b);
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		cursor: pointer;
		padding: 2px 4px;
	}

	.strip-tilbage:hover {
		text-decoration: underline;
	}

	.strip {
		display: flex;
		gap: 6px;
		overflow-x: auto;
		padding: 4px 2px 6px;
		scroll-behavior: smooth;
		scrollbar-width: none;
	}

	.strip::-webkit-scrollbar {
		display: none;
	}

	.strip-chip {
		flex: 0 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 8px 10px 7px;
		min-width: 52px;
		border-radius: 12px;
		background: var(--white);
		border: 1px solid var(--border);
		color: var(--text2);
		font-family: var(--ff-b);
		cursor: pointer;
		position: relative;
		transition: transform 0.1s, border-color 0.18s;
	}

	.strip-chip:active {
		transform: scale(0.96);
	}

	.strip-chip.erFremtid {
		opacity: 0.45;
		cursor: not-allowed;
		background: var(--bg2);
	}

	.strip-chip.erFadet:not(.erFremtid):not(.erValgt) {
		opacity: 0.55;
		background: var(--bg2);
	}

	.strip-chip.erIDag {
		border-color: var(--terra);
	}

	.strip-chip.erValgt {
		background: var(--terra);
		color: #fff;
		border-color: var(--terra);
	}

	.chip-ugedag {
		font-size: calc(9px * var(--fs-scale, 1));
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.strip-chip.erValgt .chip-ugedag {
		color: rgba(255, 255, 255, 0.85);
	}

	.chip-dag {
		font-family: var(--ff-d);
		font-size: calc(15px * var(--fs-scale, 1));
		font-weight: 700;
		line-height: 1;
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}

	.strip-chip.erValgt .chip-dag {
		color: #fff;
	}

	.chip-num {
		font-size: calc(9px * var(--fs-scale, 1));
		color: var(--text3);
		letter-spacing: 0.04em;
		font-variant-numeric: tabular-nums;
	}

	.strip-chip.erValgt .chip-num {
		color: rgba(255, 255, 255, 0.85);
	}

	.ingen-lektion {
		padding: 18px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text3);
		font-size: calc(13px * var(--fs-scale, 1));
		text-align: center;
	}

	/* ── Lektion-card ──────────────────────────────────────────── */

	.lektion-section {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.lektion-card {
		display: block;
		border-radius: 16px;
		overflow: hidden;
		background: linear-gradient(160deg, #c99587 0%, #b87b6e 60%, #9d6358 100%);
		color: #fff;
		padding: 14px 16px;
		position: relative;
		min-height: 102px;
		text-decoration: none;
	}

	.lektion-card[data-tone='1'] {
		background: linear-gradient(160deg, #8fb89c 0%, #6f9e7e 60%, #587f64 100%);
	}

	.lektion-card[data-tone='1'] .lektion-button {
		color: var(--sage);
	}

	.lektion-card[data-tone='2'] {
		background: linear-gradient(160deg, #d4b285 0%, #b8956a 60%, #957654 100%);
	}

	.lektion-card[data-tone='2'] .lektion-button {
		color: var(--gold);
	}

	.lektion-card:hover {
		filter: brightness(1.03);
	}

	.lektion-decoration {
		position: absolute;
		border-radius: 50%;
	}

	.lektion-decoration-1 {
		right: -30px;
		top: -30px;
		width: 140px;
		height: 140px;
		background: rgba(255, 255, 255, 0.08);
	}

	.lektion-decoration-2 {
		right: 30px;
		bottom: -50px;
		width: 110px;
		height: 110px;
		background: rgba(255, 255, 255, 0.05);
	}

	.lektion-content {
		position: relative;
	}

	.lektion-meta {
		font-size: calc(9px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		opacity: 0.85;
	}

	.lektion-title {
		font-family: var(--ff-d);
		font-size: calc(19px * var(--fs-scale, 1));
		font-weight: 700;
		margin-top: 4px;
		line-height: 1.1;
	}

	.lektion-description {
		font-size: calc(11.5px * var(--fs-scale, 1));
		opacity: 0.85;
		margin-top: 3px;
		line-height: 1.4;
	}

	.lektion-actions {
		display: flex;
		gap: 8px;
		margin-top: 9px;
		align-items: center;
	}

	.lektion-button {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 7px 14px;
		border-radius: 99px;
		background: #fff;
		color: var(--terra);
		border: none;
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 600;
		font-family: var(--ff-b);
		cursor: pointer;
	}

	.lektion-duration {
		font-size: calc(15px * var(--fs-scale, 1));
		font-weight: 600;
		opacity: 0.95;
	}

	/* ── Actions ───────────────────────────────────────────────── */

	.actions-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 8px;
	}

	.actions-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.action-card {
		padding: 12px;
		border-radius: 12px;
		background: var(--white);
		border: 1px solid var(--border);
		display: flex;
		align-items: center;
		gap: 11px;
		width: 100%;
		text-align: left;
		font-family: var(--ff-b);
		text-decoration: none;
		color: inherit;
		cursor: pointer;
	}

	.action-card:hover {
		background: var(--bg2);
	}

	.action-icon {
		width: 34px;
		height: 34px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.action-text {
		flex: 1;
		min-width: 0;
	}

	.action-eyebrow {
		font-size: calc(9px * var(--fs-scale, 1));
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.action-title {
		font-family: var(--ff-d);
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 700;
		margin-top: 2px;
		line-height: 1.2;
	}

	.action-meta {
		font-size: calc(10px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	/* ── Note fra Linn ─────────────────────────────────────────── */

	.note-section {
		padding: 14px;
		border-radius: 12px;
		background: var(--bg2);
		border: 1px solid var(--border);
		display: flex;
		gap: 11px;
	}

	.note-badge {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--ic-rose);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		font-family: var(--ff-d);
		font-weight: 700;
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--terra);
	}

	.note-content {
		flex: 1;
		min-width: 0;
	}

	.note-eyebrow {
		font-size: calc(9px * var(--fs-scale, 1));
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.note-text {
		font-family: var(--ff-d);
		font-size: calc(12.5px * var(--fs-scale, 1));
		font-style: italic;
		color: var(--text2);
		margin-top: 3px;
		line-height: 1.45;
	}

	/* ── C1 tilbuds-card ───────────────────────────────────────── */

	.tilbud-card {
		border-radius: 16px;
		overflow: hidden;
		background: linear-gradient(160deg, #c99587 0%, #b87b6e 60%, #9d6358 100%);
		color: #fff;
		padding: 18px;
		position: relative;
	}

	.tilbud-decoration {
		position: absolute;
		right: -30px;
		top: -30px;
		width: 130px;
		height: 130px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.08);
	}

	.tilbud-content {
		position: relative;
	}

	.tilbud-eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 3px 9px;
		border-radius: 99px;
		background: rgba(255, 255, 255, 0.22);
		font-size: calc(9px * var(--fs-scale, 1));
		font-weight: 700;
		letter-spacing: 0.14em;
		margin-bottom: 10px;
	}

	.tilbud-title {
		font-family: var(--ff-d);
		font-size: calc(22px * var(--fs-scale, 1));
		font-weight: 700;
		line-height: 1.1;
		letter-spacing: -0.01em;
	}

	.tilbud-description {
		font-size: calc(11.5px * var(--fs-scale, 1));
		opacity: 0.9;
		margin-top: 6px;
		line-height: 1.45;
	}

	.tilbud-button {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 10px 18px;
		border-radius: 99px;
		background: #fff;
		color: var(--terra);
		border: none;
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 600;
		font-family: var(--ff-b);
		margin-top: 14px;
		cursor: pointer;
	}

	/* ── C1 mine køb ───────────────────────────────────────────── */

	.kob-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 8px;
	}

	.kob-title {
		font-family: var(--ff-d);
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 700;
		font-style: italic;
		color: var(--text);
	}

	.kob-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.kob-card {
		padding: 13px;
		border-radius: 12px;
		background: var(--white);
		border: 1px solid var(--border);
		display: flex;
		align-items: center;
		gap: 11px;
		width: 100%;
		text-align: left;
		font-family: var(--ff-b);
		cursor: pointer;
	}

	.kob-icon {
		width: 38px;
		height: 38px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.kob-text {
		flex: 1;
		min-width: 0;
	}

	.kob-name {
		font-family: var(--ff-d);
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 700;
		line-height: 1.2;
		color: var(--text);
	}

	.kob-meta {
		font-size: calc(10px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.kob-expires {
		font-size: calc(9.5px * var(--fs-scale, 1));
		color: var(--terra);
		margin-top: 2px;
		font-weight: 600;
		letter-spacing: 0.04em;
	}

	.c1-disclaimer {
		font-size: calc(10px * var(--fs-scale, 1));
		color: var(--text3);
		font-family: var(--ff-d);
		font-style: italic;
		text-align: center;
		padding: 4px 0;
	}

	/* ── Placeholder ───────────────────────────────────────────── */

	.placeholder-page {
		padding: 40px 24px;
		min-height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		text-align: center;
	}

</style>
