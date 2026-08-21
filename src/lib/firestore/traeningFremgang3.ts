// Kundens fremgang i traeningsprogrammerne. Bid 3, 15. august 2026.
//
// users/{uid}/traeningFremgang3/{programId}
//
// Ét dokument pr program. Derfor kan hun skifte mellem programmer uden
// at miste noget, og derfor overlever fremgangen at et program bliver
// taget fra hende igen.
//
// AFSPILLEREN ER DEN ENESTE DER SKRIVER. Alt andet laeser kun.

import { arrayUnion, collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '$lib/firebase';
import { aktivBrugerBasisPath } from '$lib/utils/adminKlient';
import type { Traeningsfremgang3 } from '$lib/content/traeningFremgang3';

function fremgangCol(uid: string) {
	return collection(db, `${aktivBrugerBasisPath(uid)}/traeningFremgang3`);
}

function fremgangDoc(uid: string, programId: string) {
	return doc(db, `${aktivBrugerBasisPath(uid)}/traeningFremgang3/${programId}`);
}

/**
 * Markerer én traening som gennemfoert.
 *
 * arrayUnion, saa den samme traening ikke kan staa to gange hvis hun
 * tager den om. Og merge, saa vi aldrig skriver hele listen ud fra en
 * kopi der kan vaere forældet.
 */
export async function gemGennemfoert3(
	uid: string,
	programId: string,
	nr: number,
	nu: number
): Promise<void> {
	await setDoc(
		fremgangDoc(uid, programId),
		{ gennemfoerte: arrayUnion(nr), senestAt: nu },
		{ merge: true }
	);
}

/**
 * Starter programmet forfra: toemmer listen og taeller runden op.
 *
 * SKRIVER OG ROERER IKKE arrayUnion. Listen skal SAETTES til tom, og en
 * union kan kun laegge til. Det var praecis dét der gjorde at loopet ikke
 * virkede foer 20. august, se runde-feltet i content/traeningFremgang3.
 *
 * Historikken gaar ikke tabt: hver gennemfoert traening ligger separat i
 * traeningHistorik og roeres ikke her.
 */
export async function startNyRunde3(
	uid: string,
	programId: string,
	nyRunde: number
): Promise<void> {
	await setDoc(fremgangDoc(uid, programId), { gennemfoerte: [], runde: nyRunde }, { merge: true });
}

/**
 * Hele hendes fremgang, som et kort fra program-id til fremgang.
 *
 * Ét kald. Der er faa dokumenter, ét pr program hun har traenet i, og
 * listen skal alligevel bruge dem alle sammen for at kunne sortere.
 */
export async function hentFremgang3(uid: string): Promise<Map<string, Traeningsfremgang3>> {
	const snap = await getDocs(fremgangCol(uid));
	const kort = new Map<string, Traeningsfremgang3>();
	for (const d of snap.docs) {
		const data = d.data() as Partial<Traeningsfremgang3>;
		kort.set(d.id, {
			programId: d.id,
			gennemfoerte: Array.isArray(data.gennemfoerte)
				? data.gennemfoerte.filter((n): n is number => typeof n === 'number')
				: [],
			senestAt: typeof data.senestAt === 'number' ? data.senestAt : 0,
			// Gamle dokumenter har ikke feltet. De er i deres foerste runde.
			runde: typeof data.runde === 'number' && data.runde >= 1 ? data.runde : 1
		});
	}
	return kort;
}
