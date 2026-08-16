// Onboarding skriver to felter paa kundens eget dokument. Bid 1,
// 16. august 2026.
//
// Begge er additive: den gamle app laeser dem ikke, kunden maa i
// forvejen skrive paa sit eget dokument, og der skal derfor intet
// udgives i Firebase. Samme greb som traeningsudstyr3 og
// favoritOpskrifter, saa userDoc.ts ikke skal roeres.

import { doc, updateDoc } from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { TekstSkala3 } from '$lib/content/onboarding3';

/**
 * Hendes valg af skriftstoerrelse.
 *
 * Den gamle app gemmer KUN i browserens localStorage, saa valget er vaek
 * naar hun skifter telefon. Vi gemmer begge steder: paa kontoen saa det
 * foelger med, og i localStorage saa den gamle app og rod-layoutet
 * stadig ser det med det samme.
 */
export async function gemTekstSkala3(uid: string, skala: TekstSkala3): Promise<void> {
	await updateDoc(doc(db, 'users', uid), { tekstSkala3: skala });
}

/**
 * Markerer at hun har vaeret hele opstarten igennem.
 *
 * Skrives FOERST naar hun er faerdig, ikke undervejs. Falder hun ud
 * midt i, skal hun starte forfra naeste gang, for et halvt svar er
 * vaerre end ingen: en tom udstyrsliste ville saa betyde "hun har
 * svaret" uden at hun havde.
 */
export async function markerOnboardet3(uid: string): Promise<void> {
	await updateDoc(doc(db, 'users', uid), { onboardet3: Date.now() });
}

/**
 * Nulstiller, saa hun kan koere hele opstarten igen fra Profil.
 *
 * Bemaerk at det IKKE sletter hendes svar. Udstyret og
 * skriftstoerrelsen bliver staaende, og skaermene aabner med det hun har
 * valgt, saa hun kan noejes med at rette det ene hun kom efter.
 */
export async function nulstilOnboarding3(uid: string): Promise<void> {
	await updateDoc(doc(db, 'users', uid), { onboardet3: 0 });
}
