// Vanetracker — typer og pure-funktioner
//
// En VaneProgram er et versioneret sæt af 21+1 dage (baseline + dag 1-21).
// Hver dag har refleksion, faste vaner (checks), evt. bonus-spørgsmål, og
// markering for om det er en check-in-dag (dag 0, 7, 14, 21) hvor brugeren
// også svarer på 5 sliders.
//
// Brugerens svar gemmes som VanedagEntry pr dag, separat fra programmet,
// så samme program kan deles mellem mange brugere/forløb.

import type { Timestamp } from 'firebase/firestore';

// ==============================================
// Vane-typer
// ==============================================

/** Tre-værdis svar på en daglig vane. */
export type VaneSvar = 'ja' | 'delvist' | 'nej';

/** Bonus-spørgsmål er et to-værdis ja/nej. */
export type BonusSvar = 'ja' | 'nej';

/**
 * En enkelt vane brugeren skal svare på (dagens "checks").
 * Eksempel: "Protein til morgenmad" med id='pm'.
 */
export interface Vane {
	id: string;
	label: string;
}

/**
 * Bonus-spørgsmål — én pr dag, valgfrit at besvare.
 * Eksempel: "Gå 5 min udenfor" med id='b1'.
 */
export interface Bonus {
	id: string;
	label: string;
}

/**
 * En enkelt programdag — strukturen for spørgsmål, IKKE brugerens svar.
 * dagNummer 0 er baseline (kun check-in, ingen vaner eller refleksion).
 */
export interface VaneProgramDag {
	dagNummer: number;
	uge: number;
	reflection: string;
	checks: Vane[];
	bonus: Bonus | null;
	isCheckin: boolean;
	isBaseline: boolean;
	isWin: boolean;
	isMrsCheckin?: boolean;
}

/**
 * Selve vaneprogrammet (toplevel-doc i vaneProgrammer-collection).
 * Dage gemmes i subcollection days/{dagNummer}.
 */
export interface VaneProgram {
	id: string;
	navn: string;
	beskrivelse: string;
	antalDage: number;
	aktiv: boolean;
}

// ==============================================
// Brugerens svar (Vanedag-entry)
// ==============================================

export interface CheckinSvar {
	energi?: number;
	mave?: number;
	cravings?: number;
	humor?: number;
	sovn?: number;
	generelTekst?: string;
}

export interface VanedagEntry {
	dagNummer: number;
	checks: Record<string, VaneSvar>;
	bonus: Record<string, BonusSvar>;
	checkin: CheckinSvar;
	note: string;
	savedAt?: Timestamp;
}

// ==============================================
// Status og scoring
// ==============================================

export type DagStatus = 'empty' | 'partial' | 'completed' | 'locked';

export type FlowerNiveau = 'excellent' | 'good' | 'medium' | 'low' | 'poor' | 'none';

/** Standard check-in-spørgsmål (sliders 1-10). */
export const CHECKIN_SPORGSMAAL = [
	{ id: 'energi', label: 'Min energi' },
	{ id: 'mave', label: 'Min mave og fordøjelse' },
	{ id: 'cravings', label: 'Mine cravings (1 = mange → 10 = ingen)' },
	{ id: 'humor', label: 'Mit humør og overskud' },
	{ id: 'sovn', label: 'Min søvn' }
] as const;

/**
 * Beregner en dags status ud fra programmet og brugerens svar.
 * Returnerer 'locked' hvis dagen er låst (kalder skal selv afgøre låsning
 * via unlockedDays — denne funktion antager dagen er åben).
 *
 * Pr 7/6 2026 er de 5 slider-svar flyttet ud af refleksionen og over i
 * symptomtjek-modulet (mrs_scores). isCheckin paavirker derfor ikke
 * laengere completion — kun vaner/bonus taeller. Baseline-dag (dag 0)
 * bedoemmes paa generelTekst (baseline-kommentar i fritekst).
 *
 * Gamle entries (foer 7/6 2026) kan stadig have sliders i checkin —
 * de bevares uberoert, men status-logikken bygger ikke laengere paa dem.
 */
export function beregnDagsStatus(
	prog: VaneProgramDag,
	entry: VanedagEntry | null
): DagStatus {
	const e = entry ?? { checks: {}, bonus: {}, checkin: {}, note: '', dagNummer: prog.dagNummer };

	if (prog.isBaseline) {
		const generelTekst = (e.checkin?.generelTekst ?? '').trim();
		if (generelTekst.length === 0) return 'empty';
		return 'completed';
	}

	const ja = prog.checks.filter((c) => e.checks?.[c.id] === 'ja').length;
	const harSvarPaaEnVane = prog.checks.some((c) => e.checks?.[c.id]);
	const harBonusSvar = prog.bonus && e.bonus?.[prog.bonus.id];
	const harNote = (e.note ?? '').trim().length > 0;

	const harNogetIndhold = harSvarPaaEnVane || harBonusSvar || harNote;
	if (!harNogetIndhold) return 'empty';

	const alleVanerJa = prog.checks.length > 0 && ja === prog.checks.length;
	if (alleVanerJa) return 'completed';
	return 'partial';
}

