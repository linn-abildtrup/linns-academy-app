// Hendes huskede maengder paa Linns opskrifter.
//
// Ligger paa kunden selv som userDoc.opskriftMaengder3, et kort fra
// opskrift-id til det hun har rettet. Samme moenster som
// favoritOpskrifter, se favoritOpskrift3.ts.
//
// FELTET ER ADDITIVT. `userDoc.ts` og `types.ts` er uroerte, og
// Firestore-reglerne tillader i forvejen at kunden skriver sit eget
// dokument, saa der skal INTET udgives i Console for det her. Det er
// samme tjek som blev lavet 12. august til bogmaerkerne, se
// firestore.rules linje 19.
//
// DEN GAMLE APP LAESER DET IKKE. Den viser opskriften som Linn har
// skrevet den, og de 760 kunder i drift maerker ingenting.

import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { GemtAendring } from '$lib/content/opskriftAendring3';

export const MAENGDE_FELT = 'opskriftMaengder3';
/** Opskrifter hun har svaret paa spoergsmaalet om, uanset hvad hun svarede. */
export const SPURGT_FELT = 'opskriftSpurgt3';

/**
 * Laeser hendes gemte maengder ud af bruger-dokumentet.
 *
 * Castet ligger HER og ét sted, saa `types.ts` kan blive uroert. Samme
 * loesning som `favoritterFra`.
 */
export function maengderFra(userDoc: unknown): Record<string, GemtAendring> {
	const d = userDoc as Record<string, unknown> | null | undefined;
	const raa = d?.[MAENGDE_FELT];
	if (!raa || typeof raa !== 'object' || Array.isArray(raa)) return {};
	return raa as Record<string, GemtAendring>;
}

/**
 * Linjen under navnet paa en raekke i dagbogen, fx "Dine mængder · 2
 * rettet". Skrevet af gemSammensat som `note3`.
 *
 * Castet ligger HER, saa `GemtMaaltid` i content/kost.ts kan blive
 * uroert. Den fil deles med den app der er i drift, se regel 2.
 */
export function noteFra(maaltid: unknown): string {
	const m = maaltid as Record<string, unknown> | null | undefined;
	const n = m?.note3;
	return typeof n === 'string' ? n : '';
}

/** Opskrifter hun allerede er blevet spurgt om. Se skalSpoerge. */
export function spurgtFra(userDoc: unknown): string[] {
	const d = userDoc as Record<string, unknown> | null | undefined;
	const raa = d?.[SPURGT_FELT];
	return Array.isArray(raa) ? (raa.filter((x) => typeof x === 'string') as string[]) : [];
}

/**
 * Gemmer hendes maengder til naeste gang. Kaldes kun naar hun har sagt
 * ja til spoergsmaalet.
 *
 * Der skrives paa én noegle og ikke hele kortet, saa to enheder ikke kan
 * overskrive hinandens opskrifter.
 */
export async function gemMaengder(
	uid: string,
	opskriftId: string,
	gemt: GemtAendring
): Promise<void> {
	if (!uid || !opskriftId) return;
	await updateDoc(doc(db, 'users', uid), {
		[`${MAENGDE_FELT}.${opskriftId}`]: gemt
	});
}

/** Fjerner det huskede igen, altsaa naar hun trykker "Vis Linns". */
export async function glemMaengder(uid: string, opskriftId: string): Promise<void> {
	if (!uid || !opskriftId) return;
	await updateDoc(doc(db, 'users', uid), {
		[`${MAENGDE_FELT}.${opskriftId}`]: deleteField()
	});
}

/**
 * Husker at hun er blevet spurgt om netop den her opskrift, uanset om
 * hun sagde ja eller nej.
 *
 * Uden det ville baandet dukke op hver eneste gang hun retter noget i
 * den samme ret, og saa er det en pop-up der aldrig holder op.
 */
export async function husSpurgt(uid: string, opskriftId: string): Promise<void> {
	if (!uid || !opskriftId) return;
	const { arrayUnion } = await import('firebase/firestore');
	await updateDoc(doc(db, 'users', uid), {
		[SPURGT_FELT]: arrayUnion(opskriftId)
	});
}
