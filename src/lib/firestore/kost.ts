// Firestore-helpers for kost-modulet (fødevarer + opskrifter).
// Holdt adskilt fra src/lib/content/kost.ts (typer + pure logik) så
// unit tests for sidstnævnte ikke trækker firebase/firestore-runtime ind.

import {
	arrayRemove,
	arrayUnion,
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	query,
	runTransaction,
	serverTimestamp,
	setDoc,
	updateDoc,
	where
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { FavoritMaaltid, Fodevare, GemtMaaltid, Kategori } from '$lib/content/kost';
import { POPULAERE_FODEVARER } from '$lib/content/populaere-fodevarer.generated';
import { aktivBrugerBasisPath } from '$lib/utils/adminKlient';

/**
 * Returnerer Firestore-collection for brugerens måltider med automatisk
 * scoping til admin-klient-mode hvis admin er logget ind som klient.
 */
function maaltiderCollection(uid: string) {
	return collection(db, `${aktivBrugerBasisPath(uid)}/maaltider`);
}

function maaltidDoc(uid: string, mealId: string) {
	return doc(db, `${aktivBrugerBasisPath(uid)}/maaltider/${mealId}`);
}

function favoritterCollection(uid: string) {
	return collection(db, `${aktivBrugerBasisPath(uid)}/favoritmaaltider`);
}

function favoritDoc(uid: string, favId: string) {
	return doc(db, `${aktivBrugerBasisPath(uid)}/favoritmaaltider/${favId}`);
}

/**
 * In-memory cache af hele fødevaredatabasen pr session. Sættes ved første
 * succesfulde load og deles på tværs af alle steder i appen der bruger
 * `hentAlleFodevarer()` — kost-modul, opskrift-side, admin osv.
 *
 * Firestore IndexedDB-cache (sat op i firebase.ts) dækker repeat-loads
 * på tværs af sessions; denne in-memory cache dækker pr-session lookups
 * uden at gå gennem Firestore SDK overhovedet.
 */
let cachedAlleFodevarer: Fodevare[] | null = null;
let cachedAllePromise: Promise<Fodevare[]> | null = null;

/**
 * Returnerer de mest brugte 200 fødevarer ØJEBLIKKELIGT fra appens bundle —
 * 0 Firestore-reads, 0 ms latency. Bruges som første-paint på Mad-modulet
 * mens den fulde liste hentes i baggrunden.
 *
 * Listen genereres af scripts/byg-populaere-fodevarer.ts.
 */
export function hentPopulaereFodevarer(): Fodevare[] {
	return [...POPULAERE_FODEVARER].sort((a, b) => a.name.localeCompare(b.name, 'da'));
}

/**
 * Henter hele fødevaredatabasen sorteret alfabetisk. In-memory cached pr
 * session — efterfølgende kald er øjeblikkelige. Firestore-SDK'ens IndexedDB-
 * cache (sat op i firebase.ts) sørger desuden for at det første kald i en
 * ny session typisk også er hurtigt (henter fra IndexedDB hvis tilgængelig).
 */
export async function hentAlleFodevarer(): Promise<Fodevare[]> {
	if (cachedAlleFodevarer) return cachedAlleFodevarer;
	if (cachedAllePromise) return cachedAllePromise;
	cachedAllePromise = (async () => {
		try {
			const snap = await getDocs(collection(db, 'fodevarer'));
			const liste = snap.docs
				.map((d) => ({ id: d.id, ...d.data() }) as Fodevare)
				.sort((a, b) => a.name.localeCompare(b.name, 'da'));
			cachedAlleFodevarer = liste;
			return liste;
		} catch (e) {
			cachedAllePromise = null;
			throw e;
		}
	})();
	return cachedAllePromise;
}

/**
 * Invaliderer in-memory fødevare-cachen. Bruges efter admin tilføjer/sletter
 * en fødevare så næste `hentAlleFodevarer()` får frisk data.
 */
export function ryAlleFodevarerCache(): void {
	cachedAlleFodevarer = null;
	cachedAllePromise = null;
}

/**
 * Henter en enkelt fødevare. Returnerer null hvis den ikke findes.
 */
export async function hentFodevare(id: string): Promise<Fodevare | null> {
	const ref = doc(db, 'fodevarer', id);
	const snap = await getDoc(ref);
	if (!snap.exists()) return null;
	return { id: snap.id, ...snap.data() } as Fodevare;
}

/**
 * Opretter eller opdaterer en fødevare. Bruges af seed-script og admin
 * (sidstnævnte tilføjes senere).
 */
export async function gemFodevare(fodevare: Fodevare): Promise<void> {
	const { id, ...data } = fodevare;
	const ref = doc(db, 'fodevarer', id);
	await setDoc(ref, data, { merge: true });
}

// ==============================================
// Community-fødevarer (scannet via stregkode)
// ==============================================

interface NyCommunityFodevare {
	barcode: string;
	name: string;
	cat: Kategori;
	p: number;
	f: number;
	uid: string;
	uidNavn: string;
}

/**
 * Gemmer en ny community-fødevare baseret på stregkode. Stregkoden bruges som
 * dokument-ID med præfikset 'cf_' så vi ikke kolliderer med Frida-IDs.
 *
 * Hvis fødevaren allerede findes (samme barcode), tilføjes brugeren som ok-stem
 * i stedet for at oprette dublet — samtidig opdateres verificeret-flag hvis
 * tærsklen (3 ok-stemmer) er nået.
 *
 * Returnerer det dokument-ID brugeren skal tilføje til måltidet.
 */
export async function gemCommunityFodevare(
	data: NyCommunityFodevare
): Promise<string> {
	const id = `cf_${data.barcode}`;
	const ref = doc(db, 'fodevarer', id);

	await runTransaction(db, async (tx) => {
		const snap = await tx.get(ref);
		if (snap.exists()) {
			// Allerede oprettet — tilføj brugeren som ok-stem hvis ikke allerede
			const eksisterende = snap.data() as Fodevare;
			const okBy = eksisterende.okBy ?? [];
			if (!okBy.includes(data.uid)) {
				const nyOk = [...okBy, data.uid];
				const ejBy = (eksisterende.ejBy ?? []).filter((u) => u !== data.uid);
				tx.update(ref, {
					okBy: nyOk,
					ejBy,
					verificeret: nyOk.length >= 3
				});
			}
			return;
		}
		// Helt ny fødevare — scanner tæller som første ok-stem
		const ny: Omit<Fodevare, 'id'> = {
			name: data.name,
			cat: data.cat,
			p: data.p,
			f: data.f,
			kilde: 'community',
			barcode: data.barcode,
			addedBy: data.uid,
			addedByName: data.uidNavn,
			okBy: [data.uid],
			ejBy: [],
			verificeret: false
		};
		tx.set(ref, ny);
	});

	return id;
}

/**
 * Bruger stemmer på en community-fødevare. Hvis de stemmer det modsatte af
 * deres tidligere stem, fjernes det gamle stem først. verificeret-flag
 * opdateres automatisk når okBy.length passerer 3.
 */
export async function stemPaaFodevare(
	fodevareId: string,
	uid: string,
	type: 'ok' | 'ej'
): Promise<void> {
	const ref = doc(db, 'fodevarer', fodevareId);
	await runTransaction(db, async (tx) => {
		const snap = await tx.get(ref);
		if (!snap.exists()) throw new Error('Fødevaren findes ikke længere.');
		const data = snap.data() as Fodevare;
		const okBy = (data.okBy ?? []).filter((u) => u !== uid);
		const ejBy = (data.ejBy ?? []).filter((u) => u !== uid);
		if (type === 'ok') okBy.push(uid);
		else ejBy.push(uid);
		tx.update(ref, {
			okBy,
			ejBy,
			verificeret: okBy.length >= 3
		});
	});
}

/**
 * Bruges af admin til manuelt at sætte verificeret-flag eller fjerne fødevaren.
 */
export async function adminSaetVerificeret(
	fodevareId: string,
	verificeret: boolean
): Promise<void> {
	const ref = doc(db, 'fodevarer', fodevareId);
	await updateDoc(ref, { verificeret });
}

export async function sletCommunityFodevare(fodevareId: string): Promise<void> {
	await deleteDoc(doc(db, 'fodevarer', fodevareId));
}

// arrayRemove er kun importeret for at holde den i bundtet til evt. fremtidige
// helpers — eksplicit reference så TypeScript ikke fjerner importen.
export const _arrayHelpers = { arrayUnion, arrayRemove };

// ==============================================
// Dagbog — gemte måltider pr bruger
// ==============================================

/**
 * Gemmer et måltid i brugerens dagbog. Genererer et nyt id med Firestores
 * auto-id-generator. Returnerer det generede id.
 */
export async function gemMaaltid(
	uid: string,
	maaltid: Omit<GemtMaaltid, 'id'>
): Promise<string> {
	const ref = doc(maaltiderCollection(uid));
	await setDoc(ref, {
		...maaltid,
		oprettet: serverTimestamp()
	});
	return ref.id;
}

/**
 * Henter alle måltider for en specifik dato (YYYY-MM-DD).
 * Sorteret efter måltidstype (morgen → aften) skal ske kalder-side.
 */
export async function hentMaaltiderForDato(
	uid: string,
	dato: string
): Promise<GemtMaaltid[]> {
	const q = query(maaltiderCollection(uid), where('dato', '==', dato));
	const snap = await getDocs(q);
	return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GemtMaaltid);
}

