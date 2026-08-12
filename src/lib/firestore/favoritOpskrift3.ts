// Gemmer og fjerner bogmaerket paa en opskrift.
//
// Bogmaerkerne ligger i userDoc.favoritOpskrifter som et array af id'er, se
// content/favoritOpskrift3.ts for hvorfor det kun er et bogmaerke og ikke et
// gemt maaltid.
//
// Vi bruger arrayUnion og arrayRemove i stedet for at skrive hele listen. Saa
// kan to enheder markere hver sin opskrift samtidig uden at den ene overskriver
// den anden, og vi behoever ikke laese doc'et foerst.
//
// Ny fil med vilje. userDoc.ts er et delt modul som den app der er i drift
// bygger paa, og den maa kun laeses, ikke aendres. Se CLAUDE.md regel 2.
//
// Firestore-reglerne tillader i forvejen at kunden skriver sit eget dokument,
// og de validerer ikke felter, saa der skal INTET udgives i Console for det
// her. Tjekket 12. august, se firestore.rules linje 19.

import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '$lib/firebase';
import { FAVORIT_FELT } from '$lib/content/favoritOpskrift3';

/**
 * Slaar bogmaerket til eller fra paa serveren.
 *
 * Kalderen har allerede rettet sin egen visning, saa hjertet skifter med det
 * samme. Gaar skrivningen galt, kastes fejlen videre, saa kalderen kan rulle
 * visningen tilbage i stedet for at vise noget der ikke blev gemt.
 */
export async function saetFavoritOpskrift(
	uid: string,
	opskriftId: string,
	skalVaereFavorit: boolean
): Promise<void> {
	if (!uid || !opskriftId) return;
	await updateDoc(doc(db, 'users', uid), {
		[FAVORIT_FELT]: skalVaereFavorit ? arrayUnion(opskriftId) : arrayRemove(opskriftId)
	});
}
