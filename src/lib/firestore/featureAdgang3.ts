// ============================================================
// Feature-adgang i 3.0.
//
// HVORFOR DEN HER FIL FINDES, OG IKKE EN CONTEXT I SKALLEN:
//
// Foerste forsoeg lagde hentningen i routes/ny/+layout.svelte, altsaa
// det der omgiver ALLE sider i den nye flade. Kort efter var appen helt
// blank, og aarsagen kunne ikke findes. Vi rullede tilbage.
//
// Skemaet skal kun bruges ét sted, nemlig naar udvidet naering skal
// vises eller skjules. Saa henter vi det ét sted. Gaar noget galt her,
// rammer det kun det ene ark og ikke hele fladen.
//
// Ingen skrivning. Admin retter skemaet paa /app/admin/feature-adgang.
// ============================================================

import { hentFeatureMatrix } from '$lib/firestore/featureAdgang';
import { harFeatureAdgang, STANDARD_MATRIX, type FeatureMatrix } from '$lib/content/features';
import type { UserDoc } from '$lib/types';

// Skemaet aendrer sig kun naar Linn retter det i admin. Ét opslag pr
// side-indlaesning er rigeligt.
let cache: FeatureMatrix | null = null;
let henter: Promise<FeatureMatrix> | null = null;

/**
 * Henter adgangs-skemaet. Fejler det, faar vi standarden tilbage, saa
 * adgang aldrig falder bort paa grund af en daarlig forbindelse.
 */
export async function hentAdgangsskema(): Promise<FeatureMatrix> {
	if (cache) return cache;
	if (henter) return henter;
	henter = hentFeatureMatrix()
		.then((m) => {
			cache = m;
			return m;
		})
		.catch((e) => {
			console.warn('[ny] kunne ikke hente adgangs-skemaet, bruger standarden', e);
			return STANDARD_MATRIX;
		})
		.finally(() => {
			henter = null;
		});
	return henter;
}

/**
 * Maa kunden se kulhydrat, fedt og kalorier?
 *
 * Linns regel 11. august: Kickstart ser kun protein og fiber. Kropsro og
 * medlemmer ser det hele. Admin kan aendre det pr kundetype paa
 * /app/admin/feature-adgang.
 *
 * BEMAERK at skemaet i dag siger ja til ALLE kundetyper, ogsaa
 * Kickstart. Det blev bevidst ikke aendret, fordi 160 Kickstart-kunder
 * selv har slaaet udvidet naering til og bruger den i den gamle app.
 * De skal ikke miste noget uden varsel. Reglen faar foerst virkning den
 * dag Linn aendrer skemaet.
 */
export function maaSeUdvidetNaering(
	userDoc: UserDoc | null,
	matrix: FeatureMatrix | null
): boolean {
	return harFeatureAdgang(userDoc, matrix, 'udvidet-naering');
}
