// Kundens egne traeningsprogrammer. Bid 6, 16. august 2026.
//
// users/{uid}/mineTraeninger3/{egen_xxx}
//
// Traeningerne ligger i selve dokumentet. Linns 84-dages programmer skal
// kunne listes uden at traekke 84 traeninger med, men hendes egne hentes
// altid helt, saa ét dokument er baade enklere og hurtigere.
//
// Doc-id'et faar praefikset egen_, saa enhver skaerm kan se paa id'et
// alene hvilken samling den skal hente fra. Se content/mineTraeninger3.

import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '$lib/firebase';
import { aktivBrugerBasisPath } from '$lib/utils/adminKlient';
import type { TrainingDay } from '$lib/content/mikrotraening';
import {
	erEgetProgram3,
	nytEgetId3,
	nytEgetProgram3,
	tilProgram3,
	type MinTraening3
} from '$lib/content/mineTraeninger3';
import type { Traeningsprogram3 } from '$lib/content/traeningsprogram3';
import { justerAntalDage } from '$lib/content/traeningsprogram3';
import { hentProgram3 } from './traeningsprogram3';

function mineCol(uid: string) {
	return collection(db, `${aktivBrugerBasisPath(uid)}/mineTraeninger3`);
}

function minDoc(uid: string, id: string) {
	return doc(db, `${aktivBrugerBasisPath(uid)}/mineTraeninger3/${id}`);
}

function fraData(id: string, data: Partial<MinTraening3>): MinTraening3 {
	const dage = Array.isArray(data.dage) ? (data.dage as TrainingDay[]) : [];
	return {
		id,
		navn: typeof data.navn === 'string' ? data.navn : 'Mit program',
		// Rettes altid til, saa en halv skrivning ikke giver huller i numrene.
		dage: justerAntalDage(dage, Math.max(1, dage.length)),
		oprettetAt: typeof data.oprettetAt === 'number' ? data.oprettetAt : 0,
		opdateretAt: typeof data.opdateretAt === 'number' ? data.opdateretAt : 0
	};
}

export async function hentMineTraeninger3(uid: string): Promise<MinTraening3[]> {
	const snap = await getDocs(mineCol(uid));
	return snap.docs
		.map((d) => fraData(d.id, d.data() as Partial<MinTraening3>))
		.sort((a, b) => a.navn.localeCompare(b.navn, 'da'));
}

export async function hentMinTraening3(uid: string, id: string): Promise<MinTraening3 | null> {
	const snap = await getDoc(minDoc(uid, id));
	if (!snap.exists()) return null;
	return fraData(snap.id, snap.data() as Partial<MinTraening3>);
}

/** Opretter et tomt program med det antal traeninger hun bad om. */
export async function opretMinTraening3(
	uid: string,
	navn: string,
	antalTraeninger: number
): Promise<MinTraening3> {
	// Firestore laver et tilfaeldigt id, og vi saetter vores praefiks foran.
	const id = nytEgetId3(doc(mineCol(uid)).id);
	const nyt = nytEgetProgram3(id, navn, antalTraeninger, Date.now());
	const { id: _id, ...felter } = nyt;
	await setDoc(minDoc(uid, id), felter);
	return nyt;
}

/** Gemmer navn og traeninger. Hele dokumentet skrives, det er ét lille kald. */
export async function gemMinTraening3(uid: string, min: MinTraening3): Promise<void> {
	await setDoc(
		minDoc(uid, min.id),
		{
			navn: min.navn.trim(),
			dage: min.dage,
			oprettetAt: min.oprettetAt,
			opdateretAt: Date.now()
		},
		{ merge: true }
	);
}

export async function sletMinTraening3(uid: string, id: string): Promise<void> {
	await deleteDoc(minDoc(uid, id));
}

export interface ProgramMedTraeninger3 {
	program: Traeningsprogram3;
	dage: TrainingDay[];
	/** Sat naar det er kundens eget. Saa maa hun rette i det. */
	mit: MinTraening3 | null;
}

/**
 * Ét program med sine traeninger, uanset om det er Linns eller hendes eget.
 *
 * Praefikset paa id'et afgoer hvor der hentes. Derfor kan afspilleren og
 * program-siden vaere de samme for begge slags, og det er hele grunden
 * til at hendes programmer har samme form som Linns.
 */
export async function hentProgramMedTraeninger3(
	uid: string,
	programId: string
): Promise<ProgramMedTraeninger3 | null> {
	if (erEgetProgram3(programId)) {
		const mit = await hentMinTraening3(uid, programId);
		if (!mit) return null;
		return { program: tilProgram3(mit), dage: mit.dage, mit };
	}
	const data = await hentProgram3(programId);
	if (!data) return null;
	return { program: data.program, dage: data.dage, mit: null };
}