/**
 * Henter alle måltider mellem to datoer (YYYY-MM-DD inklusive).
 * Bruges af udviklings-siden til at lave aggregerede grafer pr dag.
 */
export async function hentMaaltiderIPeriode(
	uid: string,
	fraDato: string,
	tilDato: string
): Promise<GemtMaaltid[]> {
	const q = query(
		maaltiderCollection(uid),
		where('dato', '>=', fraDato),
		where('dato', '<=', tilDato)
	);
	const snap = await getDocs(q);
	return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GemtMaaltid);
}

/**
 * Opdaterer et eksisterende måltid i dagbogen. Bruges når brugeren
 * redigerer navn, type, dato eller ingredienser på et gemt måltid.
 */
export async function opdaterMaaltid(
	uid: string,
	mealId: string,
	data: Omit<GemtMaaltid, 'id'>
): Promise<void> {
	await setDoc(maaltidDoc(uid, mealId), { ...data, opdateret: serverTimestamp() }, { merge: true });
}

/**
 * Sletter et gemt måltid.
 */
export async function sletMaaltid(uid: string, mealId: string): Promise<void> {
	await deleteDoc(maaltidDoc(uid, mealId));
}

// ==============================================
// Favoritmåltider — skabeloner til hurtig genbrug
// ==============================================

