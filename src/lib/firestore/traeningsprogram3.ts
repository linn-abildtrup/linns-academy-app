// Firestore-laget for traeningsprogrammer i 3.0. Bid 1, 15. august 2026.
//
// traeningsprogrammer3/{id}          selve programmet
// traeningsprogrammer3/{id}/dage/{n} én dag med sine oevelser
//
// Kun 3.0 laeser her. De gamle programmer under forlob/, aboMikrotraening/
// og trainingPrograms/ er urørte, og de 760 kunder i drift ser praecis det
// samme som foer.
//
// DAGENE LIGGER I EN UNDERSAMLING og ikke i selve programmet. Et
// 84-dages program med fem oevelser om dagen er for stort til ét dokument,
// og listen over programmer skal kunne hentes uden at traekke 420 dage med.

import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	setDoc,
	writeBatch
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { TrainingDay } from '$lib/content/mikrotraening';
import type { Traeningsprogram3 } from '$lib/content/traeningsprogram3';
import {
	antalTommeDage,
	justerAntalDage,
	sorterProgrammer3
} from '$lib/content/traeningsprogram3';

const SAMLING = 'traeningsprogrammer3';

function programCol() {
	return collection(db, SAMLING);
}

function dageCol(programId: string) {
	return collection(db, SAMLING, programId, 'dage');
}

/** Doc-id paa en dag. Samme navngivning som de gamle programmer. */
function dagId(dagNummer: number): string {
	return `dag${dagNummer}`;
}

/** Alle programmer uden deres dage. Bruges af listen. */
export async function hentProgrammer3(): Promise<Traeningsprogram3[]> {
	const snap = await getDocs(programCol());
	const raa = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Traeningsprogram3, 'id'>) }));
	return sorterProgrammer3(raa);
}

export interface ProgramMedDage3 {
	program: Traeningsprogram3;
	dage: TrainingDay[];
}

/**
 * Ét program med alle sine dage.
 *
 * Dagene rettes altid til programmets antalDage foer de leveres. Mangler
 * en dag i databasen, kommer den tilbage som tom i stedet for at listen
 * faar et hul, saa skaermen aldrig springer fra dag 3 til dag 5.
 */
export async function hentProgram3(programId: string): Promise<ProgramMedDage3 | null> {
	const [programSnap, dageSnap] = await Promise.all([
		getDoc(doc(db, SAMLING, programId)),
		getDocs(dageCol(programId))
	]);
	if (!programSnap.exists()) return null;
	const program = {
		id: programSnap.id,
		...(programSnap.data() as Omit<Traeningsprogram3, 'id'>)
	};
	const gemteDage = dageSnap.docs.map((d) => d.data() as TrainingDay);
	return { program, dage: justerAntalDage(gemteDage, program.antalDage) };
}

/**
 * Opretter et nyt program med tomme dage. Programmet er kladde indtil Linn
 * selv saetter det til klar.
 */
export async function opretProgram3(
	felter: Omit<Traeningsprogram3, 'id' | 'oprettetAt' | 'opdateretAt' | 'klar'>
): Promise<Traeningsprogram3> {
	const nu = Date.now();
	const data = {
		...felter,
		klar: false,
		tommeDage: felter.antalDage,
		oprettetAt: nu,
		opdateretAt: nu
	};
	const ref = await addDoc(programCol(), data);
	await gemDage3(ref.id, justerAntalDage([], felter.antalDage));
	return { id: ref.id, ...data };
}

/**
 * Retter felter paa et program. opdateretAt saettes altid, oprettetAt
 * roeres aldrig.
 */
export async function gemProgram3(
	programId: string,
	felter: Partial<Omit<Traeningsprogram3, 'id' | 'oprettetAt'>>
): Promise<void> {
	await setDoc(
		doc(db, SAMLING, programId),
		{ ...felter, opdateretAt: Date.now() },
		{ merge: true }
	);
}

/**
 * Gemmer én dag. Hele dage-listen skal sendes med, saa taelleren over
 * tomme dage kan skrives i samme aandedrag. Uden den ville listen over
 * programmer advare forkert, og det er netop den advarsel der skal
 * forhindre at et halvbygget program bliver sat til klar.
 */
export async function gemDag3(
	programId: string,
	dag: TrainingDay,
	alleDage: TrainingDay[]
): Promise<void> {
	const opdateret = alleDage.map((d) => (d.dagNummer === dag.dagNummer ? dag : d));
	await Promise.all([
		setDoc(doc(db, SAMLING, programId, 'dage', dagId(dag.dagNummer)), dag),
		gemProgram3(programId, { tommeDage: antalTommeDage(opdateret) })
	]);
}

/**
 * Gemmer mange dage paa én gang. Bruges naar antal dage aendres og naar et
 * automatisk udkast laegges ind. Ét batch, saa enten kommer alle dage ind
 * eller ingen. Et halvt udkast ville vaere svaerere at rette op end slet
 * ingenting.
 */
export async function gemDage3(programId: string, dage: TrainingDay[]): Promise<void> {
	if (dage.length === 0) return;
	const batch = writeBatch(db);
	for (const dag of dage) {
		batch.set(doc(db, SAMLING, programId, 'dage', dagId(dag.dagNummer)), dag);
	}
	await batch.commit();
	await gemProgram3(programId, { tommeDage: antalTommeDage(dage) });
}

/**
 * Sletter dage der ligger over programmets nye antal. Kaldes naar Linn
 * saetter tallet ned, saa der ikke bliver liggende usynlige dage der
 * dukker op igen hvis hun senere saetter tallet op.
 */
export async function sletDageOver3(programId: string, antalDage: number): Promise<void> {
	const snap = await getDocs(dageCol(programId));
	const forMange = snap.docs.filter((d) => (d.data() as TrainingDay).dagNummer > antalDage);
	if (forMange.length === 0) return;
	const batch = writeBatch(db);
	for (const d of forMange) batch.delete(d.ref);
	await batch.commit();
}

/** Sletter et program og alle dets dage. */
export async function sletProgram3(programId: string): Promise<void> {
	const snap = await getDocs(dageCol(programId));
	const batch = writeBatch(db);
	for (const d of snap.docs) batch.delete(d.ref);
	batch.delete(doc(db, SAMLING, programId));
	await batch.commit();
}
