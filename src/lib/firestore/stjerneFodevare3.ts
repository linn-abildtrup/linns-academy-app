// Saetter og fjerner stjernen paa en foedevare.
//
// Stjernerne ligger i userDoc.favoritFodevarer, samme felt som den gamle
// app bruger, se content/stjerneFodevare3.ts.
//
// arrayUnion og arrayRemove i stedet for at skrive hele listen, saa to
// enheder kan stjerne hver sin vare samtidig uden at overskrive hinanden.
//
// Ny fil med vilje: userDoc.ts er et delt modul som den app der er i
// drift bygger paa, og den maa kun laeses. Se CLAUDE.md regel 2.
//
// Der skal INTET udgives i Firebase. Reglerne tillader i forvejen at
// kunden skriver sit eget dokument, se firestore.rules.

import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '$lib/firebase';
import { STJERNE_FELT } from '$lib/content/stjerneFodevare3';

/**
 * Slaar stjernen til eller fra paa serveren.
 *
 * Kalderen har allerede rettet sin egen visning, saa stjernen skifter med
 * det samme. Gaar skrivningen galt, kastes fejlen videre, saa kalderen kan
 * rulle visningen tilbage i stedet for at vise noget der ikke blev gemt.
 */
export async function saetStjerne3(
	uid: string,
	foodId: string,
	skalVaereStjernet: boolean
): Promise<void> {
	if (!uid || !foodId) return;
	await updateDoc(doc(db, 'users', uid), {
		[STJERNE_FELT]: skalVaereStjernet ? arrayUnion(foodId) : arrayRemove(foodId)
	});
}