/**
 * Gemmer et måltid som favorit-skabelon. Returnerer det generede id.
 */
export async function gemFavorit(
	uid: string,
	favorit: Omit<FavoritMaaltid, 'id'>
): Promise<string> {
	const ref = doc(favoritterCollection(uid));
	await setDoc(ref, {
		...favorit,
		oprettet: serverTimestamp()
	});
	return ref.id;
}

/**
 * Henter alle favoritmåltider for en bruger sorteret alfabetisk.
 */
export async function hentFavoritter(uid: string): Promise<FavoritMaaltid[]> {
	const snap = await getDocs(favoritterCollection(uid));
	return snap.docs
		.map((d) => ({ id: d.id, ...d.data() }) as FavoritMaaltid)
		.sort((a, b) => a.navn.localeCompare(b.navn, 'da'));
}

/**
 * Opdaterer en eksisterende favorit. Bruges når brugeren redigerer
 * navnet eller ingredienserne på en favorit-skabelon.
 */
export async function opdaterFavorit(
	uid: string,
	favoritId: string,
	data: Omit<FavoritMaaltid, 'id'>
): Promise<void> {
	await setDoc(favoritDoc(uid, favoritId), { ...data, opdateret: serverTimestamp() }, { merge: true });
}

/**
 * Sletter en favorit.
 */
export async function sletFavorit(uid: string, favoritId: string): Promise<void> {
	await deleteDoc(favoritDoc(uid, favoritId));
}

/**
 * Toggler en fødevare som favorit på userDoc.favoritFodevarer.
 * Bruger arrayUnion/arrayRemove så samtidige opdateringer er safe.
 */
export async function toggleFavoritFodevare(
	uid: string,
	foodId: string,
	gørTilFavorit: boolean
): Promise<void> {
	const ref = doc(db, `${aktivBrugerBasisPath(uid)}`);
	await updateDoc(ref, {
		favoritFodevarer: gørTilFavorit ? arrayUnion(foodId) : arrayRemove(foodId)
	});
}
