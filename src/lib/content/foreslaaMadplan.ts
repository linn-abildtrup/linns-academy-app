// Foreslå madplan — typer og pure-funktioner.
//
// Premium-feature der lader brugeren bede AI'en bygge et madplans-forslag
// til én dag baseret på opskrifterne i 30-30-3-databasen og brugerens egne
// (MinOpskrift). Brugeren kan vælge 1-3 alternativer pr måltidstype og
// angive op til 3 ingredienser hun ikke vil have + glutenfri-toggle.
//
// Adskilt fra firestore-helpers så enhedstests ikke trækker firebase-runtime
// ind.

import type { DagligeMaal } from '$lib/types';

export type Maaltidskategori = 'morgenmad' | 'frokost' | 'aftensmad';

export const MAALTIDSKATEGORIER: Maaltidskategori[] = [
	'morgenmad',
	'frokost',
	'aftensmad'
];

export const MAALTIDSKATEGORI_LABELS: Record<Maaltidskategori, string> = {
	morgenmad: 'Morgenmad',
	frokost: 'Frokost',
	aftensmad: 'Aftensmad'
};

/**
 * En forenklet repræsentation af en opskrift som AI'en kan vælge fra.
 * Vi sender ikke fuld instruktion eller alle metadata — kun det AI'en
 * skal bruge for at vurdere relevans.
 */
export interface OpskriftKandidat {
	id: string;
	titel: string;
	kategori: Maaltidskategori;
	protein: number;
	fiber: number;
	kalorier: number;
	dietTags: string[];
	ingredienser: string[];
	/** true = brugerens egen (MinOpskrift), false/undefined = global */
	erEgen?: boolean;
}

/**
 * Input til /api/foreslaa-madplan.
 */
export interface ForeslaaRequest {
	/** Brugerens daglige næringsmål (protein/fiber/kcal). */
	maal: DagligeMaal;
	/** Navne på brugerens favorit-fødevarer — bruges af AI'en til prioritering. */
	favoritFoodNavne: string[];
	/** Hvor mange alternativer pr måltidstype (1, 2 eller 3). */
	antalAlternativer: 1 | 2 | 3;
	/** True hvis kun glutenfri-opskrifter må foreslås. */
	glutenfri: boolean;
	/** Op til 3 ingrediens-navne brugeren vil undgå (case-insensitive substring-match). */
	undgaaIngredienser: string[];
	/** Pool af opskrifter AI'en må vælge fra (allerede filtreret på klient). */
	kandidater: OpskriftKandidat[];
}

/**
 * Et enkelt forslag returneret af AI'en.
 */
export interface MadplanForslag {
	opskriftId: string;
	erEgen: boolean;
	hvorforPasser: string;
}

/**
 * Et lille supplerende snack-forslag — typisk noget hurtigt og enkelt som
 * brugeren kan tilføje hvis opskrifterne ikke fuldt rammer hendes mål.
 * Indeholder protein/fiber-bidrag så det vises i parentes på UI'en.
 */
export interface SnackForslag {
	tekst: string; // "Et æble" / "1 hårdkogt æg" / "100g græsk yoghurt med hindbær"
	protein: number; // g
	fiber: number; // g
}

/**
 * Svar fra /api/foreslaa-madplan. Tre sektioner med 1-3 forslag hver
 * plus en liste over nemme snack-suppleringer.
 */
export interface MadplanSvar {
	morgenmad: MadplanForslag[];
	frokost: MadplanForslag[];
	aftensmad: MadplanForslag[];
	/**
	 * Hurtige snack-suppleringer brugeren kan tilføje hvis opskrifterne alene
	 * ikke når 100% af protein/fiber-målet. AI'en regner med at brugeren
	 * vælger ÉN opskrift fra hver kategori og estimerer derfra.
	 */
	snacks: SnackForslag[];
	/** 1-2 sætninger om hvordan kombinationen rammer dagens mål. */
	samletBegrundelse: string;
	/** Valgfri — hvis AI'en ikke kunne overholde alle krav. */
	advarsel?: string;
}

// ==============================================
// Pre-filtrering (klient-side, før AI-kald)
// ==============================================

/**
 * Filtrerer kandidat-listen til AI'en.
 *
 * VIGTIGT: Vi filtrerer KUN på glutenfri her, IKKE på undgå-ingredienser.
 * Det er bevidst: AI'en filtrerer undgå-ingredienser på serveren, så
 * kandidat-katalogen er ens for alle ikke-glutenfri-brugere (eller alle
 * glutenfri-brugere) og kan deles via Anthropic prompt caching.
 *
 * Glutenfri-filteret beholdes klient-side fordi det halverer pool-størrelsen
 * og giver klart hurtigere svar, og fordi de to grupper alligevel har hver
 * deres cache-entry.
 */
export function filtrerKandidater(
	kandidater: OpskriftKandidat[],
	glutenfri: boolean
): OpskriftKandidat[] {
	if (!glutenfri) return kandidater;
	return kandidater.filter((k) => k.dietTags.includes('glutenfri'));
}

/**
 * Returnerer en fejlbesked hvis request-objektet ikke er gyldigt, ellers null.
 * Bruges af både klient og server.
 */
export function validerRequest(req: ForeslaaRequest): string | null {
	if (!req.maal || typeof req.maal !== 'object') return 'Daglige mål mangler';
	if (![1, 2, 3].includes(req.antalAlternativer)) {
		return 'antalAlternativer skal være 1, 2 eller 3';
	}
	if (!Array.isArray(req.undgaaIngredienser)) return 'undgaaIngredienser skal være en liste';
	if (req.undgaaIngredienser.length > 3) return 'Højst 3 ingredienser at undgå';
	if (!Array.isArray(req.kandidater) || req.kandidater.length === 0) {
		return 'Ingen opskrifter at vælge fra — prøv at fjerne filtre.';
	}
	return null;
}

/**
 * Returnerer en fejlbesked hvis et svar fra AI'en ikke matcher forventet
 * format, ellers null. Bruges til at fange hallucineret JSON.
 */
export function validerSvar(
	svar: MadplanSvar,
	antalAlternativer: number,
	kandidatIds: Set<string>
): string | null {
	for (const k of MAALTIDSKATEGORIER) {
		const liste = svar[k];
		if (!Array.isArray(liste)) return `${k}-listen mangler`;
		if (liste.length === 0) {
			// Tillad — AI'en kunne ikke finde noget passende
			continue;
		}
		if (liste.length > antalAlternativer) {
			return `${k} har ${liste.length} forslag, max ${antalAlternativer}`;
		}
		for (const forslag of liste) {
			if (typeof forslag.opskriftId !== 'string') {
				return `${k}: opskriftId mangler`;
			}
			if (!kandidatIds.has(forslag.opskriftId)) {
				return `${k}: ukendt opskriftId "${forslag.opskriftId}"`;
			}
		}
	}
	if (!Array.isArray(svar.snacks)) return 'snacks-listen mangler';
	for (const s of svar.snacks) {
		if (typeof s.tekst !== 'string' || s.tekst.length === 0) {
			return 'snack mangler tekst';
		}
		if (typeof s.protein !== 'number' || typeof s.fiber !== 'number') {
			return 'snack mangler protein/fiber';
		}
	}
	return null;
}
