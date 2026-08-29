// ============================================================
// Vagten over opstarten.
//
// PROBLEMET, maalt 29. august 2026. Efter en frisk installation kunne
// appen saette sig fast: Auth svarede paa 200 ms, og derefter blev der
// sendt NUL kald til Firestore. Ikke langsomme kald. Ingen kald. Der er
// ingen tidsgraense noget sted i opstarten, saa appen ventede i det
// uendelige, mens skaermen viste en bjaelke der bare taeller sekunder.
//
// Selve aarsagen er fjernet (se firebase.ts, den delte lokale kopi), men
// vi vil ikke stole paa at det aldrig sker igen. Derfor holder appen nu
// oeje med sig selv.
//
// DEN SVAERE DEL er at kende forskel paa "sat fast" og "bare langsom".
// En kunde i toget med daarligt signal maa ALDRIG faa sit lager ryddet,
// bare fordi serveren er lidt om det. Kendetegnet fra maalingen er
// praecist: naar appen er sat fast, har den ikke sendt ét eneste kald.
// Er der kald undervejs, arbejder den, og saa venter vi taalmodigt.
//
// Ren logik nederst, saa beslutningen kan testes uden browser.
// ============================================================

import { browser } from '$app/environment';

/** Vi rydder og genstarter hoejst én gang pr session. */
const NULSTIL_NOEGLE = 'opstartNulstilletEnGang';

/**
 * Hvor laenge vi venter, foer vi konkluderer at noget er galt.
 *
 * Den normale kunde er inde paa under to sekunder, og den hurtige
 * opstart lukker hende ind paa kopien efter 2,5. Otte sekunder er
 * altsaa langt ude over det normale, uden at vi rammer den kunde der
 * bare har en tung forbindelse.
 */
export const VAGT_MS = 8000;

/**
 * Hvor laenge foer vi holder op med at lade som om, og siger det som det
 * er. Ligger efter vagten, saa en vellykket genstart naar at ske foerst.
 */
export const AERLIG_SKAERM_MS = 12000;

/**
 * Har Firestore overhovedet talt med serveren?
 *
 * Browserens egen maaleliste over hentede ressourcer indeholder alle
 * kald, ogsaa dem SDK'et selv laver. Er listen tom for
 * firestore.googleapis.com, er klienten aldrig kommet i gang.
 */
export function harKontaktetDatabasen(): boolean {
	if (!browser || typeof performance?.getEntriesByType !== 'function') return true;
	try {
		return performance
			.getEntriesByType('resource')
			.some((r) => r.name.includes('firestore.googleapis.com'));
	} catch {
		// Kan vi ikke maale, antager vi det bedste og lader appen vaere i fred.
		return true;
	}
}

export interface VagtVilkaar {
	/** Er opstarten stadig ikke faerdig. */
	stadigIGang: boolean;
	/** Har vi set kald til databasen. */
	harKontakt: boolean;
	/** Har vi allerede ryddet og genstartet i denne session. */
	alleredeNulstillet: boolean;
}

/**
 * Skal vi rydde det lokale lager og starte forfra?
 *
 * Alle tre skal vaere sande. Er der kontakt til databasen, arbejder appen
 * og skal have lov. Har vi allerede genstartet én gang, roerer vi den
 * ikke igen, for en app der genstarter sig selv i ring er vaerre end en
 * der staar stille.
 */
export function boerNulstille(v: VagtVilkaar): boolean {
	if (!v.stadigIGang) return false;
	if (v.harKontakt) return false;
	if (v.alleredeNulstillet) return false;
	return true;
}

/** Har vi brugt vores ene genstart i denne session? */
export function harNulstilletFoer(): boolean {
	if (!browser) return false;
	try {
		return sessionStorage.getItem(NULSTIL_NOEGLE) === '1';
	} catch {
		// Uden sessionStorage kan vi ikke holde styr paa det, og saa toer vi
		// ikke genstarte overhovedet. Bedre at staa stille end at gaa i ring.
		return true;
	}
}

/** Husk at vi har brugt den. Kaldes lige FOER genstarten. */
export function huskNulstilling(): void {
	if (!browser) return;
	try {
		sessionStorage.setItem(NULSTIL_NOEGLE, '1');
	} catch {
		// Ignoreres med vilje. Kan vi ikke huske det, naar vi alligevel ikke
		// hertil igen, fordi harNulstilletFoer saa svarer sandt.
	}
}
