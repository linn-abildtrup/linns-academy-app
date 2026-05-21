// Firestore-helpers for "mine programmer" (custom-builder).
//
// Datamodel: users/{uid}/mineProgrammer/{programId}
//
// Pure helpers ligger i $lib/content/mineProgrammer.

import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	getDocs,
	orderBy,
	query,
	setDoc,
	updateDoc
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { CustomProgram } from '$lib/content/mineProgrammer';
import type { UserDoc } from '$lib/types';

function mineProgrammerCol(uid: string) {
	return collection(db, 'users', uid, 'mineProgrammer');
}

export async function hentMineProgrammer(uid: string): Promise<CustomProgram[]> {
	const q = query(mineProgrammerCol(uid), orderBy('opdateret', 'desc'));
	const snap = await getDocs(q);
	return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CustomProgram, 'id'>) }));
}

export async function hentMitProgram(
	uid: string,
	programId: string
): Promise<CustomProgram | null> {
	const snap = await getDocs(mineProgrammerCol(uid));
	const match = snap.docs.find((d) => d.id === programId);
	if (!match) return null;
	return { id: match.id, ...(match.data() as Omit<CustomProgram, 'id'>) };
}

/**
 * Opretter et nyt program. Returnerer det gemte program med id.
 */
export async function opretMitProgram(
	uid: string,
	data: Omit<CustomProgram, 'id' | 'oprettet' | 'opdateret'>
): Promise<CustomProgram> {
	const nu = Date.now();
	const ref = await addDoc(mineProgrammerCol(uid), {
		...data,
		oprettet: nu,
		opdateret: nu
	});
	return { id: ref.id, ...data, oprettet: nu, opdateret: nu };
}

/**
 * Opdaterer et eksisterende program. Overskriver navn + øvelser og sætter
 * opdateret-timestamp. oprettet-felt bevares.
 */
export async function opdaterMitProgram(
	uid: string,
	programId: string,
	data: Pick<CustomProgram, 'navn' | 'oevelser'>
): Promise<void> {
	const nu = Date.now();
	await setDoc(
		doc(db, 'users', uid, 'mineProgrammer', programId),
		{ ...data, opdateret: nu },
		{ merge: true }
	);
}

export async function sletMitProgram(uid: string, programId: string): Promise<void> {
	await deleteDoc(doc(db, 'users', uid, 'mineProgrammer', programId));
}

/**
 * Sætter hvilket træningsprogram brugeren har valgt som sit aktive.
 * Bruges af træning-modulet og forsiden til at bestemme hvilket program
 * der vises og startes som default.
 */
export async function gemAktivtTraeningsprogram(
	uid: string,
	aktivt: NonNullable<UserDoc['aktivtTraeningsprogram']>
): Promise<void> {
	await updateDoc(doc(db, 'users', uid), { aktivtTraeningsprogram: aktivt });
}
