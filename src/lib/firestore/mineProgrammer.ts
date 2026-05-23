// Firestore-helpers for "mine programmer" (custom-builder).
//
// Datamodel: users/{uid}/mineProgrammer/{programId}
//
// Pure helpers ligger i $lib/content/mineProgrammer.

import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	orderBy,
	query,
	setDoc,
	updateDoc
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { CustomProgram } from '$lib/content/mineProgrammer';
import type { UserDoc } from '$lib/types';

function mineProgrammerCol(uid: string) {
	return collection(db, 'users', uid, 'mineProgrammer');
}

export async function hentMineProgrammer(uid: string): Promise<CustomProgram[]> {
	const q = query(mineProgrammerCol(uid), orderBy('opdateret', 'desc'));
	const snap = await getDocs(q);
	return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CustomProgram, 'id'>) }));
}

export async function hentMitProgram(
	uid: string,
	programId: string
): Promise<CustomProgram | null> {
	const snap = await getDocs(mineProgrammerCol(uid));
	const match = snap.docs.find((d) => d.id === programId);
	if (!match) return null;
	return { id: match.id, ...(match.data() as Omit<CustomProgram, 'id'>) };
}

/**
 * Opretter et nyt program. Returnerer det gemte program med id.
 */
export async function opretMitProgram(
	uid: string,
	data: Omit<CustomProgram, 'id' | 'oprettet' | 'opdateret'>
): Promise<CustomProgram> {
	const nu = Date.now();
	const ref = await addDoc(mineProgrammerCol(uid), {
		...data,
		oprettet: nu,
		opdateret: nu
	});
	return { id: ref.id, ...data, oprettet: nu, opdateret: nu };
}

/**
 * Opdaterer et eksisterende program. Overskriver navn + øvelser og sætter
 * opdateret-timestamp. oprettet-felt bevares.
 */
export async function opdaterMitProgram(
	uid: string,
	programId: string,
	data: Partial<Pick<CustomProgram, 'navn' | 'oevelser' | 'dage' | 'config' | 'startetDato'>>
): Promise<void> {
	const nu = Date.now();
	await setDoc(
		doc(db, 'users', uid, 'mineProgrammer', programId),
		{ ...data, opdateret: nu },
		{ merge: true }
	);
}

export async function sletMitProgram(uid: string, programId: string): Promise<void> {
	await deleteDoc(doc(db, 'users', uid, 'mineProgrammer', programId));
}

// ==============================================
// Pause-state (genoptag-funktionalitet)
// ==============================================

export type SpilPhase = 'prep' | 'work' | 'rest' | 'switch';

export interface SpilPauseState {
	/** Hvilken kilde programmet kommer fra. Brugt til at adskille pauser
	 *  for egne vs tildelte programmer som har samme id-rum. */
	kilde: 'eget' | 'tildelt';
	/** programId for eget eller tildelt. */
	programId: string;
	/** forlobId — kun for tildelt. */
	forlobId?: string;
	/** Indeks i øvelseslisten (0-baseret). */
	ei: number;
	/** Aktuelt sæt (1-baseret). */
	si: number;
	/** Hvilken fase brugeren var i. */
	phase: SpilPhase;
	/** Sekunder tilbage af fasen da state'en blev gemt. */
	rem: number;
	/** Unix-ms da state'en blev gemt. Bruges til at fjerne meget gamle pauser. */
	savedAt: number;
}

/** Pause-state-doc-id konstrueres så eget og tildelt har separate slots. */
function pauseDocId(kilde: 'eget' | 'tildelt', programId: string, forlobId?: string): string {
	if (kilde === 'eget') return `eget__${programId}`;
	return `tildelt__${forlobId ?? 'ukendt'}__${programId}`;
}

export async function hentSpilPause(
	uid: string,
	kilde: 'eget' | 'tildelt',
	programId: string,
	forlobId?: string
): Promise<SpilPauseState | null> {
	const id = pauseDocId(kilde, programId, forlobId);
	const snap = await getDoc(doc(db, 'users', uid, 'spilPauser', id));
	if (!snap.exists()) return null;
	return snap.data() as SpilPauseState;
}

export async function gemSpilPause(uid: string, state: SpilPauseState): Promise<void> {
	const id = pauseDocId(state.kilde, state.programId, state.forlobId);
	await setDoc(doc(db, 'users', uid, 'spilPauser', id), state);
}

export async function sletSpilPause(
	uid: string,
	kilde: 'eget' | 'tildelt',
	programId: string,
	forlobId?: string
): Promise<void> {
	const id = pauseDocId(kilde, programId, forlobId);
	await deleteDoc(doc(db, 'users', uid, 'spilPauser', id));
}

// ==============================================
// Fremgang (gennemførte træninger)
// ==============================================

export interface ProgramFremgang {
	kilde: 'eget' | 'tildelt';
	programId: string;
	forlobId?: string;
	/** Array af unix-ms tidspunkter for gennemførte træninger, nyeste først. */
	gennemforte: number[];
	/** Senest gennemførte. Redundant ift gennemforte[0] men nemmere at query. */
	senestGennemfort: number;
}

function fremgangDocId(kilde: 'eget' | 'tildelt', programId: string, forlobId?: string): string {
	if (kilde === 'eget') return `eget__${programId}`;
	return `tildelt__${forlobId ?? 'ukendt'}__${programId}`;
}

export async function tilfoejGennemfoersel(
	uid: string,
	kilde: 'eget' | 'tildelt',
	programId: string,
	forlobId?: string
): Promise<void> {
	const id = fremgangDocId(kilde, programId, forlobId);
	const ref = doc(db, 'users', uid, 'programFremgang', id);
	const nu = Date.now();
	const snap = await getDoc(ref);
	const tidligere = snap.exists() ? (snap.data() as ProgramFremgang).gennemforte : [];
	const fremgang: ProgramFremgang = {
		kilde,
		programId,
		...(forlobId ? { forlobId } : {}),
		gennemforte: [nu, ...tidligere],
		senestGennemfort: nu
	};
	await setDoc(ref, fremgang);
}

export async function hentProgramFremgang(
	uid: string,
	kilde: 'eget' | 'tildelt',
	programId: string,
	forlobId?: string
): Promise<ProgramFremgang | null> {
	const id = fremgangDocId(kilde, programId, forlobId);
	const snap = await getDoc(doc(db, 'users', uid, 'programFremgang', id));
	if (!snap.exists()) return null;
	return snap.data() as ProgramFremgang;
}

/**
 * Sætter hvilket træningsprogram brugeren har valgt som sit aktive.
 * Bruges af træning-modulet og forsiden til at bestemme hvilket program
 * der vises og startes som default.
 */
export async function gemAktivtTraeningsprogram(
	uid: string,
	aktivt: NonNullable<UserDoc['aktivtTraeningsprogram']>
): Promise<void> {
	await updateDoc(doc(db, 'users', uid), { aktivtTraeningsprogram: aktivt });
}
