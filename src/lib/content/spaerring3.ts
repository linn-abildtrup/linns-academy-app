// ============================================================
// Spaerring naar abonnementet er udloebet.
//
// REGLERNE, og hvorfor de er som de er:
//
// 1. Et aktivt forloeb giver ALTID adgang. En kvinde midt i Kropsro maa
//    aldrig spaerres, heller ikke hvis abonnementet udloeber undervejs.
//    Hun har betalt for forloebet.
//
// 2. Ingen slutdato betyder loebende adgang. Det er fri- og manuelle
//    konti. Maalt 9. august 2026: 7 af 178 abonnenter har ingen
//    slutdato. De skal aldrig spaerres.
//
// 3. Naadeperiode paa tre dage efter slutdatoen. Fornyelsen fra
//    Simplero kan komme forsinket, og en kunde der faktisk har betalt
//    skal ikke moede en mur imens. Tre dage koster ingenting og
//    fjerner hele den risiko.
//
// Tvivlen kommer altid kunden til gode. Det er bedre at give en
// udloebet kunde tre dage for meget end at laase en betalende ude.
//
// Maalt foer den blev bygget: af 615 kunder ville ÉN blive spaerret i
// dag, og hun har ikke brugt appen i over en maaned. Ingen aktiv kunde
// bliver ramt.
// ============================================================

const DAG = 86_400_000;

/** Dage efter slutdatoen hvor hun stadig lukkes ind. Se punkt 3. */
export const NAADE_DAGE = 3;

export interface SpaerringGrundlag {
	/** Har hun app-adgang lige nu, altsaa aktivt abo eller aktivt forloeb. */
	harApp: boolean;
	/** Er hun paa et forloeb der koerer. */
	harAktivtForlob: boolean;
	/** Hvornaar abonnementet slutter. Null betyder loebende adgang. */
	aboSlutterAt: number | null;
}

export type SpaerringSvar =
	| { spaerret: false; iNaade: boolean; dageTilbageAfNaade: number }
	| { spaerret: true; iNaade: false; dageTilbageAfNaade: 0 };

/**
 * Afgoer om kunden skal lukkes ind.
 *
 * Bemaerk at vi returnerer iNaade, ikke bare et ja eller nej. Er hun
 * inde paa naade, vil vi gerne kunne sige det til hende, saa hun naar
 * at forny inden det lukker.
 */
export function vurderSpaerring(g: SpaerringGrundlag, nu: number): SpaerringSvar {
	// Punkt 1: forloebet vinder over alt andet.
	if (g.harAktivtForlob) {
		return { spaerret: false, iNaade: false, dageTilbageAfNaade: 0 };
	}

	// Punkt 2: ingen slutdato er loebende adgang.
	if (g.aboSlutterAt === null || g.aboSlutterAt === undefined) {
		// Men kun hvis hun overhovedet har en adgang. Har hun hverken abo
		// eller forloeb, er der ingenting at lade loebe.
		return g.harApp
			? { spaerret: false, iNaade: false, dageTilbageAfNaade: 0 }
			: { spaerret: true, iNaade: false, dageTilbageAfNaade: 0 };
	}

	if (nu < g.aboSlutterAt) {
		return { spaerret: false, iNaade: false, dageTilbageAfNaade: 0 };
	}

	// Punkt 3: naadeperioden.
	const naadeSlut = g.aboSlutterAt + NAADE_DAGE * DAG;
	if (nu < naadeSlut) {
		return {
			spaerret: false,
			iNaade: true,
			dageTilbageAfNaade: Math.max(1, Math.ceil((naadeSlut - nu) / DAG))
		};
	}

	return { spaerret: true, iNaade: false, dageTilbageAfNaade: 0 };
}

/** Linjen hun ser mens hun er inde paa naade. */
export function naadeTekst(dageTilbage: number): string {
	if (dageTilbage <= 1) {
		return 'Dit abonnement er udløbet. Du har adgang dagen ud.';
	}
	return `Dit abonnement er udløbet. Du har adgang ${dageTilbage} dage endnu.`;
}
