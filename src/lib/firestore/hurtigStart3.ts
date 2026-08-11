// ============================================================
// Henter HELE opstarts-billedet fra kundens egen kopi, uden at spoerge
// serveren én eneste gang. Bruges kun af den hurtige opstart i skallen,
// se content/hurtigStart3.ts for hvorfor.
//
// Firestore gemmer i forvejen hver doc i browserens IndexedDB, se localCache
// i lib/firebase.ts. Det almindelige getDoc spoerger alligevel serveren
// foerst, og det er praecis dét der kan tage et minut paa en doed
// forbindelse. getDocFromCache roerer aldrig netvaerket.
//
// Hvorfor det hele og ikke bare bruger-dokumentet: spaerringen hviler paa at
// vi ved om kunden har et aktivt forloeb. Mangler forloebene, ville en
// Kropsro-kunde med udloebet abonnement se "Din adgang er udloebet" midt i
// sit forloeb. Se faelde-afsnittet i content/hurtigStart3.ts.
//
// Rækkefoelgen og udregningerne er de samme som skallens egne, saa kopien og
// serverens svar giver samme skaerm naar dataene er ens.
// ============================================================

import { doc, getDocFromCache } from 'firebase/firestore';
import { db } from '$lib/firebase';
import { nulDatoer, produktHarNulDage } from '$lib/content/nulDage3';
import { produktTypeForForlob, type Forlob } from '$lib/content/forlobAdgang';
import type { ForlobKilde, NulDageKilde } from '$lib/content/adgang3';
import type { UserDoc } from '$lib/types';

/** Alt det skallen henter ved opstart, laest lokalt. */
export interface OpstartsKopi {
	userDoc: UserDoc | null;
	forlob: ForlobKilde[];
	nulDage: NulDageKilde;
}

/** Tom kopi. Bruges naar der ikke er noget at hente. */
const TOM: OpstartsKopi = { userDoc: null, forlob: [], nulDage: {} };

/**
 * Læser ét dokument fra den lokale kopi. Null hvis det ikke ligger der.
 *
 * Kaster aldrig. At der ikke er nogen kopi er en helt normal tilstand og
 * ikke en fejl: det sker foerste gang kunden logger ind paa en enhed, og hvis
 * browseren har ryddet sin lagring (privat vindue, fuld kvota, eller Safari
 * der rydder op efter laengere tids pause).
 */
async function fraCache(sti: string[]): Promise<Record<string, unknown> | null> {
	try {
		const [foerste, ...resten] = sti;
		const snap = await getDocFromCache(doc(db, foerste, ...resten));
		if (!snap.exists()) return null;
		return snap.data() as Record<string, unknown>;
	} catch {
		return null;
	}
}

/**
 * Hele opstarts-billedet fra den lokale kopi.
 *
 * Er bruger-dokumentet ikke i kopien, giver vi op med det samme og lader
 * skallen vente paa serveren som altid. Uden det er der alligevel intet at
 * vise.
 */
export async function hentOpstartFraCache(uid: string): Promise<OpstartsKopi> {
	const userDoc = (await fraCache(['users', uid])) as UserDoc | null;
	if (!userDoc) return TOM;

	const ids = userDoc.forlobIds ?? [];
	if (ids.length === 0) return { userDoc, forlob: [], nulDage: {} };

	// Samme mapning som indlaesForlob i skallen. Et forloeb uden startDato
	// springes over, praecis som der.
	const hentet = await Promise.all(
		ids.map(async (id) => {
			const data = await fraCache(['forlob', id]);
			if (!data) return null;
			const f = { id, ...data } as Forlob;
			if (!f.startDato) return null;
			return {
				id,
				navn: f.navn,
				startMs: f.startDato.toDate().getTime(),
				antalDage: f.antalDage,
				produkt: produktTypeForForlob(f)
			} satisfies ForlobKilde;
		})
	);
	const forlob = hentet.filter((f): f is ForlobKilde => f !== null);

	return { userDoc, forlob, nulDage: await nulDageFraCache(uid, forlob) };
}

/**
 * Pause-dagene fra den lokale kopi. Samme sti og samme udregning som
 * firestore/nulDage3.ts, bare uden at spoerge serveren.
 *
 * Kun Kropsro kan holde pause, saa for alle andre koster det her nul opslag.
 */
async function nulDageFraCache(uid: string, forlob: ForlobKilde[]): Promise<NulDageKilde> {
	const relevante = [...new Set(forlob.map((f) => f.produkt))].filter(produktHarNulDage);
	if (relevante.length === 0) return {};

	const ud: NulDageKilde = {};
	await Promise.all(
		relevante.map(async (produkt) => {
			const data = await fraCache(['users', uid, 'products', produkt]);
			const iv = (data?.nulDage as { intervaller?: unknown } | undefined)?.intervaller;
			if (!Array.isArray(iv) || iv.length === 0) return;
			const datoer = nulDatoer(iv);
			if (datoer.length > 0) ud[produkt] = datoer;
		})
	);
	return ud;
}
