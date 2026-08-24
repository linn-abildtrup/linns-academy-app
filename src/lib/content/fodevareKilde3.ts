// ============================================================
// HVOR ET NAERINGSTAL KOMMER FRA, OG HVEM DER MAA SE VAREN.
//
// Den 24. august 2026 skiftede alle foedevarers tal til Den Danske
// Foedevaredatabase 6.1 fra DTU. Se HANDOVER-3.0.md 9.50.
//
// Filen her svarer paa to spoergsmaal, og de er forskellige:
//
//   1. HVOR KOMMER TALLET FRA?  Det staar paa hver raekke i soegningen,
//      saa kunden aldrig skal gaette.
//   2. MAA HUN SE VAREN OVERHOVEDET?  Den faelles liste er kun det der
//      kan navngives uden et maerke. Maerkevarer og retter ses kun af
//      dem der allerede bruger dem.
//
// LINNS REGLER, 24. august 2026:
//
//   Den faelles liste indeholder kun det der kan navngives UDEN et
//   maerke. Kefir og rugbroed er lige saa meget med som gulerod.
//   Cultura Kefir Naturel fra Arla er ikke.
//
//   En maerkevare eller en ret ses KUN af den kunde der allerede har
//   brugt den. Nye kunder ser dem ikke. Saadan bliver listen ren for
//   nye uden at nogen mister noget de bruger.
//
//   En scannet vare med billede af varedeklarationen ses af ALLE. Det
//   er saadan listen vokser tilbage.
//
//   Retter kunden i tallene efter en scanning, bliver varen hendes
//   alene. Saa er det ikke laengere pakkens tal.
//
//   Dubletter forsvinder for alle, ogsaa dem der bruger dem. De er den
//   samme mad med de samme tal, saa der er intet at miste. En maerkevare
//   der forsvinder har ingen erstatning, en dublet har.
//
// INTET SLETTES. Alt kan stadig LAESES, saa registrerede maaltider,
// faste maaltider og "det du plejer" bliver ved med at virke. Det her
// handler kun om hvad der kommer frem i SOEGNINGEN.
// ============================================================

import type { Fodevare } from './kost';

/** De fire slags kilde en kunde kan moede. Raekkefoelgen er tillid. */
export type Kilde3 = 'database' | 'scannet' | 'eget' | 'ukendt';

/**
 * Felterne der styrer det her. Alle er valgfrie og additive, saa en vare
 * uden dem opfoerer sig som foer.
 */
export interface KildeFelter {
	/** 'dtu' naar tallet kommer fra Foedevaredatabasen, 'linn' naar Linn
	    selv har sat det, 'scannet' naar en kunde har fotograferet
	    varedeklarationen. */
	kildeType?: 'dtu' | 'linn' | 'scannet';
	/** Foedevarens nummer i DTU 6.1, saa tallet kan foeres tilbage. */
	dtuId?: string;
	/** Sat naar varen er en dublet af en anden. Skjules for ALLE. */
	pegerPaa?: string;
	/** Sat paa maerkevarer og retter. Ses kun af dem der har brugt dem. */
	kunKendte?: boolean;
	/** Sat naar kunden har rettet i tallene efter en scanning. Saa er det
	    ikke laengere pakkens tal, og varen maa ikke deles. */
	rettetAfKunde?: boolean;
}

export type Vare3 = Fodevare & KildeFelter;

/** Ordene kunden ser. De skal bruges ens overalt. Linns valg 24. august. */
export const MAERKAT: Record<Kilde3, string> = {
	database: 'Fødevaredatabasen',
	scannet: 'Scannet',
	eget: 'Dit eget tal',
	ukendt: 'Uden kilde'
};

/** En linje der forklarer maerkatet, til den der trykker paa varen. */
export const FORKLARING: Record<Kilde3, string> = {
	database: 'Tallet er målt af Fødevareinstituttet på DTU',
	scannet: 'Tallet er læst af varedeklarationen på pakken',
	eget: 'Tallet er skrevet af den der oprettede varen',
	ukendt: 'Vi ved ikke hvor tallet kommer fra'
};

/**
 * Hvor kommer tallet fra?
 *
 * En vare kunden selv har oprettet er altid hendes eget tal, ogsaa hvis
 * den startede som en scanning. Retter hun ét tal, er det ikke laengere
 * pakkens.
 */
