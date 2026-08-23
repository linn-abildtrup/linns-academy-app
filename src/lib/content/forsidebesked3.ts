// ============================================================
// Beskeden paa forsiden.
//
// Til det der IKKE er en samtale: Q&A i aften, nye opskrifter, ferie.
// Linns beslutning 23. august 2026, tegnet i mockups-generel-besked.html.
//
// DEN DELER BOBLE MED DAGENS NOTE. Forsiden har allerede en talebobbel
// fra Linn, bundet til dagen i et forloeb. Der maa aldrig staa to fra
// hende: den generelle staar oeverst, dagens note under med sit
// dagnummer.
//
// ALT HAR EN SLUTDATO, og "i dag" er standarden. Uden den bliver
// forsiden en opslagstavle der aldrig ryddes, og "i aften klokken 19"
// staar der i naeste uge.
//
// KUN ÉN AD GANGEN. Passer to paa den samme kunde, vinder den nyeste.
// To generelle bobler ville vaere det samme rod, bare fra samme sted.
// ============================================================

/** Hvem beskeden er til. */
export type Modtager3 =
	| { slags: 'forlob'; forlobId: string }
	| { slags: 'medlemmer' }
	| { slags: 'alle' };

export interface Forsidebesked3 {
	id: string;
	tekst: string;
	modtager: Modtager3;
	/** Hvornaar den forsvinder af sig selv. */
	slutMs: number;
	oprettetMs: number;
	/** Skal den ogsaa sige til paa telefonen. */
	prik: boolean;
}

/** Hvad vi skal vide om kunden for at vaelge den rigtige. */
export interface BeskedKunde3 {
	/** Id'erne paa de forloeb hun er paa lige nu. Tom hvis ingen. */
	aktiveForlobIds: string[];
}

/** Hvor laenge den staar. Linns fire valg. */
export type Varighed3 = 'idag' | 'tre' | 'uge' | 'altid';

export const VARIGHED_NAVNE3: Record<Varighed3, string> = {
	idag: 'I dag',
	tre: '3 dage',
	uge: 'En uge',
	altid: 'Til jeg fjerner den'
};

const DAG_MS = 86_400_000;

/**
 * Hvornaar beskeden forsvinder.
 *
 * "I dag" betyder til midnat og ikke om 24 timer. Skriver hun klokken 9
 * at der er Q&A i aften, skal den vaere vaek naar hun staar op i morgen,
 * ikke klokken 9 naeste formiddag.
 */
export function slutMsFor3(varighed: Varighed3, nu: number): number {
	if (varighed === 'altid') return Number.MAX_SAFE_INTEGER;
	const d = new Date(nu);
	d.setHours(23, 59, 59, 999);
	const midnat = d.getTime();
	if (varighed === 'idag') return midnat;
	if (varighed === 'tre') return midnat + 2 * DAG_MS;
	return midnat + 6 * DAG_MS;
}

/** Gaelder beskeden for hende. */
export function gaelderFor3(besked: Forsidebesked3, kunde: BeskedKunde3): boolean {
	if (besked.modtager.slags === 'alle') return true;
	if (besked.modtager.slags === 'medlemmer') return kunde.aktiveForlobIds.length === 0;
	return kunde.aktiveForlobIds.includes(besked.modtager.forlobId);
}

/** Dem der ikke er loebet ud endnu. */
export function aktive3(beskeder: Forsidebesked3[], nu: number): Forsidebesked3[] {
	return beskeder.filter((b) => b.slutMs >= nu && b.tekst.trim().length > 0);
}

/**
 * Den ene besked hun skal se, eller null.
 *
 * Passer to, vinder den NYESTE. Et hold-opslag fra i dag skal ikke ligge
 * under en generel besked fra i mandags.
 */
export function beskedTil3(
	beskeder: Forsidebesked3[],
	kunde: BeskedKunde3,
	nu: number
): Forsidebesked3 | null {
	const mulige = aktive3(beskeder, nu).filter((b) => gaelderFor3(b, kunde));
	if (mulige.length === 0) return null;
	return mulige.reduce((a, b) => (b.oprettetMs > a.oprettetMs ? b : a));
}

/** Hvor mange dage der er tilbage. Til listen i admin. */
export function tilbageTekst3(besked: Forsidebesked3, nu: number): string {
	if (besked.slutMs === Number.MAX_SAFE_INTEGER) return 'Står til du fjerner den';
	const timer = Math.ceil((besked.slutMs - nu) / (60 * 60 * 1000));
	if (timer <= 0) return 'Udløbet';
	if (timer <= 24) return 'Forsvinder i nat';
	return `${Math.ceil(timer / 24)} dage tilbage`;
}

/** Modtageren skrevet ud, til admin-listen. */
export function modtagerTekst3(m: Modtager3, forlobNavne: Record<string, string>): string {
	if (m.slags === 'alle') return 'Alle';
	if (m.slags === 'medlemmer') return 'Alle medlemmer';
	return forlobNavne[m.forlobId] ?? 'Et forløb';
}
