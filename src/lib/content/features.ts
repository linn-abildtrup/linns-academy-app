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
	| 'beskeder-til-linn'
	| 'udvidet-naering'
	| 'byg-eget-program'
	| 'ai-madplan'
	| 'ai-opskrift'
	| 'nul-dage';

/** De kundetyper adgangen styres pr. 'fleksibelt' = byggede/fleksible forløb
 *  (fx SommerRo) der ikke er Kickstart eller Kropsro. */
export type Kundetype = 'kickstart' | 'kropsro' | 'fleksibelt' | 'app';

export interface Feature {
	key: FeatureKey;
	navn: string;
	beskrivelse: string;
	/** Om funktionen faktisk er koblet til at styre adgang endnu. De features
	 *  der stadig koerer paa det gamle premium-system (koblet=false) viser en
	 *  markering i admin-skemaet — at aendre dem har ingen effekt foer de er
	 *  koblet via harFeatureAdgang. */
	koblet: boolean;
}

/** Listen vist i admin-skemaet. Tilfoej nye funktioner her. */
export const FEATURES: Feature[] = [
	{
		key: 'linn-ai',
		koblet: true,
		navn: 'Linn AI',
		beskrivelse:
			'Kunden kan chatte med en AI-version af dig og få svar på spørgsmål om træning, kost og vaner, når som helst. Findes som eget punkt i Moduler.'
	},
	{
		key: 'beskeder-til-linn',
		koblet: true,
		navn: 'Beskeder til Linn',
		beskrivelse:
			'Kunden kan skrive direkte til dig under Beskeder. Slå fra hvis et forløb kun skal have Linn AI. Kan stå alene, sammen med Linn AI, eller Linn AI kan stå alene.'
	},
	{
		key: 'udvidet-naering',
		koblet: true,
		navn: 'Udvidet næringsdata',
		beskrivelse:
			'I mad-modulet (30-30-3) ser kunden også kulhydrat, fedt og kalorier, ikke kun protein og fiber. Hun kan desuden sætte sine egne daglige makromål.'
	},
	{
		key: 'byg-eget-program',
		koblet: true,
		navn: 'Byg eget træningsprogram',
		beskrivelse:
			'Kunden kan selv bygge et træningsprogram ved at vælge øvelser, sæt, gentagelser og pauser, og køre det som sit aktive program.'
	},
	{
		key: 'ai-madplan',
		koblet: true,
		navn: 'AI-madplan',
		beskrivelse:
			'Kunden kan få appen til automatisk at foreslå en madplan ud fra hendes ønsker og behov.'
	},
	{
		key: 'ai-opskrift',
		koblet: true,
		navn: 'AI-opskriftsanalyse',
		beskrivelse:
			'Kunden kan indtaste en opskrift eller tage et billede af en ret, og appen regner næringsindholdet ud automatisk.'
	},
	{
		key: 'nul-dage',
		koblet: true,
		navn: 'Nul-dage',
		beskrivelse:
			'Kunden kan markere dage som pause (fx ferie eller sygdom), så forløbet ikke skrider frem på de dage. Kun relevant for forløbskunder (Kickstart/Kropsro) — app-kunder har ikke et forløb at sætte på pause.'
	}
];

