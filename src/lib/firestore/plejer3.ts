// ============================================================
// "Det du plejer" og selve gemningen, mod Firestore.
//
// Vi skriver ét maaltids-dokument pr madvare, praecis som kunderne i
// forvejen bruger modulet: 60 % af alle registreringer er én enkelt
// madvare. Formen er den samme som den gamle app skriver, saa begge
// apps kan laese hinandens data.
//
// Nye dokumenter faar et tidsstempel. De gamle har ingen, og derfor
// kan "nyeste oeverst" kun virke fremadrettet. Se maaltider3.ts.
// ============================================================

import {
	collection,
	deleteDoc,
	doc,
	getDocs,
	query,
	serverTimestamp,
	setDoc,
	where
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { Fodevare, GemtMaaltid, Maaltidstype } from '$lib/content/kost';
import { plejerFor, type HistorikMaaltid, type PlejerPost } from '$lib/content/plejer3';
import { naeringFor } from '$lib/content/maengde3';
import { datoNoegle } from '$lib/firestore/forside3';

/** Hvor langt tilbage vi kigger efter vaner. */
const HISTORIK_DAGE = 45;

// Historikken hentes én gang pr side-indlaesning. Den aendrer sig
// langsomt, og et opslag pr maaltidsskaerm ville vaere spild.
let cache: { uid: string; hentetMs: number; maaltider: HistorikMaaltid[] } | null = null;
const CACHE_MS = 10 * 60 * 1000;

export async function hentHistorik(uid: string): Promise<HistorikMaaltid[]> {
	if (cache && cache.uid === uid && Date.now() - cache.hentetMs < CACHE_MS) {
		return cache.maaltider;
	}
	const fra = new Date();
	fra.setDate(fra.getDate() - HISTORIK_DAGE);
	const snap = await getDocs(
		query(collection(db, 'users', uid, 'maaltider'), where('dato', '>=', datoNoegle(fra)))
	);
	const maaltider: HistorikMaaltid[] = snap.docs.map((d) => {
		const m = d.data() as GemtMaaltid;
		return { type: m.type, items: m.items ?? [], dato: m.dato };
	});
	cache = { uid, hentetMs: Date.now(), maaltider };
	return maaltider;
}

/** Ryd cachen, saa en ny registrering kan naa at taelle med. */
export function glemHistorik() {
	cache = null;
}

/**
 * Hendes hyppigste madvarer til ét maaltid, klar til fliserne.
 * `foods` bruges til at slaa navne op og til at regne makro bagefter.
 */
export async function hentPlejer(
	uid: string,
	type: Maaltidstype,
	foods: Map<string, Fodevare>
): Promise<PlejerPost[]> {
	const historik = await hentHistorik(uid);
	return plejerFor(historik, type, (id) => foods.get(id)?.name);
}

export interface GemtSvar {
	/** Dokumentets id, saa Fortryd kan slette netop det. */
	id: string;
	navn: string;
}

/**
 * Gemmer én madvare i et maaltid.
 *
 * Vi laver et nyt dokument hver gang i stedet for at laegge til i et
 * eksisterende. Saa kan Fortryd slette praecis det hun lige tilfoejede,
 * uden at roere resten af maaltidet.
 */
export async function gemMadvare(args: {
	uid: string;
	dato: string;
	type: Maaltidstype;
	food: Fodevare;
	portion: number;
	enhedId?: string;
}): Promise<GemtSvar> {
	const { uid, dato, type, food, portion, enhedId } = args;
	const n = naeringFor(food, portion, enhedId);
	const ref = doc(collection(db, 'users', uid, 'maaltider'));

	await setDoc(ref, {
		navn: food.name,
		type,
		dato,
		items: [{ foodId: food.id, portion, ...(enhedId ? { enhedId } : {}) }],
		totalP: n.protein,
		totalF: n.fiber,
		// Kulhydrat, fedt og kalorier gemmes ALTID, ogsaa for kunder der
		// ikke maa se dem. Ellers ville tallene mangle bagudrettet den dag
		// Linn giver et hold adgang. Visningen afgoer hvad der vises.
		totalKh: n.kh,
		totalFedt: n.fedt,
		totalKcal: n.kcal,
		// Nye dokumenter faar et tidsstempel, saa nyeste kan staa oeverst.
		// De gamle har ingen, og det kan vi ikke lave om paa.
		oprettet: serverTimestamp(),
		opdateret: serverTimestamp()
	});

	glemHistorik();
	return { id: ref.id, navn: food.name };
}

/**
 * Gemmer noget der allerede er et faerdigt maaltid: en opskrift eller
 * en favorit. Makroen er kendt paa forhaand, saa der er ingen maengde
 * at saette, og hun har allerede valgt den.
 *
 * Vi gemmer den som ét manuelt item med navnet paa. Det er samme form
 * som den gamle app bruger naar den logger en opskrift, saa dagbogen
 * ser ens ud i begge apps.
 */
export async function gemSammensat(args: {
	uid: string;
	dato: string;
	type: Maaltidstype;
	navn: string;
	protein: number;
	fiber: number;
	/** Kulhydrat, fedt og kalorier. Gemmes ALTID, se nedenfor. */
	kh?: number;
	fedt?: number;
	kcal?: number;
}): Promise<GemtSvar> {
	const { uid, dato, type, navn, protein, fiber, kh, fedt, kcal } = args;
	const ref = doc(collection(db, 'users', uid, 'maaltider'));
	await setDoc(ref, {
		navn,
		type,
		dato,
		items: [{ foodId: '', portion: 1, manuel: { navn, enhed: 'portion' } }],
		totalP: Math.round(protein * 10) / 10,
		totalF: Math.round(fiber * 10) / 10,
		// De tre gemmes ALTID, ogsaa for kunder der ikke maa se dem. Giver Linn
		// en dag et hold adgang til udvidet naering, skal tallene ogsaa vaere
		// der for det de allerede har tastet, ellers faar kunden en halvtom
		// historik der ligner en fejl. Se SPEC-3.0.md 26.5.
		//
		// Foer 12. august gemte den her funktion KUN protein og fiber, saa
		// opskrifter og favoritter brød den regel mens almindelige madvarer
		// fulgte den. Raekker gemt foer da har ikke felterne og taeller nul med.
		totalKh: Math.round((kh ?? 0) * 10) / 10,
		totalFedt: Math.round((fedt ?? 0) * 10) / 10,
		totalKcal: Math.round(kcal ?? 0),
		oprettet: serverTimestamp(),
		opdateret: serverTimestamp()
	});
	glemHistorik();
	return { id: ref.id, navn };
}

/**
 * Fortryd. Sletter det dokument hun lige oprettede.
 *
 * Det er Fortryd der goer ét tryk forsvarligt. Uden den ville vi vaere
 * noedt til at spoerge "er du sikker" hver gang, og saa er vi tilbage
 * ved to tryk paa den vej der bruges mest.
 */
export async function fortrydMadvare(uid: string, maaltidId: string): Promise<void> {
	await deleteDoc(doc(db, 'users', uid, 'maaltider', maaltidId));
	glemHistorik();
}

/**
 * Fjerner en madvare hun har tastet tidligere, og afleverer den tilbage
 * saa den kan gendannes.
 *
 * Vi spoerger ikke "er du sikker". I stedet kan hun fortryde, praecis
 * som naar hun tilfoejer noget. Det er den samme aftale hele vejen
 * igennem modulet: handlingen sker med det samme, og fortrydelsen er
 * ét tryk vaek.
 */
export async function fjernMadvare(uid: string, maaltid: GemtMaaltid): Promise<GemtMaaltid> {
	await deleteDoc(doc(db, 'users', uid, 'maaltider', maaltid.id));
	glemHistorik();
	return maaltid;
}

/**
 * Gendanner en fjernet madvare med SAMME dokument-id, saa den lander
 * praecis hvor den laa. Bruges af Fortryd efter en fjernelse.
 */
export async function gendanMadvare(uid: string, maaltid: GemtMaaltid): Promise<void> {
	const { id, ...felter } = maaltid;
	await setDoc(doc(db, 'users', uid, 'maaltider', id), {
		...felter,
		opdateret: serverTimestamp()
	});
	glemHistorik();
}
