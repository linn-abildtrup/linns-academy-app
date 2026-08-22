// ============================================================
// Gemmer de maal guiden har regnet ud.
//
// HVORFOR DEN IKKE BRUGER DEN GAMLE APPS FUNKTION. Den slaar samtidig
// udvidet naering TIL paa kunden. Det gav mening i den gamle app, hvor
// guiden kun kunne naas naar kontakten allerede var slaaet til. I 3.0
// staar guiden altid fremme, ogsaa for hende der kun vil vide hvor meget
// protein hun skal have. Linns beslutning 22. august.
//
// Ville vi kalde den gamle, ville et enkelt tryk paa "Brug de her maal"
// pludselig sætte kalorier paa hendes forside. Se HANDOVER 9.38.
//
// Der skrives KUN de to felter. visUdvidetNaering roeres ikke, hverken
// til eller fra: det er hendes eget valg, og det bor paa kontakten.
// ============================================================

import { doc, updateDoc } from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { BrugerProfil, DagligeMaal } from '$lib/types';

export async function gemBeregnedeMaal3(
	uid: string,
	profil: BrugerProfil,
	maal: DagligeMaal
): Promise<void> {
	await updateDoc(doc(db, 'users', uid), { brugerProfil: profil, dagligeMaal: maal });
}
