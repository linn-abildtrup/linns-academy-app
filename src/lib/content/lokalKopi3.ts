// ============================================================
// Ren logik bag "vis den lokale kopi med det samme".
//
// HVORFOR DEN FINDES. Telefonen har i forvejen hver eneste doc liggende i
// sin egen lagring, se localCache i lib/firebase.ts. Men det almindelige
// getDocs spoerger serveren alligevel, saa skaermen staar og henter noget
// vi allerede har. Det er samme faelde som opstarten faldt i 11. august.
//
// Moenstret er:
//   1. Vis den lokale kopi med det samme, uden at roere nettet
//   2. Spoerg serveren stille bagefter
//   3. Er svaret et andet, opdater skaermen
//
// Filen her ejer KUN skridt 3, altsaa spoergsmaalet om der er forskel.
// Selve hentningen ligger i firestore/lokalKopi3.
//
// MAA ALDRIG BRUGES TIL ADGANG. En LUKKET doer aabnes aldrig paa en lokal
// kopi, for kopien kan vaere gammel og kunden kan lige have fornyet. Se
// maaAabnePaaKopi3 i adgang3. Det her er kun til INDHOLD: opskrifter,
// foedevarer, oevelser og programmer.
// ============================================================

/** Det mindste vi skal bruge for at kunne sammenligne to lister. */
export interface HarId {
	id: string;
}

/**
 * Er serverens svar et andet end det vi allerede viser.
 *
 * Vi sammenligner PAA ID og ikke paa indholdet. To grunde:
 *
 *  - Foedevare-listen er 2.268 raekker. En dyb sammenligning af dem alle
 *    ved hver eneste indlaesning koster mere end den sparer.
 *  - Det almindelige der sker er at Linn tilfoejer eller fjerner noget.
 *    Retter hun et tal inde i en raekke, opdager vi det foerst naeste gang
 *    listen hentes forfra, og det er sekunder senere i praksis.
 *
 * Raekkefoelgen betyder noget: begge lister er sorteret det samme sted,
 * saa to lister med samme id'er i forskellig raekkefoelge ville vaere en
 * fejl et andet sted og skal give sandt.
 */
export function erAendret3(vist: HarId[], fraServer: HarId[]): boolean {
	if (vist.length !== fraServer.length) return true;
	for (let i = 0; i < vist.length; i++) {
		if (vist[i].id !== fraServer[i].id) return true;
	}
	return false;
}

/**
 * Duer den lokale kopi til at vise med det samme.
 *
 * En TOM kopi duer ikke. Den betyder enten at kunden aldrig har aabnet
 * siden paa den her telefon, eller at browseren har ryddet sin lagring.
 * Begge dele er normale, og i begge tilfaelde skal vi bare hente som foer
 * i stedet for at vise en tom skaerm og paastaa at der ikke er noget.
 */
export function kopiDuer3(kopi: HarId[] | null): boolean {
	return kopi !== null && kopi.length > 0;
}
