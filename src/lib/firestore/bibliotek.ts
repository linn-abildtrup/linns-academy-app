// Firestore-helpers for bibliotek (FAQ + senere guides).
// Holdt adskilt fra src/lib/content/bibliotek.ts (typer + pure logik) så
// unit tests for sidstnævnte ikke trækker firebase/firestore-runtime ind.
//
// Datamodel — alt forløbs-specifikt:
//   - forlob/{forlobId}/faqKategorier/{id}
//   - forlob/{forlobId}/faqItems/{id}

import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	getDocs,
	serverTimestamp,
	updateDoc,
	writeBatch
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { FaqKategori, FaqItem } from '$lib/content/bibliotek';

// ==============================================
// FAQ-kategorier
// ==============================================

/**
 * Henter alle FAQ-kategorier for et forløb. Sortering sker i klient via
 * sorterKategorier, så denne funktion returnerer den rå liste.
 */
export async function hentFaqKategorier(forlobId: string): Promise<FaqKategori[]> {
	const snap = await getDocs(collection(db, 'forlob', forlobId, 'faqKategorier'));
	return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FaqKategori);
}

/**
 * Opretter en ny FAQ-kategori og returnerer det auto-genererede id.
 */
export async function opretFaqKategori(
	forlobId: string,
	navn: string,
	orden: number
): Promise<string> {
	const ref = await addDoc(collection(db, 'forlob', forlobId, 'faqKategorier'), {
		navn,
		orden,
		oprettet: serverTimestamp()
	});
	return ref.id;
}

/**
 * Opdaterer en kategoris navn og/eller orden. Felter ikke i input forbliver
 * uændrede.
 */
export async function opdaterFaqKategori(
	forlobId: string,
	kategoriId: string,
	felter: Partial<Pick<FaqKategori, 'navn' | 'orden'>>
): Promise<void> {
	const ref = doc(db, 'forlob', forlobId, 'faqKategorier', kategoriId);
	await updateDoc(ref, felter);
}

/**
 * Sletter en kategori og alle dens items i én batch. Items uden den
 * pågældende kategori-id forbliver urørte.
 */
export async function sletFaqKategoriMedItems(
	forlobId: string,
	kategoriId: string
): Promise<{ slettedeItems: number }> {
	const items = await hentFaqItems(forlobId);
	const tilSletning = items.filter((it) => it.kategoriId === kategoriId);

	const batch = writeBatch(db);
	for (const it of tilSletning) {
		batch.delete(doc(db, 'forlob', forlobId, 'faqItems', it.id));
	}
	batch.delete(doc(db, 'forlob', forlobId, 'faqKategorier', kategoriId));
	await batch.commit();

	return { slettedeItems: tilSletning.length };
}

// ==============================================
// FAQ-items
// ==============================================

/**
 * Henter alle FAQ-items for et forløb. Klient-koden filtrerer (kun udgivne /
 * pr kategori) og sorterer selv.
 */
export async function hentFaqItems(forlobId: string): Promise<FaqItem[]> {
	const snap = await getDocs(collection(db, 'forlob', forlobId, 'faqItems'));
	return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FaqItem);
}

/**
 * Opretter et nyt FAQ-item under en eksisterende kategori. Returnerer id'et.
 */
export async function opretFaqItem(
	forlobId: string,
	data: {
		kategoriId: string;
		spoergsmaal: string;
		svar: string;
		orden: number;
		udgivet: boolean;
	}
): Promise<string> {
	const ref = await addDoc(collection(db, 'forlob', forlobId, 'faqItems'), {
		...data,
		oprettet: serverTimestamp(),
		opdateret: serverTimestamp()
	});
	return ref.id;
}

/**
 * Opdaterer et FAQ-item. Felter der ikke er i input forbliver uændrede.
 * Sætter opdateret-tidsstempel altid.
 */
export async function opdaterFaqItem(
	forlobId: string,
	itemId: string,
	felter: Partial<Pick<FaqItem, 'kategoriId' | 'spoergsmaal' | 'svar' | 'orden' | 'udgivet'>>
): Promise<void> {
	const ref = doc(db, 'forlob', forlobId, 'faqItems', itemId);
	await updateDoc(ref, { ...felter, opdateret: serverTimestamp() });
}

/**
 * Sletter et FAQ-item.
 */
export async function sletFaqItem(forlobId: string, itemId: string): Promise<void> {
	await deleteDoc(doc(db, 'forlob', forlobId, 'faqItems', itemId));
}
