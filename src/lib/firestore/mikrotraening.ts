// Firestore-helpers for mikrotræning.
// Holdt adskilt fra src/lib/content/mikrotraening.ts (typer + pure funktioner) så
// unit tests for sidstnævnte ikke trækker firebase/firestore-runtime ind.

import {
	doc,
	getDoc,
	getDocs,
	collection,
	deleteDoc,
	serverTimestamp,
	setDoc,
	updateDoc
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type {
	TrainingProgram,
	TrainingDay,
	UserProduct,
	Exercise,
	MikrotraeningFremgang,
	PauseDoc
} from '$lib/content/mikrotraening';
import { aktivBrugerBasisPath } from '$lib/utils/adminKlient';

function userProductDoc(uid: string, productId: string) {
	return doc(db, `${aktivBrugerBasisPath(uid)}/products/${productId}`);
}

function pauseDocRef(uid: string, pauseId: string) {
	return doc(db, `${aktivBrugerBasisPath(uid)}/pauses/${pauseId}`);
}

export interface ProgramMedDage {
	id: string;
	program: TrainingProgram;
	dage: TrainingDay[];
}

/**
 * Henter alle træningsprogrammer (uden dage).
 * @deprecated Programmer ligger nu under forlob/{forlobId}/mikrotraeningProgrammer.
 * Brug hentForlobsProgrammer i stedet.
 */
export async function hentAlleProgrammer(): Promise<TrainingProgram[]> {
	const snap = await getDocs(collection(db, 'trainingPrograms'));
	return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TrainingProgram);
}

/**
 * Henter alle mikrotræningsprogrammer for et bestemt forløb (uden dage).
 * Bruges af admin-listevisningen og af klient-onboarding når klienten
 * skal vælge variant (fx 'med kettlebell' eller 'uden udstyr').
 */
export async function hentForlobsProgrammer(forlobId: string): Promise<TrainingProgram[]> {
	const snap = await getDocs(
		collection(db, 'forlob', forlobId, 'mikrotraeningProgrammer')
	);
	return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TrainingProgram);
}

/**
 * Henter et mikrotræningsprogram inkl. alle dets dage.
 * Returnerer null hvis programmet ikke findes under det givne forløb.
 */
export async function hentForlobsProgram(
	forlobId: string,
	programId: string
): Promise<ProgramMedDage | null> {
	const programRef = doc(db, 'forlob', forlobId, 'mikrotraeningProgrammer', programId);
	const programSnap = await getDoc(programRef);
	if (!programSnap.exists()) return null;

	const program = { id: programSnap.id, ...programSnap.data() } as TrainingProgram;
	const dageSnap = await getDocs(
		collection(db, 'forlob', forlobId, 'mikrotraeningProgrammer', programId, 'days')
	);
	const dage = dageSnap.docs
		.map((d) => d.data() as TrainingDay)
		.sort((a, b) => a.dagNummer - b.dagNummer);

	return { id: programSnap.id, program, dage };
}

/**
 * Gemmer/opdaterer program-metadata (navn, antalDage, udstyr osv.) under
 * et forløb. Days håndteres separat via gemForlobsDag.
 */
export async function gemForlobsProgram(
	forlobId: string,
	programId: string,
	program: Omit<TrainingProgram, 'id'>
): Promise<void> {
	const ref = doc(db, 'forlob', forlobId, 'mikrotraeningProgrammer', programId);
	await setDoc(ref, program, { merge: true });
}

/**
 * Gemmer en træningsdag under et forløbs-program.
 * Overskriver eksisterende dag hvis den findes.
 */
export async function gemForlobsDag(
	forlobId: string,
	programId: string,
	dagNummer: number,
	dag: TrainingDay
): Promise<void> {
	const ref = doc(
		db,
		'forlob',
		forlobId,
		'mikrotraeningProgrammer',
		programId,
		'days',
		`dag${dagNummer}`
	);
	await setDoc(ref, dag);
}

/**
 * Gemmer flere dage under et forløbs-program på én gang.
 */
export async function gemForlobsDage(
	forlobId: string,
	programId: string,
	dage: TrainingDay[]
): Promise<void> {
	await Promise.all(dage.map((d) => gemForlobsDag(forlobId, programId, d.dagNummer, d)));
}

/**
 * Sletter et helt mikrotræningsprogram inkl. alle dets dage. Bruges når
 * Linn beslutter at en variant ikke længere er relevant for forløbet.
 */
export async function sletForlobsProgram(
	forlobId: string,
	programId: string
): Promise<void> {
	const dageSnap = await getDocs(
		collection(db, 'forlob', forlobId, 'mikrotraeningProgrammer', programId, 'days')
	);
	await Promise.all(dageSnap.docs.map((d) => deleteDoc(d.ref)));
	await deleteDoc(doc(db, 'forlob', forlobId, 'mikrotraeningProgrammer', programId));
}

