// Firestore-helpers for abo-vanetracker.
// Adskilt fra src/lib/content/aboVaner.ts (typer + pure logik) så
// unit tests for sidstnævnte ikke trækker firebase/firestore-runtime ind.
//
// Datamodel:
//   - aboVaneskabelon/{produktType}              ← kurateret vaneliste (admin)
//   - aboBonusPulje/{produktType}                ← bonus-pulje (admin)
//   - users/{uid}/aboVaneOpsaetning              ← brugerens valgte vaner (single doc)
//   - users/{uid}/aboVanedage/{YYYY-MM-DD}       ← brugerens daglige svar

import {
	collection,
	doc,
	getDoc,
	getDocs,
	query,
	serverTimestamp,
	setDoc,
	Timestamp,
	where
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type {
	AboVaneForslag,
	AboBonusForslag,
	AboVaneOpsaetning,
	AboVanedagEntry,
	ValgtVane
} from '$lib/content/aboVaner';
import { aktivBrugerBasisPath } from '$lib/utils/adminKlient';
import { kanSkrive } from '$lib/viewOnlyState.svelte';

type ProduktType = 'basis' | 'premium';

// ==============================================
// Skabelon (admin) — kurateret vaneliste
// ==============================================

export async function hentAboVaneskabelon(produktType: ProduktType): Promise<AboVaneForslag[]> {
	const snap = await getDoc(doc(db, 'aboVaneskabelon', produktType));
	if (!snap.exists()) return [];
	const data = snap.data() as { vaner?: AboVaneForslag[] };
	return data.vaner ?? [];
}

export async function gemAboVaneskabelon(
	produktType: ProduktType,
	vaner: AboVaneForslag[]
): Promise<void> {
	await setDoc(doc(db, 'aboVaneskabelon', produktType), { vaner });
}

// ==============================================
// Bonus-pulje (admin)
// ==============================================

export async function hentAboBonusPulje(produktType: ProduktType): Promise<AboBonusForslag[]> {
	const snap = await getDoc(doc(db, 'aboBonusPulje', produktType));
	if (!snap.exists()) return [];
	const data = snap.data() as { bonus?: AboBonusForslag[] };
	return data.bonus ?? [];
}

export async function gemAboBonusPulje(
	produktType: ProduktType,
	bonus: AboBonusForslag[]
): Promise<void> {
	await setDoc(doc(db, 'aboBonusPulje', produktType), { bonus });
}

// ==============================================
// Brugerens opsætning
// ==============================================

function opsaetningRef(uid: string) {
	return doc(db, `${aktivBrugerBasisPath(uid)}/aboVaneOpsaetning/aktiv`);
}

export async function hentAboVaneOpsaetning(uid: string): Promise<AboVaneOpsaetning | null> {
	const snap = await getDoc(opsaetningRef(uid));
	if (!snap.exists()) return null;
	return snap.data() as AboVaneOpsaetning;
}

/**
 * Gemmer brugerens vanevalg. Bevarer oprettetAt + baselineNulstilletAt
 * hvis dokumentet eksisterer.
 */
export async function gemAboVaneOpsaetning(
	uid: string,
	valgteVaner: ValgtVane[],
	produktType: ProduktType
): Promise<void> {
	const eksisterende = await hentAboVaneOpsaetning(uid);
	const nu = Timestamp.now();
	const data: AboVaneOpsaetning = {
		valgteVaner,
		produktType,
		oprettetAt: eksisterende?.oprettetAt ?? nu,
		opdateretAt: nu,
		...(eksisterende?.baselineNulstilletAt && {
			baselineNulstilletAt: eksisterende.baselineNulstilletAt
		})
	};
	await setDoc(opsaetningRef(uid), data);
}

/**
 * Nulstiller baseline til en ny dato (default: nu). Det første komplette
 * check-in på eller efter denne dato bliver den nye baseline at sammenligne
 * mod. Eksisterende check-ins bevares — kun hvad der vises som baseline
 * ændrer sig.
 */
export async function nulstilAboBaseline(uid: string): Promise<void> {
	await setDoc(
		opsaetningRef(uid),
		{ baselineNulstilletAt: Timestamp.now() },
		{ merge: true }
	);
}

// ==============================================
// Daglige svar
// ==============================================

function vanedageCollection(uid: string) {
	return collection(db, `${aktivBrugerBasisPath(uid)}/aboVanedage`);
}

function vanedagDoc(uid: string, dato: string) {
	return doc(db, `${aktivBrugerBasisPath(uid)}/aboVanedage/${dato}`);
}

export async function hentAboVanedag(uid: string, dato: string): Promise<AboVanedagEntry | null> {
	const snap = await getDoc(vanedagDoc(uid, dato));
	if (!snap.exists()) return null;
	return snap.data() as AboVanedagEntry;
}

export async function gemAboVanedag(
	uid: string,
	entry: Omit<AboVanedagEntry, 'savedAt'>
): Promise<void> {
	if (!kanSkrive()) return;
	await setDoc(
		vanedagDoc(uid, entry.dato),
		{ ...entry, savedAt: serverTimestamp() },
		{ merge: true }
	);
}

/**
 * Henter abo-vanedage for en bruger. Bruges af forsiden og Udvikling-tab.
 * Returnerer Map fra dato (YYYY-MM-DD) til entry.
 *
 * fraDato (YYYY-MM-DD) begrænser hentningen til dage på/efter den dato.
 * Bruges af forsiden og Udvikling-tab så vi ikke henter års-historik for
 * langtidskunder ved hver page-mount.
 */
export async function hentAlleAboVanedage(
	uid: string,
	fraDato?: string
): Promise<Map<string, AboVanedagEntry>> {
	const ref = vanedageCollection(uid);
	const q = fraDato ? query(ref, where('dato', '>=', fraDato)) : ref;
	const snap = await getDocs(q);
	const map = new Map<string, AboVanedagEntry>();
	for (const d of snap.docs) {
		const data = d.data() as AboVanedagEntry;
		map.set(data.dato, data);
	}
	return map;
}