/**
 * 3-niveau-farve for en dag baseret paa procent ja-svar. Bruges til at
 * farve hele dag-cellen i vaner-oversigten saa kunden kan se hvor godt
 * dagen er gaaet paa et oejeblik.
 *
 *   >=75% ja → gron
 *   >=50% ja → orange
 *   under    → rod
 *   ingen svar / baseline / ingen vaner → tom
 *
 * Delvist taeller som 0.5 ja. Bonus taeller med (ja=1, ellers 0).
 *
 * For Kropsro (hvor prog.checks er tom) skal kalderen sende ekstra
 * vaner ind via 'extraChecks' (typisk filtrerede admin-tildelte vaner
 * for ugen). Saa er beregningen den samme paa tvaers af forloebstyper.
 */
export type DagsFarve = 'gron' | 'orange' | 'rod' | 'tom';

export function beregnDagsFarve(
	prog: VaneProgramDag,
	entry: VanedagEntry | null,
	extraChecks: { id: string }[] = []
): DagsFarve {
	if (!entry || prog.isBaseline) return 'tom';
	const visteVaner = [...prog.checks, ...extraChecks];
	const total = visteVaner.length + (prog.bonus ? 1 : 0);
	if (total === 0) return 'tom';

	let score = 0;
	for (const c of visteVaner) {
		const v = entry.checks?.[c.id];
		if (v === 'ja') score += 1;
		else if (v === 'delvist') score += 0.5;
	}
	if (prog.bonus && entry.bonus?.[prog.bonus.id] === 'ja') score += 1;

	const harNogetSvar =
		visteVaner.some((c) => entry.checks?.[c.id]) ||
		(prog.bonus && entry.bonus?.[prog.bonus.id]);
	if (!harNogetSvar) return 'tom';

	const procent = (score / total) * 100;
	if (procent >= 75) return 'gron';
	if (procent >= 50) return 'orange';
	return 'rod';
}

/**
 * Beregner et "flower-niveau" for en dag baseret på hvor mange vaner der er
 * besvaret med ja/delvist. Bruges til farve-kodning af dagscirklen i grid.
 *
 * Delvist tæller som 0.5 ja. Bonus tæller IKKE her — kun de faste checks.
 *
 *   100%   → excellent
 *   76-99% → good
 *   51-75% → medium
 *   26-50% → low
 *   1-25%  → poor
 *   0%     → none (eller hvis dagen ingen checks har)
 *
 * Baseline: excellent hvis baseline-kommentar (generelTekst) er skrevet,
 * ellers none. Tidligere brugte vi de 5 slider-svar, men de er flyttet
 * over i symptomtjek-modulet pr 7/6 2026.
 */
export function beregnFlowerNiveau(
	prog: VaneProgramDag,
	entry: VanedagEntry | null
): FlowerNiveau {
	const e = entry ?? { checks: {}, bonus: {}, checkin: {}, note: '', dagNummer: prog.dagNummer };

	if (prog.isBaseline) {
		const generelTekst = (e.checkin?.generelTekst ?? '').trim();
		return generelTekst.length > 0 ? 'excellent' : 'none';
	}

	if (prog.checks.length === 0) return 'none';

	const samletScore = prog.checks.reduce((sum, c) => {
		const v = e.checks?.[c.id];
		return sum + (v === 'ja' ? 1 : v === 'delvist' ? 0.5 : 0);
	}, 0);
	const procent = (samletScore / prog.checks.length) * 100;

	if (procent >= 100) return 'excellent';
	if (procent >= 76) return 'good';
	if (procent >= 51) return 'medium';
	if (procent >= 26) return 'low';
	if (procent > 0) return 'poor';
	return 'none';
}

/**
 * Statistik over en specifik vane på tværs af alle besvarede dage.
 * Returnerer score 0-100 hvor delvist tæller som 0.5.
 *
 * Kun dage hvor brugeren har svaret tæller med — ikke-besvarede dage
 * udelades så scoren afspejler "hvad har hun gjort på de dage hun har svaret".
 */
export function vaneStatistik(
	vaneId: string,
	prog: VaneProgramDag[],
	entries: Map<number, VanedagEntry>
): { antal: number; score: number } {
	const dageMedDenneVane = prog.filter((d) => d.checks.some((c) => c.id === vaneId));
	let svarSum = 0;
	let antal = 0;
	for (const dag of dageMedDenneVane) {
		const entry = entries.get(dag.dagNummer);
		const v = entry?.checks?.[vaneId];
		if (!v) continue;
		antal++;
		svarSum += v === 'ja' ? 1 : v === 'delvist' ? 0.5 : 0;
	}
	if (antal === 0) return { antal: 0, score: 0 };
	return { antal, score: Math.round((svarSum / antal) * 100) };
}

/**
 * Beregner samlet fremgang i programmet — antal dage med status='completed'
 * af unlocked dage. Baseline tælles ikke med (det er en ekstra dag).
 */
export function beregnSamletFremgang(
	prog: VaneProgramDag[],
	entries: Map<number, VanedagEntry>,
	unlockedTilDagN: number
): { gennemforte: number; iAlt: number } {
	const dageIScope = prog.filter(
		(d) => !d.isBaseline && d.dagNummer >= 1 && d.dagNummer <= unlockedTilDagN
	);
	let gennemforte = 0;
	for (const dag of dageIScope) {
		const status = beregnDagsStatus(dag, entries.get(dag.dagNummer) ?? null);
		if (status === 'completed') gennemforte++;
	}
	return { gennemforte, iAlt: dageIScope.length };
}
