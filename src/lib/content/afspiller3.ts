// Afspilleren i 3.0. Bid 4, 15. august 2026.
//
// ÉN afspiller. Den gamle app har fire naesten ens paa cirka 1.400
// linjer hver, én for abo, én for forloeb, én for master og én for
// byg-eget. Her er der ét program og én afspiller.
//
// Selve tilstands-maskinen ligger her som ren logik, uden timere,
// uden lyd og uden video. Saa kan den testes, og saa kan siden noejes
// med at taelle ned og tegne. Faserne foelger den gamle afspiller
// noejagtigt, saa traeningen foeles ens for de kunder der flyttes over:
//
//   klar   →  arbejd
//   arbejd →  hvil        naar der er flere saet tilbage
//          →  skift       naar saettene er brugt og der er en oevelse mere
//          →  faerdig     naar det var det sidste saet paa den sidste oevelse
//   hvil   →  arbejd      med ét saet mere
//   skift  →  arbejd      paa den naeste oevelse, foerste saet

import type { DayExercise } from './mikrotraening';

export type Fase3 = 'klar' | 'arbejd' | 'hvil' | 'skift' | 'faerdig';

/** Sekunder til at komme paa plads, foer den foerste oevelse. */
export const KLAR_SEK = 10;
/** Sekunder mellem to oevelser. */
export const SKIFT_SEK = 15;

export interface Stilling3 {
	/** Hvilken oevelse i traeningen, 0-baseret. */
	oevelse: number;
	/** Hvilket saet, 1-baseret. */
	saet: number;
	fase: Fase3;
	/** Sekunder tilbage af den fase vi er i. */
	tilbage: number;
}

export function startStilling3(): Stilling3 {
	return { oevelse: 0, saet: 1, fase: 'klar', tilbage: KLAR_SEK };
}

/** Hvor lang en fase er, for den oevelse vi staar paa. */
export function faseLaengde3(fase: Fase3, oevelse: DayExercise | undefined): number {
	if (fase === 'klar') return KLAR_SEK;
	if (fase === 'skift') return SKIFT_SEK;
	if (fase === 'arbejd') return oevelse?.workSec ?? 30;
	if (fase === 'hvil') return oevelse?.restSec ?? 10;
	return 0;
}

/**
 * Naeste fase, naar nedtaellingen er naaet nul.
 *
 * Rammer den faerdig, er traeningen slut. Kaldstedet skal saa gemme
 * fremgangen og lade vaere med at taelle videre.
 */
export function naesteFase3(stilling: Stilling3, oevelser: DayExercise[]): Stilling3 {
	const denne = oevelser[stilling.oevelse];
	if (!denne) return { ...stilling, fase: 'faerdig', tilbage: 0 };

	if (stilling.fase === 'klar') {
		return { ...stilling, fase: 'arbejd', tilbage: faseLaengde3('arbejd', denne) };
	}

	if (stilling.fase === 'hvil') {
		const naeste = { ...stilling, saet: stilling.saet + 1, fase: 'arbejd' as const };
		return { ...naeste, tilbage: faseLaengde3('arbejd', denne) };
	}

	if (stilling.fase === 'skift') {
		const ny = oevelser[stilling.oevelse + 1];
		if (!ny) return { ...stilling, fase: 'faerdig', tilbage: 0 };
		return {
			oevelse: stilling.oevelse + 1,
			saet: 1,
			fase: 'arbejd',
			tilbage: faseLaengde3('arbejd', ny)
		};
	}

	// arbejd
	const sidsteSaet = stilling.saet >= denne.sets;
	const sidsteOevelse = stilling.oevelse >= oevelser.length - 1;
	if (sidsteSaet && sidsteOevelse) return { ...stilling, fase: 'faerdig', tilbage: 0 };
	if (sidsteSaet) return { ...stilling, fase: 'skift', tilbage: SKIFT_SEK };
	return { ...stilling, fase: 'hvil', tilbage: faseLaengde3('hvil', denne) };
}

/**
 * Ét sekund. Er der mere tilbage, taeller vi ned. Er der ikke, skifter
 * vi fase. Siden kalder den én gang i sekundet og skal ikke selv vide
 * hvornaar der skiftes.
 */
export function tik3(stilling: Stilling3, oevelser: DayExercise[]): Stilling3 {
	if (stilling.fase === 'faerdig') return stilling;
	if (stilling.tilbage > 1) return { ...stilling, tilbage: stilling.tilbage - 1 };
	return naesteFase3(stilling, oevelser);
}

