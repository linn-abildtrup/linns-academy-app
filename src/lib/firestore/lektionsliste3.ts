// ============================================================
// "Dine lektioner" i 3.0, laget mod databasen.
//
// Vi laeser fra den gamle apps forlobsdage-samling og skriver ingenting.
// Det er den samme kilde som forsiden og dag-siden allerede bruger, saa en
// lektion Linn retter ét sted er rettet alle steder.
//
// hentForlobsdage har sit eget mellemlager pr session, saa den koster kun
// et opslag foerste gang kunden aabner et forloeb.
// ============================================================

import { hentForlobsdage } from './forlob';
import type { DagKilde } from '$lib/content/lektionsliste3';

/**
 * Alle dage i et forloeb, med de lektioner der ligger paa dem.
 *
 * Fejler opslaget, faar hun en tom liste og ikke en gaaet-i-staa side.
 * Kalderen kan ikke skelne mellem "forloebet har ingen lektioner" og
 * "vi kunne ikke naa databasen", og det er med vilje: begge dele ender
 * med den samme rolige besked paa skaermen.
 */
export async function hentLektionsdage3(forlobId: string): Promise<DagKilde[]> {
	try {
		const dage = await hentForlobsdage(forlobId);
		return dage.map((d) => ({ dagNummer: d.dagNummer, lektioner: d.lektioner ?? [] }));
	} catch (e) {
		console.warn('[ny] kunne ikke hente forloebets dage', e);
		return [];
	}
}
