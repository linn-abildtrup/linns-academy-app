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
	query,
	serverTimestamp,
	setDoc,
	where
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

// Tidligere kun 'basis' | 'premium'. Pr 7/6 2026 udvidet til at omfatte
// variant-suffix (basis_kettlebell, basis_no_kettlebell, premium_*) saa
// admin kan redigere de variant-specifikke programmer direkte.
type ProduktType =
	| 'basis'
	| 'premium'
	| 'basis_kettlebell'
	| 'basis_no_kettlebell'
	| 'premium_kettlebell'
	| 'premium_no_kettlebell';

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
	produktType: 'basis' | 'premium',
	variant: MikrotraeningVariant = 'no_kettlebell'
): Promise<AboMikrotraeningProgramMedDage | null> {
	// Pr 7/6 2026: ingen fallback. Variant-doc'et SKAL findes. Hvis ikke
	// returnerer vi null og kalderen viser "Programmet er ikke sat op endnu".
	// Det gamle 'basis'-doc (14d) er forladt — vi rammer det ikke laengere
	// fra klienter for at undgaa at de ser et program admin ikke kan
	// redigere.
	return hentAboMikrotraeningProgramVedDocId(`${produktType}_${variant}`);
}

/**
 * Henter et program direkte ud fra dets doc-id (fx 'basis_kettlebell').
 * Bruges af admin-flowet hvor route-paramet er det fulde docId.
 */
export async function hentAboMikrotraeningProgramVedDocId(
	docId: ProduktType
): Promise<AboMikrotraeningProgramMedDage | null> {
	const programSnap = await getDoc(doc(db, 'aboMikrotraening', docId));
	if (!programSnap.exists()) return null;
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
 * Sikrer at kunden har en aboStartDato sat (kalender-anker for rotation).
 * Hvis fremgang-doc'et ikke findes eller mangler aboStartDato, skrives
 * dagens dato ind. Idempotent: kalder du to gange er anden gang en no-op.
 *
 * Returnerer den nu-gaeldende aboStartDato (enten den eksisterende eller
 * den der lige blev sat).
 *
 * Bruges af mikrotraenings-sider ved foerste rendering saa kunden faar
 * en fast rotation der starter paa dag 1 i dag.
 */
export async function sikrAboStartDato(uid: string, idagDato: string): Promise<string> {
	const ref = fremgangRef(uid);
	const snap = await getDoc(ref);
	const eksisterende = snap.exists()
		? (snap.data() as AboMikrotraeningFremgang).aboStartDato
		: undefined;
	if (eksisterende) return eksisterende;
	await setDoc(
		ref,
		{
			aboStartDato: idagDato,
			// Hvis det er foerste gang vi skriver, init totalGennemforte+feedback
			...(snap.exists() ? {} : { totalGennemforte: 0, feedback: {} }),
			opdateretAt: serverTimestamp()
		},
		{ merge: true }
	);
	return idagDato;
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
 * Henter træninger sorteret nyeste først. Bruges af historik-listen på
 * mikrotræning-forsiden og strip på forsiden.
 *
 * fraDato (YYYY-MM-DD) begrænser til træninger på/efter den dato.
 * Bruges fx på forsiden så vi ikke henter års-historik ved hver mount.
 */
export async function hentAlleAboTraeninger(
	uid: string,
	fraDato?: string
): Promise<AboMikrotraeningTraening[]> {
	const ref = traeningCollection(uid);
	const q = fraDato ? query(ref, where('dato', '>=', fraDato)) : ref;
	const snap = await getDocs(q);
	return snap.docs
		.map((d) => d.data() as AboMikrotraeningTraening)
		.sort((a, b) => b.dato.localeCompare(a.dato));
}
