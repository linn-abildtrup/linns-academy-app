// ============================================================
// Skrivningen af "gennemgaaet"-markeringerne.
//
// DE LIGGER I ingrediensKobling/gennemgaaet, altsaa i den samling der i
// forvejen holder koblingerne. Ikke af skoenhed, men fordi reglerne
// allerede giver admin lov at skrive dér, og en ny samling ville kraeve
// en regel-udgivelse midt i en app hvor 925 kunder er i drift. Se regel
// 10 i CLAUDE.md. Dokumentet er sit eget, saa koblingerne aldrig kan
// blive roert af en markering.
//
// DER SKRIVES ÉN MARKERING AD GANGEN og ikke hele kortet. To admin-faner
// kan vaere aabne samtidig, og skrev vi hele kortet, ville den ene fanes
// gamle billede slette den andens flueben. `merge` fletter ind i kortet
// uden at roere de andre navne.
//
// INTET AF DET HER SES AF KUNDERNE. Markeringen staar ikke paa
// foedevaren, saa det de laeser er praecis som foer.
// ============================================================

import { doc, getDoc, setDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { Gennemgang, Gennemgangskort } from '$lib/content/ingrediensGennemgang3';

const STI = 'ingrediensKobling';
const DOK = 'gennemgaaet';

/** Henter alle markeringer. Tomt kort foerste gang, saa siden bare virker. */
export async function hentGennemgang(): Promise<Gennemgangskort> {
	const snap = await getDoc(doc(db, STI, DOK));
	if (!snap.exists()) return {};
	const data = snap.data() as Record<string, unknown>;
	const kort = data.kort;
	return (kort && typeof kort === 'object' ? kort : {}) as Gennemgangskort;
}

/** Saetter fluebenet paa ét kernenavn. */
export async function gemGennemgaaet(kerne: string, af: string): Promise<Gennemgang> {
	const markering: Gennemgang = { af, naar: new Date().toISOString() };
	await setDoc(
		doc(db, STI, DOK),
		{ kort: { [kerne]: markering }, opdateret: serverTimestamp(), opdateretAf: af },
		{ merge: true }
	);
	return markering;
}

/** Tager fluebenet af igen. */
export async function sletGennemgaaet(kerne: string, af: string): Promise<void> {
	await setDoc(
		doc(db, STI, DOK),
		{ kort: { [kerne]: deleteField() }, opdateret: serverTimestamp(), opdateretAf: af },
		{ merge: true }
	);
}
