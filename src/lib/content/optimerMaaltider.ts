// Optimér min mad — typer og pure-funktioner.
//
// Premium-feature der lader brugeren trykke "Optimér min mad" på Dagbog-
// fanen. AI'en kigger på dagens måltider + brugerens daglige mål og
// foreslår små bytter/tilføjelser så protein- og fiber-målet rammes
// uden at sprænge kcal-budgettet.
//
// Holdes adskilt fra firestore-helpers så enhedstests ikke trækker
// firebase-runtime ind.

import type { DagligeMaal } from '$lib/types';
import type { GemtMaaltid, Maaltidstype } from '$lib/content/kost';

// ==============================================
// Konstanter
// ==============================================

/**
 * Tolerance på kcal-budgettet. AI'en skal lande dagsoptotaler inden for
 * ±5% (eller ±150 kcal, hvad der er størst). Beregneren bruges både i
 * server-prompten og i klient-side validering af AI-svar.
 */
export const KCAL_TOLERANCE_PROCENT = 0.05;
export const KCAL_TOLERANCE_MIN = 150;

export function kcalTolerance(maalKcal: number): number {
	return Math.max(KCAL_TOLERANCE_MIN, Math.round(maalKcal * KCAL_TOLERANCE_PROCENT));
}

// ==============================================
// Diff-format — det AI'en returnerer
// ==============================================

/**
 * Et forslag til ændring af ét måltid. AI'en returnerer en liste af disse.
 *
 * Tre handlinger:
 *  - 'tilfoej': læg en ny ingrediens ind i et eksisterende måltid eller
 *               opret et nyt måltid (fx en snack)
 *  - 'fjern':   fjern en eksisterende ingrediens
 *  - 'byt':     erstat en ingrediens med en anden (typisk samme kategori,
 *               mere protein eller fiber)
 *
 * `maaltidId` peger på et eksisterende måltid i dagbogen. Hvis AI'en
 * foreslår et helt nyt måltid (typisk en snack), sættes maaltidId til
 * en ny streng der starter med 'NY_' og maaltidstype + navn medtages.
 */
export type DiffHandling = 'tilfoej' | 'fjern' | 'byt';

export interface MaaltidDiff {
	maaltidId: string;
	maaltidNavn: string; // til UI-visning
	maaltidType: Maaltidstype;
	handling: DiffHandling;
	/** Beskrivelse til brugeren — "Tilføj 30g valnødder" osv. */
	tekst: string;
	/** Begrundelse — "Bidrager med 5g protein og 3g fiber". */
	begrundelse: string;
	/** Makro-bidrag (positiv = tilføjet, negativ = fjernet). */
	makroDelta: MakroDelta;
}

export interface MakroDelta {
	protein: number;
	fiber: number;
	kh: number;
	fedt: number;
	kcal: number;
}

/**
 * Det fulde AI-svar. Indeholder diff'en plus en sammenfatning.
 */
export interface OptimerSvar {
	diff: MaaltidDiff[];
	/** Forventet dags-makro efter alle ændringer er anvendt. */
	resultatMakro: MakroDelta;
	/** Sammenfatning til brugeren — 1-2 sætninger om hvorfor det er bedre. */
	samletBegrundelse: string;
	/** Hvis AI'en ikke kan ramme målet inden for kcal-budgettet, forklar her. */
	advarsel?: string;
}

// ==============================================
// Pure-funktioner til klient + server
// ==============================================

/**
 * Summerer dagens måltider til ét makro-objekt.
 * Returnerer 0 for kh/fedt/kcal hvis ikke alle måltider har dem (legacy-data).
 */
export function summerDagsMakro(maaltider: GemtMaaltid[]): MakroDelta {
	let protein = 0;
	let fiber = 0;
	let kh = 0;
	let fedt = 0;
	let kcal = 0;
	for (const m of maaltider) {
		protein += m.totalP ?? 0;
		fiber += m.totalF ?? 0;
		kh += m.totalKh ?? 0;
		fedt += m.totalFedt ?? 0;
		kcal += m.totalKcal ?? 0;
	}
	return { protein, fiber, kh, fedt, kcal };
}

/**
 * Lægger en delta oven i et makro-objekt.
 */
export function laegSammen(a: MakroDelta, b: MakroDelta): MakroDelta {
	return {
		protein: a.protein + b.protein,
		fiber: a.fiber + b.fiber,
		kh: a.kh + b.kh,
		fedt: a.fedt + b.fedt,
		kcal: a.kcal + b.kcal
	};
}

/**
 * Beregner total-delta fra hele diff-listen.
 */
export function summerDiffDelta(diff: MaaltidDiff[]): MakroDelta {
	const start: MakroDelta = { protein: 0, fiber: 0, kh: 0, fedt: 0, kcal: 0 };
	return diff.reduce((acc, d) => laegSammen(acc, d.makroDelta), start);
}

/**
 * Hvor langt er brugeren fra hvert mål? Negativ = mangler, positiv = over.
 */
export function diffModMaal(faktisk: MakroDelta, maal: DagligeMaal): MakroDelta {
	return {
		protein: faktisk.protein - maal.protein,
		fiber: faktisk.fiber - maal.fiber,
		kh: faktisk.kh - maal.kh,
		fedt: faktisk.fedt - maal.fedt,
		kcal: faktisk.kcal - maal.kcal
	};
}

/**
 * Valider et AI-svar har gyldig struktur. Returnerer null hvis ok,
 * ellers fejl-besked. Bruges både server-side (afvis ugyldige svar fra
 * Claude) og klient-side (forsvar mod stale state).
 */
export function valierOptimerSvar(svar: unknown): string | null {
	if (!svar || typeof svar !== 'object') return 'Svar er ikke et objekt';
	const s = svar as Partial<OptimerSvar>;
	if (!Array.isArray(s.diff)) return 'diff mangler eller er ikke et array';
	for (const d of s.diff) {
		if (!d.maaltidId || typeof d.maaltidId !== 'string') return 'diff[].maaltidId mangler';
		if (!d.handling || !['tilfoej', 'fjern', 'byt'].includes(d.handling))
			return 'diff[].handling skal være tilfoej/fjern/byt';
		if (!d.tekst || typeof d.tekst !== 'string') return 'diff[].tekst mangler';
		if (!d.makroDelta || typeof d.makroDelta !== 'object') return 'diff[].makroDelta mangler';
	}
	if (!s.resultatMakro || typeof s.resultatMakro !== 'object') return 'resultatMakro mangler';
	if (typeof s.samletBegrundelse !== 'string') return 'samletBegrundelse mangler';
	return null;
}

/**
 * Lille hjælper til UI: vælger en farve-token baseret på handlings-type.
 * 'tilfoej' = grøn (positiv), 'byt' = gul (neutral), 'fjern' = rød (negativ).
 */
export function handlingsFarve(handling: DiffHandling): string {
	switch (handling) {
		case 'tilfoej':
			return 'var(--gron, #4caf50)';
		case 'byt':
			return 'var(--gul, #f0b400)';
		case 'fjern':
			return 'var(--terra, #c25b3f)';
	}
}
