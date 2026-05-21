// Admin-tildelte vaner pr forløb.
//
// Når Linn vil pushe specifikke vaner til alle deltagere på et forløb
// (oveni kundens 3 selvvalgte) lægges de her. Kunden ser dem som låste —
// hun kan tjekke ja/nej/delvist hver dag men kan ikke fjerne dem fra
// sin opsætning.
//
// Datamodel: forlob/{forlobId}/admintildelteVaner/{auto-id}
//   { label: string, oprettetAt: number, oprettetAf: string }

import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	getDocs,
	orderBy,
	query
} from 'firebase/firestore';
import { db } from '$lib/firebase';

export interface AdminTildeltVane {
	id: string;
	label: string;
	oprettetAt: number;
	oprettetAf: string;
}

function adminVanerCol(forlobId: string) {
	return collection(db, 'forlob', forlobId, 'admintildelteVaner');
}

export async function hentAdminVanerForForlob(
	forlobId: string
): Promise<AdminTildeltVane[]> {
	const q = query(adminVanerCol(forlobId), orderBy('oprettetAt', 'asc'));
	const snap = await getDocs(q);
	return snap.docs.map((d) => ({
		id: d.id,
		...(d.data() as Omit<AdminTildeltVane, 'id'>)
	}));
}

/**
 * Henter admin-tildelte vaner fra alle forløb kunden er (eller har været)
 * tilknyttet. Bruges på kunde-siden hvor vi merger med hendes selvvalgte.
 */
export async function hentAdminVanerForKunde(
	forlobIds: string[]
): Promise<AdminTildeltVane[]> {
	if (forlobIds.length === 0) return [];
	const alleArrays = await Promise.all(forlobIds.map(hentAdminVanerForForlob));
	return alleArrays.flat();
}

export async function tilfoejAdminVane(
	forlobId: string,
	label: string,
	oprettetAf: string
): Promise<AdminTildeltVane> {
	const nu = Date.now();
	const data = { label: label.trim(), oprettetAt: nu, oprettetAf };
	const ref = await addDoc(adminVanerCol(forlobId), data);
	return { id: ref.id, ...data };
}

export async function sletAdminVane(forlobId: string, vaneId: string): Promise<void> {
	await deleteDoc(doc(db, 'forlob', forlobId, 'admintildelteVaner', vaneId));
}
