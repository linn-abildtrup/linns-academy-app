// ============================================================
// Skemaet bag udvidet naering. 3.0's eget.
//
// TO STEDER, OG DET ER MED VILJE:
//
//  - naeringAdgang3/regler   ét dokument med medlems-linjen og alle
//    forloeb. Alle maa laese det, for kunden skal selv kunne spoerge.
//  - naeringKunde3/{uid}     én undtagelse pr kunde. Kunden laeser KUN
//    sin egen. Laa de i det faelles dokument, kunne enhver kunde se
//    navnene paa alle dem Linn har taget stilling til.
//
// Kun admin skriver begge steder.
//
// DEN GAMLE APPS SKEMA ROERES IKKE. Se content/naeringAdgang3.ts.
// ============================================================

import { collection, doc, getDoc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '$lib/firebase';
import {
	naeringAdgangFor3,
	type NaeringAdgang3,
	type NaeringRegel3,
	type NaeringRegler3
} from '$lib/content/naeringAdgang3';

const REGLER = 'naeringAdgang3/regler';
const KUNDER = 'naeringKunde3';

/** Hele skemaet. Tomt naar Linn ikke har rørt noget, og det betyder aabent. */
export async function hentNaeringRegler3(): Promise<NaeringRegler3> {
	try {
		const snap = await getDoc(doc(db, REGLER));
		if (!snap.exists()) return {};
		const d = snap.data() as NaeringRegler3;
		return { medlemmer: d.medlemmer ?? {}, forlob: d.forlob ?? {} };
	} catch (e) {
		// Kan vi ikke naa skemaet, er alt aabent. Det er den rigtige vej at
		// fejle: hun mister ikke noget hun plejer at have.
		console.warn('[ny] kunne ikke hente naerings-skemaet', e);
		return {};
	}
}

/** Hendes egen undtagelse, hvis der er en. */
export async function hentNaeringUndtagelse3(uid: string): Promise<NaeringRegel3 | null> {
	try {
		const snap = await getDoc(doc(db, KUNDER, uid));
		if (!snap.exists()) return null;
		const d = snap.data() as NaeringRegel3;
		return { udvidet: d.udvidet, maaRette: d.maaRette };
	} catch (e) {
		console.warn('[ny] kunne ikke hente undtagelsen', e);
		return null;
	}
}

/** Hele skemaet. Kun admin. */
export async function gemNaeringRegler3(regler: NaeringRegler3): Promise<void> {
	await setDoc(
		doc(db, REGLER),
		{ medlemmer: regler.medlemmer ?? {}, forlob: regler.forlob ?? {}, opdateretMs: Date.now() },
		{ merge: true }
	);
}

/**
 * Hvad der gaelder for én kunde, hentet i ét kald.
 *
 * Bruges alle de steder der viser eller skjuler de udvidede tal, saa de
 * ikke kan naa at sige noget forskelligt.
 */
export async function hentNaeringAdgang3(
	uid: string,
	aktivtForlobId: string | null
): Promise<NaeringAdgang3> {
	const [regler, undtagelse] = await Promise.all([
		hentNaeringRegler3(),
		hentNaeringUndtagelse3(uid)
	]);
	return naeringAdgangFor3(regler, undtagelse, aktivtForlobId);
}

/** Én undtagelse, som den ser ud i admin-listen. */
export interface Undtagelse3 extends NaeringRegel3 {
	uid: string;
	navn: string;
	under: string;
	satMs: number;
}

/** Alle undtagelser. Kun admin kan laese dem samlet. */
export async function hentUndtagelser3(): Promise<Undtagelse3[]> {
	const snap = await getDocs(collection(db, KUNDER));
	return snap.docs
		.map((d) => {
			const x = d.data() as Omit<Undtagelse3, 'uid'>;
			return {
				uid: d.id,
				navn: x.navn ?? '(uden navn)',
				under: x.under ?? '',
				satMs: x.satMs ?? 0,
				udvidet: x.udvidet,
				maaRette: x.maaRette
			};
		})
		.sort((a, b) => b.satMs - a.satMs);
}

/** Saetter eller opdaterer en undtagelse. Kun admin. */
export async function gemUndtagelse3(
	uid: string,
	regel: NaeringRegel3,
	navn: string,
	under: string
): Promise<void> {
	await setDoc(
		doc(db, KUNDER, uid),
		{ ...regel, navn, under, satMs: Date.now() },
		{ merge: true }
	);
}

/** Fjerner undtagelsen. Saa foelger kunden sit forloeb igen. */
export async function fjernUndtagelse3(uid: string): Promise<void> {
	await deleteDoc(doc(db, KUNDER, uid));
}
