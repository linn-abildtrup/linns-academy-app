// Navne-opslag paa favoritmaaltider.
//
// Baggrund: naar kunden gemmer et maaltid foreslaar appen maaltidstypen som
// navn, altsa "Morgenmad", "Frokost" og sa videre. Saetter hun samtidig
// flueben i "Gem ogsa som favorit" hver dag, ender hun med en stak favoritter
// der alle hedder det samme og som hun ikke kan kende fra hinanden. En kunde
// pa Kickstart August havde fire favoritter ved navn "Morgenmad", hvoraf tre
// var den samme ret. Set 4. september 2026.
//
// Reglerne her afgoer om et navn er optaget i forvejen. Selve dialogen ligger
// i FavoritNavnAdvarsel.svelte, og den bruger kun disse funktioner.

import type { FavoritMaaltid } from '$lib/content/kost';

/**
 * Normaliserer et favorit-navn til sammenligning. Mellemrum i enderne og
 * dobbelte mellemrum inde i navnet tages ikke med, og store og sma bogstaver
 * regnes som det samme. "  Morgenmad " og "morgenmad" er altsa ét navn.
 *
 * toLocaleLowerCase med 'da-DK' saa AE, OE og AA behandles som dansk.
 */
export function normaliserFavoritNavn(navn: string): string {
	return navn.trim().replace(/\s+/g, ' ').toLocaleLowerCase('da-DK');
}

/**
 * Finder den favorit der allerede baerer navnet, eller null. Er der flere med
 * samme navn, hvilket kunder der har brugt appen foer denne regel kan have,
 * returneres den foerste i listen. Listen er sorteret alfabetisk af
 * hentFavoritter, sa valget er stabilt mellem to kald.
 *
 * @param undtagenId Favorit der skal springes over i opslaget. Bruges naar
 *                   kunden omdoeber en favorit og ikke skal advares mod
 *                   dens eget navn.
 */
export function findFavoritMedNavn(
	favoritter: FavoritMaaltid[],
	navn: string,
	undtagenId?: string
): FavoritMaaltid | null {
	const soegt = normaliserFavoritNavn(navn);
	if (!soegt) return null;
	return (
		favoritter.find((f) => f.id !== undtagenId && normaliserFavoritNavn(f.navn) === soegt) ?? null
	);
}

/**
 * True hvis navnet allerede er i brug. Tynd hjaelper oven pa
 * findFavoritMedNavn, sa kaldere der kun skal bruge ja eller nej slipper for
 * at sammenligne mod null.
 */
export function favoritNavnErOptaget(
	favoritter: FavoritMaaltid[],
	navn: string,
	undtagenId?: string
): boolean {
	return findFavoritMedNavn(favoritter, navn, undtagenId) !== null;
}
