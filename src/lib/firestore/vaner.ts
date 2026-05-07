// Firestore-helpers for vanetracker.
// Holdt adskilt fra src/lib/content/vaner.ts (typer + pure logik) så
// unit tests for sidstnævnte ikke trækker firebase/firestore-runtime ind.

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
	VaneProgram,
	VaneProgramDag,
	VanedagEntry
} from '$lib/content/vaner';

// ==============================================
// VaneProgram-helpers (admin + klient kan læse)
// ==============================================

export interface VaneProgramMedDage {
	id: string;
	program: VaneProgram;
	dage: VaneProgramDag[];
}

/**
 * Lister alle vaneProgrammer (uden dage).
 * Bruges af admin-oversigten.
 */
export async function hentAlleVaneProgrammer(): Promise<VaneProgram[]> {
	const snap = await getDocs(collection(db, 'vaneProgrammer'));
	return snap.docs
		.map((d) => ({ id: d.id, ...d.data() }) as VaneProgram)
		.sort((a, b) => a.navn.localeCompare(b.navn, 'da'));
}

/**
 * Henter et vaneProgram med alle dets dage.
 * Returnerer null hvis programmet ikke findes.
 */
export async function hentVaneProgram(programId: string): Promise<VaneProgramMedDage | null> {
	const programRef = doc(db, 'vaneProgrammer', programId);
	const programSnap = await getDoc(programRef);
	if (!programSnap.exists()) return null;

	const program = { id: programSnap.id, ...programSnap.data() } as VaneProgram;

	const daysSnap = await getDocs(collection(db, 'vaneProgrammer', programId, 'days'));
	const dage = daysSnap.docs
		.map((d) => d.data() as VaneProgramDag)
		.sort((a, b) => a.dagNummer - b.dagNummer);

	return { id: programSnap.id, program, dage };
}

/**
 * Gemmer en vaneprogramdag (admin-skrivning).
 */
export async function gemVaneProgramDag(
	programId: string,
	dag: VaneProgramDag
): Promise<void> {
	const id = `dag${dag.dagNummer}`;
	const ref = doc(db, 'vaneProgrammer', programId, 'days', id);
	await setDoc(ref, dag);
}

// ==============================================
// VanedagEntry-helpers (brugerens svar)
// ==============================================

/**
 * Henter alle brugerens svar for et givet produkt.
 * Returnerer Map fra dagNummer til VanedagEntry.
 */
export async function hentAlleVanedage(
	uid: string,
	productId: string = 'kickstart'
): Promise<Map<number, VanedagEntry>> {
	const snap = await getDocs(
		collection(db, 'users', uid, 'products', productId, 'vanedage')
	);
	const map = new Map<number, VanedagEntry>();
	for (const d of snap.docs) {
		const data = d.data() as VanedagEntry;
		map.set(data.dagNummer, data);
	}
	return map;
}

/**
 * Henter brugerens svar for én specifik dag.
 * Returnerer null hvis dagen ikke er besvaret endnu.
 */
export async function hentVanedag(
	uid: string,
	dagNummer: number,
	productId: string = 'kickstart'
): Promise<VanedagEntry | null> {
	const id = `dag${dagNummer}`;
	const ref = doc(db, 'users', uid, 'products', productId, 'vanedage', id);
	const snap = await getDoc(ref);
	if (!snap.exists()) return null;
	return snap.data() as VanedagEntry;
}

/**
 * Gemmer brugerens svar for én dag. Sætter savedAt med serverTimestamp.
 * Bruger setDoc med merge så delvise opdateringer ikke nulstiller andre felter.
 */
export async function gemVanedag(
	uid: string,
	entry: Omit<VanedagEntry, 'savedAt'>,
	productId: string = 'kickstart'
): Promise<void> {
	const id = `dag${entry.dagNummer}`;
	const ref = doc(db, 'users', uid, 'products', productId, 'vanedage', id);
	await setDoc(ref, { ...entry, savedAt: serverTimestamp() }, { merge: true });
}
