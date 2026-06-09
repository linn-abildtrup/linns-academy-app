// Firestore-laget for admin-styret feature-adgang. Matrixen ligger i ét
// dokument: featureAdgang/aktiv. Admin skriver via admin-siden (etape 3B);
// alle autentificerede kan laese (klienten skal vide hvad hun har adgang til).

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '$lib/firebase';
import { STANDARD_MATRIX, type FeatureMatrix } from '$lib/content/features';

const COLLECTION = 'featureAdgang';
const DOC_ID = 'aktiv';

/**
 * Henter feature-matrixen. Findes den ikke (endnu) eller fejler hentningen,
 * returneres STANDARD_MATRIX — saa adgangen aldrig falder bort. harFeatureAdgang
 * laver desuden per-felt fallback, saa nye funktioner uden gemt vaerdi virker.
 */
export async function hentFeatureMatrix(): Promise<FeatureMatrix> {
	try {
		const snap = await getDoc(doc(db, COLLECTION, DOC_ID));
		if (snap.exists()) {
			return snap.data() as FeatureMatrix;
		}
	} catch (e) {
		console.warn('Kunne ikke hente feature-matrix, bruger standard:', e);
	}
	return STANDARD_MATRIX;
}

/** Gemmer hele matrixen (admin-siden). Overskriver dokumentet. */
export async function gemFeatureMatrix(matrix: FeatureMatrix): Promise<void> {
	await setDoc(doc(db, COLLECTION, DOC_ID), matrix);
}
