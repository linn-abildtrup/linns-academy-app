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

// In-memory cache pr session. Opskrifter ændres sjældent under en session
// (kun admin redigerer dem), så vi henter ÉN gang og deler på tværs af alle
// kald. Firestore-SDK'ens IndexedDB-cache dækker desuden første-load på
// tværs af sessions.
let cachedAlleOpskrifter: Opskrift[] | null = null;
let cachedAllePromise: Promise<Opskrift[]> | null = null;

/**
 * Henter alle opskrifter sorteret alfabetisk efter titel.
 * Inaktive opskrifter inkluderes ikke for klient-side — admin får dem alle.
 *
 * In-memory cached pr session. Brug `ryAlleOpskrifterCache()` efter
 * admin-redigering så næste kald får frisk data.
 */
export async function hentAlleOpskrifter(kunAktive: boolean = true): Promise<Opskrift[]> {
	if (cachedAlleOpskrifter) {
		return kunAktive ? cachedAlleOpskrifter.filter((o) => o.aktiv) : cachedAlleOpskrifter;
	}
	if (cachedAllePromise) {
		const liste = await cachedAllePromise;
		return kunAktive ? liste.filter((o) => o.aktiv) : liste;
	}
	cachedAllePromise = (async () => {
		try {
			const snap = await getDocs(collection(db, 'opskrifter'));
			const liste = snap.docs
				.map((d) => fraDoc(d.id, d.data()))
				.sort((a, b) => a.titel.localeCompare(b.titel, 'da'));
			cachedAlleOpskrifter = liste;
			return liste;
		} catch (e) {
			cachedAllePromise = null;
			throw e;
		}
	})();
	const liste = await cachedAllePromise;
	return kunAktive ? liste.filter((o) => o.aktiv) : liste;
}

/**
 * Invaliderer in-memory opskrift-cachen. Bruges efter admin opretter/
 * redigerer/sletter en opskrift.
 */
export function ryAlleOpskrifterCache(): void {
	cachedAlleOpskrifter = null;
	cachedAllePromise = null;
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
