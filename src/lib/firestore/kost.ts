// Firestore-helpers for kost-modulet (fødevarer + opskrifter).
// Holdt adskilt fra src/lib/content/kost.ts (typer + pure logik) så
// unit tests for sidstnævnte ikke trækker firebase/firestore-runtime ind.

import {
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	query,
	serverTimestamp,
	setDoc,
	where
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { FavoritMaaltid, Fodevare, GemtMaaltid } from '$lib/content/kost';

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

// ==============================================
// Dagbog — gemte måltider pr bruger
// ==============================================

/**
 * Gemmer et måltid i brugerens dagbog. Genererer et nyt id med Firestores
 * auto-id-generator. Returnerer det generede id.
 */
export async function gemMaaltid(
	uid: string,
	maaltid: Omit<GemtMaaltid, 'id'>
): Promise<string> {
	const ref = doc(collection(db, 'users', uid, 'maaltider'));
	await setDoc(ref, {
		...maaltid,
		oprettet: serverTimestamp()
	});
	return ref.id;
}

/**
 * Henter alle måltider for en specifik dato (YYYY-MM-DD).
 * Sorteret efter måltidstype (morgen → aften) skal ske kalder-side.
 */
export async function hentMaaltiderForDato(
	uid: string,
	dato: string
): Promise<GemtMaaltid[]> {
	const q = query(
		collection(db, 'users', uid, 'maaltider'),
		where('dato', '==', dato)
	);
	const snap = await getDocs(q);
	return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GemtMaaltid);
}

/**
 * Sletter et gemt måltid.
 */
export async function sletMaaltid(uid: string, mealId: string): Promise<void> {
	await deleteDoc(doc(db, 'users', uid, 'maaltider', mealId));
}

// ==============================================
// Favoritmåltider — skabeloner til hurtig genbrug
// ==============================================

/**
 * Gemmer et måltid som favorit-skabelon. Returnerer det generede id.
 */
export async function gemFavorit(
	uid: string,
	favorit: Omit<FavoritMaaltid, 'id'>
): Promise<string> {
	const ref = doc(collection(db, 'users', uid, 'favoritmaaltider'));
	await setDoc(ref, {
		...favorit,
		oprettet: serverTimestamp()
	});
	return ref.id;
}

/**
 * Henter alle favoritmåltider for en bruger sorteret alfabetisk.
 */
export async function hentFavoritter(uid: string): Promise<FavoritMaaltid[]> {
	const snap = await getDocs(collection(db, 'users', uid, 'favoritmaaltider'));
	return snap.docs
		.map((d) => ({ id: d.id, ...d.data() }) as FavoritMaaltid)
		.sort((a, b) => a.navn.localeCompare(b.navn, 'da'));
}

/**
 * Opdaterer en eksisterende favorit. Bruges når brugeren redigerer
 * navnet eller ingredienserne på en favorit-skabelon.
 */
export async function opdaterFavorit(
	uid: string,
	favoritId: string,
	data: Omit<FavoritMaaltid, 'id'>
): Promise<void> {
	const ref = doc(db, 'users', uid, 'favoritmaaltider', favoritId);
	await setDoc(ref, { ...data, opdateret: serverTimestamp() }, { merge: true });
}

/**
 * Sletter en favorit.
 */
export async function sletFavorit(uid: string, favoritId: string): Promise<void> {
	await deleteDoc(doc(db, 'users', uid, 'favoritmaaltider', favoritId));
}
