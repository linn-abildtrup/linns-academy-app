// Firestore-helpers for aiRatings-collection.

import {
	collection,
	doc,
	getDocs,
	limit,
	orderBy,
	query,
	serverTimestamp,
	setDoc,
	where
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { AiRating, AiType, Rating } from '$lib/content/aiRating';
import { aiRatingDocId } from '$lib/content/aiRating';

const COLLECTION = 'aiRatings';

export async function gemAiRating(input: {
	aiType: AiType;
	uid: string;
	userEmail: string;
	sporgsmaal: string;
	svar: string;
	rating: Rating;
	samtaleId?: string;
	beskedIdx?: number;
}): Promise<string> {
	const id = aiRatingDocId(input.aiType, input.uid, {
		samtaleId: input.samtaleId,
		beskedIdx: input.beskedIdx
	});
	await setDoc(
		doc(db, COLLECTION, id),
		{
			aiType: input.aiType,
			uid: input.uid,
			userEmail: input.userEmail,
			sporgsmaal: input.sporgsmaal.slice(0, 1500),
			svar: input.svar.slice(0, 5000),
			rating: input.rating,
			samtaleId: input.samtaleId ?? null,
			beskedIdx: input.beskedIdx ?? null,
			oprettetAt: serverTimestamp()
		},
		{ merge: true }
	);
	return id;
}

/**
 * Henter en specifik rating hvis brugeren tidligere har ratet svaret.
 * Bruges af UI'et til at vise hvilken rating brugeren har givet.
 */
export async function hentAiRating(
	aiType: AiType,
	uid: string,
	samtaleId: string | undefined,
	beskedIdx: number | undefined
): Promise<AiRating | null> {
	if (aiType !== 'linn-ai' || !samtaleId || beskedIdx === undefined) return null;
	const id = aiRatingDocId(aiType, uid, { samtaleId, beskedIdx });
	const snap = await getDocs(
		query(collection(db, COLLECTION), where('__name__', '==', id), limit(1))
	);
	if (snap.empty) return null;
	const d = snap.docs[0];
	return { id: d.id, ...(d.data() as Omit<AiRating, 'id'>) };
}

/**
 * Admin-only: henter alle ratings, nyeste først. Bruges af admin-siden.
 */
export async function hentAlleAiRatings(): Promise<AiRating[]> {
	const q = query(collection(db, COLLECTION), orderBy('oprettetAt', 'desc'), limit(500));
	const snap = await getDocs(q);
	return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AiRating, 'id'>) }));
}
