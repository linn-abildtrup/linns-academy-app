// ============================================================
// De faa varer kunden HAR taget i brug, gemt paa hende selv.
//
// HVORFOR DEN FINDES. Efter 24. august ses maerkevarer og retter kun af
// den kunde der allerede bruger dem, se content/fodevareKilde3.ts og
// HANDOVER-3.0.md 9.50. Historikken i plejer3 raekker kun 45 dage
// tilbage, og Linns regel er UDEN tidsgraense: en vare hun brugte for et
// aar siden skal stadig kunne findes.
//
// Derfor staar de paa hendes eget dokument. Listen er lille. Maalt paa
// alle 498 kunder med mad registreret den 24. august: median ÉN vare,
// gennemsnit 2,7 og hoejeste 21. 29 procent har ingen.
//
// Feltet er ADDITIVT og hedder `kendteVarer3`. `userDoc.ts` og
// `types.ts` er uroerte, se regel 2. Der skal intet udgives i Firebase,
// for reglerne tillader kunden at skrive paa sit eget dokument i
// forvejen.
//
// Den TREDJE af de foedevare-filer i 3.0 der skriver kundedata.
// ============================================================

import { doc, updateDoc } from 'firebase/firestore';
import { db } from '$lib/firebase';
import { kendteVarerEfter, type Vare3 } from '$lib/content/fodevareKilde3';

/** Laeser listen af et bruger-dokument. Castet ligger ét sted. */
export function kendteVarerFra(userDoc: unknown): string[] {
	const liste = (userDoc as { kendteVarer3?: unknown } | null)?.kendteVarer3;
	return Array.isArray(liste) ? liste.filter((x): x is string => typeof x === 'string') : [];
}

/**
 * Husker at kunden har taget varen i brug, hvis den er en af dem der
 * ellers ville forsvinde for hende.
 *
 * Returnerer den nye liste naar der blev skrevet, og null naar der ikke
 * var noget at skrive. Kalderen kan saette sin egen tilstand af svaret
 * uden at hente dokumentet igen.
 *
 * FEJLER ALDRIG OPAD. Gaar skrivningen galt, er maaltidet stadig gemt,
 * og hun mister hoejst at varen er svaerere at finde naeste gang. Samme
 * princip som notifikationerne, se HANDOVER 9.39.
 */
export async function husKendtVare(
	uid: string,
	userDoc: unknown,
	varen: Vare3 | null | undefined
): Promise<string[] | null> {
	if (!uid || !varen) return null;
	const ny = kendteVarerEfter(kendteVarerFra(userDoc), varen.id, varen);
	if (!ny) return null;
	try {
		await updateDoc(doc(db, 'users', uid), { kendteVarer3: ny });
		return ny;
	} catch (e) {
		console.error('[ny] kunne ikke huske varen', e);
		return null;
	}
}
