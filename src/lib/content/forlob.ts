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
	// Naar Linn vil have samme lektion paa flere dage, faar de en faelles
	// grupperingId. Aendringer kan saa propageres til alle dage i gruppen
	// via opdaterLektionGruppe(). Tom = standalone lektion (uafhaengig).
	grupperingId?: string;
	// Valgfri tidsbegraensning af synlighed. Absolutte ISO-datetime-strenge i
	// lokal tid (fx '2026-06-17T22:00') — IKKE relativt til forloebsdagen.
	// visFra tom = synlig saa snart dagen er aaben. skjulEfter tom = forsvinder
	// aldrig. Bruges fx til et live Zoom-link der kun gaelder indtil kl. 22.
	// Datoerne er hold-specifikke; genbruges lektionen til naeste hold skal de
	// saettes paa ny.
	visFra?: string;
	skjulEfter?: string;
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
	// Hvis noten skal vises paa flere dage, faar de samme noteGrupperingId.
	// Tom = standalone note.
	noteGrupperingId?: string;
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
// Nul-dage (pause-dage der skubber forloebet)
// ==============================================

/** Lokal ISO yyyy-mm-dd for et Date-objekt. */
function toIsoLokal(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${dd}`;
}

/**
 * Folder intervaller ud til en deduperet liste af ISO-datoer.
 * Inputtet kan have overlap eller dubletter — outputtet er en Set-baseret
 * sorteret liste.
 */
export function nulDageDatoer(intervaller: { fra: string; til: string }[]): string[] {
	const sat = new Set<string>();
	for (const iv of intervaller) {
		const f = new Date(iv.fra);
		const t = new Date(iv.til);
		if (isNaN(f.getTime()) || isNaN(t.getTime())) continue;
		const cur = new Date(f.getFullYear(), f.getMonth(), f.getDate());
		const slut = new Date(t.getFullYear(), t.getMonth(), t.getDate());
		while (cur.getTime() <= slut.getTime()) {
			sat.add(toIsoLokal(cur));
			cur.setDate(cur.getDate() + 1);
		}
	}
	return Array.from(sat).sort();
}

/**
 * Aktuel dagNummer der tager hensyn til nul-dage. Nul-dage med dato <= now
 * trækkes fra. Returnerer null hvis startDato er i fremtiden.
 */
export function getCurrentDayMedNulDage(
	forlob: { startDato: string; antalDage: number },
	nulDatoer: string[],
	now: Date = new Date()
): number | null {
	const basis = getCurrentDay(forlob, now);
	if (basis === null) return null;
	const idagIso = toIsoLokal(now);
	const passeret = nulDatoer.filter((d) => d <= idagIso).length;
	return Math.max(0, basis - passeret);
}

/**
 * Slut-millisecond for et forloeb der er forlaenget med nulDageBrugt dage.
 * Bruges til at afgoere om et forloeb stadig er aktivt.
 */
export function forlobSlutMs(startMs: number, antalDage: number, nulDageBrugt: number): number {
	const msPerDag = 1000 * 60 * 60 * 24;
	return startMs + (antalDage + nulDageBrugt) * msPerDag;
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

/**
 * Returnerer datoen for en bestemt dagNummer i et forløb, baseret paa
 * startDato. Dag 0 = startdagen selv.
 */
export function datoForDag(startDato: string, dagNummer: number): Date {
	const d = new Date(startDato);
	d.setDate(d.getDate() + dagNummer);
	return d;
}

/**
 * Kort dato-format brugt i admin-vaelg-dage-dialog: "30. maj 2026".
 */
export function formatKortDato(date: Date): string {
	return `${date.getDate()}. ${maaneder[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Engelsk-stil ugedag-navn brugt til at gruppere genveje: 0=soendag.
 */
export function ugedagForDato(date: Date): number {
	return date.getDay();
}

export const UGEDAG_LABELS = ugedage;

// ==============================================
// Helpers til at bygge nye lektioner
// ==============================================

/**
 * Genererer en tom LektionItem med et nyt id. Bruges når Linn klikker
 * 'Tilføj lektion' i admin-UI'et.
 */
export function nyLektion(): LektionItem {
	return {
		id:
			typeof crypto !== 'undefined' && crypto.randomUUID
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
 * Er en lektion synlig for kunden lige nu ud fra dens valgfri
 * tidsbegraensning? Lektioner uden visFra/skjulEfter er altid synlige (naar
 * dagen foerst er aaben). visFra/skjulEfter er absolutte ISO-datetime-strenge
 * i lokal tid. skjulEfter er sidste synlige oejeblik — saetter du 22:00, er
 * den synlig kl. 22:00 og forsvinder kl. 22:01.
 */
export function lektionSynligNu(
	l: { visFra?: string; skjulEfter?: string },
	now: Date = new Date()
): boolean {
	const t = now.getTime();
	if (l.visFra) {
		const fra = new Date(l.visFra).getTime();
		if (!isNaN(fra) && t < fra) return false;
	}
	if (l.skjulEfter) {
		const til = new Date(l.skjulEfter).getTime();
		// +59s saa et valgt klokkeslaet (uden sekunder) er synligt hele minuttet.
		if (!isNaN(til) && t > til + 59_000) return false;
	}
	return true;
}

export type LektionTidsstatus = 'altid' | 'foer' | 'aktiv' | 'udloebet';

/**
 * Status for en lektions tidsbegraensning — bruges til admin-maerker.
 * 'altid' = ingen begraensning. 'foer' = endnu ikke synlig (foer visFra).
 * 'aktiv' = i sit synlighedsvindue. 'udloebet' = skjult efter skjulEfter.
 */
export function lektionTidsstatus(
	l: { visFra?: string; skjulEfter?: string },
	now: Date = new Date()
): LektionTidsstatus {
	if (!l.visFra && !l.skjulEfter) return 'altid';
	const t = now.getTime();
	if (l.skjulEfter) {
		const til = new Date(l.skjulEfter).getTime();
		if (!isNaN(til) && t > til + 59_000) return 'udloebet';
	}
	if (l.visFra) {
		const fra = new Date(l.visFra).getTime();
		if (!isNaN(fra) && t < fra) return 'foer';
	}
	return 'aktiv';
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
