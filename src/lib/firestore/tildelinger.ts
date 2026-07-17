// Firestore-helpers for tildelinger.
//
// Datamodel:
//   - programTildelinger/{tildelingId}           ← admin tildeler program til kunde/forløb
//
// Pure-funktionerne ligger i $lib/content/tildelinger så de kan testes uden
// firebase-runtime.

import { addDoc, collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { ModtagerType, ProgramTildeling } from '$lib/content/tildelinger';
import { tildelingerForKunde } from '$lib/content/tildelinger';
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

// ==============================================
// Hentning
// ==============================================

export async function hentAlleProgramTildelinger(): Promise<ProgramTildeling[]> {
	const snap = await getDocs(collection(db, PROGRAM_COL));
	return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ProgramTildeling, 'id'>) }));
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
 * modtager allerede har samme program (samme kilde + forløb) tildelt,
 * returneres den eksisterende.
 *
 * forlobId og programKilde er valgfri: master-programmer har intet forlobId
 * og programKilde='master'. Vi undgår at skrive undefined-felter til Firestore
 * og deduper på kilde+forløb i hukommelsen (så undefined ikke rammer where()).
 */
export async function tildelProgram(
	args: Omit<ProgramTildeling, 'id' | 'tildeltAt'>
): Promise<ProgramTildeling> {
	const kilde: 'master' | 'forlob' = args.programKilde ?? 'forlob';
	const forlob = args.forlobId ?? '';

	const q = query(
		collection(db, PROGRAM_COL),
		where('programId', '==', args.programId),
		where('modtagerType', '==', args.modtagerType),
		where('modtagerId', '==', args.modtagerId)
	);
	const eksisterende = await getDocs(q);
	const match = eksisterende.docs.find((d) => {
		const data = d.data() as ProgramTildeling;
		return (data.programKilde ?? 'forlob') === kilde && (data.forlobId ?? '') === forlob;
	});
	if (match) {
		return { id: match.id, ...(match.data() as Omit<ProgramTildeling, 'id'>) };
	}

	const nu = Date.now();
	// Byg payload eksplicit så vi aldrig sender undefined-felter (Firestore afviser dem).
	// forlobId er tom streng for master-programmer.
	const payload = {
		programId: args.programId,
		forlobId: forlob,
		programKilde: kilde,
		modtagerType: args.modtagerType,
		modtagerId: args.modtagerId,
		tildeltAf: args.tildeltAf,
		tildeltAt: nu
	};

	const docRef = await addDoc(collection(db, PROGRAM_COL), payload);
	return { id: docRef.id, ...args, forlobId: forlob, programKilde: kilde, tildeltAt: nu };
}

export async function fjernProgramTildeling(tildelingId: string): Promise<void> {
	await deleteDoc(doc(db, PROGRAM_COL, tildelingId));
}

// ==============================================
// Kunde-side helpers
// ==============================================

export interface KundeTildelinger {
	programmer: ProgramTildeling[];
}

/**
 * Henter alle tildelinger der gælder for en specifik kunde — både direkte
 * tildelinger og dem hun arver via sine forløb. Bruges af kunde-siden af
 * træning-modulet.
 */
export async function hentTildelingerForBruger(
	uid: string,
	forlobIds: string[],
	opts: { erAppBruger?: boolean } = {}
): Promise<KundeTildelinger> {
	const alleProgTilds = await hentAlleProgramTildelinger();
	return {
		programmer: tildelingerForKunde(uid, forlobIds, alleProgTilds, opts)
	};
}
