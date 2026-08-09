// ============================================================
// Henter kundens pause-dage.
//
// De ligger i users/{uid}/products/{produkt}.nulDage.intervaller,
// altsaa samme sted som den gamle app skriver dem. Vi laeser kun, og
// der er ingen migrering.
//
// Bemaerk stien: det er products, ikke userProducts. Det kostede en
// forkert maaling 9. august 2026, hvor svaret blev nul kunder fordi der
// blev kigget i en samling der ikke findes.
// ============================================================

import { doc, getDoc } from 'firebase/firestore';
import { db } from '$lib/firebase';
import { nulDatoer, produktHarNulDage } from '$lib/content/nulDage3';
import type { NulDageKilde } from '$lib/content/adgang3';

/**
 * Pause-dagene for de produkter kunden er paa.
 *
 * Kun Kropsro kan holde pause, saa for alle andre produkter henter vi
 * ingenting. For en Kickstart-kunde koster det her altsaa nul opslag.
 */
export async function hentNulDage(uid: string, produkter: string[]): Promise<NulDageKilde> {
	const relevante = [...new Set(produkter)].filter(produktHarNulDage);
	if (relevante.length === 0) return {};

	const ud: NulDageKilde = {};
	await Promise.all(
		relevante.map(async (produkt) => {
			try {
				const snap = await getDoc(doc(db, 'users', uid, 'products', produkt));
				if (!snap.exists()) return;
				const iv = snap.data()?.nulDage?.intervaller;
				if (!Array.isArray(iv) || iv.length === 0) return;
				const datoer = nulDatoer(iv);
				if (datoer.length > 0) ud[produkt] = datoer;
			} catch (e) {
				// Kan pause-dagene ikke hentes, er det bedre at vise
				// forloebet uden dem end ikke at vise noget. Dagnummeret
				// bliver saa det raa, praecis som foer den her rettelse.
				console.warn('[ny] kunne ikke hente nul-dage for', produkt, e);
			}
		})
	);
	return ud;
}
