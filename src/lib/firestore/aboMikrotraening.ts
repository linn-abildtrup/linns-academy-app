// Firestore-helpers for abo-mikrotræning.
//
// Datamodel:
//   - aboMikrotraening/{produktType}                 ← program-metadata (admin)
//   - aboMikrotraening/{produktType}/days/{dagN}     ← træningsdage 1-14
//   - users/{uid}/aboMikrotraeningFremgang/aktiv     ← brugerens fremgang

import {
	collection,
	doc,
	getDoc,
	getDocs,
	serverTimestamp,
	setDoc
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type {
	AboMikrotraeningFremgang,
	AboMikrotraeningProgram
} from '$lib/content/aboMikrotraening';
import { ABO_MIKROTRAENING_DAGE } from '$lib/content/aboMikrotraening';
import type { TrainingDay } from '$lib/content/mikrotraening';
import { aktivBrugerBasisPath } from '$lib/utils/adminKlient';

type ProduktType = 'basis' | 'premium';

export interface AboMikrotraeningProgramMedDage {
	id: string;
	program: AboMikrotraeningProgram;
	dage: TrainingDay[];
}

// ==============================================
// Program (admin)
// ==============================================

export async function hentAboMikrotraeningProgram(
	produktType: ProduktType
): Promise<AboMikrotraeningProgramMedDage | null> {
	const programRef = doc(db, 'aboMikrotraening', produktType);
	const programSnap = await getDoc(programRef);
	if (!programSnap.exists()) return null;
	const program = { id: programSnap.id, ...programSnap.data() } as AboMikrotraeningProgram;

	const dageSnap = await getDocs(collection(db, 'aboMikrotraening', produktType, 'days'));
	const dage = dageSnap.docs
		.map((d) => d.data() as TrainingDay)
		.sort((a, b) => a.dagNummer - b.dagNummer);

	return { id: programSnap.id, program, dage };
}

export async function gemAboMikrotraeningProgram(
	produktType: ProduktType,
	program: Omit<AboMikrotraeningProgram, 'id'>
): Promise<void> {
	await setDoc(doc(db, 'aboMikrotraening', produktType), program, { merge: true });
}

export async function gemAboMikrotraeningDag(
	produktType: ProduktType,
	dag: TrainingDay
): Promise<void> {
	const ref = doc(db, 'aboMikrotraening', produktType, 'days', `dag${dag.dagNummer}`);
	await setDoc(ref, dag);
}

export async function gemAboMikrotraeningDage(
	produktType: ProduktType,
	dage: TrainingDay[]
): Promise<void> {
	await Promise.all(dage.map((d) => gemAboMikrotraeningDag(produktType, d)));
}

// ==============================================
// Brugerens fremgang
// ==============================================

function fremgangRef(uid: string) {
	return doc(db, `${aktivBrugerBasisPath(uid)}/aboMikrotraeningFremgang/aktiv`);
}

export async function hentAboFremgang(uid: string): Promise<AboMikrotraeningFremgang | null> {
	const snap = await getDoc(fremgangRef(uid));
	if (!snap.exists()) return null;
	return snap.data() as AboMikrotraeningFremgang;
}

/**
 * Markerer en dag som gennemført. totalGennemforte øges med 1.
 * Idempotent — hvis brugeren forsøger at gennemføre en dag der ikke er
 * den aktuelle, ignoreres kaldet (bestemmes via genemfoerAboDag).
 */
export async function gemAboFremgang(
	uid: string,
	totalGennemforte: number,
	feedback: Record<string, string>
): Promise<void> {
	await setDoc(
		fremgangRef(uid),
		{
			totalGennemforte,
			feedback,
			opdateretAt: serverTimestamp()
		},
		{ merge: true }
	);
}

export const ABO_MIKROTRAENING_DAGE_TO_GENERATE = ABO_MIKROTRAENING_DAGE;
