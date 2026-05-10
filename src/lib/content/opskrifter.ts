// Opskrifter — typer og pure-funktioner
//
// Opskrifter er globale (ikke forløbs-specifikke) — Linn vedligeholder
// én database der gælder alle forløb. Hver opskrift har et default-antal
// portioner, og klienten kan justere det op/ned hvorefter mængderne
// skaleres tilsvarende.

import type { Timestamp } from 'firebase/firestore';

// ==============================================
// Typer
// ==============================================

export type OpskriftKategori =
	| 'morgenmad'
	| 'frokost'
	| 'aftensmad'
	| 'salat'
	| 'snack'
	| 'dessert'
	| 'tilbehor';

export interface Ingrediens {
	navn: string;
	maengde: number;
	enhed: string;
}

export type DietTag = 'vegetar' | 'glutenfri';

export interface Opskrift {
	id: string;
	titel: string;
	beskrivelse: string;
	billedeUrl: string | null;
	kategorier: OpskriftKategori[];
	dietTags: DietTag[];
	defaultPortioner: number;
	ingredienser: Ingrediens[];
	instruktioner: string;
	aktiv: boolean;
	oprettet?: Timestamp;
	opdateret?: Timestamp;
}

// ==============================================
// Konstanter
// ==============================================

export const KATEGORI_LABELS: Record<OpskriftKategori, string> = {
	morgenmad: 'Morgenmad',
	frokost: 'Frokost',
	aftensmad: 'Aftensmad',
	salat: 'Salater',
	snack: 'Snack',
	dessert: 'Dessert',
	tilbehor: 'Tilbehør'
};

export const ALLE_KATEGORIER: OpskriftKategori[] = [
	'morgenmad',
	'frokost',
	'aftensmad',
	'salat',
	'snack',
	'dessert',
	'tilbehor'
];

export const DIET_LABELS: Record<DietTag, string> = {
	vegetar: 'Vegetar',
	glutenfri: 'Glutenfri'
};

export const ALLE_DIET_TAGS: DietTag[] = ['vegetar', 'glutenfri'];

// ==============================================
// Beregninger
// ==============================================

/**
 * Skalerer en mængde fra default-portioner til ønskede portioner.
 * Runder til to decimaler for at undgå nummeriske artefakter.
 */
export function skalerMaengde(
	defaultMaengde: number,
	defaultPortioner: number,
	oensketPortioner: number
): number {
	if (defaultPortioner <= 0 || oensketPortioner <= 0) return 0;
	const skala = oensketPortioner / defaultPortioner;
	return Math.round(defaultMaengde * skala * 100) / 100;
}

/**
 * Formaterer en mængde uden unødige decimaler.
 * 1.0 → "1", 1.5 → "1,5", 0.5 → "0,5".
 * Returnerer tom streng hvis mængden er 0 (skjul amount).
 */
export function formatMaengde(m: number): string {
	if (!Number.isFinite(m) || m === 0) return '';
	const rundet = Math.round(m * 100) / 100;
	if (rundet === Math.round(rundet)) return String(Math.round(rundet));
	return rundet.toString().replace('.', ',');
}

/**
 * Filtrerer opskrifter ud fra søgeord, kategorier og dietTags.
 * Søgeord matcher mod titel og beskrivelse (case-insensitiv).
 * Kategorier er OR-logik: opskriften vises hvis den matcher mindst én af de valgte.
 * DietTags er AND-logik: alle valgte tags skal være på opskriften.
 * Hvis ingen kategorier eller dietTags er valgt, vises alle.
 */
export function filtrerOpskrifter(
	opskrifter: Opskrift[],
	soegeord: string,
	valgteKategorier: OpskriftKategori[],
	valgteDietTags: DietTag[] = []
): Opskrift[] {
	const q = soegeord.trim().toLowerCase();
	return opskrifter.filter((o) => {
		if (valgteKategorier.length > 0) {
			const matcher = o.kategorier.some((k) => valgteKategorier.includes(k));
			if (!matcher) return false;
		}
		if (valgteDietTags.length > 0) {
			const harAlle = valgteDietTags.every((t) => (o.dietTags ?? []).includes(t));
			if (!harAlle) return false;
		}
		if (q) {
			const ingredienserTekst = o.ingredienser.map((i) => i.navn).join(' ');
			const tekst = (o.titel + ' ' + o.beskrivelse + ' ' + ingredienserTekst).toLowerCase();
			if (!tekst.includes(q)) return false;
		}
		return true;
	});
}
