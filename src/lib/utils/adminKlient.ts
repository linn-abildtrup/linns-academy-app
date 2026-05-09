// Helpers til 'Skift til klient'-mode for admin-brugere.
//
// Når admin trykker på Klient-ikonet i tabbaren og vælger et forløb sættes
// userDoc.adminKlientForlobId = forløbsId. Mens feltet er sat opfører appen
// sig som om admin var en klient på det valgte forløb — al klient-data
// (måltider, vaner, mikrotræning-fremgang osv.) gemmes i scoped sub-paths
// så Linns rigtige admin-data forbliver intakte.
//
// Sub-path-strukturen:
//   users/{uid}/maaltider/{id}                              ← admin-mode
//   users/{uid}/adminKlient/{forlobId}/maaltider/{id}      ← klient-mode
//
// Helpers her returnerer den korrekte base-path baseret på context. Alle
// firestore-helpers der i dag bruger 'users/{uid}/X' skal igennem
// brugerBasisPath i stedet for at hardcode pathen.

const ADMIN_KLIENT_BASIS = 'adminKlient';

/**
 * Returnerer base-pathen til brugerens klient-data. Hvis admin er i
 * klient-mode, scoper pathen til den specifikke forløbs-sandkasse.
 *
 * @param uid Den autentificerede brugers Firebase UID
 * @param adminKlientForlobId Hvis sat: forløbet admin er logget ind som
 *                            klient på. Ellers null/undefined.
 */
export function brugerBasisPath(uid: string, adminKlientForlobId?: string | null): string {
	if (adminKlientForlobId) {
		return `users/${uid}/${ADMIN_KLIENT_BASIS}/${adminKlientForlobId}`;
	}
	return `users/${uid}`;
}

/**
 * Splitter base-pathen til (collection, doc, ...) som Firestore SDK
 * forventer i doc()/collection()-kald.
 */
export function brugerBasisSegmenter(
	uid: string,
	adminKlientForlobId?: string | null
): string[] {
	if (adminKlientForlobId) {
		return ['users', uid, ADMIN_KLIENT_BASIS, adminKlientForlobId];
	}
	return ['users', uid];
}
