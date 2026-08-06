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

/** Sekunder hun skal have lektionen aaben, foer den taeller som taget. */
export function sekunderFoerKlaret(varighedMin: number | undefined): number | null {
	if (!varighedMin || varighedMin <= 0) return null;
	return Math.round(varighedMin * 60 * ANDEL_FOER_KLARET);
}

/** Til teksten under afspilleren, saa hun ved hvad der sker. */
export function formaterVarighed(varighedMin: number | undefined): string {
	if (!varighedMin || varighedMin <= 0) return '';
	return `${varighedMin} min`;
}
