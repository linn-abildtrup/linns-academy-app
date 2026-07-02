// Visnings-helpers til app-abonnementet ("Dit abonnement" + udløbs-påmindelse).
// Bygger på aboKoebtAt/aboSlutterAt som webhooken sætter (Simplero purchased_at
// + period_ends_at). Rene funktioner så de kan testes uden Firestore/DOM.

import type { UserDoc } from '$lib/types';

/** Antal dage før udløb hvor forsidens påmindelse begynder at vises. */
export const PAAMIND_DAGE = 14;

/** Simplero-link til at forny/genkøbe app-adgangen. */
export const APP_KOB_URL = 'https://linn.simplero.com/cart/255519-Linns-Academy-App';

export interface AboVisning {
	/** Kunden har en fast abo-periode (aboSlutterAt sat). False for comp-/
	 *  manuelle konti med løbende adgang. */
	harPeriode: boolean;
	koebtAt?: number;
	slutterAt?: number;
	/** Hele dage til udløb (afrundet op). Kun sat når harPeriode. */
	dageTilbage?: number;
	/** True når udløb er inden for PAAMIND_DAGE (og ikke allerede passeret). */
	taetPaaUdloeb: boolean;
}

const MS_PR_DAG = 86400000;

/** Udleder abo-visnings-data for en kunde. */
export function aboVisning(
	userDoc: UserDoc | null | undefined,
	now: number = Date.now()
): AboVisning {
	const slutterAt = userDoc?.aboSlutterAt;
	const koebtAt = userDoc?.aboKoebtAt;
	if (!slutterAt) {
		return { harPeriode: false, koebtAt, taetPaaUdloeb: false };
	}
	const dageTilbage = Math.max(0, Math.ceil((slutterAt - now) / MS_PR_DAG));
	const taetPaaUdloeb = slutterAt > now && slutterAt - now <= PAAMIND_DAGE * MS_PR_DAG;
	return { harPeriode: true, koebtAt, slutterAt, dageTilbage, taetPaaUdloeb };
}

/** Dansk lang dato, fx "16. december 2026". */
export function formaterDatoLang(ms: number): string {
	return new Date(ms).toLocaleDateString('da-DK', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
}
