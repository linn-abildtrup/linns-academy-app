// ============================================================
// Soegning i foedevarer i 30-30. Se SPEC-3.0.md afsnit 26.16.
//
// PROBLEMET: korte ord drukner i stoej. Soeger hun "aeg", finder en bred
// soegning ogsaa Aeggenudler og paalaeg, og det er vaerst paa netop de
// ord folk soeger mest efter.
//
// Den gamle app loeser det med et afkryds der hedder "Kun hele ord".
// 3.0 loeser det med RAEKKEFOELGEN i stedet. Linns valg 12. august, og
// begrundelsen er vaerd at kende:
//
//   1. maalgruppen skal ikke kende en indstilling for at faa et godt
//      resultat. Et afkryds hun ikke forstaar, proever hun aldrig
//   2. sortering skjuler ingenting. Afkrydset er enten eller, saa
//      slaar hun det til, forsvinder Aeggenudler ogsaa naar det var den
//      hun ledte efter
//   3. det koster ingen plads paa skaermen
//
// Inden for hver gruppe staar det korteste navn foerst, saa "Skyr"
// kommer foer "Skyr med vanilje". Det er den enkle vare hun oftest er
// ude efter.
// ============================================================

import type { Fodevare } from './kost';

/** Hvor et ord slutter i et foedevare-navn. Samme som den gamle app. */
const ORD_SKEL = /[\s,;\-/&()]+/;

/** Antallet af traeffere skaermen viser. */
export const MAKS_TRAEF = 8;

/**
 * Er soegeordet et HELT ord i navnet.
 *
 * "aeg" er et helt ord i "Paalaeg med aeg", men ikke i "Aeggenudler".
 */
export function erHeltOrd(navn: string, ord: string): boolean {
	if (!ord) return false;
	return navn.toLowerCase().split(ORD_SKEL).includes(ord);
}

/**
 * Hvor godt en foedevare passer. Lavest er bedst.
 *   0 = soegeordet er et helt ord i navnet
 *   1 = det staar bare inde i navnet
 */
export function rang(navn: string, ord: string): number {
	return erHeltOrd(navn, ord) ? 0 : 1;
}

/**
 * Soeger og sorterer.
 *
 * Matchningen er uaendret: navnet skal indeholde soegeordet. Det er kun
 * RAEKKEFOELGEN der er ny, saa ingen foedevare forsvinder af at vi
 * sorterer bedre.
 */
export function soegFodevarer(
	foods: Fodevare[],
	soegeord: string,
	maks: number = MAKS_TRAEF
): Fodevare[] {
	const q = soegeord.trim().toLowerCase();
	if (!q) return [];

	const traef = foods.filter((f) => f.name.toLowerCase().includes(q));

	return traef
		.sort((a, b) => {
			const ra = rang(a.name, q);
			const rb = rang(b.name, q);
			if (ra !== rb) return ra - rb;
			// Kortest navn foerst inden for hver gruppe: "Skyr" foer
			// "Skyr med vanilje". Det er den enkle vare hun oftest vil have.
			if (a.name.length !== b.name.length) return a.name.length - b.name.length;
			return a.name.localeCompare(b.name, 'da');
		})
		.slice(0, maks);
}
