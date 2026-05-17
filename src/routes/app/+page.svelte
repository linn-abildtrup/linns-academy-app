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
	import { hentUserProduct, hentForlobsProgram } from '$lib/firestore/mikrotraening';
	import { hentMineSpoergsmaal, type KlientSpoergsmaal } from '$lib/firestore/spoergsmaal';
	import {
		hentVaneprogramForForlob,
		hentVanedag,
		gemVanedag
	} from '$lib/firestore/vaner';
	import type { VaneProgramDag, VanedagEntry, BonusSvar } from '$lib/content/vaner';
	import {
		hentMaaltiderIPeriode,
		hentMaaltiderForDato
	} from '$lib/firestore/kost';
	import {
		hentAboVaneOpsaetning,
		hentAboBonusPulje,
		hentAboVanedag,
		hentAlleAboVanedage,
		gemAboVanedag
	} from '$lib/firestore/aboVaner';
	import {
		hentAlleAboTraeninger,
		hentAboFremgang,
		hentAboMikrotraeningProgram
	} from '$lib/firestore/aboMikrotraening';
	import { hentExercises } from '$lib/firestore/mikrotraening';
	import { aktuelAboDag } from '$lib/content/aboMikrotraening';
	import { getVideoUrl, prefetchVideoer } from '$lib/utils/storage';
	import { hentModulbrugerLektion } from '$lib/firestore/modulbrugerLektioner';
	import type { ModulbrugerLektion } from '$lib/content/modulbrugerLektioner';
	import {
		formaterDato,
		dagensBonus,
		erUgentligCheckinDag,
		type AboBonusForslag,
		type AboBonusSvar,
		type AboVaneOpsaetning,
		type AboVanedagEntry
	} from '$lib/content/aboVaner';
	import { CHECKIN_SPORGSMAAL, type VaneSvar, type CheckinSvar } from '$lib/content/vaner';
	import type { GemtMaaltid } from '$lib/content/kost';
	import { dagligeMalForBruger } from '$lib/content/naering';
	import Loading from '$lib/components/Loading.svelte';
	import { effektivState, harPremium } from '$lib/utils/userAdgang';
	import {
		erInspirationLektion,
		erLydLektion,
		erVideoLektion,
		videoThumbnail
	} from '$lib/content/bibliotek';

	const getUserDoc = getContext<() => UserDoc | null>('userDoc');
	const getUser = getContext<() => User | null>('user');

	const userDoc = $derived(getUserDoc());
	const user = $derived(getUser());
	const userState = $derived(effektivState(userDoc));

	let forlob = $state<Forlob | null>(null);
	let forlobsdage = $state<ForlobDag[]>([]);
	let userProduct = $state<UserProduct | null>(null);
	let vaneprogramDage = $state<VaneProgramDag[]>([]);
	let forlobVanedag = $state<VanedagEntry | null>(null);
	let forlobMaaltider = $state<GemtMaaltid[]>([]);
	// Initialiseres fra ?dag=N query-param så valget bevares når brugeren
	// går væk og tilbage (fx via history.back fra lektion-overlay).
	let valgtDagNummer = $state<number | null>(dagFraQuery());
	let mineSpoergsmaal = $state<KlientSpoergsmaal[]>([]);
	let tidligereForlob = $state<Forlob[]>([]);

	// Antal dage tilbage af 90-dages bibliotek-bonus (null hvis ingen bonus).
	const dageTilbageAfBonus = $derived.by<number | null>(() => {
		if (!userDoc?.bonusPeriodEndsAt) return null;
		const ms = userDoc.bonusPeriodEndsAt - Date.now();
		if (ms <= 0) return 0;
		return Math.ceil(ms / (24 * 60 * 60 * 1000));
	});

	const dageSidenForlobSlut = $derived.by<number | null>(() => {
		if (!userDoc?.expiresAt) return null;
		const ms = Date.now() - userDoc.expiresAt;
		if (ms < 0) return null;
		return Math.floor(ms / (24 * 60 * 60 * 1000));
	});

	// Tagline for udlobet-forsiden tilpasses hvor lang tid siden forløbet sluttede.
	const taglineForUdlobet = $derived.by<string>(() => {
		const dage = dageSidenForlobSlut;
		const fornavn = userDoc?.firstName ? `, ${userDoc.firstName}` : '';
		if (dage === null) return 'Det er længe siden — godt at se dig igen.';
		if (dage <= 7) return `Godt klaret med dit forløb${fornavn}!`;
		if (dage <= 30) return `Du er stadig velkommen til at bruge dit materiale${fornavn}.`;
		return 'Det er længe siden — godt at se dig igen.';
	});

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

	// Indlæs tidligere forløb (kun for udlobet-brugere — de bruges i "Mine køb").
	$effect(() => {
		if (userState !== 'udlobet') {
			tidligereForlob = [];
			return;
		}
		const ids = userDoc?.forlobIds ?? [];
		if (ids.length === 0) {
			tidligereForlob = [];
			return;
		}
		void (async () => {
			const liste: Forlob[] = [];
			for (const id of ids) {
				try {
					const f = await hentForlob(id);
					if (f) liste.push(f);
				} catch (e) {
					console.warn('Kunne ikke hente tidligere forløb:', id, e);
				}
			}
			tidligereForlob = liste;
		})();
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
	let modulbrugerLektion = $state<ModulbrugerLektion | null>(null);
	let modulbrugerVaneOpsaetning = $state<AboVaneOpsaetning | null>(null);
	let modulbrugerBonusPulje = $state<AboBonusForslag[]>([]);
	let modulbrugerVanedag = $state<AboVanedagEntry | null>(null);
	let modulbrugerMaaltider = $state<GemtMaaltid[]>([]);
	let modulbrugerTraeningsDatoer = $state<Set<string>>(new Set());
	let modulbrugerTraeningsVideo = $state<string | null>(null);
	let forlobTraeningsVideo = $state<string | null>(null);

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
		const traeningsSet = new Set<string>();
		for (const t of traeninger) {
			dataSet.add(t.dato);
			traeningsSet.add(t.dato);
		}
		modulbrugerTraeningsDatoer = traeningsSet;

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

	// Hent lektion for valgt dato (hvis nogen) — opdateres når dato skifter
	$effect(() => {
		const ud = userDoc;
		if (ud?.state !== 'modulbruger') {
			modulbrugerLektion = null;
			return;
		}
		const dato = modulbrugerAktivDato;
		void (async () => {
			try {
				modulbrugerLektion = await hentModulbrugerLektion(dato);
			} catch (e) {
				console.warn('Kunne ikke hente lektion for', dato, e);
				modulbrugerLektion = null;
			}
		})();
	});

	// Hent vane-opsætning + bonus-pulje (kører én gang når bruger er modulbruger)
	$effect(() => {
		const u = user;
		const ud = userDoc;
		if (!u || ud?.state !== 'modulbruger') {
			modulbrugerVaneOpsaetning = null;
			modulbrugerBonusPulje = [];
			return;
		}
		void (async () => {
			try {
				const opsaetning = await hentAboVaneOpsaetning(u.uid);
				modulbrugerVaneOpsaetning = opsaetning;
				if (opsaetning) {
					modulbrugerBonusPulje = await hentAboBonusPulje(opsaetning.produktType);
				}
			} catch (e) {
				console.warn('Kunne ikke hente vane-opsætning til forsiden:', e);
			}
		})();
	});

	// Hent dagens vanedag-entry og måltider når activeDato skifter
	$effect(() => {
		const u = user;
		const ud = userDoc;
		if (!u || ud?.state !== 'modulbruger') {
			modulbrugerVanedag = null;
			modulbrugerMaaltider = [];
			return;
		}
		const dato = modulbrugerAktivDato;
		void (async () => {
			try {
				const [vanedag, maaltider] = await Promise.all([
					hentAboVanedag(u.uid, dato),
					hentMaaltiderForDato(u.uid, dato)
				]);
				modulbrugerVanedag = vanedag;
				modulbrugerMaaltider = maaltider;
			} catch (e) {
				console.warn('Kunne ikke hente dagens data:', e);
			}
		})();
	});

	const modulbrugerBonusIDag = $derived(
		modulbrugerBonusPulje.length > 0
			? dagensBonus(modulbrugerBonusPulje, modulbrugerAktivDato)
			: null
	);

	const modulbrugerErCheckinDag = $derived.by(() => {
		const [aar, m, d] = modulbrugerAktivDato.split('-').map(Number);
		return erUgentligCheckinDag(new Date(aar, m - 1, d));
	});

	const modulbrugerTraeningGennemfoert = $derived(
		modulbrugerTraeningsDatoer.has(modulbrugerAktivDato)
	);

	// Find brugerens "har du trænet"-vane (hvis valgt) ud fra label-heuristik.
	// Når mikrotræning er gennemført, tvinges vanen til 'ja' og knapperne låses.
	const modulbrugerTraeningsVane = $derived(
		modulbrugerVaneOpsaetning?.valgteVaner.find((v) => v.label.toLowerCase().includes('træn')) ??
			null
	);

	$effect(() => {
		const vane = modulbrugerTraeningsVane;
		if (!vane || !modulbrugerTraeningGennemfoert) return;
		// Auto-ja KUN hvis brugeren ikke selv har valgt et svar. Så kan klienten
		// stadig rette til delvist/nej hvis hun har lavet en fejl under træningen.
		if (modulbrugerVanedag?.checks?.[vane.id] !== undefined) return;
		void gemVaneSvar(vane.id, 'ja');
	});

	// Hent thumbnail af dagens første træningsøvelse (best-effort, lazy)
	$effect(() => {
		const u = user;
		const ud = userDoc;
		if (!u || ud?.state !== 'modulbruger') {
			modulbrugerTraeningsVideo = null;
			return;
		}
		const produktType: 'basis' | 'premium' = harPremium(ud) ? 'premium' : 'basis';
		void (async () => {
			try {
				const [program, fremgang] = await Promise.all([
					hentAboMikrotraeningProgram(produktType),
					hentAboFremgang(u.uid)
				]);
				if (!program) return;
				const programDag = aktuelAboDag(fremgang);
				const dag = program.dage.find((d) => d.dagNummer === programDag);
				const exerciseIds = (dag?.exercises ?? []).map((e) => e.exerciseId);
				if (exerciseIds.length === 0) return;
				const exercises = await hentExercises(exerciseIds);
				const ex = exercises.get(exerciseIds[0]);
				if (ex?.videoPath) modulbrugerTraeningsVideo = await getVideoUrl(ex.videoPath);
				// Prefetch alle dagens videoer i baggrunden så de ligger klar
				// når brugeren klikker dagens mikrotræning.
				const videoPaths = exerciseIds
					.map((id) => exercises.get(id)?.videoPath)
					.filter((p): p is string => !!p);
				void prefetchVideoer(videoPaths);
			} catch (e) {
				console.warn('Kunne ikke hente trænings-video til thumbnail:', e);
			}
		})();
	});

	const modulbrugerMaaltidsTotaler = $derived.by(() => {
		let p = 0;
		let f = 0;
		let kcal = 0;
		for (const m of modulbrugerMaaltider) {
			p += m.totalP ?? 0;
			f += m.totalF ?? 0;
			kcal += m.totalKcal ?? 0;
		}
		return { protein: p, fiber: f, kcal };
	});

	const dagligeMaal = $derived(dagligeMalForBruger(userDoc?.dagligeMaal));
	const modulbrugerProteinPct = $derived(
		Math.min(100, Math.round((modulbrugerMaaltidsTotaler.protein / dagligeMaal.protein) * 100))
	);
	const modulbrugerFiberPct = $derived(
		Math.min(100, Math.round((modulbrugerMaaltidsTotaler.fiber / dagligeMaal.fiber) * 100))
	);

	function tomVanedag(dato: string): AboVanedagEntry {
		return { dato, checks: {}, bonus: null, checkin: {}, note: '' };
	}

	let gemmerSvar = $state(false);

	async function gemVaneSvar(vaneId: string, svar: VaneSvar) {
		const u = user;
		if (!u || gemmerSvar) return;
		gemmerSvar = true;
		const aktuel = modulbrugerVanedag ?? tomVanedag(modulbrugerAktivDato);
		const nyChecks = { ...aktuel.checks, [vaneId]: svar };
		const ny: AboVanedagEntry = { ...aktuel, checks: nyChecks };
		modulbrugerVanedag = ny;
		try {
			await gemAboVanedag(u.uid, ny);
		} catch (e) {
			console.error('Kunne ikke gemme vane-svar:', e);
		} finally {
			gemmerSvar = false;
		}
	}

	async function gemBonusSvar(bonusId: string, svar: AboBonusSvar) {
		const u = user;
		if (!u || gemmerSvar) return;
		gemmerSvar = true;
		const aktuel = modulbrugerVanedag ?? tomVanedag(modulbrugerAktivDato);
		const ny: AboVanedagEntry = {
			...aktuel,
			bonus: { id: bonusId, svar }
		};
		modulbrugerVanedag = ny;
		try {
			await gemAboVanedag(u.uid, ny);
		} catch (e) {
			console.error('Kunne ikke gemme bonus-svar:', e);
		} finally {
			gemmerSvar = false;
		}
	}

	async function gemCheckinSvar(spId: string, vaerdi: number) {
		const u = user;
		if (!u || gemmerSvar) return;
		gemmerSvar = true;
		const aktuel = modulbrugerVanedag ?? tomVanedag(modulbrugerAktivDato);
		const nyCheckin = { ...aktuel.checkin, [spId]: vaerdi } as CheckinSvar;
		const ny: AboVanedagEntry = { ...aktuel, checkin: nyCheckin };
		modulbrugerVanedag = ny;
		try {
			await gemAboVanedag(u.uid, ny);
		} catch (e) {
			console.error('Kunne ikke gemme check-in-svar:', e);
		} finally {
			gemmerSvar = false;
		}
	}

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
			const [f, dage, vaneDage] = await Promise.all([
				hentForlob(forlobId),
				hentForlobsdage(forlobId),
				hentVaneprogramForForlob(forlobId).catch(() => [] as VaneProgramDag[])
			]);
			if (!f) return;
			forlob = f;
			forlobsdage = dage;
			vaneprogramDage = vaneDage;
		} catch (e) {
			console.error('Kunne ikke hente forløb til forsiden:', e);
		}
	}

	const aktivVaneprogramDag = $derived.by<VaneProgramDag | null>(() => {
		if (vaneprogramDage.length === 0) return null;
		const n = valgtDagNummer ?? aktivDagNummer;
		if (n === null) return null;
		return vaneprogramDage.find((d) => d.dagNummer === n) ?? null;
	});

	const valgtDagDato = $derived.by<string | null>(() => {
		const d = dagensDag;
		if (!d) return null;
		const dato = stripDage[d.dagNummer]?.dato;
		return dato ? formaterDato(dato) : null;
	});

	$effect(() => {
		const u = user;
		const ud = userDoc;
		if (!u || ud?.state !== 'forlobskunde') {
			forlobVanedag = null;
			forlobMaaltider = [];
			return;
		}
		const n = valgtDagNummer ?? aktivDagNummer;
		const dato = valgtDagDato;
		if (n === null) return;
		void (async () => {
			try {
				const [vanedag, maaltider] = await Promise.all([
					hentVanedag(u.uid, n, 'kickstart'),
					dato ? hentMaaltiderForDato(u.uid, dato) : Promise.resolve([] as GemtMaaltid[])
				]);
				forlobVanedag = vanedag;
				forlobMaaltider = maaltider;
			} catch (e) {
				console.warn('Kunne ikke hente forløbs-dag-data:', e);
			}
		})();
	});

	// Forløbs trænings-thumbnail
	$effect(() => {
		const u = user;
		const ud = userDoc;
		if (!u || ud?.state !== 'forlobskunde') {
			forlobTraeningsVideo = null;
			return;
		}
		const programId = userProduct?.programValg?.mikrotraening;
		const forlobId = (userProduct as (UserProduct & { forlobId?: string }) | null)?.forlobId;
		const n = valgtDagNummer ?? aktivDagNummer;
		if (!programId || !forlobId || n === null || n === 0) {
			forlobTraeningsVideo = null;
			return;
		}
		void (async () => {
			try {
				const program = await hentForlobsProgram(forlobId, programId);
				if (!program) return;
				const dag = program.dage.find((d) => d.dagNummer === n);
				const exerciseIds = (dag?.exercises ?? []).map((e) => e.exerciseId);
				if (exerciseIds.length === 0) return;
				const exercises = await hentExercises(exerciseIds);
				const ex = exercises.get(exerciseIds[0]);
				if (ex?.videoPath) forlobTraeningsVideo = await getVideoUrl(ex.videoPath);
				// Prefetch alle dagens videoer i baggrunden så de ligger klar
				// når klienten klikker dagens mikrotræning.
				const videoPaths = exerciseIds
					.map((id) => exercises.get(id)?.videoPath)
					.filter((p): p is string => !!p);
				void prefetchVideoer(videoPaths);
			} catch (e) {
				console.warn('Kunne ikke hente forløbs-trænings-video til thumbnail:', e);
			}
		})();
	});

	const forlobTraeningGennemfoert = $derived.by<boolean>(() => {
		const n = valgtDagNummer ?? aktivDagNummer;
		if (n === null) return false;
		type FremgangShape = { gennemforte?: number[] };
		const f = userProduct?.fremgang?.mikrotraening as FremgangShape | undefined;
		return f?.gennemforte?.includes(n) ?? false;
	});

	// Auto-ja for trænings-vane i forløbet når dagens mikrotræning er gennemført.
	const forlobTraeningsVane = $derived(
		aktivVaneprogramDag?.checks?.find((v) => v.label.toLowerCase().includes('træn')) ?? null
	);

	$effect(() => {
		const vane = forlobTraeningsVane;
		if (!vane || !forlobTraeningGennemfoert) return;
		// Auto-ja KUN hvis brugeren ikke selv har valgt et svar.
		if (forlobVanedag?.checks?.[vane.id] !== undefined) return;
		void gemForlobVaneSvar(vane.id, 'ja');
	});

	const forlobMaaltidsTotaler = $derived.by(() => {
		let p = 0;
		let f = 0;
		let kcal = 0;
		for (const m of forlobMaaltider) {
			p += m.totalP ?? 0;
			f += m.totalF ?? 0;
			kcal += m.totalKcal ?? 0;
		}
		return { protein: p, fiber: f, kcal };
	});

	const forlobProteinPct = $derived(
		Math.min(100, Math.round((forlobMaaltidsTotaler.protein / dagligeMaal.protein) * 100))
	);
	const forlobFiberPct = $derived(
		Math.min(100, Math.round((forlobMaaltidsTotaler.fiber / dagligeMaal.fiber) * 100))
	);

	function tomForlobVanedag(dagNummer: number): VanedagEntry {
		return { dagNummer, checks: {}, bonus: {}, checkin: {}, note: '' };
	}

	async function gemForlobVaneSvar(vaneId: string, svar: VaneSvar) {
		const u = user;
		const n = valgtDagNummer ?? aktivDagNummer;
		if (!u || n === null || gemmerSvar) return;
		gemmerSvar = true;
		const aktuel = forlobVanedag ?? tomForlobVanedag(n);
		const nyChecks = { ...aktuel.checks, [vaneId]: svar };
		const ny: VanedagEntry = { ...aktuel, checks: nyChecks };
		forlobVanedag = ny;
		try {
			await gemVanedag(u.uid, ny, 'kickstart');
		} catch (e) {
			console.error('Kunne ikke gemme forløbs-vane-svar:', e);
		} finally {
			gemmerSvar = false;
		}
	}

	async function gemForlobBonusSvar(bonusId: string, svar: BonusSvar) {
		const u = user;
		const n = valgtDagNummer ?? aktivDagNummer;
		if (!u || n === null || gemmerSvar) return;
		gemmerSvar = true;
		const aktuel = forlobVanedag ?? tomForlobVanedag(n);
		const nyBonus = { ...aktuel.bonus, [bonusId]: svar };
		const ny: VanedagEntry = { ...aktuel, bonus: nyBonus };
		forlobVanedag = ny;
		try {
			await gemVanedag(u.uid, ny, 'kickstart');
		} catch (e) {
			console.error('Kunne ikke gemme forløbs-bonus-svar:', e);
		} finally {
			gemmerSvar = false;
		}
	}

	async function gemForlobCheckinSvar(spId: string, vaerdi: number) {
		const u = user;
		const n = valgtDagNummer ?? aktivDagNummer;
		if (!u || n === null || gemmerSvar) return;
		gemmerSvar = true;
		const aktuel = forlobVanedag ?? tomForlobVanedag(n);
		const nyCheckin = { ...aktuel.checkin, [spId]: vaerdi } as CheckinSvar;
		const ny: VanedagEntry = { ...aktuel, checkin: nyCheckin };
		forlobVanedag = ny;
		try {
			await gemVanedag(u.uid, ny, 'kickstart');
		} catch (e) {
			console.error('Kunne ikke gemme forløbs-check-in-svar:', e);
		} finally {
			gemmerSvar = false;
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

			{#if dagensDag}
				{@const harProgramValg = !!userProduct?.programValg?.mikrotraening}
				{@const traeningHref = harProgramValg
					? `/app/moduler/traening/mikrotraening/${dagensDag.dagNummer}`
					: '/app/moduler/traening/mikrotraening'}
				<section class="actions-section">
					<div class="actions-header">
						<div class="eyebrow eyebrow-muted">Dagens lektioner</div>
					</div>
					<div class="actions-list">
						{#if dagensDag.lektioner.length > 0}
							{#each dagensDag.lektioner as lektion, i (lektion.id)}
								{@const thumbUrl = videoThumbnail(lektion.url)}
								{@const erLyd = erLydLektion(lektion.url)}
								{@const erInspiration = erInspirationLektion(lektion.url)}
								{@const visThumb = erVideoLektion(lektion.url) || erLyd || erInspiration}
								{@const visFormat = erInspiration ? 'Inspiration' : lektion.format}
								<a
									class="lektion-card lektion-card-kompakt"
									class:lektion-card-medThumb={visThumb}
									data-tone={i % 3}
									href="/app/moduler/forlob?lektion={lektion.id}"
								>
									<div class="lektion-decoration lektion-decoration-1"></div>
									<div class="lektion-decoration lektion-decoration-2"></div>
									{#if visThumb}
										<div class="lektion-thumb">
											{#if thumbUrl}
												<img src={thumbUrl} alt="" loading="lazy" />
											{:else if erLyd}
												<div class="lektion-thumb-placeholder lektion-thumb-lyd">
													<Icon name="headphones" size={26} color="#fff" />
													<span>Lyd</span>
												</div>
											{:else if erInspiration}
												<div class="lektion-thumb-placeholder lektion-thumb-inspiration">
													<Icon name="lightbulb" size={32} color="#fff" />
												</div>
											{:else}
												<div class="lektion-thumb-placeholder">Zoom</div>
											{/if}
										</div>
									{/if}
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
											{#if lektion.varighedMin > 0 || visFormat}
												<span class="lektion-duration">
													{lektion.varighedMin > 0 ? lektion.varighedMin + ' min' : ''}{lektion.varighedMin > 0 && visFormat ? ' · ' : ''}{visFormat}
												</span>
											{/if}
										</div>
									</div>
								</a>
							{/each}
						{/if}
						{#if dagensDag.dagNummer > 0}
							<a class="action-card" href={traeningHref}>
								{#if forlobTraeningsVideo}
									<div class="traening-thumb">
										<video
											src={forlobTraeningsVideo}
											autoplay
											muted
											loop
											playsinline
											preload="auto"
										></video>
										{#if forlobTraeningGennemfoert}
											<div class="traening-thumb-check">
												<Icon name="check" size={12} color="#fff" />
											</div>
										{/if}
									</div>
								{:else}
									<div
										class="action-icon"
										style="background: {forlobTraeningGennemfoert ? 'var(--sage)' : 'var(--tdim)'}"
									>
										<Icon
											name={forlobTraeningGennemfoert ? 'check' : 'workout'}
											size={15}
											color={forlobTraeningGennemfoert ? '#fff' : 'var(--terra)'}
										/>
									</div>
								{/if}
								<div class="action-text">
									<div class="action-eyebrow" style="color: var(--terra)">Træning</div>
									<div class="action-title">Mikrotræning</div>
									<div class="action-meta">
										{forlobTraeningGennemfoert ? 'Gennemført' : 'Korte daglige sessioner'}
									</div>
								</div>
								<Icon name="chevron-r" size={14} color="var(--text3)" />
							</a>
						{/if}
					</div>
				</section>
			{/if}

			{#if aktivVaneprogramDag}
				<section class="vaner-inline-section">
					<div class="actions-header">
						<div class="eyebrow eyebrow-muted">Dagens små skridt</div>
					</div>
					<div class="vaner-inline-liste">
						{#if aktivVaneprogramDag.isBaseline}
							<div class="vane-inline-row">
								<div class="vane-inline-label">
									Tag dit baseline-check-in nedenfor før forløbet starter.
								</div>
							</div>
						{:else}
							{#each aktivVaneprogramDag.checks as vane (vane.id)}
								{@const svar = forlobVanedag?.checks?.[vane.id]}
								<div class="vane-inline-row">
									<div class="vane-inline-label">{vane.label}</div>
									<div class="vane-svar-knapper">
										{#each [{ v: 'ja' as VaneSvar, l: 'Ja' }, { v: 'delvist' as VaneSvar, l: 'Delvist' }, { v: 'nej' as VaneSvar, l: 'Nej' }] as opt (opt.v)}
											<button
												type="button"
												class="svar-knap svar-knap-{opt.v}"
												class:aktiv={svar === opt.v}
												disabled={gemmerSvar}
												onclick={() => gemForlobVaneSvar(vane.id, opt.v)}
											>
												{opt.l}
											</button>
										{/each}
									</div>
								</div>
							{/each}
						{/if}

						{#if aktivVaneprogramDag.bonus}
							<div class="vane-inline-row vane-inline-bonus">
								<div class="vane-inline-label">{aktivVaneprogramDag.bonus.label}</div>
								<div class="vane-svar-knapper">
									{#each [{ v: 'ja' as BonusSvar, l: 'Ja' }, { v: 'nej' as BonusSvar, l: 'Nej' }] as opt (opt.v)}
										<button
											type="button"
											class="svar-knap svar-knap-{opt.v}"
											class:aktiv={forlobVanedag?.bonus?.[aktivVaneprogramDag.bonus!.id] === opt.v}
											disabled={gemmerSvar}
											onclick={() => gemForlobBonusSvar(aktivVaneprogramDag!.bonus!.id, opt.v)}
										>
											{opt.l}
										</button>
									{/each}
								</div>
							</div>
						{/if}

						{#if aktivVaneprogramDag.isCheckin || aktivVaneprogramDag.isBaseline}
							<div class="checkin-blok">
								<div class="checkin-titel">
									{aktivVaneprogramDag.isBaseline ? 'Baseline check-in' : 'Ugentligt check-in'}
								</div>
								<div class="checkin-sub">Mærk efter — hvor er du på skalaen lige nu? (1 = lavt, 10 = højt)</div>
								{#each CHECKIN_SPORGSMAAL as q (q.id)}
									{@const aktuel = forlobVanedag?.checkin?.[q.id as keyof CheckinSvar] ?? null}
									<div class="checkin-row">
										<div class="checkin-label">{q.label}</div>
										<div class="checkin-skala-rad">
											<input
												class="checkin-slider"
												type="range"
												min="1"
												max="10"
												step="1"
												value={typeof aktuel === 'number' ? aktuel : 5}
												disabled={gemmerSvar}
												onchange={(e) =>
													gemForlobCheckinSvar(
														q.id,
														parseInt((e.target as HTMLInputElement).value, 10)
													)}
											/>
											<div class="checkin-vaerdi">{typeof aktuel === 'number' ? aktuel : '-'}</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</section>
			{/if}

			{#if dagensDag && valgtDagDato}
				<section class="mad-section">
					<a
						class="action-card mad-action-card"
						href={`/app/moduler/30-30-3?dato=${valgtDagDato}`}
					>
						<div class="action-icon" style="background: var(--sdim)">
							<Icon name="leaf" size={15} color="var(--sage)" />
						</div>
						<div class="action-text">
							<div class="action-eyebrow" style="color: var(--sage)">Mad</div>
							<div class="action-title">Dagens tal</div>
							<div class="mad-progress">
								<div class="mad-progress-row">
									<span class="mad-progress-label">Protein</span>
									<div class="mad-progress-track">
										<div
											class="mad-progress-fill mad-progress-protein"
											style="width: {forlobProteinPct}%"
										></div>
									</div>
									<span class="mad-progress-vaerdi">
										{Math.round(forlobMaaltidsTotaler.protein)}/{dagligeMaal.protein} g
									</span>
								</div>
								<div class="mad-progress-row">
									<span class="mad-progress-label">Fiber</span>
									<div class="mad-progress-track">
										<div
											class="mad-progress-fill mad-progress-fiber"
											style="width: {forlobFiberPct}%"
										></div>
									</div>
									<span class="mad-progress-vaerdi">
										{Math.round(forlobMaaltidsTotaler.fiber)}/{dagligeMaal.fiber} g
									</span>
								</div>
							</div>
						</div>
						<Icon name="chevron-r" size={14} color="var(--text3)" />
					</a>
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
							<div class="coaching-sub">Personlig coaching med Linn</div>
						</div>
					</div>
					<div class="coaching-arrow">
						<Icon name="arrow" size={14} color="#fff" />
					</div>
				</a>

				<a class="hjaelp-knap" href="/app/app-hjaelp">
					<div class="hjaelp-venstre">
						<div class="hjaelp-ikon" aria-hidden="true">💬</div>
						<div class="hjaelp-tekst">
							<div class="hjaelp-titel">Har du spørgsmål til appen?</div>
							<div class="hjaelp-sub">Stil dem her — jeg svarer med det samme</div>
						</div>
					</div>
					<Icon name="chevron-r" size={14} color="var(--text3)" />
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
					<div class="eyebrow eyebrow-muted">Dagens lektioner</div>
				</div>
				<div class="actions-list">
					{#if modulbrugerLektion && modulbrugerLektion.titel}
						{@const modulThumbUrl = modulbrugerLektion.url ? videoThumbnail(modulbrugerLektion.url) : null}
						{@const modulErLyd = !!modulbrugerLektion.url && erLydLektion(modulbrugerLektion.url)}
						{@const modulErInspiration =
							!!modulbrugerLektion.url && erInspirationLektion(modulbrugerLektion.url)}
						{@const modulVisThumb =
							!!modulbrugerLektion.url &&
							(erVideoLektion(modulbrugerLektion.url) || modulErLyd || modulErInspiration)}
						{@const modulVisFormat = modulErInspiration ? 'Inspiration' : (modulbrugerLektion.format ?? '')}
						<svelte:element
							this={modulbrugerLektion.url ? 'a' : 'div'}
							class="lektion-card lektion-card-kompakt"
							class:lektion-card-medThumb={modulVisThumb}
							data-tone="0"
							href={modulbrugerLektion.url || undefined}
							target={modulbrugerLektion.url ? '_blank' : undefined}
							rel={modulbrugerLektion.url ? 'noopener noreferrer' : undefined}
						>
							<div class="lektion-decoration lektion-decoration-1"></div>
							<div class="lektion-decoration lektion-decoration-2"></div>
							{#if modulVisThumb}
								<div class="lektion-thumb">
									{#if modulThumbUrl}
										<img src={modulThumbUrl} alt="" loading="lazy" />
									{:else if modulErLyd}
										<div class="lektion-thumb-placeholder lektion-thumb-lyd">
											<Icon name="headphones" size={26} color="#fff" />
											<span>Lyd</span>
										</div>
									{:else if modulErInspiration}
										<div class="lektion-thumb-placeholder lektion-thumb-inspiration">
											<Icon name="lightbulb" size={32} color="#fff" />
										</div>
									{:else}
										<div class="lektion-thumb-placeholder">Zoom</div>
									{/if}
								</div>
							{/if}
							<div class="lektion-content">
								<div class="lektion-title">{modulbrugerLektion.titel}</div>
								{#if modulbrugerLektion.beskrivelse}
									<div class="lektion-description">{modulbrugerLektion.beskrivelse}</div>
								{/if}
								{#if modulbrugerLektion.url || (modulbrugerLektion.varighedMin ?? 0) > 0 || modulbrugerLektion.format}
									<div class="lektion-actions">
										{#if modulbrugerLektion.url}
											<span class="lektion-button">
												<Icon name="play" size={12} color="var(--terra)" filled />
												Begynd
											</span>
										{/if}
										{#if (modulbrugerLektion.varighedMin ?? 0) > 0 || modulVisFormat}
											<span class="lektion-duration">
												{(modulbrugerLektion.varighedMin ?? 0) > 0
													? modulbrugerLektion.varighedMin + ' min'
													: ''}{(modulbrugerLektion.varighedMin ?? 0) > 0 && modulVisFormat
													? ' · '
													: ''}{modulVisFormat}
											</span>
										{/if}
									</div>
								{/if}
							</div>
						</svelte:element>
					{/if}
					<a
						class="action-card"
						href={`/app/moduler/traening/mikrotraening/abo/${modulbrugerAktivDato}`}
					>
						{#if modulbrugerTraeningsVideo}
							<div class="traening-thumb">
								<video
									src={modulbrugerTraeningsVideo}
									autoplay
									muted
									loop
									playsinline
									preload="auto"
								></video>
								{#if modulbrugerTraeningGennemfoert}
									<div class="traening-thumb-check">
										<Icon name="check" size={12} color="#fff" />
									</div>
								{/if}
							</div>
						{:else}
							<div
								class="action-icon"
								style="background: {modulbrugerTraeningGennemfoert ? 'var(--sage)' : 'var(--tdim)'}"
							>
								<Icon
									name={modulbrugerTraeningGennemfoert ? 'check' : 'workout'}
									size={15}
									color={modulbrugerTraeningGennemfoert ? '#fff' : 'var(--terra)'}
								/>
							</div>
						{/if}
						<div class="action-text">
							<div class="action-eyebrow" style="color: var(--terra)">Træning</div>
							<div class="action-title">Dagens mikrotræning</div>
							<div class="action-meta">
								{modulbrugerTraeningGennemfoert ? 'Gennemført' : 'Korte daglige sessioner'}
							</div>
						</div>
						<Icon name="chevron-r" size={14} color="var(--text3)" />
					</a>
				</div>
			</section>

			<section class="vaner-inline-section">
				<div class="actions-header">
					<div class="eyebrow eyebrow-muted">Dagens små skridt</div>
				</div>
				{#if !modulbrugerVaneOpsaetning}
					<a class="vaner-cta" href="/app/moduler/vaner/opsaetning">
						<div>
							<div class="vaner-cta-titel">Vælg dine vaner</div>
							<div class="vaner-cta-sub">Vælg 3 daglige vaner du vil arbejde med</div>
						</div>
						<Icon name="chevron-r" size={14} color="var(--text3)" />
					</a>
				{:else}
					<div class="vaner-inline-liste">
						{#each modulbrugerVaneOpsaetning.valgteVaner as vane (vane.id)}
							{@const svar = modulbrugerVanedag?.checks?.[vane.id]}
							<div class="vane-inline-row">
								<div class="vane-inline-label">{vane.label}</div>
								<div class="vane-svar-knapper">
									{#each [{ v: 'ja' as VaneSvar, l: 'Ja' }, { v: 'delvist' as VaneSvar, l: 'Delvist' }, { v: 'nej' as VaneSvar, l: 'Nej' }] as opt (opt.v)}
										<button
											type="button"
											class="svar-knap svar-knap-{opt.v}"
											class:aktiv={svar === opt.v}
											disabled={gemmerSvar}
											onclick={() => gemVaneSvar(vane.id, opt.v)}
										>
											{opt.l}
										</button>
									{/each}
								</div>
							</div>
						{/each}

						{#if modulbrugerBonusIDag}
							{@const synligeSvar = modulbrugerBonusIDag.svarmuligheder
								.map((s, i) => ({ s, i }))
								.filter((x) => x.s.trim() !== '')}
							{@const erBonusskridt = synligeSvar.length === 1}
							<div class="vane-inline-row vane-inline-bonus" class:bonusskridt={erBonusskridt}>
								<div class="vane-inline-label">{modulbrugerBonusIDag.label}</div>
								<div class="vane-svar-knapper" class:enkel={erBonusskridt}>
									{#each synligeSvar as { s, i } (i)}
										{@const variant = i === 0 ? 'ja' : i === 1 ? 'delvist' : 'nej'}
										<button
											type="button"
											class="svar-knap svar-knap-{variant}"
											class:aktiv={modulbrugerVanedag?.bonus?.svar === i}
											disabled={gemmerSvar}
											onclick={() => gemBonusSvar(modulbrugerBonusIDag!.id, i as AboBonusSvar)}
										>
											{erBonusskridt && modulbrugerVanedag?.bonus?.svar === i ? '✓ ' : ''}{s}
										</button>
									{/each}
								</div>
							</div>
						{/if}

						{#if modulbrugerErCheckinDag}
							<div class="checkin-blok">
								<div class="checkin-titel">Ugentligt check-in</div>
								<div class="checkin-sub">Mærk efter — hvor er du på skalaen lige nu? (1 = lavt, 10 = højt)</div>
								{#each CHECKIN_SPORGSMAAL as q (q.id)}
									{@const aktuel = modulbrugerVanedag?.checkin?.[q.id as keyof CheckinSvar] ?? null}
									<div class="checkin-row">
										<div class="checkin-label">{q.label}</div>
										<div class="checkin-skala-rad">
											<input
												class="checkin-slider"
												type="range"
												min="1"
												max="10"
												step="1"
												value={aktuel ?? 5}
												disabled={gemmerSvar}
												onchange={(e) =>
													gemCheckinSvar(
														q.id,
														parseInt((e.target as HTMLInputElement).value, 10)
													)}
											/>
											<div class="checkin-vaerdi">{aktuel ?? '-'}</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			</section>

			<section class="mad-section">
				<a
					class="action-card mad-action-card"
					href={`/app/moduler/30-30-3?dato=${modulbrugerAktivDato}`}
				>
					<div class="action-icon" style="background: var(--sdim)">
						<Icon name="leaf" size={15} color="var(--sage)" />
					</div>
					<div class="action-text">
						<div class="action-eyebrow" style="color: var(--sage)">Mad</div>
						<div class="action-title">Dagens tal</div>
						<div class="mad-progress">
							<div class="mad-progress-row">
								<span class="mad-progress-label">Protein</span>
								<div class="mad-progress-track">
									<div
										class="mad-progress-fill mad-progress-protein"
										style="width: {modulbrugerProteinPct}%"
									></div>
								</div>
								<span class="mad-progress-vaerdi">
									{Math.round(modulbrugerMaaltidsTotaler.protein)}/{dagligeMaal.protein} g
								</span>
							</div>
							<div class="mad-progress-row">
								<span class="mad-progress-label">Fiber</span>
								<div class="mad-progress-track">
									<div
										class="mad-progress-fill mad-progress-fiber"
										style="width: {modulbrugerFiberPct}%"
									></div>
								</div>
								<span class="mad-progress-vaerdi">
									{Math.round(modulbrugerMaaltidsTotaler.fiber)}/{dagligeMaal.fiber} g
								</span>
							</div>
						</div>
					</div>
					<Icon name="chevron-r" size={14} color="var(--text3)" />
				</a>
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
							<div class="coaching-sub">Personlig coaching med Linn</div>
						</div>
					</div>
					<div class="coaching-arrow">
						<Icon name="arrow" size={14} color="#fff" />
					</div>
				</a>

				<a class="hjaelp-knap" href="/app/app-hjaelp">
					<div class="hjaelp-venstre">
						<div class="hjaelp-ikon" aria-hidden="true">💬</div>
						<div class="hjaelp-tekst">
							<div class="hjaelp-titel">Har du spørgsmål til appen?</div>
							<div class="hjaelp-sub">Stil dem her — jeg svarer med det samme</div>
						</div>
					</div>
					<Icon name="chevron-r" size={14} color="var(--text3)" />
				</a>
			</section>
		</div>
	</div>
{:else if userState === 'udlobet'}
	<div class="forside-c1">
		<div class="forside-body">
			<section class="c1-greeting">
				<p class="c1-tagline">{taglineForUdlobet}</p>
			</section>

			{#if dageTilbageAfBonus !== null && dageTilbageAfBonus > 0}
				<a class="bibliotek-cta" href="/app/moduler/bibliotek">
					<div class="bibliotek-cta-ikon" aria-hidden="true">
						<Icon name="book" size={20} color="#fff" />
					</div>
					<div class="bibliotek-cta-tekst">
						<div class="bibliotek-cta-titel">Gå til dit bibliotek</div>
						<div class="bibliotek-cta-sub">
							{#if dageTilbageAfBonus === 1}
								Du har 1 dag tilbage med adgang
							{:else}
								Du har {dageTilbageAfBonus} dage tilbage med adgang
							{/if}
						</div>
					</div>
					<Icon name="chevron-r" size={14} color="#fff" />
				</a>
			{/if}

			{#if tidligereForlob.length > 0}
				<section class="kob-section">
					<div class="kob-header">
						<div class="eyebrow eyebrow-muted">Mine køb</div>
						{#if dageTilbageAfBonus !== null && dageTilbageAfBonus > 0}
							<div class="kob-title">
								Stadig dine — i {dageTilbageAfBonus}
								{dageTilbageAfBonus === 1 ? 'dag' : 'dage'} til
							</div>
						{:else}
							<div class="kob-title">Tidligere forløb</div>
						{/if}
					</div>
					<div class="kob-list">
						{#each tidligereForlob as f (f.id)}
							<a class="kob-card" href="/app/moduler/bibliotek">
								<div class="kob-icon" style="background: rgba(157,99,88,.10)">
									<Icon name="path" size={16} color="#9D6358" />
								</div>
								<div class="kob-text">
									<div class="kob-name">{f.navn}</div>
									<div class="kob-meta">Forløb · gennemført</div>
									<div class="kob-expires">
										{#if dageTilbageAfBonus !== null && dageTilbageAfBonus > 0}
											Adgang til biblioteket
										{:else}
											Læseadgang udløbet
										{/if}
									</div>
								</div>
								<Icon name="chevron-r" size={14} color="var(--text3)" />
							</a>
						{/each}
					</div>
				</section>
			{/if}

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
							<div class="coaching-sub">Personlig coaching med Linn</div>
						</div>
					</div>
					<div class="coaching-arrow">
						<Icon name="arrow" size={14} color="#fff" />
					</div>
				</a>

				<a class="hjaelp-knap" href="/app/app-hjaelp">
					<div class="hjaelp-venstre">
						<div class="hjaelp-ikon" aria-hidden="true">💬</div>
						<div class="hjaelp-tekst">
							<div class="hjaelp-titel">Har du spørgsmål til appen?</div>
							<div class="hjaelp-sub">Stil dem her — jeg svarer med det samme</div>
						</div>
					</div>
					<Icon name="chevron-r" size={14} color="var(--text3)" />
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

	.bibliotek-cta {
		background: var(--sage);
		border-radius: 14px;
		padding: 14px 16px;
		display: flex;
		align-items: center;
		gap: 12px;
		text-decoration: none;
		margin-bottom: 18px;
	}
	.bibliotek-cta:active {
		opacity: 0.9;
	}
	.bibliotek-cta-ikon {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.18);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.bibliotek-cta-tekst {
		flex: 1;
		min-width: 0;
		color: #fff;
	}
	.bibliotek-cta-titel {
		font-family: var(--ff-b);
		font-weight: 600;
		font-size: calc(15px * var(--fs-scale, 1));
	}
	.bibliotek-cta-sub {
		font-size: calc(12.5px * var(--fs-scale, 1));
		opacity: 0.92;
		margin-top: 2px;
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

	.hjaelp-knap {
		margin-top: 8px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 12px 14px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		text-decoration: none;
		color: inherit;
	}

	.hjaelp-knap:hover {
		background: var(--bg2);
		border-color: var(--border2);
	}

	.hjaelp-venstre {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}

	.hjaelp-ikon {
		font-size: 20px;
		flex-shrink: 0;
	}

	.hjaelp-tekst {
		min-width: 0;
	}

	.hjaelp-titel {
		font-family: var(--ff-d);
		font-weight: 600;
		font-size: calc(13.5px * var(--fs-scale, 1));
		color: var(--text);
		line-height: 1.2;
	}

	.hjaelp-sub {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
		line-height: 1.3;
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

	/* Lektioner med video-thumbnail får et billede til venstre, så cardet
	   bliver to-kolonnet i stedet for én. */
	.lektion-card-medThumb {
		display: flex;
		gap: 12px;
		align-items: stretch;
		padding: 10px 12px;
	}
	.lektion-card-medThumb .lektion-content {
		flex: 1;
		min-width: 0;
	}
	.lektion-thumb {
		position: relative;
		flex-shrink: 0;
		width: 110px;
		border-radius: 10px;
		overflow: hidden;
		aspect-ratio: 16 / 10;
		background: rgba(0, 0, 0, 0.2);
	}
	.lektion-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.lektion-thumb-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		background: linear-gradient(135deg, #2d8cff 0%, #1565d8 100%);
		color: #fff;
		font-family: var(--ff-b);
		font-weight: 600;
		font-size: calc(13px * var(--fs-scale, 1));
		letter-spacing: 0.04em;
	}
	.lektion-thumb-lyd {
		/* Mørk plum så den står tydeligt ud mod card-baggrunden (terra/sage/gold). */
		background: linear-gradient(135deg, #5a4866 0%, #3d3148 100%);
	}
	.lektion-thumb-inspiration {
		/* Varm gul-orange som passer til lyspære/inspiration-symbolet. */
		background: linear-gradient(135deg, #e8b04a 0%, #c98a2e 100%);
	}
	.lektion-thumb-lyd span {
		font-size: calc(11px * var(--fs-scale, 1));
		opacity: 0.95;
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
		padding: 6px 13px;
		border-radius: 99px;
		background: #fff;
		color: var(--terra);
		border: none;
		font-family: var(--ff-b);
		font-size: calc(9px * var(--fs-scale, 1));
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.lektion-duration {
		font-family: var(--ff-b);
		font-size: calc(9px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		opacity: 0.85;
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

	.traening-thumb {
		position: relative;
		width: 46px;
		height: 46px;
		border-radius: 10px;
		overflow: hidden;
		flex-shrink: 0;
		background: var(--bg2);
	}

	.traening-thumb video {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.traening-thumb-check {
		position: absolute;
		right: 2px;
		bottom: 2px;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--sage);
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1.5px solid #fff;
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

	.mad-progress {
		display: flex;
		flex-direction: column;
		gap: 5px;
		margin-top: 6px;
	}

	.mad-progress-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.mad-progress-label {
		font-size: calc(10.5px * var(--fs-scale, 1));
		color: var(--text2);
		font-weight: 500;
		width: 42px;
		flex-shrink: 0;
	}

	.mad-progress-track {
		flex: 1;
		height: 5px;
		background: var(--bg2);
		border-radius: 999px;
		overflow: hidden;
	}

	.mad-progress-fill {
		height: 100%;
		border-radius: 999px;
		transition: width 0.4s ease;
	}

	.mad-progress-protein {
		background: var(--terra);
	}

	.mad-progress-fiber {
		background: var(--sage);
	}

	.mad-progress-vaerdi {
		font-size: calc(10px * var(--fs-scale, 1));
		color: var(--text3);
		font-variant-numeric: tabular-nums;
		min-width: 56px;
		text-align: right;
		flex-shrink: 0;
	}

	.lektion-card-kompakt {
		padding: 14px 16px;
		min-height: unset;
	}

	.lektion-card-kompakt .lektion-title {
		font-size: calc(15px * var(--fs-scale, 1));
	}

	.lektion-card-kompakt .lektion-description {
		font-size: calc(12px * var(--fs-scale, 1));
		margin-top: 4px;
	}

	/* ── Vaner inline ──────────────────────────────────────────── */

	.vaner-inline-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.vaner-inline-liste {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 2px 14px;
		display: flex;
		flex-direction: column;
		font-family: var(--ff-b);
	}

	.vane-inline-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 11px 0;
		border-top: 1px solid var(--border);
	}

	.vane-inline-row:first-child {
		border-top: none;
	}

	.vane-inline-label {
		flex: 1;
		min-width: 0;
		font-family: var(--ff-d);
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text);
		font-weight: 700;
		line-height: 1.25;
	}

	.vane-svar-knapper {
		display: flex;
		gap: 4px;
		flex-shrink: 0;
	}
	.vane-svar-knapper.enkel .svar-knap {
		padding: 6px 16px;
		font-size: calc(12px * var(--fs-scale, 1));
	}
	/* Bonusskridt-rækken får mere plads til label-teksten + lader knappen flyde
	   til højre. Da der kun er én knap, skal labelet have plads til at wrappe. */
	.vane-inline-row.bonusskridt {
		align-items: flex-start;
		gap: 10px;
	}
	.vane-inline-row.bonusskridt .vane-inline-label {
		flex: 1;
		white-space: normal;
		line-height: 1.35;
	}

	.svar-knap {
		padding: 5px 11px;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 999px;
		font-family: var(--ff-b);
		font-size: calc(11.5px * var(--fs-scale, 1));
		font-weight: 500;
		color: var(--text2);
		cursor: pointer;
	}

	.svar-knap:hover:not(:disabled) {
		background: var(--bg2);
	}

	.svar-knap:disabled:not(.aktiv) {
		opacity: 0.55;
		cursor: wait;
	}

	.svar-knap:disabled.aktiv {
		cursor: default;
	}

	.svar-knap.aktiv {
		background: var(--terra);
		color: #fff;
		border-color: var(--terra);
	}

	.svar-knap-ja.aktiv {
		background: var(--sage);
		border-color: var(--sage);
	}

	.svar-knap-delvist.aktiv {
		background: #c9a07a;
		border-color: #c9a07a;
	}

	.svar-knap-nej.aktiv {
		background: #b87b6e;
		border-color: #b87b6e;
	}

	.checkin-blok {
		background: var(--bg2);
		border-radius: 10px;
		padding: 12px 12px 6px;
		margin-top: 4px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.checkin-titel {
		font-family: var(--ff-d);
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.checkin-sub {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		margin-bottom: 4px;
	}

	.checkin-row {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 6px 0;
	}

	.checkin-label {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
	}

	.checkin-skala-rad {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.checkin-slider {
		flex: 1;
		accent-color: var(--terra);
	}

	.checkin-vaerdi {
		font-family: var(--ff-d);
		font-weight: 600;
		font-size: calc(14px * var(--fs-scale, 1));
		color: var(--terra);
		min-width: 22px;
		text-align: right;
	}

	.vaner-cta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		text-decoration: none;
		color: inherit;
	}

	.vaner-cta:hover {
		background: var(--bg2);
	}

	.vaner-cta-titel {
		font-family: var(--ff-d);
		font-weight: 600;
		font-size: calc(14px * var(--fs-scale, 1));
		color: var(--text);
	}

	.vaner-cta-sub {
		font-size: calc(12px * var(--fs-scale, 1));
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
