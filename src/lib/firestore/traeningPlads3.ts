// Den gemte plads i en traening. Bid 4, 15. august 2026.
//
// users/{uid}/traeningPlads3/{programId}
//
// Én plads pr program. Vaelger hun "Gem hvor jeg er kommet til" naar hun
// forlader en traening, ligger den her til naeste gang. Skifter hun til
// et andet program, ligger den stadig, saa hun kan vende tilbage.
//
// Pladsen slettes naar traeningen er gennemfoert, og naar hun svarer nej.

import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '$lib/firebase';
import { aktivBrugerBasisPath } from '$lib/utils/adminKlient';
import type { GemtPlads3 } from '$lib/content/afspiller3';

function pladsDoc(uid: string, programId: string) {
	return doc(db, `${aktivBrugerBasisPath(uid)}/traeningPlads3/${programId}`);
}

export async function hentPlads3(uid: string, programId: string): Promise<GemtPlads3 | null> {
	const snap = await getDoc(pladsDoc(uid, programId));
	if (!snap.exists()) return null;
	return snap.data() as GemtPlads3;
}

export async function gemPlads3(uid: string, plads: GemtPlads3): Promise<void> {
	await setDoc(pladsDoc(uid, plads.programId), plads);
}

export async function sletPlads3(uid: string, programId: string): Promise<void> {
	await deleteDoc(pladsDoc(uid, programId));
}
