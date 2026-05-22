// Firestore-helpers for MRS (Menopause Rating Scale).
//
// Datamodel: users/{uid}/mrs_scores/{auto-id}

import {
	addDoc,
	collection,
	getDocs,
	orderBy,
	query
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import {
	calculateSubscales,
	calculateTotal,
	type MaalePunkt,
	type MrsScore,
	type MrsSliders
} from '$lib/content/mrs';

function mrsCol(uid: string) {
	return collection(db, 'users', uid, 'mrs_scores');
}

/**
 * Gemmer et udfyldt MRS-skema. Beregner subskala-scorer og total ud fra
 * de individuelle svar — kalderen skal kun sende scores-objektet.
 *
 * Skema er immutable: ingen update/delete. Hvis kunden udfylder samme
 * målepunkt to gange (fx omfortolker eller tester), oprettes en ny entry.
 * Brug seneste når der vises sammenligning.
 */
export async function gemMrsScore(
	uid: string,
	email: string,
	measurePoint: MaalePunkt,
	scores: Record<number, number>,
	sliders?: MrsSliders
): Promise<MrsScore> {
	const subscales = calculateSubscales(scores);
	const total = calculateTotal(scores);
	const data: Omit<MrsScore, 'id'> = {
		uid,
		email,
		measurePoint,
		timestamp: Date.now(),
		scores,
		subscales,
		total,
		...(sliders ? { sliders } : {})
	};
	const ref = await addDoc(mrsCol(uid), data);
	return { id: ref.id, ...data };
}

/**
 * Henter alle MRS-udfyldelser for en kunde, sorteret efter timestamp
 * (ældste først). Bruges af resultat-/sammenligningssiden.
 */
export async function hentAlleMrsScores(uid: string): Promise<MrsScore[]> {
	const q = query(mrsCol(uid), orderBy('timestamp', 'asc'));
	const snap = await getDocs(q);
	return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MrsScore, 'id'>) }));
}
