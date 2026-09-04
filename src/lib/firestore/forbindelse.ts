// Lytter der afgoer om appen faktisk kan naa serveren.
//
// Vi spoerger ikke telefonen, for den lyver: den siger gerne online paa et
// hotelnet der ikke slipper noget igennem. I stedet lytter vi paa kundens
// eget dokument og beder om at faa besked ogsaa naar KUN metadataen aendrer
// sig. Firestore fortaeller i hvert svar om dataen kom fra serveren eller fra
// den lokale kopi paa telefonen. Kommer den fra den lokale kopi, er der ingen
// forbindelse i praksis, og saa skal baandet frem.
//
// Se forbindelseState.svelte.ts for hvorfor det her overhovedet er noedvendigt.

import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '$lib/firebase';
import { setServerSvarer } from '$lib/state/forbindelseState.svelte';

/**
 * Starter lytteren. Returnerer funktionen der stopper den igen.
 *
 * Fejler lytteren, fx fordi reglerne siger nej, gaar vi ud fra at der ER
 * forbindelse. Et baand der staar fremme paa en app der virker fint er
 * vaerre end intet baand.
 */
export function lytTilForbindelse(uid: string): () => void {
	return onSnapshot(
		doc(db, 'users', uid),
		{ includeMetadataChanges: true },
		(snap) => setServerSvarer(!snap.metadata.fromCache),
		(e) => {
			console.warn('Forbindelses-lytteren fejlede:', e);
			setServerSvarer(true);
		}
	);
}
