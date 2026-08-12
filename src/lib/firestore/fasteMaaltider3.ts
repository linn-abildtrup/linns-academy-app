// ============================================================
// Faste maaltider mod Firestore. Reglerne ligger i
// content/fasteMaaltider3.ts, den her fil laeser og skriver kun.
//
// VI BLIVER I DEN GAMLE SAMLING users/{uid}/favoritmaaltider.
// To grunde, og de er begge vigtige:
//   1. kunderne flyttes over hold for hold, saa et fast maaltid lavet i
//      3.0 skal ogsaa virke hvis hun aabner den gamle app
//   2. de 2.905 der findes i forvejen skal virke i 3.0 fra dag ét
//
// Feltet `maaltid` er nyt. Den gamle app laeser kun de felter den
// kender og opdager ingenting. Der skal derfor intet udgives i Firebase
// Console: reglerne tillader i forvejen at kunden skriver i sin egen
// mappe, og de validerer ikke felter.
//
// AT LAEGGE ET FAST MAALTID I SKRIVER ÉT DOKUMENT PR MADVARE,
// praecis som hvis hun havde trykket paa de fem ting selv. Derfor
// laerer "Det du plejer" af det, derfor kan hun fjerne én enkelt ting,
// og derfor kan en linje uden makro ikke snige sig ind og taelle nul.
// Se SPEC-3.0.md afsnit 26.10.
// ============================================================

import {
	collection,
	deleteDoc,
	doc,
	getDocs,
	serverTimestamp,
	setDoc
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { Fodevare, MaaltidsItem, Maaltidstype } from '$lib/content/kost';
import type { DagsMaaltid, FastMaaltid } from '$lib/content/fasteMaaltider3';
import { kanKommeMed } from '$lib/content/fasteMaaltider3';
import { fortrydMadvare, gemMadvare, hentHistorik } from '$lib/firestore/plejer3';

function samling(uid: string) {
	return collection(db, 'users', uid, 'favoritmaaltider');
}

function dokument(uid: string, id: string) {
	return doc(db, 'users', uid, 'favoritmaaltider', id);
}

/** Alle hendes faste maaltider. Sorteringen sker i content-laget. */
export async function hentFasteMaaltider(uid: string): Promise<FastMaaltid[]> {
	const snap = await getDocs(samling(uid));
	return snap.docs.map((d) => {
		const data = d.data() as Partial<FastMaaltid>;
		return {
			id: d.id,
			navn: (data.navn ?? '').trim(),
			items: data.items ?? [],
			maaltid: data.maaltid
		};
	});
}

/**
 * Hendes historik med dagen paa, saa brugsstatistik kan laegge en hel
 * dags maaltid sammen.
 *
 * Den genbruger plejer3's hentning og dermed dens cache, saa de 45 dage
 * kun hentes én gang pr side. Uden det ville hver aabning af hylden
 * koste et par hundrede opslag mere.
 */
export async function hentBrugshistorik(uid: string): Promise<DagsMaaltid[]> {
	const historik = await hentHistorik(uid);
	return historik
		.filter((m): m is typeof m & { dato: string } => !!m.dato)
		.map((m) => ({ dato: m.dato, type: m.type, items: m.items ?? [] }));
}

/** Gemmer et nyt fast maaltid. Returnerer id'et. */
export async function gemFastMaaltid(
	uid: string,
	fast: { navn: string; items: MaaltidsItem[]; maaltid: Maaltidstype }
): Promise<string> {
	const ref = doc(samling(uid));
	await setDoc(ref, {
		navn: fast.navn,
		items: fast.items,
		maaltid: fast.maaltid,
		oprettet: serverTimestamp()
	});
	return ref.id;
}

/**
 * Opdaterer linjerne, naar hun svarer ja til baandet.
 *
 * Kun linjerne. Navnet og maaltidet er hendes eget valg og skal ikke
 * flytte sig fordi hun sprang blaabaerrene over en enkelt dag. Og
 * merge, saa et felt vi ikke kender ikke forsvinder.
 */
export async function opdaterFastMaaltid(
	uid: string,
	id: string,
	items: MaaltidsItem[]
): Promise<void> {
	await setDoc(dokument(uid, id), { items, opdateret: serverTimestamp() }, { merge: true });
}

export async function sletFastMaaltid(uid: string, id: string): Promise<void> {
	await deleteDoc(dokument(uid, id));
}

export interface IlagtSvar {
	/** Dokument-id'erne, saa Fortryd kan slette praecis dem igen. */
	ids: string[];
	/** Hvor mange linjer der ikke kunne laegges i, se nedenfor. */
	sprunget: number;
}

/**
 * Laegger et fast maaltid i dagen som ét dokument pr madvare.
 *
 * Vi skriver dem én ad gangen og ikke paa én gang. Saa staar de i den
 * raekkefoelge hun gemte dem, og gaar noget galt undervejs, kan Fortryd
 * stadig rydde op efter de linjer der naaede at blive skrevet.
 *
 * En madvare der er forsvundet fra databasen springes over og taelles i
 * `sprunget`. Vi kan hverken vise navn eller regne makro paa den, og at
 * laegge den i ville betyde nul gram uden at nogen sagde det.
 */
export async function laegFastMaaltidI(args: {
	uid: string;
	dato: string;
	type: Maaltidstype;
	fast: FastMaaltid;
	foods: Map<string, Fodevare>;
}): Promise<IlagtSvar> {
	const { uid, dato, type, fast, foods } = args;
	const ids: string[] = [];
	let sprunget = 0;

	for (const it of fast.items ?? []) {
		if (!kanKommeMed(it)) {
			sprunget++;
			continue;
		}
		const food = foods.get(it.foodId);
		if (!food) {
			sprunget++;
			continue;
		}
		const svar = await gemMadvare({
			uid,
			dato,
			type,
			food,
			portion: it.portion ?? 0,
			enhedId: it.enhedId
		});
		ids.push(svar.id);
	}

	return { ids, sprunget };
}

/**
 * Fortryd for et helt fast maaltid. Sletter alle de dokumenter der blev
 * skrevet, ogsaa hvis én af dem allerede er væk.
 */
export async function fortrydFasteLinjer(uid: string, ids: string[]): Promise<void> {
	for (const id of ids) {
		try {
			await fortrydMadvare(uid, id);
		} catch (e) {
			console.warn('[ny] kunne ikke fortryde linjen', id, e);
		}
	}
}
