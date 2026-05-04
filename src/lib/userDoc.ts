import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { UserDoc, UserState } from '$lib/types';

/**
 * Henter bruger-dokumentet fra Firestore.
 * Returnerer null hvis dokumentet ikke findes.
 */
export async function getUserDoc(uid: string): Promise<UserDoc | null> {
	const ref = doc(db, 'users', uid);
	const snap = await getDoc(ref);
	if (!snap.exists()) return null;
	return snap.data() as UserDoc;
}

/**
 * Opretter et nyt bruger-dokument i Firestore.
 * Bruges når en bruger registrerer sig for første gang.
 */
export async function createUserDoc(
	uid: string,
	email: string,
	firstName: string = '',
	state: UserState = 'modulbruger'
): Promise<void> {
	const ref = doc(db, 'users', uid);
	const userDoc: UserDoc = {
		firstName,
		email,
		state,
		createdAt: Date.now()
	};
	await setDoc(ref, userDoc);
}
