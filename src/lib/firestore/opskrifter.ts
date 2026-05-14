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
import { normaliserKategorier, type Opskrift } from '$lib/content/opskrifter';

function fraDoc(id: string, data: Record<string, unknown>): Opskrift {
	const opskrift = { id, ...data } as Opskrift;
	// Migrér gamle kategori-ids (salat/snack/dessert/tilbehor → andet).
	opskrift.kategorier = normaliserKategorier(
		opskrift.kategorier as unknown as string[] | undefined
	);
	return opskrift;
}

/**
 * Henter alle opskrifter sorteret alfabetisk efter titel.
 * Inaktive opskrifter inkluderes ikke for klient-side — admin får dem alle.
 */
export async function hentAlleOpskrifter(kunAktive: boolean = true): Promise<Opskrift[]> {
	const snap = await getDocs(collection(db, 'opskrifter'));
	let liste = snap.docs.map((d) => fraDoc(d.id, d.data()));
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
	return fraDoc(snap.id, snap.data());
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
