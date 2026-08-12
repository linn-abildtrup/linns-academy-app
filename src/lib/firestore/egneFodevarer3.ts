// ============================================================
// Kundens egne foedevarer mod Firestore. Reglerne ligger i
// content/egneFodevarer3.ts, den her fil laeser og skriver kun.
//
// VI BLIVER I DEN GAMLE SAMLING users/{uid}/customFodevarer, saa en
// vare hun laver i 3.0 ogsaa virker i den app der er i drift, mens
// kunderne flyttes hold for hold.
//
// Der skal intet udgives i Firebase: reglerne daekker samlingen i
// forvejen, se firestore.rules.
// ============================================================

import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { Fodevare } from '$lib/content/kost';

function samling(uid: string) {
	return collection(db, 'users', uid, 'customFodevarer');
}

/** Hendes egne, alfabetisk. */
export async function hentEgneFodevarer3(uid: string): Promise<Fodevare[]> {
	const snap = await getDocs(samling(uid));
	return snap.docs
		.map((d) => ({ id: d.id, ...d.data() }) as Fodevare)
		.sort((a, b) => a.name.localeCompare(b.name, 'da'));
}

/**
 * Gemmer en ny eller retter en hun har. Returnerer id'et.
 *
 * Merge, saa felter vi ikke kender bliver staaende. Retter hun tallene
 * paa en vare hun allerede har brugt, aendrer det IKKE de registreringer
 * hun har lavet: hvert maaltid gemmer sine egne tal. Kun fremtiden
 * bliver rigtig, og det er den rigtige opfoersel. Linns beslutning
 * 12. august.
 */
export async function gemEgenFodevare3(
	uid: string,
	data: Omit<Fodevare, 'id'>,
	id?: string
): Promise<string> {
	const ref = id ? doc(samling(uid), id) : doc(samling(uid));
	await setDoc(ref, { ...data, opdateret: serverTimestamp() }, { merge: true });
	return ref.id;
}

/**
 * Sletter en egen foedevare.
 *
 * Det hun allerede har registreret bliver staaende: maaltiderne gemmer
 * selv deres tal, saa dagbogen aendrer sig ikke. Varen forsvinder kun
 * som genvej, og som forslag under "Det du plejer", hvor en madvare
 * uden navn springes over.
 */
export async function sletEgenFodevare3(uid: string, id: string): Promise<void> {
	await deleteDoc(doc(samling(uid), id));
}
