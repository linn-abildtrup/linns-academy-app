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

import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	getDocs,
	query,
	where,
	writeBatch
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { NyTildeling3, Traeningstildeling3 } from '$lib/content/traeningTildeling3';

const SAMLING = 'traeningTildelinger3';

function tildelingCol() {
	return collection(db, SAMLING);
}

function fraSnap(d: { id: string; data: () => unknown }): Traeningstildeling3 {
	return { id: d.id, ...(d.data() as Omit<Traeningstildeling3, 'id'>) };
}

/** Alle tildelinger. Kun admin maa det, se firestore.rules. */
export async function hentTildelinger3(): Promise<Traeningstildeling3[]> {
	const snap = await getDocs(tildelingCol());
	return snap.docs.map(fraSnap);
}

/**
 * Kundens egne tildelinger. TO forespoergsler, og det er med vilje.
 *
 * Raekker til et hold, til medlemmer og til alle indeholder ingen
 * personoplysninger, saa dem maa enhver indlogget kunde laese. En raekke
 * til ÉN person indeholder hendes navn, og den maa kun hun selv laese.
 * Derfor er den anden forespoergsel snaevret ind til hendes eget uid, og
 * reglen i firestore.rules kraever praecis den indsnaevring.
 *
 * Et enkelt kald efter hele samlingen ville blive afvist af reglen, og
 * det er meningen. Kunder skal ikke kunne laese hinandens navne.
 */
export async function hentMineTildelinger3(uid: string): Promise<Traeningstildeling3[]> {
	const [bredde, egne] = await Promise.all([
		getDocs(query(tildelingCol(), where('modtagerType', 'in', ['hold', 'medlemmer', 'alle']))),
		getDocs(
			query(
				tildelingCol(),
				where('modtagerType', '==', 'kunde'),
				where('modtagerId', '==', uid)
			)
		)
	]);
	return [...bredde.docs, ...egne.docs].map(fraSnap);
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
