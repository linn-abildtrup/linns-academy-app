// Firestore-helpers for tildelinger.
//
// Datamodel:
//   - programTildelinger/{tildelingId}           ← admin tildeler program til kunde/forløb
//   - customBuilderTildelinger/{tildelingId}     ← admin tildeler custom-builder-adgang
//
// Pure-funktionerne ligger i $lib/content/tildelinger så de kan testes uden
// firebase-runtime.

import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	getDocs,
	query,
	where
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type {
	CustomBuilderTildeling,
	ModtagerType,
	ProgramTildeling
} from '$lib/content/tildelinger';
import {
	harCustomBuilderAdgang,
	tildelingerForKunde
} from '$lib/content/tildelinger';
import { alleProdukter } from '$lib/content/produkter';
import type { TrainingProgram } from '$lib/content/mikrotraening';
import { hentForlobsProgrammer } from './mikrotraening';

export interface ProgramMedForlob {
	forlobId: string;
	forlobNavn: string;
	program: TrainingProgram;
}

/**
 * Henter alle træningsprogrammer på tværs af alle forløb. Bruges af admin-UI'en
 * når et program skal tildeles — programmer er stadig hostet pr forløb, men
 * kan tildeles på tværs.
 */
export async function hentAlleProgrammerPaaTvaers(): Promise<ProgramMedForlob[]> {
	const resultat: ProgramMedForlob[] = [];
	for (const p of alleProdukter()) {
		if (!p.forlobId) continue;
		const programmer = await hentForlobsProgrammer(p.forlobId);
		for (const prog of programmer) {
			resultat.push({ forlobId: p.forlobId, forlobNavn: p.navn, program: prog });
		}
	}
	return resultat;
}

const PROGRAM_COL = 'programTildelinger';
const CUSTOM_BUILDER_COL = 'customBuilderTildelinger';

// ==============================================
// Hentning
// ==============================================

export async function hentAlleProgramTildelinger(): Promise<ProgramTildeling[]> {
	const snap = await getDocs(collection(db, PROGRAM_COL));
	return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ProgramTildeling, 'id'>) }));
}

export async function hentAlleCustomBuilderTildelinger(): Promise<CustomBuilderTildeling[]> {
	const snap = await getDocs(collection(db, CUSTOM_BUILDER_COL));
	return snap.docs.map((d) => ({
		id: d.id,
		...(d.data() as Omit<CustomBuilderTildeling, 'id'>)
	}));
}

/**
 * Henter program-tildelinger der rammer en specifik modtager
 * (enten en kunde-uid eller et forløbs-id).
 */
export async function hentProgramTildelingerForModtager(
	modtagerType: ModtagerType,
	modtagerId: string
): Promise<ProgramTildeling[]> {
	const q = query(
		collection(db, PROGRAM_COL),
		where('modtagerType', '==', modtagerType),
		where('modtagerId', '==', modtagerId)
	);
	const snap = await getDocs(q);
	return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ProgramTildeling, 'id'>) }));
}

// ==============================================
// Oprettelse + sletning
// ==============================================

/**
 * Opretter en program-tildeling. Forhindrer dubletter: hvis præcis samme
 * modtager allerede har samme program tildelt, returneres den eksisterende.
 */
export async function tildelProgram(
	args: Omit<ProgramTildeling, 'id' | 'tildeltAt'>
): Promise<ProgramTildeling> {
	const q = query(
		collection(db, PROGRAM_COL),
		where('programId', '==', args.programId),
		where('forlobId', '==', args.forlobId),
		where('modtagerType', '==', args.modtagerType),
		where('modtagerId', '==', args.modtagerId)
	);
	const eksisterende = await getDocs(q);
	if (!eksisterende.empty) {
		const d = eksisterende.docs[0];
		return { id: d.id, ...(d.data() as Omit<ProgramTildeling, 'id'>) };
	}
	const nu = Date.now();
	const docRef = await addDoc(collection(db, PROGRAM_COL), { ...args, tildeltAt: nu });
	return { id: docRef.id, ...args, tildeltAt: nu };
}

export async function fjernProgramTildeling(tildelingId: string): Promise<void> {
	await deleteDoc(doc(db, PROGRAM_COL, tildelingId));
}

export async function tildelCustomBuilder(
	args: Omit<CustomBuilderTildeling, 'id' | 'tildeltAt'>
): Promise<CustomBuilderTildeling> {
	const q = query(
		collection(db, CUSTOM_BUILDER_COL),
		where('modtagerType', '==', args.modtagerType),
		where('modtagerId', '==', args.modtagerId)
	);
	const eksisterende = await getDocs(q);
	if (!eksisterende.empty) {
		const d = eksisterende.docs[0];
		return { id: d.id, ...(d.data() as Omit<CustomBuilderTildeling, 'id'>) };
	}
	const nu = Date.now();
	const docRef = await addDoc(collection(db, CUSTOM_BUILDER_COL), { ...args, tildeltAt: nu });
	return { id: docRef.id, ...args, tildeltAt: nu };
}

export async function fjernCustomBuilderTildeling(tildelingId: string): Promise<void> {
	await deleteDoc(doc(db, CUSTOM_BUILDER_COL, tildelingId));
}

// ==============================================
// Kunde-side helpers
// ==============================================

export interface KundeTildelinger {
	programmer: ProgramTildeling[];
	harCustomBuilder: boolean;
}

/**
 * Henter alle tildelinger der gælder for en specifik kunde — både direkte
 * tildelinger og dem hun arver via sine forløb. Bruges af kunde-siden af
 * træning-modulet.
 */
export async function hentTildelingerForBruger(
	uid: string,
	forlobIds: string[]
): Promise<KundeTildelinger> {
	const [alleProgTilds, alleCbTilds] = await Promise.all([
		hentAlleProgramTildelinger(),
		hentAlleCustomBuilderTildelinger()
	]);
	return {
		programmer: tildelingerForKunde(uid, forlobIds, alleProgTilds),
		harCustomBuilder: harCustomBuilderAdgang(uid, forlobIds, alleCbTilds)
	};
}
