// Firestore-helpers for mikrotræning.
// Holdt adskilt fra src/lib/content/mikrotraening.ts (typer + pure funktioner) så
// unit tests for sidstnævnte ikke trækker firebase/firestore-runtime ind.

import { doc, getDoc, getDocs, collection } from 'firebase/firestore';
import { db } from '$lib/firebase';
import type {
	TrainingProgram,
	TrainingDay,
	UserProduct,
	Exercise
} from '$lib/content/mikrotraening';

export interface ProgramMedDage {
	id: string;
	program: TrainingProgram;
	dage: TrainingDay[];
}

/**
 * Henter et træningsprogram med alle dets dage.
 * Returnerer null hvis programmet ikke findes.
 */
export async function hentProgram(programId: string): Promise<ProgramMedDage | null> {
	const programRef = doc(db, 'trainingPrograms', programId);
	const programSnap = await getDoc(programRef);
	if (!programSnap.exists()) return null;

	const program = { id: programSnap.id, ...programSnap.data() } as TrainingProgram;

	const dageSnap = await getDocs(collection(db, 'trainingPrograms', programId, 'days'));
	const dage = dageSnap.docs
		.map((d) => d.data() as TrainingDay)
		.sort((a, b) => a.dagNummer - b.dagNummer);

	return { id: programSnap.id, program, dage };
}

/**
 * Henter en bruger-produkt-relation der fortæller hvilke programmer brugeren har
 * adgang til, hvad de har valgt, og hvor langt de er nået.
 * Returnerer null hvis brugeren ikke har adgang til produktet.
 */
export async function hentUserProduct(uid: string, productId: string): Promise<UserProduct | null> {
	const ref = doc(db, 'users', uid, 'products', productId);
	const snap = await getDoc(ref);
	if (!snap.exists()) return null;
	return snap.data() as UserProduct;
}

/**
 * Henter en enkelt øvelse fra øvelsesbiblioteket.
 * Returnerer null hvis øvelsen ikke findes.
 */
export async function hentExercise(exerciseId: string): Promise<Exercise | null> {
	const ref = doc(db, 'exercises', exerciseId);
	const snap = await getDoc(ref);
	if (!snap.exists()) return null;
	return { id: snap.id, ...snap.data() } as Exercise;
}

/**
 * Henter flere øvelser ad gangen baseret på en liste af ID'er.
 * Returnerer et map fra exerciseId til Exercise. Manglende øvelser udelades.
 */
export async function hentExercises(exerciseIds: string[]): Promise<Map<string, Exercise>> {
	const unikkeIds = Array.from(new Set(exerciseIds));
	const map = new Map<string, Exercise>();
	const resultater = await Promise.all(unikkeIds.map((id) => hentExercise(id)));
	resultater.forEach((ex, i) => {
		if (ex) map.set(unikkeIds[i], ex);
	});
	return map;
}
