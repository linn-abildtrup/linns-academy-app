// Firestore-helpers for traeningHistorik.
//
// Datamodel: users/{uid}/traeningHistorik/{auto-id}

import {
	addDoc,
	collection,
	getDocs,
	query,
	where
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { TraeningHistorikEntry } from '$lib/content/traeningHistorik';

function historikCol(uid: string) {
	return collection(db, 'users', uid, 'traeningHistorik');
}

/**
 * Logger en gennemført træning. Tilføjer et nyt doc — vi opretter altid
 * en ny entry så historikken bevares selv hvis kunden træner flere gange
 * samme dag eller skifter program.
 */
export async function logTraening(
	uid: string,
	entry: Omit<TraeningHistorikEntry, 'id'>
): Promise<void> {
	await addDoc(historikCol(uid), entry);
}

/**
 * Henter alle træning-entries for en specifik dato. Returnerer tom liste
 * hvis kunden ikke trænede den dag.
 */
export async function hentHistorikForDato(
	uid: string,
	dato: string
): Promise<TraeningHistorikEntry[]> {
	const q = query(historikCol(uid), where('dato', '==', dato));
	const snap = await getDocs(q);
	return snap.docs.map((d) => ({
		id: d.id,
		...(d.data() as Omit<TraeningHistorikEntry, 'id'>)
	}));
}
