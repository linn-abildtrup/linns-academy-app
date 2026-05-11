// Firestore-helpers for private opskrifter.
//
// Datamodel:
//   - users/{uid}/privateOpskrifter/{id}          ← klientens egne opskrifter
//   - Storage: users/{uid}/opskrift-billeder/{id} ← billede-fil

import {
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	orderBy,
	query,
	setDoc,
	Timestamp
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { MinOpskrift } from '$lib/content/minOpskrift';
import { aktivBrugerBasisPath } from '$lib/utils/adminKlient';

function opskriftCollection(uid: string) {
	return collection(db, `${aktivBrugerBasisPath(uid)}/privateOpskrifter`);
}

function opskriftRef(uid: string, id: string) {
	return doc(db, `${aktivBrugerBasisPath(uid)}/privateOpskrifter/${id}`);
}

export async function hentMineOpskrifter(uid: string): Promise<MinOpskrift[]> {
	const snap = await getDocs(query(opskriftCollection(uid), orderBy('oprettet', 'desc')));
	return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MinOpskrift);
}

export async function hentMinOpskrift(uid: string, id: string): Promise<MinOpskrift | null> {
	const snap = await getDoc(opskriftRef(uid, id));
	if (!snap.exists()) return null;
	return { id: snap.id, ...snap.data() } as MinOpskrift;
}

export async function opretMinOpskrift(
	uid: string,
	data: Omit<MinOpskrift, 'id' | 'oprettet' | 'opdateret'>
): Promise<string> {
	const id = `opskrift_${Date.now()}`;
	const nu = Timestamp.now();
	await setDoc(opskriftRef(uid, id), {
		...data,
		oprettet: nu,
		opdateret: nu
	});
	return id;
}

export async function gemMinOpskrift(
	uid: string,
	id: string,
	data: Partial<MinOpskrift>
): Promise<void> {
	await setDoc(
		opskriftRef(uid, id),
		{ ...data, opdateret: Timestamp.now() },
		{ merge: true }
	);
}

export async function sletMinOpskrift(uid: string, id: string): Promise<void> {
	await deleteDoc(opskriftRef(uid, id));
}
