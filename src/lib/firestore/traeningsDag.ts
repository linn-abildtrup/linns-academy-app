// ============================================================
// Hvilken forloebsdag staar kunden paa lige nu.
//
// HVORFOR EN EGEN FIL. Reglen om hvornaar traeningen begynder ligger i
// content/traeningStart.ts, men for at bruge den skal man vide hvilken
// dag kunden er paa, og DET kraever tre opslag i databasen: forloebet,
// hendes produkt og hendes pause-dage. Den udregning laa kun inde paa
// selve program-siden, saa traenings-oversigten kunne ikke stille
// samme spoergsmaal. Derfor ligger den her, hvor begge kan bruge den.
//
// Linns krav 29. august 2026: "kunden skal heller ikke kunne gaa ind i
// traeningsmodulet og snyde sig til at starte". Fundet 30. august at
// spaerringen kun sad paa forsiden og den gamle traenings-side.
// ============================================================

import { hentForlob, hentAktivProduktType } from '$lib/firestore/forlob';
import { hentUserProduct } from '$lib/firestore/mikrotraening';
import { getCurrentDayMedNulDage, nulDageDatoer, toIsoLokal } from '$lib/content/forlob';
import type { Forlob } from '$lib/content/forlobAdgang';

export interface ForlobsDagSvar {
	/** Forloebet, eller null hvis vi ikke kunne hente det. */
	forlob: Forlob | null;
	/**
	 * Kundens forloebsdag. 0 er startdagen. Null naar vi ikke kan regne den
	 * ud, fx foer forloebet begynder eller efter det er slut.
	 *
	 * VIGTIGT: null betyder "ved ikke", ikke "dag 0". En spaerring maa aldrig
	 * lukke en kunde ude paa et gaet, saa kalderen skal lade tvivlen komme
	 * kunden til gode.
	 */
	forlobsDag: number | null;
}

/**
 * Henter forloebet og regner kundens dag ud, pauser medregnet.
 *
 * Pause-dagene skal med. Uden dem taeller vi kalenderdage, og saa ville en
 * kunde der har holdt pause staa laengere fremme end hun er.
 */
export async function hentForlobsDag(
	uid: string,
	forlobId: string,
	forlobIds: string[]
): Promise<ForlobsDagSvar> {
	const forlob = await hentForlob(forlobId);
	if (!forlob) return { forlob: null, forlobsDag: null };

	let nulDatoer: string[] = [];
	try {
		const produktType = await hentAktivProduktType(forlobIds.length ? forlobIds : [forlobId], uid);
		const up = await hentUserProduct(uid, produktType);
		nulDatoer = nulDageDatoer(up?.nulDage?.intervaller ?? []);
	} catch {
		// Best-effort. Kan vi ikke hente pauserne, regner vi uden dem. Det
		// giver et dag-nummer der er lige saa stort eller stoerre, altsaa
		// aldrig en spaerring der rammer for haardt.
	}

	const startDato = toIsoLokal(forlob.startDato.toDate());
	const forlobsDag = getCurrentDayMedNulDage(
		{ startDato, antalDage: forlob.antalDage },
		nulDatoer
	);
	return { forlob, forlobsDag };
}
