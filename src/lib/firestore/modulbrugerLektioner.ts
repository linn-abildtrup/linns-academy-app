// Firestore-helpers for modulbruger-lektioner.
// Hver lektion er ét dokument i collection 'modulbrugerLektioner' med
// doc-id = YYYY-MM-DD. Hvis dokumentet ikke findes, er der ingen lektion
// på den dato.

import {
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	orderBy,
	query,
	serverTimestamp,
	setDoc
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { ModulbrugerLektion } from '$lib/content/modulbrugerLektioner';

const COLLECTION = 'modulbrugerLektioner';

function lektionDoc(dato: string) {
	return doc(db, COLLECTION, dato);
}

/**
 * Henter lektion for en specifik dato. Returnerer null hvis ingen findes.
 */
export async function hentModulbrugerLektion(
	dato: string
): Promise<ModulbrugerLektion | null> {
	const snap = await getDoc(lektionDoc(dato));
	if (!snap.exists()) return null;
	return { dato, ...(snap.data() as Omit<ModulbrugerLektion, 'dato'>) };
}

/**
 * Henter alle modulbruger-lektioner sorteret efter dato (nyeste først).
 * Bruges af admin-siden til at vise hele listen.
 */
export async function hentAlleModulbrugerLektioner(): Promise<ModulbrugerLektion[]> {
	const q = query(collection(db, COLLECTION), orderBy('dato', 'desc'));
	const snap = await getDocs(q);
	return snap.docs.map(
		(d) => ({ dato: d.id, ...(d.data() as Omit<ModulbrugerLektion, 'dato'>) })
	);
}

/**
 * Gemmer eller opdaterer en lektion. dato bruges som doc-id.
 */
export async function gemModulbrugerLektion(
	lektion: ModulbrugerLektion
): Promise<void> {
	const data: Record<string, unknown> = {
		dato: lektion.dato,
		titel: lektion.titel,
		beskrivelse: lektion.beskrivelse,
		indhold: lektion.indhold ?? '',
		url: lektion.url ?? '',
		format: lektion.format ?? '',
		varighedMin: lektion.varighedMin ?? 0,
		opdateretAt: serverTimestamp()
	};
	if (!lektion.oprettetAt) data.oprettetAt = serverTimestamp();
	await setDoc(lektionDoc(lektion.dato), data, { merge: true });
}

/**
 * Sletter en lektion.
 */
export async function sletModulbrugerLektion(dato: string): Promise<void> {
	await deleteDoc(lektionDoc(dato));
}
