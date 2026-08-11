// Laeser kundens bruger-dokument fra telefonens EGEN kopi, uden at spoerge
// serveren. Bruges kun af den hurtige opstart, se content/hurtigStart.ts.
//
// Firestore gemmer i forvejen hver doc i browserens IndexedDB, se localCache
// i lib/firebase.ts. Det almindelige getDoc spoerger alligevel serveren
// foerst, og det er praecis dét der kan tage et minut paa en doed forbindelse.
// getDocFromCache roerer aldrig netvaerket.
//
// Ny fil med vilje. userDoc.ts er et delt modul som den app der er i drift
// bygger paa, og den maa kun laeses, ikke aendres.

import { doc, getDocFromCache } from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { UserDoc } from '$lib/types';

/**
 * Kundens bruger-dokument fra den lokale kopi, eller null hvis der ikke er
 * nogen. Kaster aldrig.
 *
 * Null er en helt normal tilstand og ikke en fejl. Det sker foerste gang
 * kunden logger ind paa en enhed, og hvis browseren har ryddet sin lagring
 * (privat vindue, fuld kvota, eller Safari der rydder op efter laengere tids
 * pause). I alle de tilfaelde falder opstarten tilbage til at spoerge
 * serveren, praecis som den altid har gjort.
 */
export async function hentUserDocFraCache(uid: string): Promise<UserDoc | null> {
	try {
		const snap = await getDocFromCache(doc(db, 'users', uid));
		if (!snap.exists()) return null;
		return snap.data() as UserDoc;
	} catch {
		return null;
	}
}
