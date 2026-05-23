// Mit forløb-modul — typer og pure-funktioner.
//
// Et forløb består af en startdato + antalDage og har tilknyttet:
//   - vaneprogram pr dagNummer (i forlob/{id}/vaneprogram, dækket af vaner-modulet)
//   - lektioner pr dagNummer (i forlob/{id}/forlobsdage)
//   - FAQ + guides (i forlob/{id}/...)
//
// Det selve Forløb-dokument med startDato+antalDage ligger i
// src/lib/content/forlobAdgang.ts (interface Forlob med Timestamp).
// Denne fil håndterer kun lektioner og dagsberegning til UI-niveau.

// ==============================================
// Typer
// ==============================================

/**
 * Et enkelt lektion-item på en forløbsdag. Lektioner kan være tekst-baserede
 * (kun titel + beskrivelse) eller indeholde en URL til video/PDF/lyd. URL er
 * tom streng hvis ikke i brug.
 *
 * id genereres klient-side ved oprettelse (crypto.randomUUID) så Linn kan
 * tilføje/fjerne flere lektioner pr dag uden at rode med Firestore-id'er.
 */
export interface LektionItem {
	id: string;
	titel: string;
	beskrivelse: string;
	varighedMin: number;
	format: string;
	url: string;
	thumbnailUrl?: string;
}

/**
 * En forløbsdag — én pr dagNummer i forlob/{id}/forlobsdage.
 * dagNummer 0 = baseline-dag (samme konvention som vaneprogram).
 * dagNummer 1+ = programdage.
 *
 * lektioner kan være tom liste (intet indhold den dag).
 * noteFraLinn kan være tom streng (ingen note).
 */
export interface ForlobDag {
	dagNummer: number;
	uge: number;
	lektioner: LektionItem[];
	noteFraLinn: string;
}

// ==============================================
// Dags-beregning
// ==============================================

/**
 * Beregner ugenummer fra dagNummer.
 * Dag 0 = uge 0 (baseline).
 * Dag 1-7 = uge 1, dag 8-14 = uge 2, dag 15-21 = uge 3, osv.
 */
export function ugeForDag(dagNummer: number): number {
	if (dagNummer <= 0) return 0;
	return Math.ceil(dagNummer / 7);
}

/**
 * Beregner aktuel dagNummer i forløbet.
 * Returnerer 0 på selve startdagen (baseline), 1 dagen efter (første programdag),
 * osv. Returnerer null hvis startdato er i fremtiden.
 *
 * Konventionen matcher vaneprogrammet: dag 0 = baseline, dag 1-21 = programdage.
 */
export function getCurrentDay(
	forlob: { startDato: string; antalDage: number },
	now: Date = new Date()
): number | null {
	const start = new Date(forlob.startDato);
	const msPerDag = 1000 * 60 * 60 * 24;
	const startMidnat = new Date(start.getFullYear(), start.getMonth(), start.getDate());
	const nowMidnat = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const diffDage = Math.floor((nowMidnat.getTime() - startMidnat.getTime()) / msPerDag);

	if (diffDage < 0) {
		return null;
	}
	return diffDage;
}

// ==============================================
// Status pr dag
// ==============================================

/**
 * Status for en forløbsdag set fra klientens perspektiv.
 * 'fremtid' = endnu ikke nået
 * 'aktiv' = dagens dag
 * 'fortid' = passeret (kan stadig læses)
 */
export type DagStatus = 'fremtid' | 'aktiv' | 'fortid';

/**
 * Returnerer status for en given dag baseret på den aktuelle dag.
 * aktivDag er output fra getCurrentDay (1-indekseret).
 */
export function dagStatus(dagNummer: number, aktivDag: number | null): DagStatus {
	if (aktivDag === null) return 'fremtid';
	if (dagNummer < aktivDag) return 'fortid';
	if (dagNummer === aktivDag) return 'aktiv';
	return 'fremtid';
}

// ==============================================
// Datoformatering
// ==============================================

const ugedage = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag'];
const maaneder = [
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

/**
 * Formaterer dato som "Tirsdag, 4. juni".
 */
export function formatDato(date: Date = new Date()): string {
	const ugedag = ugedage[date.getDay()];
	const dag = date.getDate();
	const maaned = maaneder[date.getMonth()];
	return ugedag + ', ' + dag + '. ' + maaned;
}

// ==============================================
// Helpers til at bygge nye lektioner
// ==============================================

/**
 * Genererer en tom LektionItem med et nyt id. Bruges når Linn klikker
 * 'Tilføj lektion' i admin-UI'et.
 */
export function nyLektion(): LektionItem {
	return {
		id: typeof crypto !== 'undefined' && crypto.randomUUID
			? crypto.randomUUID()
			: 'lektion-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
		titel: '',
		beskrivelse: '',
		varighedMin: 0,
		format: '',
		url: ''
	};
}

/**
 * Returnerer en tom ForlobDag med given dagNummer. Bruges når der ikke
 * er gemt data for dagen endnu.
 */
export function tomForlobDag(dagNummer: number): ForlobDag {
	return {
		dagNummer,
		uge: ugeForDag(dagNummer),
		lektioner: [],
		noteFraLinn: ''
	};
}