export function kildeAf(v: Vare3 | null | undefined): Kilde3 {
	if (!v) return 'ukendt';
	if (v.rettetAfKunde) return 'eget';
	if (v.kildeType === 'dtu' || v.kildeType === 'linn') return 'database';
	if (v.kildeType === 'scannet') return 'scannet';
	if (v.kilde === 'custom') return 'eget';
	return 'ukendt';
}

/** Maerkatet paa en raekke i soegningen. */
export function maerkatFor(v: Vare3 | null | undefined): string {
	return MAERKAT[kildeAf(v)];
}

/**
 * Skal baandet vises, det der beder hende scanne varen?
 *
 * Linns beslutning 24. august: HVER GANG. Ikke kun foerste gang, og ikke
 * kun paa de mest brugte. Saa laenge tallet er uden kilde, skal hun kunne
 * se det, hver gang hun moeder varen.
 */
export function skalBedesOmScanning(v: Vare3 | null | undefined): boolean {
	return kildeAf(v) === 'ukendt';
}

/**
 * Maa varen komme frem i soegningen for netop den her kunde?
 *
 * `hendesEgne` er de foedevare-id'er hun HAR brugt foer, altsaa
 * registreret i et maaltid, brugt i et fast maaltid eller markeret med
 * hjerte. Uden tidsgraense: en vare hun brugte for et aar siden skal
 * stadig kunne findes.
 */
export function maaSesISoegning(v: Vare3, hendesEgne: ReadonlySet<string>): boolean {
	// Dubletter forsvinder for alle. Der findes en bedre udgave af den
	// samme mad med de samme tal.
	if (v.pegerPaa) return false;
	// Maerkevarer og retter kun til dem der bruger dem.
	if (v.kunKendte) return hendesEgne.has(v.id);
	return true;
}

/**
 * Filtrerer en liste foer soegningen. Kaldes FOER `soegFodevarer`, saa
 * antallet af traeffere passer med det hun faktisk kan se.
 */
export function tilSoegning(varer: Vare3[], hendesEgne: ReadonlySet<string>): Vare3[] {
	return varer.filter((v) => maaSesISoegning(v, hendesEgne));
}

/**
 * Maa varen deles med andre kunder?
 *
 * Kun en scanning der er UROERT. I det sekund hun retter ét tal, er det
 * hendes eget og maa ikke sendes videre. Og en vare hvor tallene ikke
 * haenger sammen deles aldrig, uanset hvor den kommer fra.
 */
export function maaDeles(v: Vare3, tallenePasser: boolean): boolean {
	if (!tallenePasser) return false;
	if (v.rettetAfKunde) return false;
	return v.kildeType === 'scannet';
}

/**
 * Bruges varen af kunden i forvejen? Samler de steder hun kan have taget
 * den i brug, saa der kun er ét sted at rette hvis der kommer et mere.
 *
 * `gemte` er listen paa hendes bruger-dokument. Den er den eneste af dem
 * der raekker LAENGERE TILBAGE END 45 DAGE, se `kendteVarerEfter`.
 */
export function hendesVarer(...lister: Iterable<string>[]): Set<string> {
	const ud = new Set<string>();
	for (const liste of lister) {
		for (const id of liste) if (id) ud.add(id);
	}
	return ud;
}

/**
 * Listen paa kundens eget dokument, `kendteVarer3`.
 *
 * HVORFOR DEN FINDES. Historikken raekker kun 45 dage tilbage, og Linns
 * regel er UDEN tidsgraense: en vare hun brugte for et aar siden skal
 * stadig kunne findes. Derfor gemmes de faa varer hun har taget i brug
 * paa hende selv i stedet for at blive regnet ud hver gang.
 *
 * Den er lille. Maalt 24. august: median ÉN vare pr kunde, gennemsnit 2,7
 * og hoejeste 21. 29 procent af kunderne har ingen.
 *
 * Kun varer der ellers ville forsvinde skal med. En almindelig foedevare
 * ses af alle i forvejen, og at skrive den ville lade listen vokse uden
 * grund.
 */
export function kendteVarerEfter(
	gemte: readonly string[] | undefined,
	brugtNu: string,
	varen: Vare3 | null | undefined
): string[] | null {
	if (!varen || !varen.kunKendte) return null;
	const liste = gemte ?? [];
	if (liste.includes(brugtNu)) return null;
	return [...liste, brugtNu];
}
