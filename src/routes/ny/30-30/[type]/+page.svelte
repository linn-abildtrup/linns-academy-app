<script lang="ts">
	// ============================================================
	// 30-30 beregneren, inde i maaltidet. Se SPEC-3.0.md afsnit 26.2.
	//
	// Kunden har valgt maaltidet paa oversigten, saa alt hun tilfoejer
	// her lander det rigtige sted. Maaltidstypen gaettes aldrig.
	//
	// Raekkefoelgen paa skaermen er valgt efter hvad der bruges mest:
	// det du plejer oeverst, saa soegning, saa de fire veje, og til
	// sidst hvad der allerede ligger i maaltidet.
	// ============================================================

	import { getContext } from 'svelte';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import type { Fodevare, GemtMaaltid, Maaltidstype } from '$lib/content/kost';
	import {
		MAALTIDSTYPER,
		MAALTIDSTYPE_LABELS,
		PROTEIN_MAALTIDS_MAAL,
		filtrerFodevarer
	} from '$lib/content/kost';
	import { LABELS, harProteinMaal } from '$lib/content/maaltider3';
	import { formatPortion, naeringFor } from '$lib/content/maengde3';
	import type { PlejerPost } from '$lib/content/plejer3';
	import { hentMaaltidsPlads } from '$lib/firestore/maaltider3';
	import {
		hentPlejer,
		gemMadvare,
		fortrydMadvare,
		fjernMadvare,
		gendanMadvare
	} from '$lib/firestore/plejer3';
	import { hentAlleFodevarer } from '$lib/firestore/kost';
	import { hentAdgangsskema, maaSeUdvidetNaering } from '$lib/firestore/featureAdgang3';
	import { datoNoegle } from '$lib/firestore/forside3';
	import MaengdeArk from '$lib/components/ny/MaengdeArk.svelte';
	import VaelgArk, { type Valg } from '$lib/components/ny/VaelgArk.svelte';
	import OpskriftArk from '$lib/components/ny/OpskriftArk.svelte';
	import OpskriftListe from '$lib/components/ny/OpskriftListe.svelte';
	import { hentMineCustomFodevarer } from '$lib/firestore/kost';
	import { favoritterFra, erFavorit, skiftFavorit } from '$lib/content/favoritOpskrift3';
	import { makroForPortioner } from '$lib/content/opskriftPortion3';
	import { saetFavoritOpskrift } from '$lib/firestore/favoritOpskrift3';
	import { hentOpskrifter3, type Opskrift3 } from '$lib/firestore/opskrifter3';
	import { kategoriForMaaltid } from '$lib/content/opskriftKategori3';
	import { parseOpskriftMakro } from '$lib/content/opskrifter';
	import type { Opskrift } from '$lib/content/opskrifter';
	import { gemSammensat } from '$lib/firestore/plejer3';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';

	// Faste maaltider. Se SPEC-3.0.md afsnit 26.10.
	import {
		antalTing,
		brugsstatistik,
		delLinjer,
		erAendret,
		foreslaaNavn,
		maaltidFor,
		nyeLinjer,
		rensNavn,
		sorterTilHylde,
		type Brug,
		type FastMaaltid
	} from '$lib/content/fasteMaaltider3';
	import {
		fortrydFasteLinjer,
		gemFastMaaltid,
		hentBrugshistorik,
		hentFasteMaaltider,
		laegFastMaaltidI,
		opdaterFastMaaltid,
		sletFastMaaltid
	} from '$lib/firestore/fasteMaaltider3';
	import FasteMaaltiderArk, { type FastPost } from '$lib/components/ny/FasteMaaltiderArk.svelte';
	import GemFastMaaltidArk, { type GemLinje } from '$lib/components/ny/GemFastMaaltidArk.svelte';

	// Kundens egne opskrifter. Se SPEC-3.0.md afsnit 26.11.
	import {
		dagbogsNavn,
		gaetKategorier,
		kategorierFor,
		makroFor,
		tilListePost,
		type MinOpskrift3
	} from '$lib/content/mineOpskrifter3';
	import {
		hentBrugteOpskrifter,
		hentMineOpskrifter3,
		saetKategorier3,
		sletMinOpskrift3
	} from '$lib/firestore/mineOpskrifter3';
	import MinOpskriftArk from '$lib/components/ny/MinOpskriftArk.svelte';
	import type { Kategori3 } from '$lib/content/opskriftKategori3';

	const hentUser = getContext<() => User | null>('user');
	const hentUserDoc = getContext<() => UserDoc | null>('userDoc');
	const user = $derived(hentUser());
	const userDoc = $derived(hentUserDoc());

	// Maa kunden se kulhydrat, fedt og kalorier? Skemaet hentes for sig
	// selv og maa gerne komme et halvt sekund senere. Indtil da er det
	// falsk, saa vi hellere viser for lidt end for meget.
	let visUdvidet = $state(false);

	const iDag = datoNoegle(new Date());

	const type = $derived.by<Maaltidstype>(() => {
		const t = page.params.type as Maaltidstype;
		return MAALTIDSTYPER.includes(t) ? t : 'morgenmad';
	});

	let dato = $state(page.url.searchParams.get('dato') ?? datoNoegle(new Date()));
	let poster = $state<GemtMaaltid[]>([]);
	let henter = $state(true);

	let foods = $state<Map<string, Fodevare>>(new Map());
	let plejer = $state<PlejerPost[]>([]);
	let soegeord = $state('');

	// Arket og kvitteringen
	let valgt = $state<{ food: Fodevare; saedvanlig: { portion: number; enhedId?: string } | null } | null>(null);
	let gemmer = $state(false);
	// Kvitteringen daekker begge veje: tilfoejet og fjernet. Fortryd
	// betyder derfor enten slet igen eller gendan.
	let kvittering = $state<
		| { slags: 'tilfoejet'; id: string; navn: string }
		// Et fast maaltid bliver til ét dokument pr madvare, saa Fortryd
		// skal kunne tage dem alle sammen paa én gang.
		| { slags: 'faste'; ids: string[]; navn: string }
		| { slags: 'fjernet'; maaltid: GemtMaaltid }
		// Ren besked uden Fortryd, fx naar et fast maaltid er gemt. Der er
		// intet at fortryde: hendes dagbog er ikke roert.
		| { slags: 'besked'; tekst: string }
		| null
	>(null);
	let kvitTimer: ReturnType<typeof setTimeout> | null = null;

	// De tre ark bag ikonerne.
	//
	// Madplanen er PARKERET efter Linns beslutning 11. august. Ikonet er
	// fjernet helt, ikke bare slaaet fra, saa der ikke staar noget der
	// ser halvfaerdigt ud. Motoren bag findes stadig i
	// content/foreslaaMadplan.ts og api/foreslaa-madplan, uroert.
	type Kilde = 'opskrifter' | 'faste' | 'mine';
	let aabentArk = $state<Kilde | null>(null);
	let arkHenter = $state(false);
	let opskrifter = $state<Opskrift3[]>([]);
	let egne = $state<Fodevare[]>([]);

	// ── Faste maaltider ────────────────────────────────────────
	let faste = $state<FastMaaltid[]>([]);
	let brug = $state<Map<string, Brug>>(new Map());
	/** Gem-arket er aabent. */
	let gemArk = $state(false);
	/**
	 * Det faste maaltid hun lige har lagt i, og hvad der laa i maaltidet
	 * FOER hun gjorde det. Uden `foerIds` ville en aeggemad hun tastede i
	 * forvejen blive regnet som en del af hendes morgengroed.
	 *
	 * Den lever kun saa laenge hun bliver paa skaermen. Lukker hun appen
	 * og fjerner noget tre dage senere, spoerger vi ikke, for hun kan
	 * alligevel ikke huske hvad hun lagde i, og et spoergsmaal om noget
	 * hun ikke kan huske er vaerre end intet spoergsmaal.
	 */
	let ilagt = $state<{ fast: FastMaaltid; foerIds: string[] } | null>(null);
	/** Den opskrift hun kigger paa. Vises oven paa listen. */
	let aabenOpskrift = $state<Opskrift | null>(null);

	// ── Hendes egne opskrifter ─────────────────────────────────
	// Tom for de 91 % der ingen har, og saa findes fanen slet ikke.
	let mineOpskrifter = $state<MinOpskrift3[]>([]);
	let gaettedeKategorier = $state<Map<string, Kategori3[]>>(new Map());
	let aabenEgen = $state<MinOpskrift3 | null>(null);

	// Favorit-opskrifter, altsaa bogmaerker. Se content/favoritOpskrift3.ts.
	//
	// Sandheden staar paa kundens dokument, men vi holder en lokal kopi, saa
	// hjertet skifter i samme oejeblik hun trykker. Uden den ville hun vente
	// paa at skrivningen naaede serveren og kom tilbage gennem lytTilUserDoc,
	// og et hjerte der halter efter fingeren foeles i stykker.
	//
	// null betyder "ikke roert endnu, brug det der staar paa kunden".
	let favoritRettet = $state<string[] | null>(null);
	const favoritOpskrifter = $derived(favoritRettet ?? favoritterFra(userDoc));

	const erIDag = $derived(dato === iDag);
	const kanFrem = $derived(dato < iDag);

	const UGEDAGE = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
	const MAANEDER = [
		'januar', 'februar', 'marts', 'april', 'maj', 'juni',
		'juli', 'august', 'september', 'oktober', 'november', 'december'
	];

	const datoTekst = $derived.by(() => {
		const [aar, m, d] = dato.split('-').map(Number);
		if (!aar) return '';
		const dt = new Date(aar, m - 1, d);
		const lang = `${UGEDAGE[dt.getDay()]} ${d}. ${MAANEDER[m - 1]}`;
		return erIDag ? `I dag · ${lang}` : lang.charAt(0).toUpperCase() + lang.slice(1);
	});

	function flytDag(retning: number) {
		const [aar, m, d] = dato.split('-').map(Number);
		const dt = new Date(aar, m - 1, d);
		dt.setDate(dt.getDate() + retning);
		const ny = datoNoegle(dt);
		if (ny > iDag) return;
		dato = ny;
	}

	const protein = $derived(Math.round(poster.reduce((s, m) => s + (m.totalP ?? 0), 0)));
	const fiber = $derived(Math.round(poster.reduce((s, m) => s + (m.totalF ?? 0), 0)));
	// Udvidet naering. Raekker gemt foer 11. august har dem ikke, og saa
	// taeller de bare nul med i stedet for at vaelte summen.
	const kh = $derived(Math.round(poster.reduce((s, m) => s + (m.totalKh ?? 0), 0)));
	const fedt = $derived(Math.round(poster.reduce((s, m) => s + (m.totalFedt ?? 0), 0)));
	const kcal = $derived(Math.round(poster.reduce((s, m) => s + (m.totalKcal ?? 0), 0)));
	const harMaal = $derived(harProteinMaal(type));
	const procent = $derived(Math.min(100, Math.round((protein / PROTEIN_MAALTIDS_MAAL) * 100)));

	// Soegning i fodevare-databasen. Opskrifter, favoritter og egne
	// foedevarer kommer med naar arkene bag ikonerne er bygget.
	const traef = $derived.by(() => {
		const ord = soegeord.trim();
		if (ord.length < 2) return [] as Fodevare[];
		// Kortest navn foerst: 'Skyr' foer 'Skyr med vanilje'. Det er
		// oftest den enkle vare hun leder efter.
		return filtrerFodevarer([...foods.values()], ord, 'all')
			.sort((a, b) => a.name.length - b.name.length)
			.slice(0, 8);
	});

	/** Maengden som den blev tastet, fx "1 dl" eller "100 g". Tom hvis
	    posten er et faerdigt maaltid som en opskrift. */
	function maengdeTekst(p: GemtMaaltid): string {
		const it = p.items?.[0];
		if (!it || !it.foodId || !it.portion) return '';
		return `${formatPortion(it.portion)} ${it.enhedId ?? 'g'}`;
	}

	async function indlaesDagen() {
		const uid = user?.uid;
		if (!uid) return;
		poster = await hentMaaltidsPlads(uid, dato, type);
	}

	$effect(() => {
		const uid = user?.uid;
		const d = dato;
		const t = type;
		if (!uid) return;
		let afbrudt = false;
		henter = true;
		// Skifter hun dag eller maaltid, holder vi op med at holde oeje.
		// Baandet hoerer til den skaerm hun lagde det faste maaltid i.
		ilagt = null;
		baandLukket = false;

		(async () => {
			const alle = await hentAlleFodevarer();
			const kort = new Map(alle.map((f) => [f.id, f]));
			if (afbrudt) return;
			foods = kort;
			poster = await hentMaaltidsPlads(uid, d, t);
			if (afbrudt) return;
			henter = false;
			// Vanerne hentes bagefter. De maa ikke forsinke maaltidet.
			plejer = await hentPlejer(uid, t, kort);
			const skema = await hentAdgangsskema();
			if (!afbrudt) visUdvidet = maaSeUdvidetNaering(userDoc, skema);
		})().catch((e) => {
			console.error('[ny] kunne ikke hente maaltidet', e);
			henter = false;
		});

		return () => {
			afbrudt = true;
		};
	});

	/** Henter foerst naar hun aabner arket. Ellers ville vi hente tre
	    lister hver gang hun bare vil taste en banan. */
	async function aabnKilde(kilde: Kilde) {
		const uid = user?.uid;
		if (!uid) return;
		aabentArk = kilde;
		arkHenter = true;
		try {
			if (kilde === 'opskrifter') {
				if (opskrifter.length === 0) opskrifter = await hentOpskrifter3();
				// Hendes egne hentes samtidig, for de bor paa den samme hylde.
				// Har hun ingen, findes fanen ikke, og saa koster det ét
				// tomt opslag som Firestore i forvejen har liggende lokalt.
				mineOpskrifter = await hentMineOpskrifter3(uid);
				if (mineOpskrifter.length > 0) {
					gaettedeKategorier = gaetKategorier(await hentBrugteOpskrifter(uid));
				}
			} else if (kilde === 'faste') {
				// Hentes hver gang, saa en hun lige har gemt eller slettet er
				// med. Historikken kommer fra plejer3's cache og koster
				// ingenting naar den allerede er hentet til fliserne.
				faste = await hentFasteMaaltider(uid);
				brug = brugsstatistik(await hentBrugshistorik(uid), faste);
			} else if (kilde === 'mine' && egne.length === 0) {
				egne = await hentMineCustomFodevarer(uid);
			}
		} catch (e) {
			console.error('[ny] kunne ikke hente', kilde, e);
		} finally {
			arkHenter = false;
		}
	}

	const arkTitel: Record<Kilde, string> = {
		opskrifter: 'Opskrifter',
		faste: 'Faste måltider',
		mine: 'Mine fødevarer'
	};

	const arkTom: Record<Kilde, string> = {
		opskrifter: 'Der er ingen opskrifter endnu.',
		// Faste maaltider har sit eget ark med sin egen tomme tekst, se
		// FasteMaaltiderArk. Den her bruges aldrig, men typen kraever den.
		faste: '',
		mine: 'Du har ikke lavet nogen egne fødevarer endnu. Dem laver du, når en vare ikke findes i forvejen.'
	};

	const arkPoster = $derived.by<Valg[]>(() => {
		// Opskrifter og faste maaltider har hver deres eget ark.
		if (aabentArk === 'mine') {
			return egne.map((f) => ({
				id: f.id,
				navn: f.name,
				under: `${f.p} g protein pr 100 g`
			}));
		}
		return [];
	});

	/** Hvad der sker naar hun vaelger noget i arket. */
	async function vaelgFraArk(id: string) {
		const kilde = aabentArk;
		if (!kilde) return;

		// Egne foedevarer er almindelige madvarer, saa de gaar gennem
		// maengde-arket praecis som et soegeresultat.
		if (kilde === 'mine') {
			const f = egne.find((x) => x.id === id);
			if (!f) return;
			aabentArk = null;
			valgt = { food: f, saedvanlig: null };
			return;
		}

		// Opskriften SKAL kunne ses foer den laegges i. Hun kan ikke
		// vurdere en ret ud fra titlen alene.
		if (kilde === 'opskrifter') {
			const o = opskrifter.find((x) => x.id === id);
			if (!o) return;
			aabenOpskrift = o.raa;
			return;
		}

		// Et fast maaltid er hendes eget, faerdige maaltid. Det laegges
		// direkte i, uden at hun skal se det foerst.
		const uid = user?.uid;
		if (!uid) return;
		const f = faste.find((x) => x.id === id);
		if (!f) return;
		aabentArk = null;
		gemmer = true;
		try {
			// ÉT DOKUMENT PR MADVARE, praecis som hvis hun havde trykket paa
			// dem selv. Derfor laerer "Det du plejer" af det, derfor kan hun
			// fjerne én enkelt ting, og derfor kan en linje uden makro ikke
			// snige sig ind og taelle nul. Se SPEC-3.0.md 26.10.
			const foerIds = poster.map((p) => p.id);
			const svar = await laegFastMaaltidI({ uid, dato, type, fast: f, foods });
			if (svar.ids.length === 0) {
				console.warn('[ny] intet i det faste maaltid kunne laegges i');
				return;
			}
			// Vi holder oeje med om hun retter i det bagefter, saa baandet
			// kan spoerge om det faste maaltid skal opdateres.
			//
			// MEN KUN hvis alt kom med. Er en madvare forsvundet fra
			// databasen, springes den over, og saa ville baandet spoerge
			// med det samme om hun vil gemme det uden den linje, uden at
			// hun har roert noget. Et ja ville stille og roligt klippe
			// hendes eget faste maaltid ned.
			if (svar.sprunget === 0) {
				ilagt = { fast: f, foerIds };
				baandLukket = false;
			} else {
				console.warn('[ny] linjer sprunget over i det faste maaltid:', svar.sprunget);
			}
			await indlaesDagen();
			visKvittering({ slags: 'faste', ids: svar.ids, navn: f.navn });
		} catch (e) {
			console.error('[ny] kunne ikke laegge det faste maaltid i', e);
		} finally {
			gemmer = false;
		}
	}

	// ============================================================
	// Hendes egne opskrifter
	// ============================================================

	/** Hendes egne, klar til gitteret. Maaltiderne er hendes eget valg,
	    ellers gaettet ud af historikken, ellers ingen. */
	const mineTilListen = $derived(
		mineOpskrifter.map((m) => tilListePost(m, kategorierFor(m, gaettedeKategorier)))
	);

	/** De maaltider den aabne opskrift hoerer til lige nu. */
	const aabenEgenKategorier = $derived(
		aabenEgen ? kategorierFor(aabenEgen, gaettedeKategorier) : []
	);

	function aabnEgen(id: string) {
		aabenEgen = mineOpskrifter.find((m) => m.id === id) ?? null;
	}

	/**
	 * Hun har sat maaltiderne. Visningen rettes foerst, saa chippen skifter
	 * i samme oejeblik hun trykker, og rulles tilbage hvis skrivningen
	 * fejler. Ingen fejlbesked: hun har ikke mistet noget, og et
	 * maaltids-maerke er ikke vigtigt nok til at afbryde hende.
	 */
	async function saetEgnesKategorier(kategorier: Kategori3[]) {
		const uid = user?.uid;
		const o = aabenEgen;
		if (!uid || !o) return;
		const foer = o.kategorier3;
		mineOpskrifter = mineOpskrifter.map((m) =>
			m.id === o.id ? { ...m, kategorier3: kategorier } : m
		);
		aabenEgen = { ...o, kategorier3: kategorier };
		try {
			await saetKategorier3(uid, o.id, kategorier);
		} catch (e) {
			console.warn('[ny] kunne ikke gemme maaltiderne paa opskriften', e);
			mineOpskrifter = mineOpskrifter.map((m) =>
				m.id === o.id ? { ...m, kategorier3: foer } : m
			);
			aabenEgen = { ...o, kategorier3: foer };
		}
	}

	/** Laegger en af hendes egne i dagen. Makroen er PR PORTION og ganges,
	    aldrig delt med antalPortioner. Se SPEC-3.0.md 26.9 og 26.11. */
	async function gemEgenOpskrift(portioner: number) {
		const uid = user?.uid;
		const o = aabenEgen;
		if (!uid || !o) return;
		gemmer = true;
		try {
			const m = makroFor(o, portioner);
			const svar = await gemSammensat({
				uid,
				dato,
				type,
				navn: dagbogsNavn(o, portioner),
				protein: m.protein,
				fiber: m.fiber,
				kh: m.kh,
				fedt: m.fedt,
				kcal: m.kcal
			});
			aabenEgen = null;
			aabentArk = null;
			await indlaesDagen();
			visKvittering({ slags: 'tilfoejet', ...svar });
		} catch (e) {
			console.error('[ny] kunne ikke laegge din egen opskrift i', e);
		} finally {
			gemmer = false;
		}
	}

	async function sletEgenOpskrift() {
		const uid = user?.uid;
		const o = aabenEgen;
		if (!uid || !o) return;
		try {
			await sletMinOpskrift3(uid, o.id);
			mineOpskrifter = mineOpskrifter.filter((m) => m.id !== o.id);
			aabenEgen = null;
			visKvittering({ slags: 'besked', tekst: `${o.navn} er slettet` });
		} catch (e) {
			console.error('[ny] kunne ikke slette opskriften', e);
		}
	}

	// ============================================================
	// Faste maaltider: hylden, gemningen og baandet
	// ============================================================

	/** Det maaltid hun staar i, delt og sorteret til hylden. */
	const hylde = $derived(sorterTilHylde(faste, brug, type));

	/** Protein i et fast maaltid, regnet naar hylden aabnes og ikke gemt.
	    Saa kan tallet aldrig blive forældet. */
	function proteinFor(f: FastMaaltid): number {
		let p = 0;
		for (const it of f.items ?? []) {
			const food = foods.get(it.foodId);
			if (!food) continue;
			p += naeringFor(food, it.portion ?? 0, it.enhedId).protein;
		}
		return Math.round(p);
	}

	function tilPost(f: FastMaaltid, medBadge: boolean): FastPost {
		const b = brug.get(f.id);
		const dele = [`${antalTing(f)} ting`, `${proteinFor(f)} g protein`];
		// Tallet taelles paa de 45 dage vi henter i forvejen, saa teksten
		// maa ikke love mere end den ved.
		if (b?.antal) dele.push(`brugt ${b.antal} ${b.antal === 1 ? 'gang' : 'gange'} på det seneste`);
		const m = medBadge ? maaltidFor(f, b) : undefined;
		return {
			id: f.id,
			navn: f.navn,
			under: dele.join(' · '),
			badge: m ? MAALTIDSTYPE_LABELS[m] : undefined
		};
	}

	const hyldeTil = $derived(hylde.tilMaaltidet.map((f) => tilPost(f, false)));
	const hyldeAndre = $derived(hylde.andre.map((f) => tilPost(f, true)));

	/** Det hun har i maaltidet, delt i det der kan gemmes og det der ikke kan. */
	const tilGemning = $derived(delLinjer(poster));

	/**
	 * Knappen vises kun naar der er noget at gemme, og den gemmer sig
	 * mens baandet staar der. Saa er spoergsmaalet et andet.
	 */
	const kanGemmeSomFast = $derived(tilGemning.med.length > 0 && !ilagt);

	const gemLinjer = $derived.by<GemLinje[]>(() =>
		tilGemning.med.map((it) => ({
			navn: foods.get(it.foodId)?.name ?? 'Madvare',
			maengde: it.portion ? `${formatPortion(it.portion)} ${it.enhedId ?? 'g'}` : ''
		}))
	);

	async function gemSomFast(navn: string, maaltid: Maaltidstype) {
		const uid = user?.uid;
		if (!uid || tilGemning.med.length === 0) return;
		gemmer = true;
		try {
			await gemFastMaaltid(uid, { navn: rensNavn(navn), items: tilGemning.med, maaltid });
			gemArk = false;
			// Hylden hentes forfra naeste gang den aabnes, saa den nye er med.
			faste = [];
			visKvittering({ slags: 'besked', tekst: `${rensNavn(navn)} er gemt som fast måltid` });
		} catch (e) {
			console.error('[ny] kunne ikke gemme det faste maaltid', e);
		} finally {
			gemmer = false;
		}
	}

	async function sletFast(id: string) {
		const uid = user?.uid;
		if (!uid) return;
		try {
			await sletFastMaaltid(uid, id);
			faste = faste.filter((f) => f.id !== id);
		} catch (e) {
			console.error('[ny] kunne ikke slette det faste maaltid', e);
		}
	}

	// ── Baandet ────────────────────────────────────────────────
	//
	// Vi spoerger ÉN gang, ikke pr aendring, og standarden er at der ikke
	// sker noget. De fleste aendringer er engangs-ting: hun har ikke
	// flere blaabaer i dag, men i morgen har hun. Spurgte vi hver gang,
	// ville hun langsomt tygge sit eget faste maaltid i stykker.
	let baandLukket = $state(false);

	const baandLinjer = $derived(ilagt ? nyeLinjer(poster, ilagt.foerIds) : []);
	const visBaand = $derived(!!ilagt && !baandLukket && erAendret(ilagt.fast, baandLinjer));

	async function opdaterFast() {
		const uid = user?.uid;
		const i = ilagt;
		if (!uid || !i) return;
		baandLukket = true;
		try {
			await opdaterFastMaaltid(uid, i.fast.id, baandLinjer);
			faste = [];
			visKvittering({ slags: 'besked', tekst: `${i.fast.navn} er opdateret` });
		} catch (e) {
			console.error('[ny] kunne ikke opdatere det faste maaltid', e);
		} finally {
			// Uanset hvad spoerger vi ikke igen paa den her skaerm.
			ilagt = null;
		}
	}

	function beholdFast() {
		baandLukket = true;
		ilagt = null;
	}

	/** Laegger opskriften i, med det antal portioner hun har valgt. */
	async function gemOpskrift(portioner: number) {
		const uid = user?.uid;
		const o = aabenOpskrift;
		if (!uid || !o) return;
		gemmer = true;
		try {
			const mk = parseOpskriftMakro(o.instruktioner);
			const navn = portioner === 1 ? o.titel : `${o.titel} (${formatPortion(portioner)} port.)`;
			// Alle fem tal skalerer med portionerne, og alle fem gemmes, ogsaa hvis
			// hun ikke maa se de tre sidste. Se SPEC-3.0.md 26.5. Makroen er PR
			// PORTION, saa defaultPortioner indgaar ALDRIG her, se
			// content/opskriftPortion3.ts.
			const svar = await gemSammensat({
				uid,
				dato,
				type,
				navn,
				protein: makroForPortioner(mk.protein ?? 0, portioner) ?? 0,
				fiber: makroForPortioner(mk.fiber ?? 0, portioner) ?? 0,
				kh: makroForPortioner(mk.kh ?? 0, portioner) ?? 0,
				fedt: makroForPortioner(mk.fedt ?? 0, portioner) ?? 0,
				kcal: makroForPortioner(mk.kalorier ?? 0, portioner) ?? 0
			});
			aabenOpskrift = null;
			aabentArk = null;
			await indlaesDagen();
			visKvittering({ slags: 'tilfoejet', ...svar });
		} catch (e) {
			console.error('[ny] kunne ikke laegge opskriften i', e);
		} finally {
			gemmer = false;
		}
	}

	/**
	 * Slaar bogmaerket til eller fra paa den opskrift hun kigger paa.
	 *
	 * Visningen rettes foerst, saa hjertet skifter med det samme, og rulles
	 * tilbage hvis skrivningen fejler. Vi viser ikke en fejlbesked: hun har
	 * ikke mistet noget, og et bogmaerke er ikke vigtigt nok til at afbryde
	 * hende midt i at registrere sin mad.
	 */
	async function skiftFavoritOpskrift() {
		const uid = user?.uid;
		const id = aabenOpskrift?.id;
		if (!uid || !id) return;

		const foer = favoritOpskrifter;
		const skalVaere = !erFavorit(foer, id);
		favoritRettet = skiftFavorit(foer, id);
		try {
			await saetFavoritOpskrift(uid, id, skalVaere);
		} catch (e) {
			console.warn('[ny] kunne ikke gemme favorit-opskriften', e);
			favoritRettet = foer;
		}
	}

	function aabnArk(food: Fodevare, saedvanlig: { portion: number; enhedId?: string } | null) {
		valgt = { food, saedvanlig };
	}

	/**
	 * Ét tryk paa en flise: gemmes med det samme med den maengde hun
	 * plejer. Ingen bekraeftelse, men en kvittering med Fortryd. Et "er
	 * du sikker" ville fordoble klikkene paa den vej der bruges mest.
	 */
	async function gemDirekte(p: PlejerPost) {
		const uid = user?.uid;
		const food = foods.get(p.foodId);
		if (!uid || !food) return;
		await gem(food, p.portion, p.enhedId);
	}

	async function gem(food: Fodevare, portion: number, enhedId: string | undefined) {
		const uid = user?.uid;
		if (!uid) return;
		gemmer = true;
		try {
			const svar = await gemMadvare({ uid, dato, type, food, portion, enhedId });
			valgt = null;
			soegeord = '';
			await indlaesDagen();
			visKvittering({ slags: 'tilfoejet', ...svar });
		} catch (e) {
			console.error('[ny] kunne ikke gemme madvaren', e);
		} finally {
			gemmer = false;
		}
	}

	function visKvittering(k: NonNullable<typeof kvittering>) {
		kvittering = k;
		if (kvitTimer) clearTimeout(kvitTimer);
		kvitTimer = setTimeout(() => (kvittering = null), 6000);
	}

	/**
	 * Fjerner en madvare hun allerede har tastet. Ingen "er du sikker",
	 * men en kvittering med Fortryd, praecis som naar hun tilfoejer.
	 */
	async function fjern(m: GemtMaaltid) {
		const uid = user?.uid;
		if (!uid || gemmer) return;
		gemmer = true;
		try {
			await fjernMadvare(uid, m);
			await indlaesDagen();
			visKvittering({ slags: 'fjernet', maaltid: m });
		} catch (e) {
			console.error('[ny] kunne ikke fjerne madvaren', e);
		} finally {
			gemmer = false;
		}
	}

	async function fortryd() {
		const uid = user?.uid;
		const k = kvittering;
		if (!uid || !k) return;
		kvittering = null;
		if (k.slags === 'besked') return;
		try {
			if (k.slags === 'tilfoejet') {
				await fortrydMadvare(uid, k.id);
			} else if (k.slags === 'faste') {
				// Hele det faste maaltid ud igen, og saa er der heller ikke
				// noget at spoerge om i baandet laengere.
				await fortrydFasteLinjer(uid, k.ids);
				ilagt = null;
			} else {
				await gendanMadvare(uid, k.maaltid);
			}
			await indlaesDagen();
		} catch (e) {
			console.error('[ny] kunne ikke fortryde', e);
		}
	}
