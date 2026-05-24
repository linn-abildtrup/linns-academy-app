// Admin-tildelte vaner pr forløb.
//
// Når Linn vil pushe specifikke vaner til alle deltagere på et forløb
// (oveni kundens 3 selvvalgte) lægges de her. Kunden ser dem som låste —
// hun kan tjekke ja/nej/delvist hver dag men kan ikke fjerne dem fra
// sin opsætning.
//
// Datamodel: forlob/{forlobId}/admintildelteVaner/{auto-id}
//   { label: string, ugeNummer?: number, oprettetAt: number, oprettetAf: string }
//
// ugeNummer er valgfrit. Hvis sat, vises vanen kun i den uge af forløbet.
// Hvis udeladt, opfattes vanen som "altid aktiv" (bagudkompatibelt med
// eksisterende Kickstart-vaner uden uge-felt).

import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	getDocs,
	orderBy,
	query,
	updateDoc
} from 'firebase/firestore';
import { db } from '$lib/firebase';

export interface AdminTildeltVane {
	id: string;
	label: string;
	ugeNummer?: number;
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
	oprettetAf: string,
	ugeNummer?: number
): Promise<AdminTildeltVane> {
	const nu = Date.now();
	const data: Omit<AdminTildeltVane, 'id'> = {
		label: label.trim(),
		oprettetAt: nu,
		oprettetAf
	};
	if (ugeNummer !== undefined) data.ugeNummer = ugeNummer;
	const ref = await addDoc(adminVanerCol(forlobId), data);
	return { id: ref.id, ...data };
}

export async function sletAdminVane(forlobId: string, vaneId: string): Promise<void> {
	await deleteDoc(doc(db, 'forlob', forlobId, 'admintildelteVaner', vaneId));
}

export async function opdaterAdminVane(
	forlobId: string,
	vaneId: string,
	opdateringer: { label?: string; ugeNummer?: number | null }
): Promise<void> {
	const data: Record<string, unknown> = {};
	if (opdateringer.label !== undefined) data.label = opdateringer.label.trim();
	if (opdateringer.ugeNummer !== undefined) data.ugeNummer = opdateringer.ugeNummer;
	await updateDoc(doc(db, 'forlob', forlobId, 'admintildelteVaner', vaneId), data);
}

/**
 * Returnerer kun de vaner der er aktive i en given uge.
 * Vaner uden ugeNummer-felt (legacy / Kickstart-stil) opfattes som altid aktive.
 * ugeNummer 0 forventes ikke i praksis — vi behandler det som "altid aktiv".
 */
export function filtrerVanerForUge(
	vaner: AdminTildeltVane[],
	ugeNummer: number
): AdminTildeltVane[] {
	return vaner.filter((v) => v.ugeNummer === undefined || v.ugeNummer === ugeNummer);
}
