// Admin-styret feature-adgang. Erstatter det gamle binaere harPremium/
// basis-premium-system med en matrix, admin selv styrer: pr kundetype
// (kickstart / kropsro / app) kan hver funktion taendes/slukkes.
//
// Etape 3A: definitioner + helper + standard-matrix (= nuvaerende adgang).
// Koblingen til de faktiske features sker i etape 3C — indtil da bruger
// ingenting denne fil til at gate noget.

import type { UserDoc } from '$lib/types';
import { erForlobsklient, erModulbruger } from '$lib/utils/userAdgang';
import { aktivtForlobId } from '$lib/utils/traeningsvariant';

/** De funktioner adgangen kan styres for. */
export type FeatureKey =
	| 'linn-ai'
	| 'udvidet-naering'
	| 'udvidet-vaner'
	| 'byg-eget-program'
	| 'ai-madplan'
	| 'ai-opskrift';

/** De kundetyper adgangen styres pr. */
export type Kundetype = 'kickstart' | 'kropsro' | 'app';

export interface Feature {
	key: FeatureKey;
	navn: string;
	beskrivelse: string;
}

/** Listen vist i admin-skemaet. Tilfoej nye funktioner her. */
export const FEATURES: Feature[] = [
	{
		key: 'linn-ai',
		navn: 'Linn AI',
		beskrivelse:
			'Kunden kan chatte med en AI-version af dig og få svar på spørgsmål om træning, kost og vaner, når som helst. Findes som eget punkt i Moduler.'
	},
	{
		key: 'udvidet-naering',
		navn: 'Udvidet næringsdata',
		beskrivelse:
			'I mad-modulet (30-30-3) ser kunden også kulhydrat, fedt og kalorier, ikke kun protein og fiber. Hun kan desuden sætte sine egne daglige makromål.'
	},
	{
		key: 'udvidet-vaner',
		navn: 'Udvidet vanetracker',
		beskrivelse:
			'Kunden får en udvidet vanetracker med flere vaner end standard-versionen, så hun kan følge flere ting på én gang.'
	},
	{
		key: 'byg-eget-program',
		navn: 'Byg eget træningsprogram',
		beskrivelse:
			'Kunden kan selv bygge et træningsprogram ved at vælge øvelser, sæt, gentagelser og pauser, og køre det som sit aktive program.'
	},
	{
		key: 'ai-madplan',
		navn: 'AI-madplan',
		beskrivelse:
			'Kunden kan få appen til automatisk at foreslå en madplan ud fra hendes ønsker og behov.'
	},
	{
		key: 'ai-opskrift',
		navn: 'AI-opskriftsanalyse',
		beskrivelse:
			'Kunden kan indtaste en opskrift eller tage et billede af en ret, og appen regner næringsindholdet ud automatisk.'
	}
];

/** Kundetyperne vist som kolonner i admin-skemaet. */
export const KUNDETYPER: { key: Kundetype; navn: string }[] = [
	{ key: 'kickstart', navn: 'Kickstart' },
	{ key: 'kropsro', navn: 'Kropsro' },
	{ key: 'app', navn: 'App-kunde' }
];

/** Adgangsmatrix: for hver kundetype, hvilke funktioner er taendt. */
export type FeatureMatrix = Record<Kundetype, Record<FeatureKey, boolean>>;

function alleFeatures(vaerdi: boolean): Record<FeatureKey, boolean> {
	return FEATURES.reduce(
		(acc, f) => {
			acc[f.key] = vaerdi;
			return acc;
		},
		{} as Record<FeatureKey, boolean>
	);
}

/**
 * Standard-matrix = den adgang kunderne har I DAG (premium-niveau = Kickstart
 * + Kropsro har alle funktioner; app-kunder har ingen). Bruges som seed naar
 * matrixen oprettes, OG som fail-safe fallback hvis matrixen ikke kan hentes —
 * saa en hente-fejl aldrig fjerner adgang fra en kunde der har den i dag.
 */
export const STANDARD_MATRIX: FeatureMatrix = {
	kickstart: alleFeatures(true),
	kropsro: alleFeatures(true),
	app: alleFeatures(false)
};

/**
 * Udleder en kundes type ud fra adgangs-felterne. Aktive forløbskunder
 * typebestemmes af deres AKTIVE forløb (kropsro_ vs andet). Returnerer null
 * hvis kunden ikke har aktiv adgang (udløbet / ingen) — saa faar hun ingen
 * funktioner, praecis som harPremium=false i dag.
 */
export function kundetypeFor(userDoc: UserDoc | null | undefined): Kundetype | null {
	if (erForlobsklient(userDoc)) {
		return aktivtForlobId(userDoc)?.startsWith('kropsro_') ? 'kropsro' : 'kickstart';
	}
	if (erModulbruger(userDoc)) return 'app';
	return null;
}

/**
 * True hvis kunden har adgang til en funktion. Slaar kundens type op i
 * matrixen. Mangler matrixen (ikke hentet endnu), bruges STANDARD_MATRIX saa
 * adgangen aldrig falder bort ved en hente-fejl.
 */
export function harFeatureAdgang(
	userDoc: UserDoc | null | undefined,
	matrix: FeatureMatrix | null | undefined,
	feature: FeatureKey
): boolean {
	const kt = kundetypeFor(userDoc);
	if (!kt) return false;
	const m = matrix ?? STANDARD_MATRIX;
	return m[kt]?.[feature] ?? STANDARD_MATRIX[kt][feature];
}
