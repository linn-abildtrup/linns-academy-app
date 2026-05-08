// Bibliotek-modul — typer og pure-funktioner.
//
// Bibliotek samler FAQ og guides for et givet forløb. FAQ er sat op først;
// guides kommer i en senere etape. Begge ligger som sub-collections under
// forlob/{forlobId}/... så indholdet er forløbs-specifikt og kopieres med
// kopierForlobIndhold når Linn opretter et nyt forløb baseret på et tidligere.
//
// Firestore-stier:
//   forlob/{forlobId}/faqKategorier/{id}  { navn, orden, oprettet }
//   forlob/{forlobId}/faqItems/{id}       { kategoriId, spoergsmaal, svar,
//                                            orden, udgivet, oprettet, opdateret }

import type { Timestamp } from 'firebase/firestore';

// ==============================================
// Typer
// ==============================================

export interface FaqKategori {
	id: string;
	navn: string;
	orden: number;
	oprettet: Timestamp;
}

export interface FaqItem {
	id: string;
	kategoriId: string;
	spoergsmaal: string;
	svar: string;
	orden: number;
	udgivet: boolean;
	oprettet: Timestamp;
	opdateret: Timestamp;
}

// ==============================================
// Sortering og filtrering
// ==============================================

/**
 * Sorterer kategorier efter orden, derefter navn alfabetisk som fallback.
 */
export function sorterKategorier<T extends { orden: number; navn: string }>(kategorier: T[]): T[] {
	return [...kategorier].sort((a, b) => {
		if (a.orden !== b.orden) return a.orden - b.orden;
		return a.navn.localeCompare(b.navn, 'da');
	});
}

/**
 * Sorterer items efter orden indenfor deres egen kategori. Stabil mht
 * input-rækkefølge når orden er identisk.
 */
export function sorterItems<T extends { orden: number }>(items: T[]): T[] {
	return [...items].sort((a, b) => a.orden - b.orden);
}

/**
 * Filtrerer items så kun udgivne returneres. Bruges på klient-siden,
 * hvor admin ser både kladder og udgivne.
 */
export function kunUdgivne<T extends { udgivet: boolean }>(items: T[]): T[] {
	return items.filter((it) => it.udgivet);
}

/**
 * Grupperer items pr kategori-id.
 */
export function grupperEfterKategori<T extends { kategoriId: string }>(
	items: T[]
): Record<string, T[]> {
	const ud: Record<string, T[]> = {};
	for (const it of items) {
		if (!ud[it.kategoriId]) ud[it.kategoriId] = [];
		ud[it.kategoriId].push(it);
	}
	return ud;
}

/**
 * Returnerer den næste ledige orden-værdi i en kategori. Tager max+1 så
 * nyoprettede items lander i bunden uden at kollidere med eksisterende.
 */
export function naesteOrden<T extends { orden: number }>(eksisterende: T[]): number {
	if (eksisterende.length === 0) return 0;
	const max = eksisterende.reduce((m, it) => (it.orden > m ? it.orden : m), 0);
	return max + 1;
}
