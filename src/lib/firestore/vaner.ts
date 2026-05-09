// Firestore-helpers for vanetracker.
// Holdt adskilt fra src/lib/content/vaner.ts (typer + pure logik) så
// unit tests for sidstnævnte ikke trækker firebase/firestore-runtime ind.
//
// Datamodel:
//   - forlob/{forlobId}/vaneprogram/{dagId}     ← programmets spørgsmål pr dag
//                                                  (hver forløb har sit eget)
//   - users/{uid}/products/{productId}/vanedage/{dagId}  ← brugerens svar

import {
	collection,
	doc,
	getDoc,
	getDocs,
	serverTimestamp,
	setDoc
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { VaneProgramDag, VanedagEntry } from '$lib/content/vaner';
import { aktivBrugerBasisPath } from '$lib/utils/adminKlient';

function vanedageCollection(uid: string, productId: string) {
	return collection(db, `${aktivBrugerBasisPath(uid)}/products/${productId}/vanedage`);
}

function vanedagDoc(uid: string, productId: string, dagId: string) {
	return doc(db, `${aktivBrugerBasisPath(uid)}/products/${productId}/vanedage/${dagId}`);
}

// ==============================================
// Vaneprogram-helpers (pr forløb)
// ==============================================

/**
 * Henter alle vaneprogram-dage for et forløb sorteret efter dagNummer.
 * Returnerer en tom liste hvis forløbet ikke har vaner sat op endnu.
 */
export async function hentVaneprogramForForlob(forlobId: string): Promise<VaneProgramDag[]> {
	const snap = await getDocs(collection(db, 'forlob', forlobId, 'vaneprogram'));
	return snap.docs
		.map((d) => d.data() as VaneProgramDag)
		.sort((a, b) => a.dagNummer - b.dagNummer);
}

/**
 * Henter én specifik vaneprogram-dag for et forløb.
 */
export async function hentVaneprogramDag(
	forlobId: string,
	dagNummer: number
): Promise<VaneProgramDag | null> {
	const ref = doc(db, 'forlob', forlobId, 'vaneprogram', `dag${dagNummer}`);
	const snap = await getDoc(ref);
	if (!snap.exists()) return null;
	return snap.data() as VaneProgramDag;
}

/**
 * Gemmer en vaneprogram-dag for et forløb (admin-skrivning).
 */
export async function gemVaneprogramDag(
	forlobId: string,
	dag: VaneProgramDag
): Promise<void> {
	const id = `dag${dag.dagNummer}`;
	const ref = doc(db, 'forlob', forlobId, 'vaneprogram', id);
	await setDoc(ref, dag);
}

// ==============================================
// VanedagEntry-helpers (brugerens svar — uændret)
// ==============================================

/**
 * Henter alle brugerens svar for et givet produkt.
 * Returnerer Map fra dagNummer til VanedagEntry.
 */
export async function hentAlleVanedage(
	uid: string,
	productId: string = 'kickstart'
): Promise<Map<number, VanedagEntry>> {
	const snap = await getDocs(vanedageCollection(uid, productId));
	const map = new Map<number, VanedagEntry>();
	for (const d of snap.docs) {
		const data = d.data() as VanedagEntry;
		map.set(data.dagNummer, data);
	}
	return map;
}

/**
 * Henter brugerens svar for én specifik dag.
 * Returnerer null hvis dagen ikke er besvaret endnu.
 */
export async function hentVanedag(
	uid: string,
	dagNummer: number,
	productId: string = 'kickstart'
): Promise<VanedagEntry | null> {
	const id = `dag${dagNummer}`;
	const snap = await getDoc(vanedagDoc(uid, productId, id));
	if (!snap.exists()) return null;
	return snap.data() as VanedagEntry;
}

/**
 * Gemmer brugerens svar for én dag. Sætter savedAt med serverTimestamp.
 * Bruger setDoc med merge så delvise opdateringer ikke nulstiller andre felter.
 */
export async function gemVanedag(
	uid: string,
	entry: Omit<VanedagEntry, 'savedAt'>,
	productId: string = 'kickstart'
): Promise<void> {
	const id = `dag${entry.dagNummer}`;
	await setDoc(
		vanedagDoc(uid, productId, id),
		{ ...entry, savedAt: serverTimestamp() },
		{ merge: true }
	);
}
