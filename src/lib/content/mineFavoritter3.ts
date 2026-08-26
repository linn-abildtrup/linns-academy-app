// ============================================================
// MINE FAVORITTER. Se mockups-hjerte-og-scannede.html.
//
// Kunden moedte foer TRE begreber for at bruge én skaerm: hendes egne
// madvarer, de scannede varer og hjertet. To af dem er appens
// bogholderi, ikke hendes tanke. Om en vare bor i den faelles samling
// eller i hendes egen skuffe er noget koden skal vide for at styre hvem
// der ser hvad. Hun staar med varen i haanden.
//
// LINNS BESLUTNING 26. august 2026: de tre samles til ét begreb, og det
// hedder MINE FAVORITTER. Tre doere ind, og hun skal ikke vide hvor
// varen bor bagefter:
//
//   1. hun trykker paa hjertet paa en vare der findes i forvejen
//   2. hun scanner en pakke
//   3. hun laver en vare selv
//
// Ordene hjerte og favorit er samtidig ét begreb. Opskrifterne brugte i
// forvejen ordet favorit, se favoritOpskrift3, saa de to er nu enige.
// OPSKRIFTER OG MADVARER ER TO LISTER MED SAMME ORD, ikke én liste.
// Linns beslutning samme dag: en opskrift bliver til et helt maaltid,
// en madvare er én linje i et maaltid, og de to aabner hver sit ark.
//
// ============================================================
// DEN REGEL DER IKKE MAA BRYDES
// ============================================================
// Listen her REGNES UD. Den skrives ALDRIG.
//
// Navnet Mine favoritter er en lille overdrivelse for to af de tre
// grupper: en vare hun selv har lavet og en hun har scannet er ikke
// noedvendigvis favoritter. Hun lavede Mors rugbroed fordi den ikke
// fandtes, ikke fordi hun elsker den.
//
// DEN NAERLIGGENDE OG FORKERTE MAADE at goere navnet sandt paa er at
// saette hjertet automatisk paa det hun laver og scanner. GOER DET
// ALDRIG. Det er praecis den gamle apps fejl, og det er derfor 74 % af
// de 7.158 hjerter i drift er noget kunden aldrig har valgt, maalt 26.
// august 2026. Gentager vi den, er hjertet ubrugeligt for altid, for
// saa kan ingen laengere maale hvad hun rent faktisk har valgt.
//
// Hjertet saettes kun naar hun trykker paa det, se hjerteFodevare3.
// Hendes egne og hendes scanninger kommer med i listen HER, ved
// udregning, uden at der roeres et felt. Der er test paa begge dele.
// ============================================================

import type { Fodevare } from './kost';
import { hjerterTilSoegning } from './fodevareSoeg3';
import { kildeAf, type Kilde3, type Vare3 } from './fodevareKilde3';

/** Hvorfor en vare staar paa listen. Styrer hvad krydset goer. */
export type Grund = 'hjerte' | 'egen' | 'scanning';

/** Hvad krydset paa raekken goer. Se handlingFor(). */
export type Handling = 'fjern' | 'slet' | 'ingen';

export interface FavoritRaekke {
	vare: Vare3;
	grund: Grund;
	kilde: Kilde3;
	/** Hvad krydset paa raekken goer. Se handlingFor(). */
	handling: Handling;
}

/**
 * Hvad krydset paa en raekke goer. TRE svar, ikke to.
 *
 *   fjern  et hjerte. Varen bliver ved med at findes for alle, og hun
 *          kan soege den frem igen
 *   slet   hendes egen vare. Den findes ikke andre steder, saa at
 *          fjerne den ER at slette den, og det skal staa paa skaermen
 *   ingen  en vare hun selv har scannet. Den er DELT med andre kunder,
 *          se firestore.rules og HANDOVER 9.51, saa den maa hverken
 *          slettes for alle eller forsvinde ud af den faelles liste.
 *          At skjule den for hende alene ville kraeve et nyt felt paa
 *          kunden, og det er ikke bygget. Raekken har derfor intet
 *          kryds. Maalt 26. august 2026: der findes 4 scannede varer i
 *          drift, saa det rammer nogle faa
 */
export function handlingFor(grund: Grund): Handling {
	if (grund === 'hjerte') return 'fjern';
	if (grund === 'egen') return 'slet';
	return 'ingen';
}

/**
 * Én liste, sorteret paa navn.
 *
 * Raekkefoelgen er alfabetisk og IKKE grupperet. Grupper ville give
 * hende de tre begreber tilbage gennem bagdoeren, og det er hele
 * pointen at de forsvinder. Kilde-maerkatet paa raekken siger hvor
 * tallet kommer fra, og det er den eneste forskel hun skal moede.
 *
 * HENDES EGNE HOLDES UDE AF HJERTE-GRUPPEN, samme regel som
 * hjertedeFodevarer og hjerterTilSoegning allerede foelger. Uden det
 * ville en vare hun selv har lavet staa to gange, én gang som hjerte
 * fordi den gamle app satte det automatisk, og én gang som sin egen.
 * De tre skal blive ved med at vaere enige.
 *
 * En vare der ikke findes laengere springes over. Den kan hverken vises
 * eller bruges, og en tom raekke ligner en fejl.
 */