</script>

<svelte:head><title>{LABELS[type]} · 30-30</title></svelte:head>

<div class="ny-pad tm-side">
	<div class="tm-hoved">
		<a class="tm-tilbage" href="/ny/30-30" aria-label="Tilbage til oversigten">‹</a>
		<h1 class="tm-navn">{LABELS[type]}</h1>
	</div>

	<!-- Datoen har sin egen linje, saa dens pile ikke forveksles med
	     pilen tilbage. To venstrepile ville betyde to ting. -->
	<div class="tt-dato">
		<button type="button" onclick={() => flytDag(-1)} aria-label="Dagen før">‹</button>
		<span>{datoTekst}</span>
		<button type="button" onclick={() => flytDag(1)} disabled={!kanFrem} aria-label="Dagen efter">›</button>
	</div>

	<div class="tm-tal">
		<div class="tm-t">
			<div class="tm-t-navn">Protein</div>
			<div class="tm-t-linje">
				<span class="tm-t-tal">
					{protein}
					{#if harMaal}<small>/ {PROTEIN_MAALTIDS_MAAL} g</small>{:else}<small>g</small>{/if}
				</span>
			</div>
			<!-- Snack har ingen stribe. Der er intet maal at naa. -->
			{#if harMaal}
				<div class="tm-t-bar"><i style="width:{procent}%"></i></div>
			{/if}
		</div>
		<div class="tm-skel"></div>
		<div class="tm-t">
			<div class="tm-t-navn">Fiber</div>
			<div class="tm-t-linje">
				<span class="tm-t-tal">{fiber} <small>g</small></span>
				<!-- Fiber er et dagsmaal, ikke et maaltidsmaal. Ingen stribe. -->
				<span class="tm-t-note">i dagens 30</span>
			</div>
		</div>
	</div>

	{#if plejer.length > 0}
		<!-- Udgave C: kortet er uroert, og de tre andre staar som en fri linje
	     lige under. Saa beholder metodens tal deres vaegt, og resten
	     foeles som noget ekstra i stedet for som en del af maalet. -->
	{#if visUdvidet}
		<div class="tm-ekstra">
			<span>Kulhydrat <b>{kh} g</b></span>
			<span>Fedt <b>{fedt} g</b></span>
			<span>Kalorier <b>{kcal}</b></span>
		</div>
	{/if}

	<div class="tm-k">Det du plejer</div>
		<div class="tm-plejer">
			{#each plejer as p (p.foodId)}
				<button type="button" class="tm-flise" disabled={gemmer} onclick={() => gemDirekte(p)}>
					<span class="tm-f-navn">{p.navn}</span>
					<span class="tm-f-m">{formatPortion(p.portion)} {p.enhedId ?? 'g'}</span>
				</button>
			{/each}
		</div>
	{/if}

	<div class="tm-soegefelt">
		<input
			type="search"
			bind:value={soegeord}
			placeholder="Søg efter mad"
			aria-label="Søg efter mad"
		/>
	</div>

	{#if traef.length > 0}
		<div class="tm-traef">
			{#each traef as f (f.id)}
				<button type="button" onclick={() => aabnArk(f, null)}>
					<span class="tm-tr-navn">{f.name}</span>
					<span class="tm-tr-makro">{f.p} g protein pr 100 g</span>
				</button>
			{/each}
		</div>
	{/if}

	<!-- Groen er Linns ting, blomme er kundens eget. Farven baerer
	     parringen, saa vi slipper for at gruppere dem i layoutet og
	     dermed for et ekstra klik. Se SPEC-3.0.md afsnit 26.2. -->
	<div class="tm-ikoner">
		<button type="button" class="tm-ikon" onclick={() => aabnKilde('opskrifter')}>
			<span class="i1">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H19v16H5.5A1.5 1.5 0 0 1 4 18.5Z" />
					<path d="M8 8h7M8 12h7M8 16h4" />
				</svg>
			</span>
			Opskrifter
		</button>
		<button type="button" class="tm-ikon" onclick={() => aabnKilde('faste')}>
			<span class="i3">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M12 20s-7-4.4-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7 2.8C19 15.6 12 20 12 20Z" />
				</svg>
			</span>
			Faste måltider
		</button>
		<button type="button" class="tm-ikon" onclick={() => aabnKilde('mine')}>
			<span class="i4">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M17 3.5 20.5 7 10 17.5l-4.5 1 1-4.5Z" />
					<path d="M4 20.5h9" />
				</svg>
			</span>
			Mine
		</button>
	</div>

	<div class="tm-k">I dette måltid</div>

	<!-- Knappen staar OVER den foerste ingrediens, ikke under listen.
	     Linns valg 12. august: ligger den under, falder den uden for
	     skaermen saa snart maaltidet fylder noget, og saa findes den
	     reelt ikke. En fjerdedel af de faste maaltider har mellem syv og
	     ti ting i sig. Se SPEC-3.0.md 26.10. -->
	{#if kanGemmeSomFast}
		<button type="button" class="fm-gem-knap" onclick={() => (gemArk = true)}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<path d="M12 20s-7-4.4-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7 2.8C19 15.6 12 20 12 20Z" />
			</svg>
			Gem som fast måltid
		</button>
	{/if}

	{#if henter}
		<div class="tt-venter"><Ventetegn variant="lille" /><span>Henter</span></div>
	{:else if poster.length === 0}
		<div class="kort rolig">Der er ikke noget her endnu.</div>
	{:else}
		<div class="tm-liste">
			{#each poster as p (p.id)}
				<div class="tm-raekke">
					<span class="tm-r-t">
						<span class="tm-r-navn">{p.navn}</span>
						<!-- Foer stod der bare "5 g", og man kunne ikke vide hvad
						     de fem gram var. Nu staar maengden og hvad hver ting
						     bidrog med, med ord paa. -->
						<span class="tm-r-under">
							{#if maengdeTekst(p)}<span class="tm-r-maengde">{maengdeTekst(p)}</span>{/if}
							<span>{Math.round(p.totalP ?? 0)} g protein</span>
							<span>{Math.round(p.totalF ?? 0)} g fiber</span>
							{#if visUdvidet && p.totalKh !== undefined}
								<span class="daempet">{Math.round(p.totalKh)} g kulhydrat</span>
							{/if}
							{#if visUdvidet && p.totalFedt !== undefined}
								<span class="daempet">{Math.round(p.totalFedt)} g fedt</span>
							{/if}
							{#if visUdvidet && p.totalKcal !== undefined}
								<span class="daempet">{Math.round(p.totalKcal)} kcal</span>
							{/if}
						</span>
					</span>
					<button
						type="button"
						class="tm-r-fjern"
						disabled={gemmer}
						onclick={() => fjern(p)}
						aria-label="Fjern {p.navn}">×</button
					>
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if valgt}
	<MaengdeArk
		food={valgt.food}
		maaltidLabel={LABELS[type]}
		saedvanlig={valgt.saedvanlig}
		{gemmer}
		{visUdvidet}
		ongem={(portion, enhedId) => gem(valgt!.food, portion, enhedId)}
		onluk={() => (valgt = null)}
	/>
{/if}

{#if aabentArk === 'opskrifter'}
	<OpskriftListe
		{opskrifter}
		henter={arkHenter}
		startKategori={kategoriForMaaltid(type)}
		favoritter={favoritOpskrifter}
		mine={mineTilListen}
		onvaelg={vaelgFraArk}
		onvaelgEgen={aabnEgen}
		onluk={() => (aabentArk = null)}
	/>
{:else if aabentArk === 'faste'}
	<FasteMaaltiderArk
		tilMaaltidet={hyldeTil}
		andre={hyldeAndre}
		maaltidLabel={LABELS[type].toLowerCase()}
		henter={arkHenter}
		onvaelg={vaelgFraArk}
		onslet={sletFast}
		onluk={() => (aabentArk = null)}
	/>
{:else if aabentArk}
	<VaelgArk
		titel={arkTitel[aabentArk]}
		poster={arkPoster}
		henter={arkHenter}
		tomTekst={arkTom[aabentArk]}
		onvaelg={vaelgFraArk}
		onluk={() => (aabentArk = null)}
	/>
{/if}

{#if gemArk}
	<GemFastMaaltidArk
		startNavn={foreslaaNavn(poster, type)}
		startMaaltid={type}
		linjer={gemLinjer}
		uden={tilGemning.uden}
		{gemmer}
		ongem={gemSomFast}
		onluk={() => (gemArk = false)}
	/>
{/if}

{#if aabenEgen}
	<MinOpskriftArk
		opskrift={aabenEgen}
		kategorier={aabenEgenKategorier}
		maaltidLabel={LABELS[type]}
		{gemmer}
		{visUdvidet}
		ongem={gemEgenOpskrift}
		onkategorier={saetEgnesKategorier}
		onslet={sletEgenOpskrift}
		ontilbage={() => (aabenEgen = null)}
	/>
{/if}

{#if aabenOpskrift}
	<OpskriftArk
		opskrift={aabenOpskrift}
		maaltidLabel={LABELS[type]}
		{gemmer}
		{visUdvidet}
		erFavorit={erFavorit(favoritOpskrifter, aabenOpskrift.id)}
		ongem={gemOpskrift}
		onfavorit={skiftFavoritOpskrift}
		ontilbage={() => (aabenOpskrift = null)}
	/>
{/if}

{#if kvittering}
	<div class="kvit">
		<span class="kvit-t">
			{#if kvittering.slags === 'tilfoejet'}
				{kvittering.navn} lagt til {LABELS[type].toLowerCase()}
			{:else if kvittering.slags === 'faste'}
				{kvittering.navn} lagt til {LABELS[type].toLowerCase()}
			{:else if kvittering.slags === 'besked'}
				{kvittering.tekst}
			{:else}
				{kvittering.maaltid.navn} er fjernet
			{/if}
		</span>
		<!-- En besked har intet at fortryde. Hendes dagbog er ikke roert. -->
		{#if kvittering.slags !== 'besked'}
			<button type="button" class="kvit-f" onclick={fortryd}>Fortryd</button>
		{/if}
	</div>
{/if}

<!-- Baandet. Det spoerger ÉN gang, det spaerrer ikke, og goer hun
     ingenting sker der ingenting. De fleste aendringer er engangs-ting,
     og et "opdatér" der lyser ville langsomt tygge hendes eget faste
     maaltid i stykker. Se SPEC-3.0.md 26.10. -->
{#if visBaand && ilagt}
	<div class="fm-baand">
		<div class="fm-b-tekst">
			Du har ændret <strong>{ilagt.fast.navn}</strong> i dag. Skal det faste måltid gemmes sådan
			fremover?
		</div>
		<div class="fm-b-knapper">
			<button type="button" class="fm-b-nej" onclick={beholdFast}>Nej, kun i dag</button>
			<button type="button" class="fm-b-ja" onclick={opdaterFast}>Ja, opdatér</button>
		</div>
	</div>
{/if}