export function faseTekst3(fase: Fase3): string {
	if (fase === 'klar') return 'Gør dig klar';
	if (fase === 'arbejd') return 'Arbejd';
	if (fase === 'hvil') return 'Hvil';
	if (fase === 'skift') return 'Næste øvelse';
	return 'Færdig';
}

/**
 * Hvilken oevelse der skal vises paa skaermen.
 *
 * Under skift viser vi den NAESTE, for det er den hun skal stille sig
 * klar til. Under alt andet viser vi den hun er i gang med.
 */
export function visesOevelse3(stilling: Stilling3, oevelser: DayExercise[]): DayExercise | null {
	if (stilling.fase === 'skift') return oevelser[stilling.oevelse + 1] ?? null;
	return oevelser[stilling.oevelse] ?? null;
}

/** Samlet tid for hele traeningen i sekunder, uden klar og skift. */
export function samletSekunder3(oevelser: DayExercise[]): number {
	return oevelser.reduce(
		(sum, o) => sum + o.sets * o.workSec + Math.max(0, o.sets - 1) * o.restSec,
		0
	);
}

/**
 * Hvor langt hun er i traeningen, 0 til 100. Bruges til baandet i toppen.
 * Klar og skift taeller ikke med, saa baandet ikke hopper mellem oevelser.
 */
export function procentAfTraening3(stilling: Stilling3, oevelser: DayExercise[]): number {
	const ialt = samletSekunder3(oevelser);
	if (ialt <= 0) return 0;
	if (stilling.fase === 'faerdig') return 100;

	let brugt = 0;
	for (let i = 0; i < stilling.oevelse; i++) {
		const o = oevelser[i];
		brugt += o.sets * o.workSec + Math.max(0, o.sets - 1) * o.restSec;
	}
	const denne = oevelser[stilling.oevelse];
	if (denne) {
		const faerdigeSaet = Math.max(0, stilling.saet - 1);
		brugt += faerdigeSaet * denne.workSec + faerdigeSaet * denne.restSec;
		if (stilling.fase === 'arbejd') brugt += denne.workSec - stilling.tilbage;
		if (stilling.fase === 'hvil') brugt += denne.workSec + (denne.restSec - stilling.tilbage);
		if (stilling.fase === 'skift') brugt += denne.workSec;
	}
	return Math.max(0, Math.min(100, Math.round((brugt / ialt) * 100)));
}

// ── Den gemte plads ─────────────────────────────────────────────

export interface GemtPlads3 {
	programId: string;
	/** Nummeret paa traeningen, 1-baseret. */
	nr: number;
	oevelse: number;
	saet: number;
	fase: Fase3;
	tilbage: number;
	gemtAt: number;
}

/**
 * Kan den gemte plads bruges paa den traening vi er ved at aabne.
 *
 * Passer den ikke, starter vi trygt forfra i stedet for at genoptage et
 * sted der ikke findes. En gemt plads fra en anden traening maa aldrig
 * kunne genoptages, for saa ville hun blive markeret faerdig med noget
 * hun ikke har lavet.
 */
export function pladsPasser3(
	plads: GemtPlads3 | null,
	programId: string,
	nr: number,
	oevelser: DayExercise[]
): boolean {
	if (!plads) return false;
	if (plads.programId !== programId || plads.nr !== nr) return false;
	if (plads.oevelse < 0 || plads.oevelse >= oevelser.length) return false;
	if (plads.saet < 1) return false;
	if (plads.tilbage < 0) return false;
	return ['klar', 'arbejd', 'hvil', 'skift'].includes(plads.fase);
}

/** Den gemte plads som en stilling afspilleren kan fortsaette fra. */
export function stillingFraPlads3(plads: GemtPlads3, oevelser: DayExercise[]): Stilling3 {
	const oevelse = oevelser[plads.oevelse];
	const laengde = faseLaengde3(plads.fase, oevelse);
	return {
		oevelse: plads.oevelse,
		saet: plads.saet,
		fase: plads.fase,
		// Aldrig mere tilbage end fasen er lang. Ellers kunne en gammel
		// gemt plads give en nedtaelling der er laengere end oevelsen.
		tilbage: Math.min(Math.max(0, plads.tilbage), laengde)
	};
}

/** Er der overhovedet noget vaerd at gemme, eller er hun lige begyndt. */
export function vaerdAtGemme3(stilling: Stilling3): boolean {
	if (stilling.fase === 'faerdig') return false;
	if (stilling.oevelse > 0 || stilling.saet > 1) return true;
	return stilling.fase !== 'klar';
}
