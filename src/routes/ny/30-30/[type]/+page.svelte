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
	import type { Adgangsbillede } from '$lib/content/adgang3';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import type { Fodevare, GemtMaaltid, Maaltidstype } from '$lib/content/kost';
	import { MAALTIDSTYPER, MAALTIDSTYPE_LABELS, PROTEIN_MAALTIDS_MAAL } from '$lib/content/kost';
	import {
	soegFodevarer,
	foerstISoegning,
	mineScanninger,
	MAKS_TRAEF
} from '$lib/content/fodevareSoeg3';
	import { LABELS, harProteinMaal } from '$lib/content/maaltider3';
	import { formatPortion, naeringFor } from '$lib/content/maengde3';
	import type { PlejerPost } from '$lib/content/plejer3';
	import { hentMaaltidsPlads } from '$lib/firestore/maaltider3';
	import {
		hentPlejer,
		gemMadvare,
		fortrydMadvare,
		fjernMadvare,
		gendanMadvare,
		opdaterMadvare
	} from '$lib/firestore/plejer3';
	import { hentFodevarer3 } from '$lib/firestore/fodevarer3';
	import { hentAdgangsskema } from '$lib/firestore/featureAdgang3';
	import { hentNaeringAdgang3 } from '$lib/firestore/naeringAdgang3';
	import { visUdvidet3 } from '$lib/content/naeringAdgang3';
	import { datoNoegle } from '$lib/firestore/forside3';
	import MaengdeArk from '$lib/components/ny/MaengdeArk.svelte';
	import OpskriftArk from '$lib/components/ny/OpskriftArk.svelte';
	import OpskriftListe from '$lib/components/ny/OpskriftListe.svelte';
	import { favoritterFra, erFavorit, skiftFavorit } from '$lib/content/favoritOpskrift3';
	import { makroForPortioner, ingrediensMaengde } from '$lib/content/opskriftPortion3';
	import { saetFavoritOpskrift } from '$lib/firestore/favoritOpskrift3';
	import { hentOpskrifter3, type Opskrift3 } from '$lib/firestore/opskrifter3';
	import { kategoriForMaaltid } from '$lib/content/opskriftKategori3';
	import { parseOpskriftMakro } from '$lib/content/opskrifter';
	import { visMakro } from '$lib/content/opskriftMakro3';
	import { hentBeregninger, type Beregninger } from '$lib/firestore/opskriftBeregning3';
	// Hun retter i en af Linns opskrifter, se HANDOVER 9.52.
	import { hentKoblinger, type Koblingskort } from '$lib/firestore/ingrediensKobling3';
	import {
		type Aendring,
		tomAendring,
		harAendringer,
		dagbogsTekst,
		regnMedAendringer,
		laegTil,
		tilGemt,
		fraGemt,
		skalSpoerge
	} from '$lib/content/opskriftAendring3';
	import {
		maengderFra,
		spurgtFra,
		gemMaengder,
		husSpurgt,
		noteFra
	} from '$lib/firestore/opskriftAendring3';
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
		MAX_BILLEDER,
		fraAiSvar,
		fraUdkast,
		tilListePost,
		tilUdkast,
		type MinOpskrift3,
		type OpskriftUdkast
	} from '$lib/content/mineOpskrifter3';
	import {
		gemMinOpskrift3,
		opretMinOpskrift3,
		saetMadBillede,
		hentBrugteOpskrifter,
		hentMineOpskrifter3,
		saetKategorier3,
		sletMinOpskrift3
	} from '$lib/firestore/mineOpskrifter3';
	import MinOpskriftArk from '$lib/components/ny/MinOpskriftArk.svelte';
	import RetOpskriftArk from '$lib/components/ny/RetOpskriftArk.svelte';
	import NyOpskriftArk from '$lib/components/ny/NyOpskriftArk.svelte';

	// Hendes egne foedevarer. Se SPEC-3.0.md afsnit 26.12.
	import {
		findesAllerede,
		fraUdkast as fodevareFraUdkast,
		tilUdkast as fodevareTilUdkast,
		tomtUdkast,
		type FodevareUdkast
	} from '$lib/content/egneFodevarer3';
	import {
		gemEgenFodevare3,
		hentEgneFodevarer3,
		sletEgenFodevare3
	} from '$lib/firestore/egneFodevarer3';
	import MineFavoritterArk from '$lib/components/ny/MineFavoritterArk.svelte';
	import TilfoejArk from '$lib/components/ny/TilfoejArk.svelte';

	// Hjertet paa en foedevare. Se SPEC-3.0.md afsnit 26.15.
	import {
		erHjertet,
		skiftHjerte,
		hjerterFra
	} from '$lib/content/hjerteFodevare3';
	import { saetHjerte3 } from '$lib/firestore/hjerteFodevare3';
	// Mine favoritter: de tre grupper samlet til ét begreb, 26. august.
	import { mineFavoritter, type FavoritRaekke } from '$lib/content/mineFavoritter3';
	import NyFodevareArk from '$lib/components/ny/NyFodevareArk.svelte';
	import { forberedBillede } from '$lib/utils/billede3';
	import { harFeatureAdgang } from '$lib/content/features';
	import type { Kategori3 } from '$lib/content/opskriftKategori3';
	import { tilSoegning, hendesVarer } from '$lib/content/fodevareKilde3';
	import { kendteVarerFra, husKendtVare } from '$lib/firestore/kendteVarer3';
	import ScanArk from '$lib/components/ny/ScanArk.svelte';
	import { hentScannedeVarer3, medScannede, delScanning, idFor, gemDeklarationsbillede } from '$lib/firestore/scannedeVarer3';

	const hentUser = getContext<() => User | null>('user');
	const hentUserDoc = getContext<() => UserDoc | null>('userDoc');
	// Forloebet afgoer om hun maa se de udvidede tal, se HANDOVER 9.38.
	const hentAdgang = getContext<() => Adgangsbillede>('adgang');
	const forlobId = $derived(hentAdgang().aktiveForlob[0]?.forlobId ?? null);
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
	/** Sat naar hun lige har taget en vare i brug, saa listen ikke skal
	    hentes forfra for at soegningen kan se den. */
	let kendteRettet = $state<string[] | null>(null);
	let scanArk = $state(false);

	let soegeord = $state('');

	// Arket og kvitteringen
	/**
	 * Maengde-arket. `retter` er sat naar hun aendrer en maengde hun
	 * allerede har tastet, i stedet for at laegge noget nyt i.
	 */
	let valgt = $state<{
		food: Fodevare;
		saedvanlig: { portion: number; enhedId?: string } | null;
		retter?: GemtMaaltid;
		/**
		 * Sat naar varen skal ind I den aabne opskrift og ikke i dagbogen.
		 * Se aabnTilfoejTilOpskrift.
		 */
		tilOpskrift?: boolean;
	} | null>(null);
	let gemmer = $state(false);
	// Kvitteringen daekker begge veje: tilfoejet og fjernet. Fortryd
	// betyder derfor enten slet igen eller gendan.
	let kvittering = $state<
		| { slags: 'tilfoejet'; id: string; navn: string }
		// Et fast maaltid bliver til ét dokument pr madvare, saa Fortryd
		// skal kunne tage dem alle sammen paa én gang.
		| { slags: 'faste'; ids: string[]; navn: string }
		| { slags: 'fjernet'; maaltid: GemtMaaltid }
		// Rettet en maengde. Fortryd saetter den gamle raekke tilbage.
		| { slags: 'rettet'; foer: GemtMaaltid }
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
	/**
	 * Arket der samler alt det der tilfoejer noget. Forslag 2 fra
	 * design-gennemgangen 12. august: maaltidsskaermen var vokset til ni
	 * lag, og hun laeste fem afsnit foer hun saa sin egen mad.
	 *
	 * Arket er en FORDELING, ikke et sted hun bliver. Vaelger hun noget,
	 * lukker det, saa der kun er ét ark aabent ad gangen og kvitteringen
	 * med Fortryd kan ses.
	 */
	let tilfoejArk = $state(false);
	let arkHenter = $state(false);
	let opskrifter = $state<Opskrift3[]>([]);
	/**
	 * De beregnede makrotal pr opskrift. Hentes sammen med opskrifterne
	 * og bruges baade i arket og naar retten laegges i maaltidet, saa det
	 * hun SER og det der bliver GEMT altid er det samme tal.
	 * Se SPEC-3.0.md 26.19.
	 */
	let beregninger = $state<Beregninger>({});

	// ── Hun retter i en af Linns opskrifter ──
	//
	// Tilstanden bor HER og ikke i arket, fordi det er siden der ejer
	// soegningen naar hun laegger en ingrediens til. Laa den i arket,
	// ville den vaere vaek i det sekund soege-arket aabnede ovenpaa.
	let koblinger = $state<Koblingskort>({});
	/** De varer hun selv har scannet. De ligger oeverst naar hun soeger. */
	let mineScannedeIds = $state<string[]>([]);
	let aabenAendring = $state<Aendring>(tomAendring());
	/** Sat mens hun soeger efter noget der skal ind I opskriften. */
	let tilfoejerTilOpskrift = $state(false);
	/**
	 * Retten hun lige har lagt i, hvis hun havde rettet i den. Den er
	 * det spoergsmaalet om at huske maengderne haenger paa. Se D1 i
	 * mockups-ret-maengde-i-opskrift.html.
	 */
	let spoergOmHusk = $state<{ opskriftId: string; titel: string; aendring: Aendring } | null>(
		null
	);
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
	/** Udkastet hun retter i. Null naar rediger-arket er lukket. */
	let retterEgen = $state<{ id: string; start: OpskriftUdkast } | null>(null);

	// ── En ny opskrift af et billede ───────────────────────────
	/** Maa hun bruge AI-opskriften. Samme flag som den gamle app. */
	let maaOprette = $state(false);
	let nyArk = $state(false);
	let nyFiler = $state<File[]>([]);
	let nyPreviews = $state<string[]>([]);
	let nyArbejder = $state(false);
	let nyFejl = $state<string | null>(null);
	/** Udkastet AI'en har laest, og billedet der skal gemmes med det. */
	let nytUdkast = $state<{ start: OpskriftUdkast; billede: Blob | null } | null>(null);
	/** Sat mens hendes foto af retten laegges op. */
	let lagerBillede = $state(false);

	// ── Egne foedevarer ────────────────────────────────────────
	/** Arket hvor hun laver eller retter en. Null naar det er lukket. */
	let fodevareArk = $state<{ id?: string; start: FodevareUdkast } | null>(null);

	// Favorit-opskrifter, altsaa bogmaerker. Se content/favoritOpskrift3.ts.
	//
	// Sandheden staar paa kundens dokument, men vi holder en lokal kopi, saa
	// hjertet skifter i samme oejeblik hun trykker. Uden den ville hun vente
	// paa at skrivningen naaede serveren og kom tilbage gennem lytTilUserDoc,
	// og et hjerte der halter efter fingeren foeles i stykker.
	//
	// null betyder "ikke roert endnu, brug det der staar paa kunden".
	let favoritRettet = $state<string[] | null>(null);

	// Hjerterne paa foedevarer. Samme moenster som hjertet: en lokal kopi,
	// saa hjertet skifter i samme oejeblik hun trykker.
	let hjerteRettet = $state<string[] | null>(null);
	const favoritOpskrifter = $derived(favoritRettet ?? favoritterFra(userDoc));
	const hjerter = $derived(hjerteRettet ?? hjerterFra(userDoc));

	/**
	 * De varer hun HAR taget i brug. To kilder, og de daekker hver sit:
	 * listen paa hendes dokument raekker uendeligt tilbage, og "det du
	 * plejer" fanger de sidste 45 dage ogsaa foer listen er fyldt ud.
	 */
	const hendesEgne = $derived(
		hendesVarer(
			kendteRettet ?? kendteVarerFra(userDoc),
			plejer.map((p) => p.foodId),
			hjerter
		)
	);

	/**
	 * MINE FAVORITTER: hendes hjerter, hendes egne og hendes egne
	 * scanninger i ÉN liste. Se content/mineFavoritter3.ts.
	 *
	 * Listen REGNES UD her og skrives aldrig. Hjertet saettes stadig kun
	 * naar hun trykker paa det, se reglen i toppen af mineFavoritter3.
	 */
	const favoritter = $derived(
		mineFavoritter({ hjerter, egne, scannedeAfHende: mineScannedeIds, foods })
	);
	/** Ligger varen paa listen i forvejen, uanset hvorfor. */
	const favoritIds = $derived(new Set(favoritter.map((r) => r.vare.id)));

	/**
	 * Er varen HENDES EGEN eller HENDES EGEN SCANNING? De ligger paa
	 * favorit-listen altid, for de findes ikke andre steder, saa linjen i
	 * maengde-arket er ikke en knap. Se favoritLinje() i mineFavoritter3.
	 */
	function altidPaaListen(id: string): boolean {
		const r = favoritter.find((x) => x.vare.id === id);
		return !!r && r.grund !== 'hjerte';
	}

	const erIDag = $derived(dato === iDag);
	const kanFrem = $derived(dato < iDag);

	const UGEDAGE = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
	const MAANEDER = [
		'januar',
		'februar',
		'marts',
		'april',
		'maj',
		'juni',
		'juli',
		'august',
		'september',
		'oktober',
		'november',
		'december'
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
		// Hele ord foerst, saa "aeg" ikke drukner i Aeggenudler, og
		// derefter korteste navn. Se content/fodevareSoeg3.ts for hvorfor
		// det er sortering og ikke et afkryds som i den gamle app.
		//
		// Filtreres FOER soegningen, saa antallet af traeffere passer med
		// det hun faktisk kan se. Dubletter er ude for alle, og
		// maerkevarer og retter kun for dem der allerede bruger dem.
		// Se content/fodevareKilde3.ts.
		//
		// HENDES EGET FOERST. Linns beslutninger 25. august: hjerter,
		// hendes egne foedevarer og de varer hun selv har scannet. De
		// gamle automatiske hjerter paa hendes egne varer taeller ikke
		// med som hjerter, se foerstISoegning.
		return soegFodevarer(
			tilSoegning([...foods.values()], hendesEgne),
			ord,
			MAKS_TRAEF,
			foerstISoegning({
				hjerter,
				egneIds: new Set(egne.map((f) => f.id)),
				scannedeAfHende: mineScannedeIds
			})
		);
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
			// Kopien foerst. Listen er 2.268 raekker, og foer stod skaermen
			// tom mens den blev hentet, ogsaa naar den laa paa telefonen.
			// Har serveren noget nyere, skiftes den stille ud under hende.
			const alle = await hentFodevarer3((friske) => {
				if (!afbrudt) foods = new Map(friske.map((f) => [f.id, f]));
			});
			// De scannede varer ses af ALLE og laegges oveni den faelles
			// liste. Se firestore/scannedeVarer3.ts.
			const scannede = await hentScannedeVarer3().catch(() => []);
			// De varer HUN selv har scannet, saa de kan ligge oeverst naar
			// hun soeger efter dem igen. Linns oenske 25. august, se
			// foerstISoegning.
			mineScannedeIds = mineScanninger(scannede, uid);
			const kort = new Map(medScannede(alle, scannede).map((f) => [f.id, f]));
			if (afbrudt) return;
			foods = kort;
			poster = await hentMaaltidsPlads(uid, d, t);
			if (afbrudt) return;
			henter = false;
			// Vanerne hentes bagefter. De maa ikke forsinke maaltidet.
			plejer = await hentPlejer(uid, t, kort);
			// To skemaer, og de er ikke det samme. AI-opskrift ligger stadig i
			// det gamle, som ogsaa styrer den gamle app. Udvidet naering er
			// lagt om til 3.0's eget, se HANDOVER 9.38.
			const [skema, naering] = await Promise.all([
				hentAdgangsskema(),
				hentNaeringAdgang3(uid, forlobId)
			]);
			if (!afbrudt) {
				visUdvidet = visUdvidet3(naering, userDoc?.visUdvidetNaering);
				maaOprette = harFeatureAdgang(userDoc, skema, 'ai-opskrift');
			}
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
				if (opskrifter.length === 0) {
					// Koblingerne er ÉT dokument og hentes her sammen med de
					// gemte tal. Uden dem kan der ikke regnes paa stedet naar
					// hun retter i en opskrift, og saa staar listen som ren
					// tekst i stedet, se OpskriftArk.
					const [o, b, k] = await Promise.all([
						hentOpskrifter3(),
						hentBeregninger(),
						hentKoblinger()
					]);
					opskrifter = o;
					beregninger = b;
					koblinger = k;
				}
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
			} else if (kilde === 'mine') {
				egne = await hentEgneFodevarer3(uid);
			}
		} catch (e) {
			console.error('[ny] kunne ikke hente', kilde, e);
		} finally {
			arkHenter = false;
		}
	}

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
			// Har hun bedt om at faa sine maengder husket, aabner retten paa
			// dem. fraGemt kaster dem vaek af sig selv hvis Linn har rettet
			// opskriften siden, se aftryk i opskriftAendring3.
			aabenAendring = fraGemt(
				maengderFra(userDoc)[o.id],
				(o.raa.ingredienser ?? []) as { navn: string; maengde: number; enhed: string }[]
			);
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
			mineOpskrifter = mineOpskrifter.map((m) => (m.id === o.id ? { ...m, kategorier3: foer } : m));
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

	function retEgen() {
		if (!aabenEgen) return;
		retterEgen = { id: aabenEgen.id, start: tilUdkast(aabenEgen) };
	}

	/**
	 * Gemmer det hun har rettet. Visningen opdateres af det vi selv har
	 * skrevet, saa arket bagved viser det nye med det samme uden at vi
	 * skal hente hele listen igen.
	 */
	async function gemRettelse(udkast: OpskriftUdkast) {
		const uid = user?.uid;
		const r = retterEgen;
		if (!uid || !r) return;
		gemmer = true;
		try {
			const data = fraUdkast(udkast);
			await gemMinOpskrift3(uid, r.id, data);
			mineOpskrifter = mineOpskrifter.map((m) => (m.id === r.id ? { ...m, ...data } : m));
			if (aabenEgen?.id === r.id) aabenEgen = { ...aabenEgen, ...data };
			retterEgen = null;
			visKvittering({ slags: 'besked', tekst: `${data.navn} er rettet` });
		} catch (e) {
			console.error('[ny] kunne ikke gemme rettelsen', e);
		} finally {
			gemmer = false;
		}
	}

	// ── En ny opskrift af et billede ───────────────────────────

	function vaelgBilleder(liste: FileList | null) {
		if (!liste) return;
		const nye = [...liste].filter((f) => f.type.startsWith('image/'));
		if (nye.length === 0) {
			// HEIC fra en iPhone kan ikke aabnes i alle browsere. Sker det,
			// skal hun vide hvorfor, ikke se en teknisk fejl.
			nyFejl = 'Det billede kan ikke bruges. Prøv at vælge det på selve telefonen.';
			return;
		}
		nyFejl = null;
		const plads = MAX_BILLEDER - nyFiler.length;
		const taget = nye.slice(0, plads);
		if (nye.length > plads) {
			nyFejl = `Der er plads til ${MAX_BILLEDER} billeder af den samme opskrift.`;
		}
		nyFiler = [...nyFiler, ...taget];
		nyPreviews = [...nyPreviews, ...taget.map((f) => URL.createObjectURL(f))];
	}

	function fjernBillede(i: number) {
		URL.revokeObjectURL(nyPreviews[i]);
		nyFiler = nyFiler.filter((_, n) => n !== i);
		nyPreviews = nyPreviews.filter((_, n) => n !== i);
	}

	function rydNy() {
		for (const p of nyPreviews) URL.revokeObjectURL(p);
		nyFiler = [];
		nyPreviews = [];
		nyFejl = null;
		nyArbejder = false;
		nyArk = false;
	}

	function blobTilBase64(blob: Blob): Promise<string> {
		return new Promise((klar, fejl) => {
			const l = new FileReader();
			l.onload = () => klar(String(l.result).split(',')[1] ?? '');
			l.onerror = () => fejl(new Error('Kunne ikke laese billedet'));
			l.readAsDataURL(blob);
		});
	}

	/**
	 * Sender billederne til AI'en og aabner gennemgangen med svaret.
	 *
	 * Billederne skaleres foerst i telefonen. Et billede lige fra
	 * kameraet er flere megabyte, og det ville baade koste hende data og
	 * gaa langsomt paa en daarlig forbindelse.
	 */
	async function analyserBilleder() {
		const u = user;
		if (!u || nyFiler.length === 0 || nyArbejder) return;
		nyArbejder = true;
		nyFejl = null;
		try {
			const saet = await Promise.all(nyFiler.map((f) => forberedBillede(f)));
			const billeder = await Promise.all(
				saet.map(async (s) => ({
					billedeBase64: await blobTilBase64(s.stor.blob),
					mediaType: s.stor.mime
				}))
			);
			const svar = await fetch('/api/analyser-opskrift', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${await u.getIdToken()}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ billeder })
			});
			if (!svar.ok) {
				const krop = (await svar.json().catch(() => ({}))) as { message?: string };
				throw new Error(krop.message ?? 'Kunne ikke læse opskriften. Prøv igen.');
			}
			const laest = fraAiSvar(await svar.json());
			if (laest.fejl || !laest.udkast) {
				nyFejl = laest.fejl ?? 'Kunne ikke læse opskriften. Prøv igen.';
				return;
			}
			// Det FOERSTE billede gemmes med opskriften. AI'en har allerede
			// laest de andre, saa de behoever ikke ligge i Storage.
			nytUdkast = { start: laest.udkast, billede: saet[0].stor.blob };
			rydNy();
		} catch (e) {
			console.error('[ny] kunne ikke analysere opskriften', e);
			nyFejl = e instanceof Error ? e.message : 'Kunne ikke læse opskriften. Prøv igen.';
		} finally {
			nyArbejder = false;
		}
	}

	/** Hun har gennemgaaet svaret og gemmer. Foerst nu skrives der noget. */
	async function gemNyOpskrift(udkast: OpskriftUdkast) {
		const uid = user?.uid;
		const n = nytUdkast;
		if (!uid || !n) return;
		gemmer = true;
		try {
			const data = fraUdkast(udkast);
			// Maaltidet hun staar i er et godt foerste gaet, og hun kan
			// altid rette det i arket bagefter.
			const start = kategoriForMaaltid(type);
			await opretMinOpskrift3(uid, { ...data, kategorier3: start ? [start] : [] }, n.billede);
			nytUdkast = null;
			mineOpskrifter = await hentMineOpskrifter3(uid);
			visKvittering({ slags: 'besked', tekst: `${data.navn} er gemt` });
		} catch (e) {
			console.error('[ny] kunne ikke gemme den nye opskrift', e);
		} finally {
			gemmer = false;
		}
	}

	/**
	 * Hendes foto af RETTEN, til flisen. Opskrift-fotoet roeres ikke, se
	 * mineOpskrifter3.ts.
	 */
	async function saetBilledeAfRetten(fil: File) {
		const uid = user?.uid;
		const o = aabenEgen;
		if (!uid || !o || lagerBillede) return;
		lagerBillede = true;
		try {
			const saet = await forberedBillede(fil);
			const nye = await saetMadBillede(
				uid,
				o.id,
				{ stor: saet.stor.blob, lille: saet.lille.blob },
				{ stor: o.madBilledeSti, lille: o.madBilledeStiLille }
			);
			const opdateret = { ...o, ...nye };
			mineOpskrifter = mineOpskrifter.map((m) => (m.id === o.id ? { ...m, ...nye } : m));
			aabenEgen = opdateret;
		} catch (e) {
			console.error('[ny] kunne ikke laegge billedet op', e);
			// HEIC fra en iPhone kan ikke aabnes i alle browsere. Sker det,
			// skal hun vide hvorfor og ikke se en teknisk fejl.
			visKvittering({
				slags: 'besked',
				tekst: 'Billedet kunne ikke bruges. Prøv at vælge det på selve telefonen.'
			});
		} finally {
			lagerBillede = false;
		}
	}

	// ── Egne foedevarer ────────────────────────────────────────

	/** Har hun allerede en vare der hedder det samme. Kun en advarsel. */
	const fodevareAdvarsel = $derived.by(() => {
		const a = fodevareArk;
		if (!a) return null;
		return findesAllerede(egne, a.start.navn, a.id)
			? 'Du har allerede en fødevare der hedder det samme.'
			: null;
	});

	function nyFodevare(navn = '') {
		fodevareArk = { start: tomtUdkast(navn) };
	}

	function retFodevare(id: string) {
		const f = egne.find((x) => x.id === id);
		if (!f) return;
		fodevareArk = { id, start: fodevareTilUdkast(f) };
	}

	/**
	 * Gemmer varen. Er den NY, aabner maengde-arket bagefter, saa hun kan
	 * laegge den i med det samme. Den gamle app laegger den i paa 100 g
	 * uden at spoerge, og det passer ikke til 3.0, hvor maengden altid
	 * vaelges. Hun er jo midt i at taste sit maaltid.
	 */
	async function gemFodevare(udkast: FodevareUdkast) {
		const uid = user?.uid;
		if (!uid) return;
		gemmer = true;
		try {
			const data = fodevareFraUdkast(udkast);
			const erNy = !fodevareArk?.id;
			const id = await gemEgenFodevare3(uid, data, fodevareArk?.id);
			const vare = { id, ...data };
			// Ind i den liste soegningen bruger, saa den kan findes med det
			// samme uden at hele foedevare-databasen hentes igen.
			foods = new Map(foods).set(id, vare);
			egne = erNy
				? [...egne, vare].sort((a, b) => a.name.localeCompare(b.name, 'da'))
				: egne.map((f) => (f.id === id ? vare : f));
			fodevareArk = null;
			if (erNy) {
				aabentArk = null;
				soegeord = '';
				valgt = { food: vare, saedvanlig: null };
			} else {
				visKvittering({ slags: 'besked', tekst: `${data.name} er rettet` });
			}
		} catch (e) {
			console.error('[ny] kunne ikke gemme foedevaren', e);
		} finally {
			gemmer = false;
		}
	}

	async function sletFodevare(id: string) {
		const uid = user?.uid;
		const f = egne.find((x) => x.id === id);
		if (!uid || !f) return;
		try {
			await sletEgenFodevare3(uid, id);
			egne = egne.filter((x) => x.id !== id);
			const uden = new Map(foods);
			uden.delete(id);
			foods = uden;
			visKvittering({ slags: 'besked', tekst: `${f.name} er slettet` });
		} catch (e) {
			console.error('[ny] kunne ikke slette foedevaren', e);
		}
	}

	/**
	 * Tager en vare af Mine favoritter.
	 *
	 * ÉN handling paa skaermen, tre ting bagved, og raekken ved selv
	 * hvilken. Et hjerte slaas fra, og varen bliver ved med at findes
	 * for alle. Hendes egen slettes, for den findes ikke andre steder.
	 * En scanning hun selv har lavet er delt med andre, saa den bliver
	 * staaende i den faelles samling og forsvinder kun fra HENDES liste.
	 * Se content/mineFavoritter3.ts.
	 */
	async function fjernFavorit(r: FavoritRaekke) {
		if (r.grund === 'hjerte') {
			await skiftHjertePaa(r.vare.id);
			return;
		}
		if (r.grund === 'egen') {
			await sletFodevare(r.vare.id);
			return;
		}
		// 'ingen'. En vare hun selv har scannet er DELT med andre kunder,
		// saa raekken har intet kryds og vi kommer aldrig herned. Se
		// handlingFor() i mineFavoritter3.ts.
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

	/**
	 * Lukker opskriften. Hendes aendringer kastes vaek med vilje.
	 *
	 * De huskes kun hvis hun har sagt ja til spoergsmaalet, og det
	 * spoergsmaal stilles foerst naar retten ER lagt i. Gik hun ud uden
	 * at laegge noget i, har hun ikke spist noget, og saa er der intet
	 * at huske.
	 */
	function lukOpskrift() {
		aabenOpskrift = null;
		aabenAendring = tomAendring();
	}

	/**
	 * Hun vil laegge en ingrediens til retten.
	 *
	 * Vi bruger PRAECIS den samme soegning som naar hun laegger en
	 * madvare i sit maaltid, saa hendes egne og scannede varer er med og
	 * de to lister ikke kan drive fra hinanden. Se hvad der skete med
	 * oevelses-vaelgeren 21. august, da den fik sin egen soegning.
	 */
	function aabnTilfoejTilOpskrift() {
		tilfoejerTilOpskrift = true;
		soegeord = '';
	}

	function lukTilfoejTilOpskrift() {
		tilfoejerTilOpskrift = false;
		soegeord = '';
	}

	/** Hun har valgt en vare der skal ind i opskriften. */
	function vaelgTilOpskrift(food: Fodevare) {
		tilfoejerTilOpskrift = false;
		soegeord = '';
		// Maengden saettes i det maengde-ark hun kender i forvejen. `tilOpskrift`
		// er det der faar gem() til at laegge den i RETTEN og ikke i dagbogen.
		valgt = { food, saedvanlig: null, tilOpskrift: true };
	}

	/**
	 * Hendes svar paa om maengderne skal huskes.
	 *
	 * Uanset hvad hun svarer, huskes det at hun ER blevet spurgt om netop
	 * den ret. Ellers ville baandet dukke op hver eneste gang, og saa er
	 * det en pop-up der aldrig holder op.
	 *
	 * FEJLER ALDRIG OPAD. Gaar skrivningen galt, er retten stadig lagt i
	 * hendes dagbog, og det er det vigtige. Hun faar ikke en fejl at se
	 * om noget der kun er en bekvemmelighed.
	 */
	async function svarPaaHusk(ja: boolean) {
		const uid = user?.uid;
		const s = spoergOmHusk;
		spoergOmHusk = null;
		if (!uid || !s) return;
		const o = opskrifter.find((x) => x.id === s.opskriftId);
		try {
			if (ja && o) {
				await gemMaengder(
					uid,
					s.opskriftId,
					tilGemt(
						s.aendring,
						(o.raa.ingredienser ?? []) as { navn: string; maengde: number; enhed: string }[]
					)
				);
			}
			await husSpurgt(uid, s.opskriftId);
		} catch (e) {
			console.error('[ny] kunne ikke gemme svaret om at huske maengder', e);
		}
	}

	/** Laegger opskriften i, med det antal portioner hun har valgt. */
	async function gemOpskrift(portioner: number, aendring: Aendring) {
		const uid = user?.uid;
		const o = aabenOpskrift;
		if (!uid || !o) return;
		gemmer = true;
		const rettet = harAendringer(aendring);
		try {
			// HAR HUN ROERT NOGET, REGNES DER PAA STEDET.
			//
			// Ellers bruges det gemte tal, som med vilje er frosset. De to
			// kan give en lille forskel paa den samme mad, og Linn har sagt
			// ja til det 25. august. Det afgoerende er at det tal der
			// gemmes er PRAECIS det tal arket viste hende, og det er derfor
			// begge veje gaar gennem de samme to funktioner som arket.
			const mk = visMakro(o.id, o.instruktioner, beregninger, parseOpskriftMakro(o.instruktioner));
			const paaStedet = rettet
				? regnMedAendringer(
						(o.ingredienser ?? []).map((i) => ({
							...i,
							maengde: ingrediensMaengde(i.maengde, o.defaultPortioner, portioner)
						})),
						aendring,
						koblinger,
						foods
					)
				: null;
			// Navnet siger ikke noget om at hun har rettet. Det staar paa
			// linjen UNDER i dagbogen, saa retten stadig kan kendes paa sit
			// eget navn. Linns valg 25. august.
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
				// "Dine mængder · 2 rettet". Uden den kan hverken hun eller
				// Linn se at hun spiste noget andet end det der staar, og om
				// tre uger ligner det en fejl i tallene.
				noteTekst: rettet ? dagbogsTekst(aendring) : undefined,
				protein: paaStedet
					? paaStedet.makro.protein
					: (makroForPortioner(mk.protein ?? 0, portioner) ?? 0),
				fiber: paaStedet
					? paaStedet.makro.fiber
					: (makroForPortioner(mk.fiber ?? 0, portioner) ?? 0),
				kh: paaStedet ? paaStedet.makro.kh : (makroForPortioner(mk.kh ?? 0, portioner) ?? 0),
				fedt: paaStedet ? paaStedet.makro.fedt : (makroForPortioner(mk.fedt ?? 0, portioner) ?? 0),
				kcal: paaStedet
					? paaStedet.makro.kalorier
					: (makroForPortioner(mk.kalorier ?? 0, portioner) ?? 0)
			});
			// Spoergsmaalet om at huske maengderne stilles FOERST naar retten
			// er lagt i, saa det ikke ligger i vejen mens hun arbejder, og
			// kun én gang pr opskrift. Se skalSpoerge.
			const spoerg = skalSpoerge(aendring, spurgtFra(userDoc).includes(o.id));
			aabenOpskrift = null;
			aabentArk = null;
			aabenAendring = tomAendring();
			await indlaesDagen();
			visKvittering({ slags: 'tilfoejet', ...svar });
			if (spoerg) spoergOmHusk = { opskriftId: o.id, titel: o.titel, aendring };
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

	/**
	 * Slaar hjertet til eller fra paa en foedevare.
	 *
	 * Visningen rettes foerst, saa hjertet skifter med det samme, og rulles
	 * tilbage hvis skrivningen fejler. Ingen fejlbesked: hun har ikke mistet
	 * noget, og en hjerte er ikke vigtig nok til at afbryde hende midt i at
	 * registrere sin mad. Samme aftale som hjertet paa en opskrift.
	 */
	async function skiftHjertePaa(foodId: string) {
		const uid = user?.uid;
		if (!uid || !foodId) return;
		const foer = hjerter;
		const skalVaere = !erHjertet(foer, foodId);
		hjerteRettet = skiftHjerte(foer, foodId);
		try {
			await saetHjerte3(uid, foodId, skalVaere);
		} catch (e) {
			console.warn('[ny] kunne ikke gemme hjertet', e);
			hjerteRettet = foer;
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
		tilfoejArk = false;
		await gem(food, p.portion, p.enhedId);
	}

	/**
	 * Gemmer en scannet vare. Den lander som KUNDENS EGEN indtil videre.
	 *
	 * At dele den med alle kraever en aendring i firestore.rules, og den
	 * skal forelaegges Linn foer den udgives, se regel 4. Varen baerer
	 * allerede kildeType og billedet, saa delingen kan taendes bagefter
	 * uden at nogen skal scanne igen.
	 */
	async function gemScannetVare(v: {
		navn: string;
		barcode: string | null;
		tal: { protein: number | null; fiber: number | null; kh: number | null; fedt: number | null; kcal: number | null };
		rettet: boolean;
		billede: Blob | null;
	}) {
		const uid = user?.uid;
		if (!uid) return;

		// HAR HUN IKKE RETTET, DELES VAREN MED ALLE. Tallene er
		// producentens egne og der ligger et billede bag. Retter hun ét
		// tal, er det ikke laengere pakkens, og saa bliver den kun hendes.
		// Linns regel 24. august, se HANDOVER 9.51.
		// Uden billede er der intet bevis, og saa deles varen ikke. Har hun
		// skrevet tallene selv, bliver den kun hendes.
		if (!v.rettet && v.tal.protein !== null && v.billede) {
			const vareId = idFor(v.barcode);
			const billedeSti = `deklarationer/${uid}/${vareId}`;
			const billedeUrl = await gemDeklarationsbillede(uid, vareId, v.billede);
			const delt = await delScanning(uid, {
				navn: v.navn,
				barcode: v.barcode,
				p: v.tal.protein,
				f: v.tal.fiber,
				kh: v.tal.kh,
				fedt: v.tal.fedt,
				kcal: v.tal.kcal,
				billedeUrl,
				billedeSti: billedeUrl ? `${billedeSti}.${v.billede.type.includes('webp') ? 'webp' : 'jpg'}` : null
			});
			// Sagde reglen nej, har en anden kunde scannet den samme
			// stregkode foer hende. Saa bruger vi den der ligger.
			const id2 = delt ?? idFor(v.barcode);
			const friske = await hentScannedeVarer3().catch(() => []);
			const fundet = friske.find((x) => x.id === id2);
			if (fundet) {
				foods = new Map(foods).set(fundet.id, fundet as Fodevare);
				scanArk = false;
				aabnArk(fundet as Fodevare, null);
				return;
			}
		}

		const id = await gemEgenFodevare3(uid, {
			name: v.navn,
			cat: 'andet',
			p: v.tal.protein ?? 0,
			f: v.tal.fiber ?? 0,
			kh: v.tal.kh ?? undefined,
			fedt: v.tal.fedt ?? undefined,
			kcal: v.tal.kcal ?? undefined,
			kilde: 'custom',
			// Baerer hvor tallet kommer fra, saa maerket i soegningen er
			// rigtigt fra foerste sekund. Se content/fodevareKilde3.ts.
			...(v.rettet ? {} : { kildeType: 'scannet' }),
			...(v.rettet ? { rettetAfKunde: true } : {}),
			...(v.barcode ? { barcode: v.barcode } : {})
		} as never);
		const vare = { id, name: v.navn, cat: 'andet', p: v.tal.protein ?? 0, f: v.tal.fiber ?? 0,
			kh: v.tal.kh ?? undefined, fedt: v.tal.fedt ?? undefined, kcal: v.tal.kcal ?? undefined,
			kilde: 'custom' } as Fodevare;
		foods = new Map(foods).set(id, vare);
		egne = [...egne, vare];
		scanArk = false;
		// Maengde-arket aabner af sig selv, saa hun kan laegge varen i med
		// det samme. Samme moenster som en ny egen foedevare, se 9.12.
		aabnArk(vare, null);
	}

	/** Fra tilfoej-arket: en traeffer aabner maengden, og arket lukker. */
	function vaelgTraef(food: Fodevare) {
		tilfoejArk = false;
		aabnArk(food, null);
	}

	/** Fra tilfoej-arket: en hylde aabnes, og arket lukker. */
	function aabnKildeFraArk(kilde: Kilde) {
		tilfoejArk = false;
		void aabnKilde(kilde);
	}

	/** Fra tilfoej-arket: lav en madvare selv, og arket lukker. */
	function lavSelvFraArk(navn: string) {
		tilfoejArk = false;
		nyFodevare(navn);
	}

	/**
	 * Hun trykker paa en linje hun allerede har tastet, for at rette
	 * maengden. Linns beslutning 12. august: kan hun vaelge noget til sit
	 * maaltid, skal hun ogsaa kunne rette det. Foer kunne hun kun slette.
	 *
	 * Kun linjer der ER en madvare kan rettes. En linje fra en opskrift
	 * har hverken foodId eller maengde, saa der er intet at skrue paa.
	 */
	function retMaengde(m: GemtMaaltid) {
		const it = m.items?.[0];
		const food = it?.foodId ? foods.get(it.foodId) : undefined;
		if (!food || !it?.portion) return;
		valgt = {
			food,
			saedvanlig: { portion: it.portion, enhedId: it.enhedId },
			retter: m
		};
	}

	/** Kan linjen rettes, eller kan den kun fjernes. */
	function kanRettes(m: GemtMaaltid): boolean {
		const it = m.items?.[0];
		return !!it?.foodId && !!it.portion && foods.has(it.foodId);
	}

	async function gem(food: Fodevare, portion: number, enhedId: string | undefined) {
		const uid = user?.uid;
		if (!uid) return;

		// Skal varen ind I opskriften, roeres dagbogen slet ikke. Den
		// lander som en linje i retten, og tallene foelger foerst med naar
		// hun trykker "Læg i".
		if (valgt?.tilOpskrift) {
			aabenAendring = laegTil(aabenAendring, {
				foodId: food.id,
				navn: food.name,
				portion,
				enhedId
			});
			valgt = null;
			return;
		}

		const retter = valgt?.retter;
		gemmer = true;
		// Er varen en af dem der ellers ville forsvinde for hende, huskes
		// det at hun bruger den. Fejler aldrig opad, se kendteVarer3.ts.
		void husKendtVare(uid, userDoc, food).then((ny) => {
			if (ny) kendteRettet = ny;
		});
		try {
			if (retter) {
				await opdaterMadvare({ uid, maaltidId: retter.id, food, portion, enhedId });
				valgt = null;
				await indlaesDagen();
				visKvittering({ slags: 'rettet', foer: retter });
				return;
			}
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
			} else if (k.slags === 'rettet') {
				// Saetter hele den gamle raekke tilbage, med samme dokument-id.
				await gendanMadvare(uid, k.foer);
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
		<button type="button" onclick={() => flytDag(1)} disabled={!kanFrem} aria-label="Dagen efter"
			>›</button
		>
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

	<!-- Forslag 2 fra design-gennemgangen 12. august: ÉN knap i stedet for
	     fem afsnit. Det du plejer, soegningen, traefferne og de tre hylder
	     ligger nu i tilfoej-arket. Skaermen er tal, knap og mad.
	     Se SPEC-3.0.md 26.17. -->
	<button type="button" class="tm-tilfoej" onclick={() => (tilfoejArk = true)}>
		+ Tilføj til {LABELS[type].toLowerCase()}
	</button>

	<div class="tm-k">I dette måltid</div>

	{#if henter}
		<div class="tt-venter"><Ventetegn variant="lille" /><span>Henter</span></div>
	{:else if poster.length === 0}
		<div class="kort rolig">Der er ikke noget her endnu.</div>
	{:else}
		<div class="tm-liste">
			{#each poster as p (p.id)}
				<div class="tm-raekke">
					<!-- Et tryk paa linjen retter maengden. Kan hun vaelge noget
					     til sit maaltid, skal hun ogsaa kunne rette det, ikke
					     kun slette det. Linns beslutning 12. august.
					     En linje fra en opskrift har ingen maengde at skrue paa,
					     og saa er den ikke en knap. -->
					<svelte:element
						this={kanRettes(p) ? 'button' : 'span'}
						class="tm-r-t"
						role={kanRettes(p) ? 'button' : undefined}
						type={kanRettes(p) ? 'button' : undefined}
						onclick={kanRettes(p) ? () => retMaengde(p) : undefined}
						aria-label={kanRettes(p) ? `Ret mængden af ${p.navn}` : undefined}
					>
						<span class="tm-r-navn">{p.navn}</span>
						<!-- "Dine mængder · 2 rettet" naar hun har rettet i en af
						     Linns opskrifter. Uden den kan hverken hun eller Linn
						     se at hun spiste noget andet end det der staar, og om
						     tre uger ligner det en fejl i tallene. -->
						{#if noteFra(p)}
							<span class="tm-r-note">{noteFra(p)}</span>
						{/if}
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
					</svelte:element>
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

	<!-- Gem som fast maaltid ligger nu UNDER maden. Den laa foer mellem
	     overskriften og den foerste ingrediens, fordi den ellers faldt
	     uden for skaermen. Med forslag 2 er der ikke laengere fem afsnit
	     over maden, saa den kan ligge hvor den hoerer til: efter det den
	     handler om. -->
	{#if kanGemmeSomFast}
		<button type="button" class="fm-gem-knap" onclick={() => (gemArk = true)}>
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				aria-hidden="true"
			>
				<circle cx="12" cy="12" r="8.5" />
				<circle cx="12" cy="12" r="3.8" />
			</svg>
			Gem som fast måltid
		</button>
	{/if}
</div>

{#if scanArk}
	<ScanArk ongem={gemScannetVare} onluk={() => (scanArk = false)} />
{/if}

{#if tilfoejArk}
	<TilfoejArk
		maaltidLabel={LABELS[type]}
		{plejer}
		bind:soegeord
		{traef}
		{hjerter}
		{favoritter}
		{gemmer}
		onplejer={gemDirekte}
		onvaelg={vaelgTraef}
		onhjerte={skiftHjertePaa}
		onlavSelv={lavSelvFraArk}
		onscan={() => { tilfoejArk = false; scanArk = true; }}
		onkilde={aabnKildeFraArk}
		onluk={() => (tilfoejArk = false)}
	/>
{/if}

{#if tilfoejerTilOpskrift}
	<!-- SAMME ARK OG SAMME SOEGNING som naar hun laegger en madvare i sit
	     maaltid, bare uden hylderne. To soegninger ved siden af hinanden
	     ville drive fra hinanden, se hvad der skete med oevelses-vaelgeren
	     21. august. -->
	<TilfoejArk
		maaltidLabel={LABELS[type]}
		titel="Tilføj til retten"
		kunSoegning
		plejer={[]}
		bind:soegeord
		{traef}
		{hjerter}
		{gemmer}
		onplejer={() => {}}
		onvaelg={vaelgTilOpskrift}
		onhjerte={skiftHjertePaa}
		onlavSelv={lavSelvFraArk}
		onscan={() => {
			tilfoejerTilOpskrift = false;
			scanArk = true;
		}}
		onkilde={() => {}}
		onluk={lukTilfoejTilOpskrift}
	/>
{/if}

{#if spoergOmHusk}
	<!-- D1 fra tegningen. Et bloedt baand og ikke en pop-up: en pop-up
	     ville laegge sig hen over kvitteringen med Fortryd. Samme moenster
	     som naar hun retter i et fast maaltid, se 9.10. -->
	<div class="op-husk" class:over-kvit={!!kvittering}>
		<div class="op-husk-t">Skal jeg huske dine mængder til den her ret?</div>
		<div class="op-husk-u">
			Så åbner den med dine tal næste gang. Du kan altid sætte den tilbage.
		</div>
		<div class="op-husk-rk">
			<button type="button" class="op-husk-ja" onclick={() => svarPaaHusk(true)}>Ja tak</button>
			<button type="button" class="op-husk-nej" onclick={() => svarPaaHusk(false)}>Nej</button>
		</div>
	</div>
{/if}

{#if valgt}
	<MaengdeArk
		food={valgt.food}
		maaltidLabel={LABELS[type]}
		saedvanlig={valgt.saedvanlig}
		{gemmer}
		{visUdvidet}
		retter={!!valgt.retter}
		tilOpskrift={!!valgt.tilOpskrift}
		erFavorit={favoritIds.has(valgt.food.id)}
		altidPaaListen={altidPaaListen(valgt.food.id)}
		onfavorit={altidPaaListen(valgt.food.id) ? null : () => skiftHjertePaa(valgt!.food.id)}
		onret={egne.some((f) => f.id === valgt!.food.id) ? () => retFodevare(valgt!.food.id) : null}
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
		kanOprette={maaOprette}
		onvaelg={vaelgFraArk}
		onvaelgEgen={aabnEgen}
		onny={() => (nyArk = true)}
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
{:else if aabentArk === 'mine'}
	<MineFavoritterArk
		raekker={favoritter}
		henter={arkHenter}
		onvaelg={vaelgFraArk}
		onfjern={fjernFavorit}
		onny={() => nyFodevare()}
		onscan={() => {
			aabentArk = null;
			scanArk = true;
		}}
		onluk={() => (aabentArk = null)}
	/>
{/if}

{#if fodevareArk}
	<NyFodevareArk
		start={fodevareArk.start}
		titel={fodevareArk.id ? 'Ret fødevaren' : 'Ny fødevare'}
		gemTekst={fodevareArk.id ? 'Gem ændringerne' : 'Gem og vælg mængde'}
		{gemmer}
		{visUdvidet}
		advarsel={fodevareAdvarsel}
		ongem={gemFodevare}
		onluk={() => (fodevareArk = null)}
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
		onret={retEgen}
		onbillede={saetBilledeAfRetten}
		{lagerBillede}
		onslet={sletEgenOpskrift}
		ontilbage={() => (aabenEgen = null)}
	/>
{/if}

{#if nyArk}
	<NyOpskriftArk
		filer={nyFiler}
		previews={nyPreviews}
		arbejder={nyArbejder}
		fejl={nyFejl}
		onvaelg={vaelgBilleder}
		onfjern={fjernBillede}
		onanalyser={analyserBilleder}
		onluk={rydNy}
	/>
{/if}

{#if nytUdkast}
	<RetOpskriftArk
		start={nytUdkast.start}
		titel="Se opskriften efter"
		gemTekst="Gem opskriften"
		{gemmer}
		{visUdvidet}
		ongem={gemNyOpskrift}
		onluk={() => (nytUdkast = null)}
	/>
{/if}

{#if retterEgen}
	<RetOpskriftArk
		start={retterEgen.start}
		titel="Ret opskriften"
		gemTekst="Gem ændringerne"
		{gemmer}
		{visUdvidet}
		ongem={gemRettelse}
		onluk={() => (retterEgen = null)}
	/>
{/if}

{#if aabenOpskrift}
	<OpskriftArk
		opskrift={aabenOpskrift}
		maaltidLabel={LABELS[type]}
		{gemmer}
		{visUdvidet}
		erFavorit={erFavorit(favoritOpskrifter, aabenOpskrift.id)}
		{beregninger}
		ongem={gemOpskrift}
		onfavorit={skiftFavoritOpskrift}
		ontilbage={lukOpskrift}
		aendring={aabenAendring}
		onaendring={(a) => (aabenAendring = a)}
		ontilfoej={aabnTilfoejTilOpskrift}
		{koblinger}
		varer={foods}
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
			{:else if kvittering.slags === 'rettet'}
				Mængden af {kvittering.foer.navn} er rettet
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
			Du har ændret <strong>{ilagt.fast.navn}</strong> i dag. Skal det faste måltid gemmes sådan fremover?
		</div>
		<div class="fm-b-knapper">
			<button type="button" class="fm-b-nej" onclick={beholdFast}>Nej, kun i dag</button>
			<button type="button" class="fm-b-ja" onclick={opdaterFast}>Ja, opdatér</button>
		</div>
	</div>
{/if}
