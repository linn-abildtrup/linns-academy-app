// Firestore-laget for traeningskategorier i 3.0. Bid 1, 15. august 2026.
//
// Kategorierne ligger i deres egen top-samling, traeningKategorier3, som
// KUN 3.0 laeser. Den gamle app kender kun kettlebell og uden kettlebell,
// og den skal ikke pludselig faa et sjippetov at forholde sig til.
//
// Der er faa af dem, typisk under ti, saa hele samlingen hentes paa én
// gang. Ingen grund til at forespoerge paa noget.

import { addDoc, collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { TraeningKategori3 } from '$lib/content/traeningKategori3';
import { sorterKategorier3 } from '$lib/content/traeningKategori3';

const SAMLING = 'traeningKategorier3';

function kategoriCol() {
	return collection(db, SAMLING);
}

/** Alle kategorier, sorteret i den raekkefoelge kunden ser dem. */
export async function hentKategorier3(): Promise<TraeningKategori3[]> {
	const snap = await getDocs(kategoriCol());
	const raa = snap.docs.map(
		(d) => ({ id: d.id, ...(d.data() as Omit<TraeningKategori3, 'id'>) })
	);
	return sorterKategorier3(raa);
}

/** Opretter en ny kategori og returnerer den med sit id. */
export async function opretKategori3(
	data: Omit<TraeningKategori3, 'id'>
): Promise<TraeningKategori3> {
	const ref = await addDoc(kategoriCol(), data);
	return { id: ref.id, ...data };
}

/** Gemmer en kategori der findes i forvejen. */
export async function gemKategori3(kategori: TraeningKategori3): Promise<void> {
	const { id, ...felter } = kategori;
	await setDoc(doc(db, SAMLING, id), felter, { merge: true });
}

/**
 * Gemmer raekkefoelgen for flere kategorier paa én gang. Bruges naar Linn
 * flytter én op eller ned, for saa aendrer hele listen sig.
 */
export async function gemRaekkefolge3(kategorier: TraeningKategori3[]): Promise<void> {
	await Promise.all(
		kategorier.map((k) =>
			setDoc(doc(db, SAMLING, k.id), { raekkefolge: k.raekkefolge }, { merge: true })
		)
	);
}

/**
 * Sletter en kategori. Kaldstedet SKAL foerst spoerge kategoriKanSlettes3,
 * ellers kan der ligge programmer tilbage uden en kategori, og saa er de
 * usynlige for kunden.
 */
export async function sletKategori3(id: string): Promise<void> {
	await deleteDoc(doc(db, SAMLING, id));
}