export function mineFavoritter(args: {
	/** Raa hjerte-liste fra kundens dokument, se hjerterFra. */
	hjerter: string[];
	/** Hendes egne foedevarer, hele objekter. */
	egne: Fodevare[];
	/** Id'erne paa de delte varer hun selv har scannet, se mineScanninger. */
	scannedeAfHende?: string[];
	/** Alt vi kender, til opslag. Faelles liste plus de scannede. */
	foods: Map<string, Fodevare>;
}): FavoritRaekke[] {
	const egneIds = new Set(args.egne.map((f) => f.id));
	const ud: FavoritRaekke[] = [];
	const set = new Set<string>();

	const laeg = (vare: Fodevare | undefined, grund: Grund) => {
		if (!vare || set.has(vare.id)) return;
		set.add(vare.id);
		ud.push({ vare, grund, kilde: kildeAf(vare as Vare3), handling: handlingFor(grund) });
	};

	// Hendes egne foerst, saa de vinder over et gammelt automatisk hjerte
	// paa den samme vare. Raekkefoelgen i listen bestemmes af sorteringen
	// nedenfor, saa det her handler kun om hvilken GRUND raekken faar.
	for (const f of args.egne) laeg(f, 'egen');
	for (const id of args.scannedeAfHende ?? []) laeg(args.foods.get(id), 'scanning');
	for (const id of hjerterTilSoegning(args.hjerter, egneIds)) laeg(args.foods.get(id), 'hjerte');

	return ud.sort((a, b) => a.vare.name.localeCompare(b.vare.name, 'da'));
}

/** Hvor mange fliser hylden i tilfoej-arket viser, foer "Se alle". */
export const FLISER_PAA_HYLDEN = 4;

/**
 * De foerste faa til hylden i tilfoej-arket.
 *
 * Fire, saa hylden ikke skubber "Hent fra" ned under folden. Maalt 26.
 * august: medianen er 13 favoritter pr kunde og den stoerste har 150,
 * saa "Se alle" er ikke en sjaelden vej.
 */
export function tilHylden(raekker: FavoritRaekke[], antal = FLISER_PAA_HYLDEN): FavoritRaekke[] {
	return raekker.slice(0, antal);
}

/**
 * Ordet paa krydset. To ord, og det er den ene undtagelse vi ikke kan
 * tegne os ud af: en vare hun selv har lavet findes ikke andre steder,
 * saa at fjerne den ER at slette den. Siger vi Fjern begge steder, tror
 * hun den kan findes frem igen.
 */
export function fjernOrd(r: FavoritRaekke): 'Fjern' | 'Slet' {
	return r.handling === 'slet' ? 'Slet' : 'Fjern';
}

/** Spoergsmaalet paa bekraeftelsen. */
export function fjernTitel(r: FavoritRaekke): string {
	return r.handling === 'slet'
		? `Slet ${r.vare.name}?`
		: `Fjern ${r.vare.name} fra dine favoritter?`;
}

/**
 * Linjen under spoergsmaalet.
 *
 * Begge udgaver siger at det hun allerede har registreret bliver
 * staaende. Det er det hun er bange for, og det er sandt: makroen
 * fryses ind i maaltidet naar hun gemmer.
 */
export function fjernForklaring(r: FavoritRaekke): string {
	return r.handling === 'slet'
		? 'Du har selv lavet den, så den forsvinder helt. Det du allerede har registreret bliver stående.'
		: 'Den bliver ved med at findes når du søger. Det du allerede har registreret bliver stående.';
}

/**
 * Teksten paa favorit-linjen i maengde-arket.
 *
 * Hjertet er i dag et ikon uden ord, og hun kan ikke vide hvad der sker
 * naar hun trykker. Her staar der hvad det goer, og bagefter er det
 * bare et hjerte hun genkender.
 *
 * `erFavorit` er sand naar varen ligger paa listen, uanset hvorfor.
 */
export function favoritLinje(args: {
	erFavorit: boolean;
	/** Sand naar varen er hendes egen eller hendes egen scanning. */
	altidPaaListen: boolean;
}): { tekst: string; kanTrykkes: boolean } {
	if (args.altidPaaListen) return { tekst: 'Ligger i dine favoritter', kanTrykkes: false };
	return args.erFavorit
		? { tekst: 'Gemt i dine favoritter', kanTrykkes: true }
		: { tekst: 'Gem i dine favoritter', kanTrykkes: true };
}
