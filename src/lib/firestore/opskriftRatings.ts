// Firestore-helpers for opskrift-ratings.
// Hver rating ligger som opskrifter/{id}/ratings/{uid} med stjerner 1-5.
// Aggregat (ratingSum, ratingCount, ratingAvg) opdateres atomisk paa
// opskrift-doc via transaktion, saa gennemsnittet altid er konsistent.

import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '$lib/firebase';

export interface OpskriftRating {
	stjerner: number;
	opdateret?: unknown;
}

/**
 * Henter den indlogget brugers egen rating for en given opskrift.
 * Returnerer null hvis hun ikke har stemt endnu.
 */
export async function hentMinRating(
	opskriftId: string,
	uid: string
): Promise<number | null> {
	const ref = doc(db, 'opskrifter', opskriftId, 'ratings', uid);
	const snap = await getDoc(ref);
	if (!snap.exists()) return null;
	const data = snap.data() as { stjerner?: number };
	return typeof data.stjerner === 'number' ? data.stjerner : null;
}

/**
 * Gemmer eller opdaterer brugerens rating og opdaterer det aggregerede
 * gennemsnit paa opskrift-doc i samme transaktion.
 *
 * Returnerer det nye aggregat saa UI'en kan vise det uden et ekstra
 * Firestore-roundtrip.
 */
export async function gemMinRating(
	opskriftId: string,
	uid: string,
	stjerner: number
): Promise<{ ratingSum: number; ratingCount: number; ratingAvg: number }> {
	if (stjerner < 1 || stjerner > 5 || !Number.isInteger(stjerner)) {
		throw new Error('stjerner skal vaere et heltal 1-5');
	}
	const opskriftRef = doc(db, 'opskrifter', opskriftId);
	const ratingRef = doc(db, 'opskrifter', opskriftId, 'ratings', uid);

	return await runTransaction(db, async (tx) => {
		const opSnap = await tx.get(opskriftRef);
		const eksRating = await tx.get(ratingRef);

		const opData = opSnap.exists() ? opSnap.data() : {};
		const prevSum = typeof opData.ratingSum === 'number' ? opData.ratingSum : 0;
		const prevCount = typeof opData.ratingCount === 'number' ? opData.ratingCount : 0;
		const prevStjerner = eksRating.exists()
			? ((eksRating.data() as { stjerner?: number }).stjerner ?? 0)
			: 0;

		const nySum = prevSum - prevStjerner + stjerner;
		const nyCount = eksRating.exists() ? prevCount : prevCount + 1;
		const nyAvg = nyCount > 0 ? Math.round((nySum / nyCount) * 10) / 10 : 0;

		tx.set(ratingRef, { stjerner, opdateret: serverTimestamp() });
		tx.update(opskriftRef, {
			ratingSum: nySum,
			ratingCount: nyCount,
			ratingAvg: nyAvg
		});

		return { ratingSum: nySum, ratingCount: nyCount, ratingAvg: nyAvg };
	});
}
