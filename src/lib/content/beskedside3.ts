// ============================================================
// Reglerne bag Beskeder i 3.0. Ren logik, ingen database.
//
// Beskeder samler det der foer laa to steder: samtalen med Linn AI og
// de spoergsmaal kunden har sendt videre til Linn. Linns beslutning
// 16. august 2026: det er det samme i hendes verden, saa det er én side
// med to faner, praecis som den gamle app goer.
//
// Filen hedder beskedSIDE, fordi content/beskeder3.ts allerede findes og
// er noget andet, nemlig linjerne i "Til dig lige nu" paa forsiden.
//
// TO REGLER DER ER DYRE AT GENOPDAGE:
//
// 1. Vejen ind til Linn gaar gennem AI'en. Der findes IKKE et
//    skrivefelt paa fanen Linn. Hun spoerger AI'en, og er hun ikke
//    tilfreds, sender hun netop DET spoergsmaal videre.
// 2. Adgangen afgoeres HER og ikke i det delte adgangs-skema. Skemaet
//    styrer ogsaa den gamle app, saa et flueben der ville aabne Linn AI
//    for Kickstart i 3.0 ville aabne den for de 760 i drift samtidig.
//    Linns besked 16. august: hold det uden om den gamle app.
// ============================================================

export type BeskedFane3 = 'ai' | 'linn';

export interface BeskedAdgang3 {
	/** Maa hun snakke med Linn AI. */
	ai: boolean;
	/** Maa hun sende et spoergsmaal videre til Linn selv. */
	linn: boolean;
}

/**
 * Hvad hun maa. Linns regel 16. august 2026, i to linjer:
 *
 *   Alle kan skrive til Linn AI, ogsaa et medlem der kun har koebt appen.
 *   Kun kunder paa et forloeb kan sende spoergsmaalet videre til Linn.
 *
 * Reglen staar HER og ikke i det delte skema, se toppen af filen. Det
 * betyder ogsaa at et bygget forloeb, fx SommerRo, taeller med: det ER
 * et forloeb, og saa maa hun skrive til Linn.
 */
export function beskedAdgang3(harAktivtForlob: boolean): BeskedAdgang3 {
	return { ai: true, linn: harAktivtForlob };
}

/**
 * Fanerne hun skal se, i den raekkefoelge de staar.
 *
 * Tom liste betyder at hun ikke har adgang til noget af det. Det kan
 * ikke ske med reglen ovenfor, men skaermen kan svare paa det alligevel,
 * saa den ikke staar tom hvis reglen en dag bliver aendret.
 */
export function beskedFaner3(adgang: BeskedAdgang3): BeskedFane3[] {
	const faner: BeskedFane3[] = [];
	if (adgang.ai) faner.push('ai');
	if (adgang.linn) faner.push('linn');
	return faner;
}

/**
 * Skal fanerakken tegnes. Én fane er ingen fane: har hun kun Linn AI,
 * ville en raekke med ét punkt kun fortaelle hende hvad hun ikke har.
 */
export function visFaneraekke3(faner: BeskedFane3[]): boolean {
	return faner.length > 1;
}

/**
 * Hvilken fane siden aabner paa.
 *
 * Linns beslutning 16. august: altid Linn AI, ogsaa naar der ligger et
 * nyt svar. Prikken paa den anden fane siger at der er noget. Skiftede
 * siden selv fane, ville hun miste det hun sidst skrev.
 *
 * `oenske` er et eksplicit valg udefra, altsaa ?fane=linn. Den kommer
 * fra "Nyt svar fra Linn" paa forsiden, hvor hun HAR sagt hvad hun vil.
 * Et oenske hun ikke har adgang til bliver ignoreret.
 */
export function startFane3(faner: BeskedFane3[], oenske?: string | null): BeskedFane3 | null {
	if (faner.length === 0) return null;
	if (oenske === 'linn' || oenske === 'ai') {
		if (faner.includes(oenske)) return oenske;
	}
	return faner[0];
}

// ── Svar fra Linn ────────────────────────────────────────────

/** Det mindste vi skal bruge om et spoergsmaal hun har sendt videre. */
export interface SvarKilde3 {
	id: string;
	spoergsmaal: string;
	svar?: string;
	/** Hvornaar Linn svarede, i ms. Mangler den, er der ikke svaret. */
	besvaretMs?: number;
}

/**
 * Det nyeste svar hun ikke har set endnu.
 *
 * `senestLaestMs` er userDoc.senestSpoergsmaalLaestAt, altsaa det samme
 * felt den gamle app bruger. Derfor foelges de to flader ad: har hun
 * laest svaret i den gamle app, er prikken ogsaa vaek her.
 */
export function nyesteUlaesteSvar3(traade: SvarKilde3[], senestLaestMs: number): SvarKilde3 | null {
	const ulaeste = traade.filter(
		(t) => t.svar && t.besvaretMs !== undefined && t.besvaretMs > senestLaestMs
	);
	if (ulaeste.length === 0) return null;
	return ulaeste.reduce((nyest, t) => (t.besvaretMs! > nyest.besvaretMs! ? t : nyest));
}

/** Skal der staa en prik paa fanen Linn. */
export function harNytSvar3(traade: SvarKilde3[], senestLaestMs: number): boolean {
	return nyesteUlaesteSvar3(traade, senestLaestMs) !== null;
}

// ── Send videre til Linn ─────────────────────────────────────

