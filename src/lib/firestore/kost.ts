// Firestore-helpers for kost-modulet (fødevarer + opskrifter).
// Holdt adskilt fra src/lib/content/kost.ts (typer + pure logik) så
// unit tests for sidstnævnte ikke trækker firebase/firestore-runtime ind.

import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { Fodevare } from '$lib/content/kost';

/**
 * Henter hele fødevaredatabasen sorteret alfabetisk.
 * Bruges af beregneren — alle fødevarer caches på klienten ved første load.
 */
export async function hentAlleFodevarer(): Promise<Fodevare[]> {
	const snap = await getDocs(collection(db, 'fodevarer'));
	return snap.docs
		.map((d) => ({ id: d.id, ...d.data() }) as Fodevare)
		.sort((a, b) => a.name.localeCompare(b.name, 'da'));
}

/**
 * Henter en enkelt fødevare. Returnerer null hvis den ikke findes.
 */
export async function hentFodevare(id: string): Promise<Fodevare | null> {
	const ref = doc(db, 'fodevarer', id);
	const snap = await getDoc(ref);
	if (!snap.exists()) return null;
	return { id: snap.id, ...snap.data() } as Fodevare;
}

/**
 * Opretter eller opdaterer en fødevare. Bruges af seed-script og admin
 * (sidstnævnte tilføjes senere).
 */
export async function gemFodevare(fodevare: Fodevare): Promise<void> {
	const { id, ...data } = fodevare;
	const ref = doc(db, 'fodevarer', id);
	await setDoc(ref, data, { merge: true });
}