/** Kundetyperne vist som kolonner i admin-skemaet. */
export const KUNDETYPER: { key: Kundetype; navn: string }[] = [
	{ key: 'kickstart', navn: 'Kickstart' },
	{ key: 'kropsro', navn: 'Kropsro' },
	{ key: 'fleksibelt', navn: 'Fleksibelt forløb' },
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
 * Standard-matrixen — default-adgangen indtil admin aendrer skemaet. Bruges
 * som seed naar matrixen oprettes, OG som fail-safe fallback hvis matrixen
 * ikke kan hentes.
 *
 * Udgangspunkt: de oevrige funktioner foelger den hidtidige premium-adgang
 * (Kickstart + Kropsro har dem, app-kunder ikke). UNDTAGELSER (slukket for
 * ALLE, styres via testere indtil Linn bevidst taender dem): Linn AI (9/6),
 * nul-dage (11/6), byg-eget-program (11/6 — aldrig lanceret) og ai-madplan
 * (11/6 — kun en test-funktion endnu, ikke lanceret bredt).
 */
export const STANDARD_MATRIX: FeatureMatrix = {
	kickstart: {
		...alleFeatures(true),
		'linn-ai': false,
		'nul-dage': false,
		'byg-eget-program': false,
		'ai-madplan': false
	},
	kropsro: {
		...alleFeatures(true),
		'linn-ai': false,
		'nul-dage': false,
		'byg-eget-program': false,
		'ai-madplan': false
	},
	// Fleksible/byggede forløb (fx SommerRo): som Kropsro-niveau, men Linn AI
	// til, INGEN nul-dage, og ingen beskeder-til-Linn (kun Linn AI). Admin kan
	// frit ændre i feature-adgang-skemaet.
	fleksibelt: {
		...alleFeatures(false),
		'linn-ai': true,
		'udvidet-naering': true,
		'ai-opskrift': true
	},
	app: alleFeatures(false)
};

/** Standard-produkterne (abo + Kickstart/Kropsro-forløb). Alt andet i
 *  activeProduct er en byggetForløbs egen produktNøgle = fleksibelt forløb. */
const STANDARD_PRODUKTER = ['basisabo', 'premiumabo', 'kickstart', 'premiumforløb'];

/**
 * Udleder en kundes type ud fra adgangs-felterne. Aktive forløbskunder:
 * byggede/fleksible forløb (activeProduct = forløbets egen produktNøgle, ikke et
 * standard-produkt) → 'fleksibelt'; ellers Kropsro vs Kickstart efter det aktive
 * forløbs id. Returnerer null hvis kunden ikke har aktiv adgang (udløbet / ingen)
 * — saa faar hun ingen funktioner, praecis som harPremium=false i dag.
 */
export function kundetypeFor(userDoc: UserDoc | null | undefined): Kundetype | null {
	if (erForlobsklient(userDoc)) {
		const ap = userDoc?.activeProduct;
		if (ap && !STANDARD_PRODUKTER.includes(ap)) return 'fleksibelt';
		return aktivtForlobId(userDoc)?.startsWith('kropsro_') ? 'kropsro' : 'kickstart';
	}
	if (erModulbruger(userDoc)) return 'app';
	return null;
}

/**
 * DEN ENESTE funktion der afgør om en kunde har adgang til en funktion.
 * Bruges overalt hvor en funktion vises/skjules — saa skema og testere
 * aldrig kan komme ud af trit. To lag i samme svar:
 *
 *   1. Tester-undtagelse: er kunden udvalgt som tester for funktionen
 *      (userDoc.testerFeatures), faar hun adgang uanset skemaet. Bruges til
 *      at proeve en funktion af paa enkelte navngivne kunder foer bred
 *      udrulning (se /admin/testere).
 *   2. Skemaet: ellers afgoer admin-matrixen pr kundetype.
 *
 * Mangler matrixen (ikke hentet endnu), bruges STANDARD_MATRIX saa adgangen
 * aldrig falder bort ved en hente-fejl.
 */
export function harFeatureAdgang(
	userDoc: UserDoc | null | undefined,
	matrix: FeatureMatrix | null | undefined,
	feature: FeatureKey
): boolean {
	if (userDoc?.testerFeatures?.includes(feature)) return true;
	// Byggede/fleksible forløb styres nu via 'fleksibelt'-kolonnen i matrixen
	// (se kundetypeFor), ikke længere pr-forløb via userDoc.forlobFeatures.
	const kt = kundetypeFor(userDoc);
	if (!kt) return false;
	const m = matrix ?? STANDARD_MATRIX;
	return m[kt]?.[feature] ?? STANDARD_MATRIX[kt][feature];
}
