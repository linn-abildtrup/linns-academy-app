// Firestore-helper til de beregnede makrotal, etape 4 af regnemaskinen.
//
// Tallene ligger i ÉN doc, ingrediensKobling/beregninger, med ét
// opslag pr opskrift-id.
//
// HVORFOR ET GEMT OEJEBLIKSBILLEDE OG IKKE EN UDREGNING HVER GANG
// Tre grunde. Kunden skal ikke hente 2268 foedevarer for at se makroen
// paa én opskrift. Tallene skal ikke aendre sig af sig selv, naar en
// foedevare bliver rettet, men foerst naar vi bevidst regner om. Og
// Linn skal kunne se listen igennem foer den gaar ud.
//
// Regnestykket ligger i content/opskriftMakro3.ts. Her gemmes kun
// resultatet.
//
// Opskrifterne selv roeres ALDRIG. Linns regel 13. august.

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '$lib/firebase';

const STI = 'ingrediensKobling';
const DOK = 'beregninger';

/** Makro PR PORTION, samme regning som resten af 3.0 bruger. */
export interface BeregnetMakro {
	protein: number;
	fiber: number;
	kh: number;
	fedt: number;
	kalorier: number;
	/**
	 * 0 til 100. Hvor stor en del af rettens vaegt der er gjort rede for.
	 * Under GRAENSE_DAEKNING bruges tallet ikke.
	 */
	daekning: number;
	/** Falsk naar en af varerne mangler et kalorietal. */
	kalorierPaalidelige: boolean;
}

export type Beregninger = Record<string, BeregnetMakro>;

/**
 * Hvor stor daekningen skal vaere foer et beregnet tal bruges.
 *
 * Under 90 procent siger tallet mere om manglende koblinger end om
 * opskriften, og saa er det gamle tal bedre.
 */
export const GRAENSE_DAEKNING = 90;

let cache: Beregninger | null = null;

/**
 * Henter alle beregninger. Cached pr session, for de aendrer sig kun
 * naar admin regner om.
 */
export async function hentBeregninger(): Promise<Beregninger> {
	if (cache) return cache;
	const snap = await getDoc(doc(db, STI, DOK));
	const data = snap.exists() ? (snap.data() as Record<string, unknown>) : {};
	const kort = data.kort;
	cache = (kort && typeof kort === 'object' ? kort : {}) as Beregninger;
	return cache;
}

/** Rydder cachen, saa naeste kald henter friske tal. */
export function ryBeregningerCache(): void {
	cache = null;
}

/** Gemmer hele kortet. Kun admin. */
export async function gemBeregninger(kort: Beregninger, af: string): Promise<void> {
	await setDoc(doc(db, STI, DOK), { kort, opdateret: serverTimestamp(), opdateretAf: af });
	cache = kort;
}
