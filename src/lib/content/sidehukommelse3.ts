// ============================================================
// Hukommelsen bag bundmenuen.
//
// PROBLEMET, meldt af Linn 4. september. Hver fane hentede sine ting
// forfra hver eneste gang hun trykkede paa den. Gik hun frem og tilbage
// mellem to faner ti gange, blev det samme hentet ti gange, og hver gang
// stod skaermen og hentede et kort sekund. Traening henter fem ting,
// forsiden seks.
//
// LOESNINGEN er den samme som rigtige apps bruger: vis det fanen viste
// sidst med det samme, og hent friskt i baggrunden. Lander det friske,
// glider det ind. Vente-skaermen kommer altsaa kun FOERSTE gang hun
// aabner en fane i et besoeg.
//
// PRISEN, og Linn er forelagt den: har hun lige tastet noget paa en anden
// fane, kan hun se det gamle tal et oejeblik foer det retter sig. Vi
// henter friskt med det samme, saa vinduet er et halvt sekund.
//
// HUKOMMELSEN LEVER KUN SAA LAENGE APPEN ER AABEN. Der skrives intet til
// telefonen. Lukker hun appen, er den vaek, og saa henter alt forfra som
// foer. Det er med vilje: en kopi der overlever paa telefonen ville kunne
// vise tal fra i gaar, og den slags har vi allerede haft fingrene i med
// den hurtige opstart.
//
// DEN VIGTIGSTE REGEL HER ER EJERSKABET. Alt er bundet til ét uid. Skifter
// brugeren, ryddes hele hukommelsen foer der udleveres noget som helst.
// En kunde maa aldrig kunne se et glimt af en anden kundes tal, og en
// delt telefon er ikke en teoretisk situation.
// ============================================================

const hukommelse = new Map<string, unknown>();

/** Hvilken bruger det gemte hoerer til. Null naar der intet er gemt. */
let ejer: string | null = null;

/**
 * Sikrer at hukommelsen hoerer til den her bruger.
 *
 * Er den en andens, ryddes den helt. Det sker foer BAADE opslag og
 * gemning, saa der ikke findes en vej udenom.
 */
function sikrEjer(uid: string): void {
	if (ejer !== uid) {
		hukommelse.clear();
		ejer = uid;
	}
}

/**
 * Hvad fanen viste sidst, hvis vi har set den i det her besoeg.
 *
 * Undefined betyder "aldrig set", og saa skal siden vise sin
 * vente-skaerm som foer.
 */
export function husket<T>(uid: string, noegle: string): T | undefined {
	if (!uid) return undefined;
	sikrEjer(uid);
	return hukommelse.get(noegle) as T | undefined;
}

/** Gemmer det fanen netop har hentet, saa den staar klar naeste gang. */
export function husk<T>(uid: string, noegle: string, vaerdi: T): void {
	if (!uid) return;
	sikrEjer(uid);
	hukommelse.set(noegle, vaerdi);
}

/**
 * Rydder alt. Kaldes naar hun logger ud.
 *
 * Ejerskabs-tjekket ovenfor ville fange en ny bruger alligevel, men vi
 * venter ikke paa det: der skal ikke ligge kundedata i hukommelsen paa en
 * skaerm hvor der staar Log ind.
 */
export function glemAlt(): void {
	hukommelse.clear();
	ejer = null;
}
