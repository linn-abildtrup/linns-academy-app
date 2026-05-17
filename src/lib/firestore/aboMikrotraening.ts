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
	AboMikrotraeningProgram,
	AboMikrotraeningTraening
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

export type MikrotraeningVariant = 'kettlebell' | 'no_kettlebell';

/**
 * Henter abo-mikrotræningsprogrammet for en bestemt produkt-type + variant.
 * Programmer ligger på aboMikrotraening/{produktType}_{variant} med dage som
 * subcollection. Hvis variant ikke angives, bruges 'no_kettlebell' som default.
 *
 * Backwards-compat: hvis det nye `{produktType}_{variant}`-doc ikke findes,
 * falder vi tilbage til det gamle `{produktType}`-doc (uden variant-suffix).
 */
export async function hentAboMikrotraeningProgram(
	produktType: ProduktType,
	variant: MikrotraeningVariant = 'no_kettlebell'
): Promise<AboMikrotraeningProgramMedDage | null> {
	const nyDocId = `${produktType}_${variant}`;
	let programSnap = await getDoc(doc(db, 'aboMikrotraening', nyDocId));
	let docId = nyDocId;
	if (!programSnap.exists()) {
		// Fallback til den gamle docId uden variant-suffix
		programSnap = await getDoc(doc(db, 'aboMikrotraening', produktType));
		docId = produktType;
		if (!programSnap.exists()) return null;
	}
	const program = { id: programSnap.id, ...programSnap.data() } as AboMikrotraeningProgram;

	const dageSnap = await getDocs(collection(db, 'aboMikrotraening', docId, 'days'));
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

// ==============================================
// Trænings-historik (pr dato)
// ==============================================

function traeningRef(uid: string, dato: string) {
	return doc(db, `${aktivBrugerBasisPath(uid)}/aboMikrotraeningTraeninger/${dato}`);
}

function traeningCollection(uid: string) {
	return collection(db, `${aktivBrugerBasisPath(uid)}/aboMikrotraeningTraeninger`);
}

/**
 * Logger en gennemført træning bundet til en bestemt dato. Hvis brugeren
 * trænede flere gange samme dag, overskrives den sidste (kun én træning
 * pr dato). Bruges til historik-visning.
 */
export async function gemAboTraening(
	uid: string,
	dato: string,
	programDag: number,
	runde: number,
	feedback?: AboMikrotraeningTraening['feedback']
): Promise<void> {
	const data: Record<string, unknown> = {
		dato,
		programDag,
		runde,
		savedAt: serverTimestamp()
	};
	if (feedback) data.feedback = feedback;
	await setDoc(traeningRef(uid, dato), data, { merge: true });
}

/**
 * Henter alle træninger sorteret nyeste først. Bruges af historik-listen
 * på mikrotræning-forsiden.
 */
export async function hentAlleAboTraeninger(uid: string): Promise<AboMikrotraeningTraening[]> {
	const snap = await getDocs(traeningCollection(uid));
	return snap.docs
		.map((d) => d.data() as AboMikrotraeningTraening)
		.sort((a, b) => b.dato.localeCompare(a.dato));
}
