// ============================================================
// Lektionsvisning i 3.0. Ren logik, ingen Firestore og ingen DOM.
//
// Fire slags indhold, og de aabnes hver paa sin maade:
//   video  — Vimeo eller YouTube, indlejret
//   lyd    — appens fuldskaerms-afspiller med hukommelse for hvor hun slap
//   side   — Linns uploadede HTML-lektioner, indlejret i fuld skaerm
//   link   — PDF'er og alt andet, aabnes udenfor
// ============================================================

import { detekterGuideType, erLydLektion, youtubeId, vimeoId } from './bibliotek';

export type LektionsArt = 'video' | 'lyd' | 'side' | 'link';

export function artFor(url: string): LektionsArt {
	if (!url) return 'link';
	if (erLydLektion(url)) return 'lyd';
	const t = detekterGuideType(url);
	if (t === 'video') return 'video';
	if (t === 'audio') return 'lyd';
	if (t === 'html') return 'side';
	return 'link';
}

/**
 * Adressen der kan indlejres. Vimeo og YouTube kraever hver sin form,
 * og en almindelig side kan vises som den er.
 */
export function indlejretUrl(url: string): string | null {
	const yt = youtubeId(url);
	if (yt) return `https://www.youtube.com/embed/${yt}?rel=0&modestbranding=1`;
	const vm = vimeoId(url);
	if (vm) return `https://player.vimeo.com/video/${vm}?title=0&byline=0&portrait=0`;
	if (artFor(url) === 'side') return url;
	return null;
}

/**
 * Hvornaar en lektion regnes for taget af sig selv.
 *
 * Vi kan ikke se ind i Vimeos og YouTubes afspillere uden at hente deres
 * egen kode ind, saa vi maaler i stedet hvor laenge hun har haft
 * lektionen aaben. Har hun vaeret der i 80 procent af den tid Linn har
 * skrevet paa den, regner vi den for taget.
 *
 * Det er et skoen, ikke en maaling. Derfor er der ogsaa altid en knap.
 */
export const ANDEL_FOER_KLARET = 0.8;

/**
 * Hvor laenge en LAESE-lektion uden angivet tid skal vaere aaben.
 *
 * LINNS BESLUTNING 25. august. Baggrunden er maalt: af de 43
 * guide-lektioner paa Kropsro har kun 6 en varighed sat. De 37 andre
 * kunne derfor ALDRIG markere sig selv, hvor video og lyd goer det.
 * Konsekvensen var at dagen aldrig foldede sig sammen for hende, fordi
 * ét punkt blev staaende umarkeret.
 *
 * Tyve sekunder er kort nok til at hun ikke naar at undre sig, og langt
 * nok til at et fejltryk ikke taeller som laest.
 */
export const SEKUNDER_LAESNING = 20;

/**
 * Sekunder hun skal have lektionen aaben, foer den taeller som taget.
 *
 * Er der sat en varighed, bruges 80 procent af den, uanset slags.
 * Er der ikke, faar en LAESNING den faste graense ovenfor. Video og lyd
 * faar stadig ingenting: dér ved vi ikke hvor lang filmen er, og et
 * gaet ville markere den mens hun stadig ser.
 */
export function sekunderFoerKlaret(
	varighedMin: number | undefined,
	art?: LektionsArt
): number | null {
	if (varighedMin && varighedMin > 0) return Math.round(varighedMin * 60 * ANDEL_FOER_KLARET);
	// 'link' markeres ved at hun trykker Åbn, ikke af et ur. Se siden.
	if (art === 'side') return SEKUNDER_LAESNING;
	return null;
}

/** Til teksten under afspilleren, saa hun ved hvad der sker. */
export function formaterVarighed(varighedMin: number | undefined): string {
	if (!varighedMin || varighedMin <= 0) return '';
	return `${varighedMin} min`;
}

/**
 * Ordet paa knappen der markerer lektionen som klaret.
 *
 * ORDET FOELGER INDHOLDET. Linn 5. september: der stod "Markér som set"
 * paa en lektion man LYTTER til. Man ser ikke en lydfil.
 *
 * Video ses, lyd hoeres, og en skreven lektion laeses. Tre ord i stedet
 * for ét, og det koster ingenting: kunden laeser knappen hver gang, og
 * et forkert ord faar appen til at virke skoedeslaas.
 *
 * `link` er en lektion der aabner i et nyt vindue. Den markeres naar hun
 * trykker Åbn, se lektions-siden, og der er "set" det aerlige ord: vi
 * ved kun at hun aabnede den.
 */
export function klaretOrd3(art: LektionsArt): { knap: string; klaret: string } {
	if (art === 'lyd') return { knap: 'Markér som hørt', klaret: 'Hørt' };
	if (art === 'side') return { knap: 'Markér som læst', klaret: 'Læst' };
	return { knap: 'Markér som set', klaret: 'Set' };
}
