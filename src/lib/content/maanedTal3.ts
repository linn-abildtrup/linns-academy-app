// ============================================================
// Maaned mod maaned. Ren logik, ingen database.
//
// Traening, mad og smaa skridt goer alle tre det samme: de stiller den
// maaned hun er i gang med op mod den forrige. Uden den her fil ville
// den regel ligge tre steder og drive fra hinanden.
//
// DEN REGEL DER STYRER DET HELE, og som Linn satte 18. august:
// en side der goer status maa ALDRIG kunne laeses som en anklage.
// Derfor er der INTET MAAL her. Kun hende mod hende selv.
//
// To ting er bevidst:
//
//  - En maaned uden data bliver ALDRIG til et nul at sammenligne med.
//    "0 → 40" ville laese som om hun havde svigtet maaneden foer. Har
//    hun ingenting den maaned, er der bare ikke noget at sammenligne
//    med, og saa siger vi ingenting om det
//
//  - Gennemsnit regnes pr DAG HUN HAR REGISTRERET, ikke pr dag i
//    maaneden. Ellers ville en uge uden madregistrering trykke hendes
//    protein ned, selvom hun spiste praecis som hun plejer
// ============================================================

/** Ét maalepunkt paa en dato. */
export interface DagPunkt {
	/** YYYY-MM-DD. */
	dato: string;
	vaerdi: number;
}

/** Laegges dagene sammen, eller er det gennemsnittet der taeller. */
export type Metode = 'sum' | 'gennemsnit';

export interface Maaned {
	/** YYYY-MM. */
	noegle: string;
	/** "august", "juli". */
	navn: string;
	vaerdi: number;
	/** Hvor mange dage der ligger bag tallet. Nul betyder ingen data. */
	dage: number;
}

export interface MaanedOverblik {
	/** Den maaned hun er i gang med. */
	denne: Maaned;
	/** Maaneden foer. null naar hun ikke har noget den maaned. */
	forrige: Maaned | null;
	/** denne minus forrige. null naar der ikke er en forrige. */
	forskel: number | null;
	/** Er det den bedste maaned hun har haft. */
	bedste: boolean;
	/** De seneste maaneder, aeldst foerst. Til soejlerne. */
	maaneder: Maaned[];
}

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

/** Hvor mange maaneder der vises som soejler. */
export const ANTAL_MAANEDER = 6;

export function maanedsNavn(noegle: string): string {
	const nr = Number(noegle.slice(5, 7));
	return MAANEDER[nr - 1] ?? noegle;
}

function noegleFor(d: Date): string {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Maaneden med stort begyndelsesbogstav, til starten af en saetning. */
export function stortNavn(navn: string): string {
	return navn.charAt(0).toUpperCase() + navn.slice(1);
}

/**
 * Stiller denne maaned op mod den forrige.
 *
 * `nu` er det tidspunkt vi regner "denne maaned" ud fra, saa testene kan
 * saette et fast ur.
 */
export function maanedOverblik(
	punkter: DagPunkt[],
	nu: number,
	metode: Metode
): MaanedOverblik | null {
	if (punkter.length === 0) return null;

	// Flere maalinger paa samme dag laegges sammen. En dag med tre
	// maaltider er stadig ÉN dag naar der regnes gennemsnit.
	const prDag = new Map<string, number>();
	for (const p of punkter) {
		prDag.set(p.dato, (prDag.get(p.dato) ?? 0) + p.vaerdi);
	}

	const sum = new Map<string, number>();
	const dage = new Map<string, number>();
	for (const [dato, vaerdi] of prDag) {
		const n = dato.slice(0, 7);
		sum.set(n, (sum.get(n) ?? 0) + vaerdi);
		dage.set(n, (dage.get(n) ?? 0) + 1);
	}

	function maanedFor(noegle: string): Maaned {
		const antal = dage.get(noegle) ?? 0;
		const total = sum.get(noegle) ?? 0;
		const vaerdi = metode === 'sum' ? total : antal > 0 ? Math.round((total / antal) * 10) / 10 : 0;
		return { noegle, navn: maanedsNavn(noegle), vaerdi, dage: antal };
	}

	const d = new Date(nu);
	const denne = maanedFor(noegleFor(d));
	const forrigeNoegle = noegleFor(new Date(d.getFullYear(), d.getMonth() - 1, 1));
	const forrige = dage.has(forrigeNoegle) ? maanedFor(forrigeNoegle) : null;

	// Soejlerne. Maaneder uden data staar med nul, saa raekken ikke hopper
	// i tid, men de faar ingen tekst der peger paa dem.
	const maaneder: Maaned[] = [];
	for (let i = ANTAL_MAANEDER - 1; i >= 0; i--) {
		maaneder.push(maanedFor(noegleFor(new Date(d.getFullYear(), d.getMonth() - i, 1))));
	}

	const medData = [...dage.keys()].map(maanedFor).map((m) => m.vaerdi);
	const bedste = medData.length > 1 && denne.vaerdi === Math.max(...medData) && denne.vaerdi > 0;

	return {
		denne,
		forrige,
		forskel: forrige ? Math.round((denne.vaerdi - forrige.vaerdi) * 10) / 10 : null,
		bedste,
		maaneder
	};
}

/** Hvor lang soejlen skal vaere, 0 til 100. Den stoerste maaned er 100. */
export function soejleBredde(vaerdi: number, stoerst: number): number {
	if (stoerst <= 0 || vaerdi <= 0) return 0;
	// En meget lille maaned skal stadig kunne ses.
	return Math.max(4, Math.round((vaerdi / stoerst) * 100));
}

/** Den stoerste maaned i raekken. Mindst 1, saa der aldrig deles med nul. */
export function stoersteMaaned(o: MaanedOverblik | null): number {
	if (!o) return 1;
	return Math.max(...o.maaneder.map((m) => m.vaerdi), 1);
}
