// ============================================================
// Hvilke af forloebets regler gaelder for DEN HER kunde.
//
// HVORFOR. Et forloeb kan begraense kunden: Kickstart lader hende kun logge
// morgenmad de foerste uger, og traeningen begynder foerst dag 3. Det er
// rigtigt for en der har koebt holdet. Det er forkert for en der har et
// almindeligt app-abonnement og bare er havnet paa holdet.
//
// BAGGRUND. Ved importen 30. august 2026 blev hele koebs-historikken for
// Kickstart lagt paa august-holdet, ogsaa 173 kunder der har et loebende
// abonnement. De kunne pludselig kun taste morgenmad ind. En af dem skrev
// til Linn samme dag.
//
// SKILLELINJEN ER SIKKER. Af de 236 der faktisk har koebt august-holdet har
// NUL et abonnement. Maalt 30. august 2026. Saa "har et loebende abonnement"
// rammer ingen rigtig deltager.
//
// Reglerne gaelder altsaa forloebs-kunden, ikke app-kunden. Linns besked
// 30. august 2026.
// ============================================================

import type { UserDoc } from '$lib/types';

/**
 * Har kunden et loebende app-abonnement.
 *
 * Vi ser paa abo-felterne selv, ikke paa accessSource. Importen skrev
 * accessSource om til "forloeb" for de her kunder, saa den kan ikke bruges
 * til at kende dem. Abo-felterne blev ikke roert.
 *
 * En kunde der har sagt op beholder adgangen perioden ud. Derfor taeller vi
 * hende med indtil aboSlutterAt er passeret, praecis som resten af appen.
 * Mangler datoen (comp-konti og manuelt oprettede) er adgangen loebende.
 */
export function harLoebendeAbonnement(userDoc: UserDoc | null | undefined): boolean {
	if (!userDoc) return false;
	if (userDoc.aboProdukt === undefined && userDoc.aboKoebtAt === undefined) return false;
	const slutter = userDoc.aboSlutterAt;
	if (slutter == null) return true;
	return slutter > Date.now();
}

/** De felter paa et forloeb der begraenser kunden. */
export interface ForlobsBegraensninger {
	maaltidsFokus?: unknown[];
	traeningStartDag?: number;
}

/**
 * Forloebet som det gaelder for den her kunde.
 *
 * For en app-kunde fjerner vi begraensningerne og lader resten staa. Hun ser
 * altsaa stadig forloebets indhold, men maden og traeningen opfoerer sig som
 * i hendes almindelige app.
 *
 * Alt andet end de to felter er uroert, saa der ikke sker noget uventet et
 * tredje sted.
 */
export function forlobReglerFor<T extends ForlobsBegraensninger>(
	forlob: T | null | undefined,
	userDoc: UserDoc | null | undefined
): T | null {
	if (!forlob) return null;
	if (!harLoebendeAbonnement(userDoc)) return forlob;
	return { ...forlob, maaltidsFokus: undefined, traeningStartDag: undefined };
}
