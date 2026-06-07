// Firestore-helpers for vanetracker.
// Holdt adskilt fra src/lib/content/vaner.ts (typer + pure logik) så
// unit tests for sidstnævnte ikke trækker firebase/firestore-runtime ind.
//
// Datamodel:
//   - forlob/{forlobId}/vaneprogram/{dagId}     ← programmets spørgsmål pr dag
//                                                  (hver forløb har sit eget)
//   - users/{uid}/products/{productId}/vanedage/{dagId}  ← brugerens svar

import {
	collection,
	doc,
	getDoc,
	getDocs,
	serverTimestamp,
	setDoc
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { VaneProgramDag, VanedagEntry } from '$lib/content/vaner';
import { aktivBrugerBasisPath } from '$lib/utils/adminKlient';

function vanedageCollection(uid: string, productId: string) {
	return collection(db, `${aktivBrugerBasisPath(uid)}/products/${productId}/vanedage`);
}

function vanedagDoc(uid: string, productId: string, dagId: string) {
	return doc(db, `${aktivBrugerBasisPath(uid)}/products/${productId}/vanedage/${dagId}`);
}

// ==============================================
// Vaneprogram-helpers (pr forløb)
// ==============================================

/**
 * Henter alle vaneprogram-dage for et forløb sorteret efter dagNummer.
 * Returnerer en tom liste hvis forløbet ikke har vaner sat op endnu.
 */
export async function hentVaneprogramForForlob(forlobId: string): Promise<VaneProgramDag[]> {
	const snap = await getDocs(collection(db, 'forlob', forlobId, 'vaneprogram'));
	return snap.docs
		.map((d) => d.data() as VaneProgramDag)
		.sort((a, b) => a.dagNummer - b.dagNummer);
}

/**
 * Henter én specifik vaneprogram-dag for et forløb.
 */
export async function hentVaneprogramDag(
	forlobId: string,
	dagNummer: number
): Promise<VaneProgramDag | null> {
	const ref = doc(db, 'forlob', forlobId, 'vaneprogram', `dag${dagNummer}`);
	const snap = await getDoc(ref);
	if (!snap.exists()) return null;
	return snap.data() as VaneProgramDag;
}

/**
 * Gemmer en vaneprogram-dag for et forløb (admin-skrivning).
 */
export async function gemVaneprogramDag(
	forlobId: string,
	dag: VaneProgramDag
): Promise<void> {
	const id = `dag${dag.dagNummer}`;
	const ref = doc(db, 'forlob', forlobId, 'vaneprogram', id);
	await setDoc(ref, dag);
}

// ==============================================
// VanedagEntry-helpers (brugerens svar — uændret)
// ==============================================

/**
 * Henter alle brugerens svar for et givet produkt.
 * Returnerer Map fra dagNummer til VanedagEntry.
 */
export async function hentAlleVanedage(
	uid: string,
	productId: string
): Promise<Map<number, VanedagEntry>> {
	const snap = await getDocs(vanedageCollection(uid, productId));
	const map = new Map<number, VanedagEntry>();
	for (const d of snap.docs) {
		const data = d.data() as VanedagEntry;
		map.set(data.dagNummer, data);
	}
	return map;
}

/**
 * Henter brugerens checkin-data fra ALLE forl0b hun har deltaget i, samlet
 * og sorteret kronologisk. Bruges af udvikling-fanen til at vise hele
 * baseline+check-in-historikken pa tvaers af Kickstart og Kropsro.
 *
 * Hvert returneret punkt har:
 *  - forlobId, forlobNavn (label til UI)
 *  - dagNummer (lokalt i forl0bet — 0=baseline, 7/14/21 osv. for Kickstart,
 *    0/28/56/84 for Kropsro)
 *  - dato (faktisk dato beregnet fra forl0b.startDato + dagNummer)
 *  - entry (selve VanedagEntry-doc)
 */
export async function hentCheckinHistorikForBruger(
	uid: string,
	forlobIds: string[]
): Promise<
	Array<{
		forlobId: string;
		forlobNavn: string;
		forlobType: 'kickstart' | 'kropsro';
		dagNummer: number;
		dato: Date;
		entry: VanedagEntry;
	}>
> {
	const forl0bsdata = await Promise.all(
		forlobIds.map(async (forlobId) => {
			const fSnap = await getDoc(doc(db, 'forlob', forlobId));
			if (!fSnap.exists()) return null;
			const f = fSnap.data() as {
				navn?: string;
				startDato?: { toDate: () => Date };
				type?: string;
			};
			const forlobType: 'kickstart' | 'kropsro' = f.type === 'kropsro' ? 'kropsro' : 'kickstart';
			const productId = forlobType === 'kropsro' ? 'premiumforløb' : 'kickstart';
			const vanedage = await hentAlleVanedage(uid, productId);
			const startDato = f.startDato?.toDate?.() ?? new Date();
			return {
				forlobId,
				forlobNavn: f.navn ?? forlobId,
				forlobType,
				startDato,
				vanedage
			};
		})
	);

	const punkter: Array<{
		forlobId: string;
		forlobNavn: string;
		forlobType: 'kickstart' | 'kropsro';
		dagNummer: number;
		dato: Date;
		entry: VanedagEntry;
	}> = [];

	for (const f of forl0bsdata) {
		if (!f) continue;
		for (const [dagNummer, entry] of f.vanedage) {
			const dato = new Date(f.startDato);
			dato.setDate(dato.getDate() + dagNummer);
			punkter.push({
				forlobId: f.forlobId,
				forlobNavn: f.forlobNavn,
				forlobType: f.forlobType,
				dagNummer,
				dato,
				entry
			});
		}
	}

	punkter.sort((a, b) => a.dato.getTime() - b.dato.getTime());
	return punkter;
}

/**
 * Henter brugerens svar for én specifik dag.
 * Returnerer null hvis dagen ikke er besvaret endnu.
 */
export async function hentVanedag(
	uid: string,
	dagNummer: number,
	productId: string
): Promise<VanedagEntry | null> {
	const id = `dag${dagNummer}`;
	const snap = await getDoc(vanedagDoc(uid, productId, id));
	if (!snap.exists()) return null;
	return snap.data() as VanedagEntry;
}

/**
 * Gemmer brugerens svar for én dag. Sætter savedAt med serverTimestamp.
 * Bruger setDoc med merge så delvise opdateringer ikke nulstiller andre felter.
 *
 * VIGTIGT: bruges nu kun fra refleksions-siden hvor klienten har den
 * FULDE seneste tilstand i UI'et. Forsidens hurtige svar-knapper skal
 * bruge opdaterVaneSvar/opdaterBonusSvar i stedet — de overskriver
 * ellers note + checkin + andre felter med stale state.
 */
export async function gemVanedag(
	uid: string,
	entry: Omit<VanedagEntry, 'savedAt'>,
	productId: string
): Promise<void> {
	const id = `dag${entry.dagNummer}`;
	await setDoc(
		vanedagDoc(uid, productId, id),
		{ ...entry, savedAt: serverTimestamp() },
		{ merge: true }
	);
}

/**
 * Opdaterer kun ÉT vane-svar i checks-feltet for en dag. Bruges af
 * forsidens hurtige Ja/Delvist/Nej-knapper saa de ikke overskriver note,
 * bonus, checkin eller andre vaner med stale state.
 *
 * Vivian/Dorthe-incidenten 7/6 2026: 158 juni-kunder mistede deres
 * refleksioner fordi forsidens gem-flow sendte hele entry-objektet inkl
 * en stale 'note: ""'. Fix: kun det specifikke felt opdateres.
 */
export async function opdaterVaneSvar(
	uid: string,
	productId: string,
	dagNummer: number,
	vaneId: string,
	svar: 'ja' | 'delvist' | 'nej'
): Promise<void> {
	const id = `dag${dagNummer}`;
	await setDoc(
		vanedagDoc(uid, productId, id),
		{
			dagNummer,
			checks: { [vaneId]: svar },
			savedAt: serverTimestamp()
		},
		{ merge: true }
	);
}

/**
 * Opdaterer kun ÉT bonus-svar i bonus-feltet. svar=null fjerner svaret
 * (klienten trykker paa allerede-aktiv knap for at fortryde).
 */
export async function opdaterBonusSvar(
	uid: string,
	productId: string,
	dagNummer: number,
	bonusId: string,
	svar: 'ja' | 'nej' | null
): Promise<void> {
	const id = `dag${dagNummer}`;
	const ref = vanedagDoc(uid, productId, id);
	if (svar === null) {
		// arrayRemove/delete-field-i-nested-object kraever updateDoc med dot-path
		const { deleteField, updateDoc } = await import('firebase/firestore');
		await updateDoc(ref, {
			[`bonus.${bonusId}`]: deleteField(),
			savedAt: serverTimestamp()
		});
		return;
	}
	await setDoc(
		ref,
		{
			dagNummer,
			bonus: { [bonusId]: svar },
			savedAt: serverTimestamp()
		},
		{ merge: true }
	);
}
