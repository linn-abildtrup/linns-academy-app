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

// ============================================================
// DE TRE TILSTANDE. Linns praecisering 18. august, se SPEC 35.
//
// Reglerne ovenfor svarer kun ja eller nej: er hun spaerret. Det er én
// tilstand for lidt, og det har kostet kunden tre maaneder.
//
//   fuld    abonnement eller forloeb i gang. Hele appen
//   bonus   de 90 dage efter et forloeb. Kun hendes side og materialet
//   lukket  de 90 dage er gaaet. Ingen adgang
//
// Foer det her kendte porten kun abonnement og aktivt forloeb. I det
// oejeblik forloebet sluttede, og hun ikke havde koebt app-adgang, moedte
// hun "Din adgang er udloebet" med det samme. Hun saa hverken opskrifter,
// lektioner eller oevelser i de 90 dage hun har krav paa dem. Den gamle
// app goer det rigtigt. Det var kun 3.0 der manglede det.
//
// BEMAERK at bonus IKKE handler om data. Intet slettes fordi adgangen
// loeber ud, se SPEC 35.3. Feltet styrer hvad hun maa SE.
// ============================================================

export type Tilstand = 'fuld' | 'bonus' | 'lukket';

export interface TilstandGrundlag extends SpaerringGrundlag {
	/** Hvornaar de 90 dage slutter. Null naar hun aldrig har haft et forloeb. */
	bonusSlutMs: number | null;
}

/**
 * Hvilken af de tre tilstande kunden er i.
 *
 * Bygget oven paa vurderSpaerring og ikke ved siden af, saa naaden, de
 * loebende konti og reglen om at et forloeb altid vinder kun findes ét
 * sted. Er hun ikke spaerret, er hun paa fuld app, punktum.
 */
export function vurderTilstand(g: TilstandGrundlag, nu: number): Tilstand {
	if (!vurderSpaerring(g, nu).spaerret) return 'fuld';
	if (g.bonusSlutMs !== null && nu < g.bonusSlutMs) return 'bonus';
	return 'lukket';
}

/**
 * De steder hun maa vaere i de 90 dage. Alt andet sender tilbage til
 * hendes side.
 *
 * Det er en hvidliste og ikke en sortliste, med vilje. En ny side der
 * bliver bygget i morgen er lukket indtil nogen aktivt aabner den, og
 * ikke aaben indtil nogen opdager det.
 */
export const BONUS_STIER = [
	'/ny/profil',
	'/ny/lektioner',
	'/ny/lektion',
	'/ny/udvikling',
	'/ny/traening',
	'/ny/hjaelp'
];

/** Hvor hun lander naar hun proever et sted hun ikke maa vaere. */
export const BONUS_START = '/ny/profil';

/** Maa hun se den her side i de 90 dage. */
export function maaSeIBonus(sti: string): boolean {
	return BONUS_STIER.some((p) => sti === p || sti.startsWith(p + '/'));
}

/**
 * Baandet oeverst i de 90 dage.
 *
 * Den siger hvad hun HAR og ikke hvad hun har mistet. Hun har lige
 * gennemfoert et forloeb, og det foerste hun moeder maa ikke vaere en
 * regning.
 */
export function bonusBaandTekst(bonusSlutMs: number, nu: number): string {
	const dage = Math.ceil((bonusSlutMs - nu) / DAG);
	if (dage <= 1) return 'Dit forløb er slut. Du har alt materialet dagen ud.';
	return `Dit forløb er slut. Du har alt materialet ${dage} dage endnu.`;
}
