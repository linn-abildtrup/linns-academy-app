// Kundens udstyrsvalg. Bid 3, 15. august 2026.
//
// Feltet er traeningsudstyr3 paa bruger-dokumentet. Det er additivt: den
// gamle app laeser det ikke, og der skal intet udgives i Firebase, for
// kunden maa i forvejen skrive paa sit eget dokument.
//
// Skrivningen ligger i sin egen lille fil, saa userDoc.ts ikke skal
// roeres. Samme greb som userDocCache og favoritOpskrifter.

import { doc, updateDoc } from 'firebase/firestore';
import { db } from '$lib/firebase';

/**
 * Gemmer hendes valg. Kategorier der vises altid skal IKKE med i listen,
 * for de gaelder uanset hvad, og et gemt id ville bare kunne blive
 * forkert den dag fluebenet flyttes til en anden kategori.
 */
export async function gemUdstyr3(uid: string, kategoriIds: string[]): Promise<void> {
	await updateDoc(doc(db, 'users', uid), { traeningsudstyr3: kategoriIds });
}
