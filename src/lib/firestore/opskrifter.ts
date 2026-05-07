// Firestore-helpers for opskrifter.
// Opskrifter er globale (ikke pr forløb) og ligger i opskrifter/{id}.

import {
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	serverTimestamp,
	setDoc
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { Opskrift } from '$lib/content/opskrifter';

/**
 * Henter alle opskrifter sorteret alfabetisk efter titel.
 * Inaktive opskrifter inkluderes ikke for klient-side — admin får dem alle.
 */
export async function hentAlleOpskrifter(kunAktive: boolean = true): Promise<Opskrift[]> {
	const snap = await getDocs(collection(db, 'opskrifter'));
	let liste = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Opskrift);
	if (kunAktive) liste = liste.filter((o) => o.aktiv);
	return liste.sort((a, b) => a.titel.localeCompare(b.titel, 'da'));
}

/**
 * Henter en enkelt opskrift. Returnerer null hvis den ikke findes.
 */
export async function hentOpskrift(id: string): Promise<Opskrift | null> {
	const ref = doc(db, 'opskrifter', id);
	const snap = await getDoc(ref);
	if (!snap.exists()) return null;
	return { id: snap.id, ...snap.data() } as Opskrift;
}

/**
 * Opretter eller opdaterer en opskrift. Sætter opdateret-tidsstempel
 * automatisk, og oprettet ved første gang.
 */
export async function gemOpskrift(opskrift: Opskrift): Promise<void> {
	const { id, oprettet, ...data } = opskrift;
	const ref = doc(db, 'opskrifter', id);
	const eks = await getDoc(ref);
	const skrivData: Record<string, unknown> = {
		...data,
		opdateret: serverTimestamp()
	};
	if (!eks.exists()) {
		skrivData.oprettet = oprettet ?? serverTimestamp();
	}
	await setDoc(ref, skrivData, { merge: true });
}

/**
 * Sletter en opskrift fra Firestore.
 */
export async function sletOpskrift(id: string): Promise<void> {
	await deleteDoc(doc(db, 'opskrifter', id));
}
