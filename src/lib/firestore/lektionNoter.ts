// Firestore-helpers for lektion-noter.
//
// Datamodel: users/{uid}/lektionNoter/{noterId}

import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '$lib/firebase';
import {
	noteDocId,
	type LektionNote
} from '$lib/content/lektionNoter';

function noteRef(uid: string, forlobId: string, lektionId: string) {
	return doc(db, 'users', uid, 'lektionNoter', noteDocId(forlobId, lektionId));
}

export async function hentLektionNote(
	uid: string,
	forlobId: string,
	lektionId: string
): Promise<LektionNote | null> {
	const snap = await getDoc(noteRef(uid, forlobId, lektionId));
	if (!snap.exists()) return null;
	return { id: snap.id, ...(snap.data() as Omit<LektionNote, 'id'>) };
}

/**
 * Henter alle noter for et givet forløb. Bruges af biblioteks-fanen til
 * at vise noter-indikator pr lektion.
 */
export async function hentNoterForForlob(
	uid: string,
	forlobId: string
): Promise<LektionNote[]> {
	const snap = await getDocs(collection(db, 'users', uid, 'lektionNoter'));
	return snap.docs
		.map((d) => ({ id: d.id, ...(d.data() as Omit<LektionNote, 'id'>) }))
		.filter((n) => n.forlobId === forlobId);
}

/**
 * Gemmer eller opdaterer en note. Hvis teksten er tom (efter trim) slettes
 * noten i stedet — undgår tomme docs.
 */
export async function gemLektionNote(
	uid: string,
	forlobId: string,
	lektionId: string,
	tekst: string
): Promise<void> {
	const trimmet = tekst.trim();
	if (!trimmet) {
		await deleteDoc(noteRef(uid, forlobId, lektionId)).catch(() => undefined);
		return;
	}
	const ref = noteRef(uid, forlobId, lektionId);
	const eksisterende = await getDoc(ref);
	const nu = Date.now();
	const oprettet = eksisterende.exists()
		? (eksisterende.data() as LektionNote).oprettet
		: nu;
	const data: Omit<LektionNote, 'id'> = {
		forlobId,
		lektionId,
		tekst: trimmet,
		oprettet,
		opdateret: nu
	};
	await setDoc(ref, data);
}
