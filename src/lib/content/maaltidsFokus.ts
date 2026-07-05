// Måltids-fokus: admin kan pr forløb begrænse hvilke måltidstyper kunden må
// se/logge i en periode af forløbet (fx dag 0-6 = kun morgenmad). Ren logik +
// typer — INGEN Firestore, så reglerne kan unit-testes isoleret.
//
// Konfigureres i admin under "Funktioner og adgang" (pr forløb), gemmes på
// forlob/{id}.maaltidsFokus. Håndhæves klient-side i 30-30-3-modulet +
// bibliotekets opskrifter (bid B).

import type { Maaltidstype } from './kost';

/**
 * Én fokus-periode: fra og med forløbs-dag `fraDag` til og med `tilDag` er KUN
 * `maaltider` synlige/tilladte. Dag-numre er forløbs-relative (0 = baseline/
 * startdag), så samme opsætning gælder alle hold af forløbet uanset startdato.
 */
export interface MaaltidsFokusPeriode {
	fraDag: number;
	tilDag: number;
	maaltider: Maaltidstype[];
}

/**
 * Hvilke måltidstyper er tilladt for en given forløbs-dag?
 *  - Returnerer listen fra den periode dagen falder i (hård begrænsning).
 *  - Returnerer `null` hvis dagen ligger UDEN for enhver periode = ingen
 *    begrænsning (alle måltider tilladt, normal adfærd).
 * Ved (util-tilsigtet) overlap vinder den første matchende periode.
 */
export function tilladteMaaltiderForDag(
	perioder: MaaltidsFokusPeriode[] | undefined | null,
	dagNummer: number
): Maaltidstype[] | null {
	if (!perioder || perioder.length === 0) return null;
	const match = perioder.find((p) => dagNummer >= p.fraDag && dagNummer <= p.tilDag);
	return match ? match.maaltider : null;
}

/**
 * Validerer en enkelt periode. Returnerer en dansk fejlbesked eller null hvis
 * gyldig. Bruges af admin-siden før gem.
 */
export function validerPeriode(p: MaaltidsFokusPeriode): string | null {
	if (!Number.isInteger(p.fraDag) || p.fraDag < 0) return 'Fra-dag skal være 0 eller højere.';
	if (!Number.isInteger(p.tilDag) || p.tilDag < 0) return 'Til-dag skal være 0 eller højere.';
	if (p.tilDag < p.fraDag) return 'Til-dag skal være samme eller senere end fra-dag.';
	if (!p.maaltider || p.maaltider.length === 0) return 'Vælg mindst én måltidstype.';
	return null;
}

/**
 * Validerer en hel liste af perioder: hver periode gyldig + ingen overlap
 * (så en dag aldrig falder i to perioder). Returnerer fejlbesked eller null.
 */
export function validerPerioder(perioder: MaaltidsFokusPeriode[]): string | null {
	for (const p of perioder) {
		const fejl = validerPeriode(p);
		if (fejl) return fejl;
	}
	const sorteret = [...perioder].sort((a, b) => a.fraDag - b.fraDag);
	for (let i = 1; i < sorteret.length; i++) {
		if (sorteret[i].fraDag <= sorteret[i - 1].tilDag) {
			return `Perioderne overlapper (dag ${sorteret[i].fraDag} ligger i to perioder).`;
		}
	}
	return null;
}