/**
 * Henter alle øvelser fra biblioteket.
 * Bruges af admin-editoren når øvelser skal vælges.
 */
export async function hentAlleExercises(): Promise<Exercise[]> {
	const snap = await getDocs(collection(db, 'exercises'));
	return snap.docs
		.map((d) => ({ id: d.id, ...d.data() }) as Exercise)
		.sort((a, b) => a.name.localeCompare(b.name, 'da'));
}

/**
 * Gemmer en træningsdag til Firestore.
 * Overskriver eksisterende dag hvis den findes.
 */
export async function gemDag(
	programId: string,
	dagNummer: number,
	dag: TrainingDay
): Promise<void> {
	const ref = doc(db, 'trainingPrograms', programId, 'days', `dag${dagNummer}`);
	await setDoc(ref, dag);
}

/**
 * Gemmer flere dage på én gang. Bruges af auto-generér-funktionen.
 */
export async function gemDage(programId: string, dage: TrainingDay[]): Promise<void> {
	await Promise.all(dage.map((d) => gemDag(programId, d.dagNummer, d)));
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
	const snap = await getDoc(userProductDoc(uid, productId));
	if (!snap.exists()) return null;
	return snap.data() as UserProduct;
}

/**
 * Skriver opdateret mikrotræning-fremgang til brugerens userProduct-dokument.
 * Bruges af workout-spilleren når en dag er gennemført eller feedback registreres.
 *
 * Opdaterer kun feltet fremgang.mikrotraening — andre fremgang-felter (fx vaner,
 * kost) røres ikke. Dot-path-update på et nestet felt overskriver hele
 * mikrotraening-objektet, så kald-stedet skal sende det fulde opdaterede objekt.
 */
export async function gemMikrotraeningFremgang(
	uid: string,
	productId: string,
	fremgang: MikrotraeningFremgang
): Promise<void> {
	await updateDoc(userProductDoc(uid, productId), { 'fremgang.mikrotraening': fremgang });
}

/**
 * Sætter brugerens programvalg for en træningsform (fx mikrotraening).
 * Opdaterer userProduct.programValg.{treaningsform} via dot-path så
 * andre programvalg på samme produkt ikke berøres.
 */
export async function gemProgramValg(
	uid: string,
	productId: string,
	treaningsform: string,
	programId: string
): Promise<void> {
	await updateDoc(userProductDoc(uid, productId), {
		[`programValg.${treaningsform}`]: programId
	});
}

/**
 * Bygger pauseId-strengen ud fra programId og dag-nummer.
 * Format: {programId}_{dagNummer} — sikrer én pause pr program-dag.
 */
function pauseId(programId: string, dag: number): string {
	return `${programId}_${dag}`;
}

/**
 * Henter en gemt pause for et program + dag, hvis brugeren har en aktiv session.
 * Returnerer null hvis ingen pause er gemt.
 */
export async function hentPause(
	uid: string,
	programId: string,
	dag: number
): Promise<PauseDoc | null> {
	const snap = await getDoc(pauseDocRef(uid, pauseId(programId, dag)));
	if (!snap.exists()) return null;
	return snap.data() as PauseDoc;
}

/**
 * Gemmer en pause-state så brugeren kan fortsætte træningen senere.
 * savedAt sættes med serverTimestamp på Firestore-siden.
 */
export async function gemPause(
	uid: string,
	pause: Omit<PauseDoc, 'savedAt'>
): Promise<void> {
	const ref = pauseDocRef(uid, pauseId(pause.programId, pause.dag));
	await setDoc(ref, { ...pause, savedAt: serverTimestamp() });
}

/**
 * Sletter en gemt pause. Bruges når dagen er gennemført eller
 * brugeren vil starte forfra.
 */
export async function sletPause(
	uid: string,
	programId: string,
	dag: number
): Promise<void> {
	await deleteDoc(pauseDocRef(uid, pauseId(programId, dag)));
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

/**
 * Opretter eller opdaterer en øvelse i øvelsesbanken.
 * exerciseId bruges som dokument-id så Linn kan vælge læselige id'er
 * (fx 'goblet_squat') der matcher videofilnavn.
 */
export async function gemExercise(
	exerciseId: string,
	exercise: Omit<Exercise, 'id'>
): Promise<void> {
	const ref = doc(db, 'exercises', exerciseId);
	await setDoc(ref, exercise, { merge: true });
}

/**
 * Sletter en øvelse fra øvelsesbanken. Programmer der refererer til
 * øvelsen får tomme pladser indtil Linn manuelt fjerner referencen.
 */
export async function sletExercise(exerciseId: string): Promise<void> {
	await deleteDoc(doc(db, 'exercises', exerciseId));
}
