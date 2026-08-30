// ============================================================
// Hvornaar begynder traeningen i et forloeb.
//
// Kickstart skal foerst have mikrotraening fra dag 3. De to foerste
// dage handler om mad og smaa skridt, og de smaa skridt naevner ogsaa
// foerst mikrotraening fra dag 3. Foer denne fil fulgte traeningen
// forloebsdagen ét til ét, saa kortet stod der allerede dag 0.
//
// REGLEN ÉT STED: forsiden, traenings-oversigten og selve traenings-
// siden skal alle tre svare det samme. Gjorde de ikke det, kunne kunden
// gaa udenom ved at kende adressen. Derfor ligger regnestykket her, og
// de tre steder spoerger den samme funktion.
// ============================================================

/**
 * Standard: traeningen begynder paa forloebets dag 1.
 *
 * Dermed er alt uaendret for Kropsro og de byggede forloeb, hvor dag N
 * altid har givet traening N. Den eneste forskel er dag 0, hvor kortet
 * foer pegede paa en traening nummer 0 der ikke findes.
 */
export const TRAENING_START_DAG_DEFAULT = 1;

export interface TraeningStartKilde {
	/** forlob.traeningStartDag. Undefined for alle forloeb der ikke har sat den. */
	traeningStartDag?: number;
}

/**
 * Hvilken forloebsdag den foerste traening ligger paa.
 *
 * Vi tager kun imod hele tal fra 0 og op. En forkert vaerdi i databasen
 * maa ikke kunne spaerre et helt hold ude af traeningen, saa alt andet
 * falder tilbage paa standarden.
 */
export function traeningStartDag(forlob: TraeningStartKilde | null | undefined): number {
	const v = forlob?.traeningStartDag;
	if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return TRAENING_START_DAG_DEFAULT;
	return Math.floor(v);
}

/**
 * Er der overhovedet traening at vise paa den her forloebsdag.
 * Bruges af forsiden til at holde flisen vaek dag 0, 1 og 2.
 */
export function traeningErStartet(
	forlobsDag: number | null | undefined,
	forlob: TraeningStartKilde | null | undefined
): boolean {
	if (typeof forlobsDag !== 'number') return false;
	return forlobsDag >= traeningStartDag(forlob);
}

/**
 * Forloebsdag -> nummeret paa den traening hun skal have.
 *
 * Med start paa dag 3 giver dag 3 traening 1, dag 4 traening 2 og saa
 * fremdeles. Er traeningen ikke begyndt endnu, giver vi null i stedet
 * for et tal, saa kalderen ikke kommer til at linke til noget.
 */
export function traeningsdagFor(
	forlobsDag: number | null | undefined,
	forlob: TraeningStartKilde | null | undefined
): number | null {
	if (!traeningErStartet(forlobsDag, forlob)) return null;
	return (forlobsDag as number) - traeningStartDag(forlob) + 1;
}

/**
 * Hoejeste traeningsnummer hun har faaet adgang til paa den her
 * forloebsdag. Bruges af oversigten til at laase resten, og af selve
 * traenings-siden til at afvise en dag hun ikke er naaet til.
 *
 * Null betyder at ingen traening er aabnet endnu.
 */
export function hoejesteAabneTraeningsdag(
	forlobsDag: number | null | undefined,
	forlob: TraeningStartKilde | null | undefined
): number | null {
	return traeningsdagFor(forlobsDag, forlob);
}

/**
 * Maa hun aabne den her traening nu.
 *
 * Bagud er altid tilladt: har hun én gang haft adgang til en traening,
 * skal hun kunne gaa tilbage til den. Det er kun fremad vi spaerrer.
 */
export function maaAabneTraening(
	traeningsNummer: number,
	forlobsDag: number | null | undefined,
	forlob: TraeningStartKilde | null | undefined
): boolean {
	const hoejeste = hoejesteAabneTraeningsdag(forlobsDag, forlob);
	if (hoejeste === null) return false;
	return traeningsNummer >= 1 && traeningsNummer <= hoejeste;
}

/**
 * Skal traeningen spaerres paa den her forloebsdag.
 *
 * KUN forloeb der selv har udskudt traeningen bliver spaerret. Har et
 * forloeb ingen egen startdag, er den 1, og saa har traeningen altid
 * ligget aaben fra foerste faerd. Linns besked 30. august 2026: det skal
 * kun vaere Kickstart der venter.
 *
 * Tvivlen kommer kunden til gode. Ved vi ikke hvilken dag hun staar paa,
 * spaerrer vi ikke. En forkert vaerdi i databasen maa aldrig kunne laase
 * et helt hold ude af traeningen.
 */
export function traeningErSpaerret(
	forlobsDag: number | null | undefined,
	forlob: TraeningStartKilde | null | undefined
): boolean {
	if (traeningStartDag(forlob) <= TRAENING_START_DAG_DEFAULT) return false;
	if (typeof forlobsDag !== 'number') return false;
	return !traeningErStartet(forlobsDag, forlob);
}

/**
 * Teksten hun moeder, hvis hun alligevel lander paa en traening der
 * ikke er aabnet. Den skal fortaelle hvornaar der sker noget, ikke bare
 * sige nej.
 */
export function endnuIkkeStartetTekst(
	forlob: TraeningStartKilde | null | undefined,
	forlobsDag: number | null | undefined
): string {
	const start = traeningStartDag(forlob);
	if (typeof forlobsDag === 'number' && forlobsDag < start) {
		const dageTil = start - forlobsDag;
		if (dageTil === 1) return 'Træningen begynder i morgen. Vi ses her på dag ' + start + '.';
		return `Træningen begynder på dag ${start}, altså om ${dageTil} dage.`;
	}
	return 'Den træning er ikke åbnet endnu. Den kommer af sig selv, når du når dertil.';
}