/**
 * Maa hun sende det her svar videre.
 *
 * Linjen staar under HVERT svar fra AI'en, ikke kun naar AI'en selv er i
 * tvivl. Linns beslutning 16. august, og den er rigtig: det er hende der
 * afgoer om svaret duer, ikke modellen.
 *
 * Et svar der allerede er sendt videre kan ikke sendes igen. Ellers
 * ville det samme spoergsmaal ligge to gange i Linns vaerktoej.
 */
export function kanSendeVidere3(
	adgang: BeskedAdgang3,
	erAiSvar: boolean,
	alleredeSendt: boolean
): boolean {
	return adgang.linn && erAiSvar && !alleredeSendt;
}

/** Skaerer et spoergsmaal til, saa to skrivemaader af det samme er ens. */
function noegle(tekst: string): string {
	return tekst.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Er det her spoergsmaal allerede sendt videre.
 *
 * Vi sammenligner paa selve teksten og ikke paa et id, fordi samtalen og
 * spoergsmaalene ligger to forskellige steder og ikke kender hinanden.
 * Rammer den ved siden af, er det i den sikre retning: hun kan sende
 * igen, i stedet for at et spoergsmaal lydloest ikke naar frem.
 */
export function erSendtVidere3(spoergsmaal: string, sendte: Iterable<string>): boolean {
	const n = noegle(spoergsmaal);
	for (const s of sendte) {
		if (noegle(s) === n) return true;
	}
	return false;
}

// ── Samtalens laengde ────────────────────────────────────────

/**
 * Hvor mange beskeder der maa staa i én samtale, foer vi lukker den og
 * starter en ny.
 *
 * Et Firestore-dokument kan hoejst fylde 1 MB, og hele samtalen ligger i
 * ét felt. Ved 200 beskeder er vi milevidt fra graensen, og hun kan
 * stadig rulle tilbage i det hun har spurgt om. De aeldre samtaler kan
 * hun aabne under "Se tidligere samtaler".
 */
export const MAX_BESKEDER_I_SAMTALE_3 = 200;

export function samtaleErFuld3(antalBeskeder: number): boolean {
	return antalBeskeder >= MAX_BESKEDER_I_SAMTALE_3;
}

/** Det mindste vi skal bruge om en gemt samtale. */
export interface SamtaleKilde3 {
	id: string;
	antalBeskeder: number;
	opdateretMs: number;
}

/**
 * Hvilken samtale hun skal skrive videre i.
 *
 * Den nyeste der ikke er fuld. Er der ingen, eller er den nyeste fuld,
 * returneres null og kalderen opretter en ny. Hun maerker ingenting.
 */
export function fortsaetSamtale3(samtaler: SamtaleKilde3[]): SamtaleKilde3 | null {
	const brugbare = samtaler.filter((s) => !samtaleErFuld3(s.antalBeskeder));
	if (brugbare.length === 0) return null;
	return brugbare.reduce((nyest, s) => (s.opdateretMs > nyest.opdateretMs ? s : nyest));
}

// ── Datolinjen i samtalen ────────────────────────────────────

const MAANEDER_3 = [
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

/** Midnat samme dag, saa to tidspunkter kan sammenlignes paa dato alene. */
function dagStart(ms: number): number {
	const d = new Date(ms);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

/**
 * Teksten paa den tynde linje mellem to dage i samtalen. "I dag" og
 * "I går" er dem hun ser oftest, saa de skrives med ord.
 */
export function dagLabel3(ms: number, nuMs: number): string {
	const dage = Math.round((dagStart(nuMs) - dagStart(ms)) / 86_400_000);
	if (dage <= 0) return 'I dag';
	if (dage === 1) return 'I går';
	const d = new Date(ms);
	const iAar = new Date(nuMs).getFullYear() === d.getFullYear();
	const grund = `${d.getDate()}. ${MAANEDER_3[d.getMonth()]}`;
	return iAar ? grund : `${grund} ${d.getFullYear()}`;
}

/** En besked i samtalen, som skaermen har brug for den. */
export interface SamtaleBesked3 {
	rolle: 'user' | 'assistant';
	indhold: string;
	/** Hvornaar den blev skrevet, i ms. */
	ms: number;
	/**
	 * Hvor godt Linns tidligere svar daekkede spoergsmaalet, 0 til 100.
	 *
	 * KUNDEN SER DEN. Linns beslutning 4. september: 3.0 skal sige det
	 * samme som den gamle app, hvor de 925 kunder har set tallet hele
	 * tiden. Foer stod der i den her fil at procenten aldrig gik til
	 * kunden, og det er nu omgjort.
	 *
	 * null eller undefined betyder at modellen glemte at saette den paa.
	 * Det sker i knap hvert tiende svar, og saa siges det med ord i
	 * stedet, se den gamle apps ordlyd.
	 */
	sikkerhed?: number | null;
}

export interface SamtaleDag3 {
	label: string;
	beskeder: SamtaleBesked3[];
}

/**
 * Deler samtalen op i dage, saa der kan staa en tynd linje imellem.
 * Raekkefoelgen bevares, aeldst foerst, praecis som de blev skrevet.
 */
export function grupperEfterDag3(beskeder: SamtaleBesked3[], nuMs: number): SamtaleDag3[] {
	const dage: SamtaleDag3[] = [];
	for (const b of beskeder) {
		const label = dagLabel3(b.ms, nuMs);
		const sidste = dage[dage.length - 1];
		if (sidste && sidste.label === label) sidste.beskeder.push(b);
		else dage.push({ label, beskeder: [b] });
	}
	return dage;
}
