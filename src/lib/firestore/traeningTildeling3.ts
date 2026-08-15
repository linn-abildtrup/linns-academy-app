// Firestore-laget for tildelinger i 3.0. Bid 2, 15. august 2026.
//
// traeningTildelinger3/{id}
//
// Kun 3.0 laeser her. Den gamle apps tildelinger ligger i
// programTildelinger og customBuilderTildelinger og er urørte, saa de
// 760 kunder i drift ser praecis det samme som foer.
//
// Hele samlingen hentes paa én gang. Der er faa af dem, i stoerrelses-
// ordenen et par hundrede raekker, og baade daeknings-siden og
// kunde-opslaget skal alligevel se dem alle sammen for at kunne svare.
// Tre forespoergsler pr kunde ville vaere flere kald og ikke faerre.

import { addDoc, collection, deleteDoc, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { NyTildeling3, Traeningstildeling3 } from '$lib/content/traeningTildeling3';

const SAMLING = 'traeningTildelinger3';

function tildelingCol() {
	return collection(db, SAMLING);
}

export async function hentTildelinger3(): Promise<Traeningstildeling3[]> {
	const snap = await getDocs(tildelingCol());
	return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Traeningstildeling3, 'id'>) }));
}

/** Opretter én tildeling og giver den tilbage med sit id. */
export async function opretTildeling3(ny: NyTildeling3): Promise<Traeningstildeling3> {
	const ref = await addDoc(tildelingCol(), ny);
	return { id: ref.id, ...ny };
}

/**
 * Opretter flere paa én gang. Bruges naar Linn saetter flueben ved flere
 * hold, og naar et holds tildelinger kopieres over paa et nyt hold.
 * Ét batch, saa enten kommer de alle sammen ind eller ingen.
 */
export async function opretTildelinger3(nye: NyTildeling3[]): Promise<void> {
	if (nye.length === 0) return;
	const batch = writeBatch(db);
	for (const ny of nye) {
		batch.set(doc(tildelingCol()), ny);
	}
	await batch.commit();
}

export async function sletTildeling3(id: string): Promise<void> {
	await deleteDoc(doc(db, SAMLING, id));
}

/**
 * Sletter alle tildelinger der peger paa et program. Kaldes naar
 * programmet slettes, saa der ikke bliver liggende raekker der peger paa
 * ingenting og taeller med i daekningen.
 */
export async function sletTildelingerForProgram3(programId: string): Promise<void> {
	const alle = await hentTildelinger3();
	const doede = alle.filter((t) => t.type === 'program' && t.programId === programId);
	if (doede.length === 0) return;
	const batch = writeBatch(db);
	for (const t of doede) batch.delete(doc(db, SAMLING, t.id));
	await batch.commit();
}
