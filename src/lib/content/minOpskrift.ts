// Private (personlige) opskrifter — typer og pure-funktioner.
//
// Premium-feature: klienter tager/uploader et billede af en opskrift, AI
// (Claude vision) analyserer indhold og estimerer makro pr portion. Opskriften
// gemmes privat under users/{uid}/privateOpskrifter — kun synlig for ejeren.

import type { Timestamp } from 'firebase/firestore';

export interface MinOpskriftIngrediens {
	navn: string;
	maengde: number;
	enhed: string;
}

export interface MinOpskriftMakro {
	protein: number;
	fiber: number;
	kh: number;
	fedt: number;
	kcal: number;
}

export interface MinOpskrift {
	id: string;
	navn: string;
	beskrivelse?: string;
	billedeUrl?: string;
	antalPortioner: number;
	ingredienser: MinOpskriftIngrediens[];
	makroPrPortion: MinOpskriftMakro;
	oprettet: Timestamp;
	opdateret?: Timestamp;
}

/**
 * Skalerer makro fra én portion til antal portioner. Bruges når brugeren
 * tilføjer opskriften til Byg-måltid og vil spise flere portioner.
 */
export function skalerMakro(
	makroPrPortion: MinOpskriftMakro,
	antalPortioner: number
): MinOpskriftMakro {
	return {
		protein: Math.round(makroPrPortion.protein * antalPortioner * 10) / 10,
		fiber: Math.round(makroPrPortion.fiber * antalPortioner * 10) / 10,
		kh: Math.round(makroPrPortion.kh * antalPortioner * 10) / 10,
		fedt: Math.round(makroPrPortion.fedt * antalPortioner * 10) / 10,
		kcal: Math.round(makroPrPortion.kcal * antalPortioner)
	};
}

/**
 * Omberegner makro pr portion naar kunden aendrer antal portioner paa en
 * gemt opskrift. Total-makroen bevares (opskriftens indhold er det samme),
 * saa per-portion-vaerdierne skaleres med faktor = original/nyt.
 *
 * Eksempel: opskrift med 4 portioner a 2,5g protein (total 10g). Kunden
 * aendrer til 2 portioner -> 5g protein pr portion (total stadig 10g).
 *
 * Returnerer original-makroen uaendret hvis nytAntalPortioner er ugyldigt
 * (<=0 eller ikke-finit), saa kaldere skal selv validere input.
 */
export function omberegnMakroForNytAntalPortioner(
	originalMakroPrPortion: MinOpskriftMakro,
	originalAntalPortioner: number,
	nytAntalPortioner: number
): MinOpskriftMakro {
	if (!Number.isFinite(nytAntalPortioner) || nytAntalPortioner <= 0) {
		return { ...originalMakroPrPortion };
	}
	if (!Number.isFinite(originalAntalPortioner) || originalAntalPortioner <= 0) {
		return { ...originalMakroPrPortion };
	}
	const faktor = originalAntalPortioner / nytAntalPortioner;
	return {
		protein: Math.round(originalMakroPrPortion.protein * faktor * 10) / 10,
		fiber: Math.round(originalMakroPrPortion.fiber * faktor * 10) / 10,
		kh: Math.round(originalMakroPrPortion.kh * faktor * 10) / 10,
		fedt: Math.round(originalMakroPrPortion.fedt * faktor * 10) / 10,
		kcal: Math.round(originalMakroPrPortion.kcal * faktor)
	};
}

/**
 * Validerer at en AI-analyse-respons har de nødvendige felter.
 * Bruges som første sanity-check før vi viser den til brugeren.
 */
export function erGyldigAnalyse(data: unknown): data is {
	navn: string;
	antalPortioner: number;
	ingredienser: MinOpskriftIngrediens[];
	makroPrPortion: MinOpskriftMakro;
} {
	if (!data || typeof data !== 'object') return false;
	const d = data as Record<string, unknown>;
	if (typeof d.navn !== 'string') return false;
	if (typeof d.antalPortioner !== 'number' || d.antalPortioner < 1) return false;
	if (!Array.isArray(d.ingredienser)) return false;
	const m = d.makroPrPortion as Record<string, unknown> | undefined;
	if (!m || typeof m !== 'object') return false;
	for (const k of ['protein', 'fiber', 'kh', 'fedt', 'kcal']) {
		if (typeof m[k] !== 'number') return false;
	}
	return true;
}

export const DEFAULT_MAKRO: MinOpskriftMakro = {
	protein: 0,
	fiber: 0,
	kh: 0,
	fedt: 0,
	kcal: 0
};
