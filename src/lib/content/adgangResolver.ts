// Samlet dato-styret adgangs-resolver. Afgør en kundes AKTUELLE tilstand ud fra
// hendes forløbs-vinduer + abo-periode, så app↔forløb-skift sker automatisk
// efter dato:
//   - Aktivt forløb (start <= nu < slut)   → forløbskunde
//   - Ellers gyldig abo (aboSlutterAt > nu) → app-kunde (modulbruger)
//   - Ellers                                → udlobet
//
// Ren funktion (ingen Firestore) så alle overgange kan testes. Kalderen
// (login-sync / audit) bygger vinduerne fra forlob-docs + abo-felterne.

export type Niveau = 'basis' | 'premium';

export interface ForlobVindue {
	id: string;
	startMs: number;
	/** Forløbets indholds-slut (forlobSlutMs). Kunden er forløbskunde i
	 *  [startMs, slutMs). Efter slutMs falder hun tilbage til app (hvis abo
	 *  gyldig) — bibliotek-bonus håndteres separat via bonusPeriodEndsAt. */
	slutMs: number;
	accessLevel: Niveau;
	activeProduct: string;
}

export interface AboPeriode {
	/** period_ends_at (ms). Undefined = comp/manuel konto med løbende adgang. */
	slutterAt?: number;
	produkt?: string; // basisabo | premiumabo
	accessLevel?: Niveau;
}

export interface AdgangResultat {
	state: 'forlobskunde' | 'modulbruger' | 'udlobet';
	accessSource?: 'forløb' | 'abonnement';
	activeProduct?: string;
	accessLevel?: Niveau;
	expiresAt?: number;
	aktivtForlobId?: string;
}

/**
 * Resolver en kundes aktuelle adgang. `abo.slutterAt` undefined = løbende abo
 * (comp/manuel) der aldrig udløber af sig selv.
 */
export function resolverAktuelAdgang(
	nu: number,
	forlob: ForlobVindue[],
	abo: AboPeriode
): AdgangResultat {
	// 1) Aktivt forløb vinder. Ved overlap: det med senest slut (mest adgang).
	const aktive = forlob.filter((f) => nu >= f.startMs && nu < f.slutMs);
	if (aktive.length > 0) {
		const valgt = aktive.reduce((a, b) => (b.slutMs > a.slutMs ? b : a));
		return {
			state: 'forlobskunde',
			accessSource: 'forløb',
			activeProduct: valgt.activeProduct,
			accessLevel: valgt.accessLevel,
			expiresAt: valgt.slutMs,
			aktivtForlobId: valgt.id
		};
	}

	// 2) Ingen aktivt forløb → gyldig abo? (løbende abo uden slutdato tæller som gyldig)
	const aboGyldig = abo.produkt != null && (abo.slutterAt == null || abo.slutterAt > nu);
	if (aboGyldig) {
		return {
			state: 'modulbruger',
			accessSource: 'abonnement',
			activeProduct: abo.produkt,
			accessLevel: abo.accessLevel,
			...(abo.slutterAt != null ? { expiresAt: abo.slutterAt } : {})
		};
	}

	// 3) Hverken aktivt forløb eller gyldig abo → udløbet.
	return { state: 'udlobet' };
}
