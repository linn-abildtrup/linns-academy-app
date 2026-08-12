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
 * Soegningen delt op i ord.
 *
 * Der deles ved MELLEMRUM saavel som komma. Foer 12. august blev hele
 * strengen slaaet op paa én gang, saa "skyr vanilje" gav NUL traeffere.
 * Praecis samme fejl som i opskrift-soegningen, hvor otte almindelige
 * to-ords-soegninger alle gav nul. Se SPEC-3.0.md 9.5.
 *
 * Den gamle app kraever komma for det samme. Her virker begge dele.
 */
export function soegetermer(soegeord: string): string[] {
	return (soegeord ?? '')
		.toLowerCase()
		.split(ORD_SKEL)
		.map((t) => t.trim())
		.filter((t) => t.length > 0);
}

/** Hvor mange af soegeordene der staar som HELE ord i navnet. */
export function antalHeleOrd(navn: string, termer: string[]): number {
	return termer.filter((t) => erHeltOrd(navn, t)).length;
}

/**
 * Soeger og sorterer.
 *
 * ALLE ord skal findes, men de maa staa i hvert sit hjoerne af navnet og
 * i vilkaarlig raekkefoelge: "vanilje skyr" finder ogsaa Skyr med
 * vanilje. Et enkelt ord giver praecis samme traeffere som foer, saa
 * ingenting forsvandt da flere ord blev muligt.
 *
 * Raekkefoelgen: flest hele ord foerst, saa korteste navn.
 */
export function soegFodevarer(
	foods: Fodevare[],
	soegeord: string,
	maks: number = MAKS_TRAEF
): Fodevare[] {
	const termer = soegetermer(soegeord);
	if (termer.length === 0) return [];

	const traef = foods.filter((f) => {
		const navn = f.name.toLowerCase();
		return termer.every((t) => navn.includes(t));
	});

	return traef
		.sort((a, b) => {
			const ha = antalHeleOrd(a.name, termer);
			const hb = antalHeleOrd(b.name, termer);
			// Flest hele ord foerst, saa "aeg" ikke drukner i Aeggenudler.
			if (ha !== hb) return hb - ha;
			// Kortest navn foerst inden for hver gruppe: "Skyr" foer
			// "Skyr med vanilje". Det er den enkle vare hun oftest vil have.
			if (a.name.length !== b.name.length) return a.name.length - b.name.length;
			return a.name.localeCompare(b.name, 'da');
		})
		.slice(0, maks);
}
