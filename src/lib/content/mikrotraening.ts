// Mikrotræning — typer og hjælpe-funktioner
// Datamodellen består af fire lag:
//   1. exercises          — øvelsesbiblioteket (alle øvelser)
//   2. trainingPrograms   — sekvenser af træningsdage
//   3. products           — købbare produkter (Kickstart, Træningsmodul m.fl.)
//   4. users/{uid}/...    — brugerens fremgang og delvise pauser

import type { Timestamp } from 'firebase/firestore';

// ==============================================
// LAG 1 — Øvelsesbiblioteket
// ==============================================

export type Treaningsform = 'mikrotraening' | 'yoga' | 'styrke' | 'mobilitet';

export type ExerciseCategory = 'ben' | 'overkrop' | 'core' | 'stabilitet';

export type Udstyr = 'ingen' | 'kettlebell' | 'elastik' | 'haandvaegte' | 'forhojning';

export interface Exercise {
	id: string;
	name: string;
	desc: string;
	how: string[];
	cat: ExerciseCategory;
	catLabel: string;
	tags: string[];
	videoPath: string;
	treaningsformer: Treaningsform[];
	udstyr: Udstyr[];
	aktiv: boolean;
}

// ==============================================
// LAG 2 — Træningsprogrammer
// ==============================================

export type Niveau = 'begynder' | 'let_oevet' | 'oevet';

export interface TrainingProgram {
	id: string;
	navn: string;
	beskrivelse: string;
	treaningsform: Treaningsform;
	antalDage: number;
	dagligTid: number;
	niveau: Niveau;
	udstyr: Udstyr[];
	aktiv: boolean;
}

export interface DayExercise {
	exerciseId: string;
	sets: number;
	workSec: number;
	restSec: number;
	bonus: boolean;
}

export interface TrainingDay {
	dagNummer: number;
	titel: string;
	indledning: string;
	exercises: DayExercise[];
}

// ==============================================
// LAG 3 — Produkter
// ==============================================

export type ProductType = 'forlob' | 'modul' | 'single';

export type ContentItemType = 'trainingProgram' | 'kostElement' | 'vanetracker' | 'lekion';

export interface ContentItem {
	type: ContentItemType;
	ref: string;
	alias: string;
}

export interface Product {
	id: string;
	navn: string;
	beskrivelse: string;
	pris: number;
	type: ProductType;
	varighed: number | null;
	indhold: ContentItem[];
	aktiv: boolean;
}

// ==============================================
// LAG 4 — Brugerens data
// ==============================================

export type Feedback = 'let' | 'tilpas' | 'udfordrende';

export interface UserProduct {
	productId: string;
	koebt: Timestamp;
	startDato: Timestamp;
	udloberDato: Timestamp | null;
	programValg: Record<string, string>;
	fremgang: Record<string, MikrotraeningFremgang | unknown>;
	/**
	 * Nul-dage = dage kunden skubber forloebet uden aktivitet (ferie/syg).
	 * Hvert interval er én transaktion — bruges til fortryd-tjek (kun samme
	 * dag som satMs kan fortrydes). Pulje er MAX_NUL_DAGE_PR_FORLOB (21) pr
	 * forloeb og gaelder kun Kropsro indtil videre.
	 */
	nulDage?: {
		intervaller: { fra: string; til: string; satMs: number }[];
	};
	/**
	 * Per-kunde bonus oven paa MAX_NUL_DAGE_PR_FORLOB. Tildeles manuelt af
	 * admin naar en kunde objektivt er kommet for sent i gang (fx Charlotte
	 * 6/6 2026 fik 14 ekstra saa hendes effektive pulje blev 35). Brug
	 * effektivMaxNulDage()-helperen til at laese den effektive maks.
	 */
	bonusNulDage?: number;
	/**
	 * Egne vaner klienten selv har valgt at f0lge oveni Linn's tildelte.
	 * Max 3 ad gangen. Kan tilfoejes og slettes frit. Bruges af Kropsro-
	 * forloebskunder; abonnenter har deres egne via aboVaneOpsaetning.
	 */
	egneVaner?: { id: string; label: string; oprettetAt: number }[];
}

// Nul-dage-pulje pr forloebstype. Kropsro er et laengere forloeb (84 dage) og
// faar 21; Kickstart er kortere og faar 14. MAX_NUL_DAGE_PR_FORLOB beholdes som
// bagudkompat-alias for Kropsro-puljen.
export const MAX_NUL_DAGE_KROPSRO = 21;
export const MAX_NUL_DAGE_KICKSTART = 14;
export const MAX_NUL_DAGE_PR_FORLOB = MAX_NUL_DAGE_KROPSRO;
export const MAX_EGNE_VANER = 3;

/**
 * Standard nul-dage-pulje for et forloeb. Byggede forloeb saetter et eksplicit
 * tal (pulje) ved oprettelse — bruges hvis angivet. Ellers afgoeres puljen af
 * forloebs-id-prefixet: 'kropsro_' -> 21, alt andet (Kickstart) -> 14. Bonus
 * laegges ovenpaa. (Kickstart/Kropsro saetter ikke pulje og er dermed uaendret.)
 */
export function maxNulDageForForlob(
	forlobId: string | null | undefined,
	pulje?: number | null
): number {
	if (typeof pulje === 'number' && pulje >= 0) return pulje;
	return forlobId?.startsWith('kropsro_') ? MAX_NUL_DAGE_KROPSRO : MAX_NUL_DAGE_KICKSTART;
}

/**
 * Effektiv max nul-dage for en kunde — forloebs-puljen plus eventuel
 * admin-tildelt bonus paa userProducts. Brug ALTID denne i stedet for at
 * laese pulje-konstanterne direkte, saa bonus-overrides respekteres.
 */
export function effektivMaxNulDage(
	userProduct: UserProduct | null | undefined,
	forlobId: string | null | undefined,
	pulje?: number | null
): number {
	const bonus = Math.max(0, userProduct?.bonusNulDage ?? 0);
	return maxNulDageForForlob(forlobId, pulje) + bonus;
}

export interface MikrotraeningFremgang {
	gennemforte: number[];
	feedback: Record<string, Feedback>;
}

export interface PauseDoc {
	productId: string;
	elementAlias: string;
	programId: string;
	dag: number;
	currentEx: number;
	currentSet: number;
	phase: 'prep' | 'work' | 'rest' | 'switch';
	rem: number;
	savedAt: Timestamp;
}

// ==============================================
// Hjælpe-funktioner
// ==============================================

/**
 * Genererer et tomt skelet af træningsdage for et nyt program.
 * Hver dag får dagNummer 1..antal og tomt exercises-array — Linn
 * fylder dem ud via admin-UI'et bagefter.
 */
export function tommeDageSkelet(antal: number): TrainingDay[] {
	return Array.from({ length: antal }, (_, i) => ({
		dagNummer: i + 1,
		titel: '',
		indledning: '',
		exercises: []
	}));
}

/**
 * Beregner total tid for en træningsdag i sekunder.
 * Inkluderer alle øvelser, alle sæt, og hvile mellem sæt.
 * Tæller IKKE prep-tid før første øvelse eller switch-tid mellem øvelser.
 */
export function beregnDagensTid(day: TrainingDay): number {
	return day.exercises.reduce((total, ex) => {
		const arbejdsTid = ex.sets * ex.workSec;
		const hvileTid = (ex.sets - 1) * ex.restSec;
		return total + arbejdsTid + hvileTid;
	}, 0);
}

/**
 * Tæller hvor mange normale (ikke-bonus) øvelser en dag har.
 * Bruges til at afgøre hvor mange øvelser der skal laves for at gennemføre dagen.
 */
export function antalNormaleOvelser(day: TrainingDay): number {
	return day.exercises.filter((ex) => !ex.bonus).length;
}

/**
 * Tjekker om en bruger har gennemført en specifik dag.
 */
export function harGennemfortDag(fremgang: MikrotraeningFremgang, dag: number): boolean {
	return fremgang.gennemforte.includes(dag);
}

/**
 * Beregner procentvis fremgang i et program (0-100).
 */
export function beregnProgramFremgang(fremgang: MikrotraeningFremgang, antalDage: number): number {
	if (antalDage <= 0) return 0;
	const gennemforte = fremgang.gennemforte.length;
	return Math.round((gennemforte / antalDage) * 100);
}

/**
 * Finder næste dag brugeren skal lave.
 * Returnerer den laveste dag der ikke er gennemført, eller null hvis alle er færdige.
 */
export function naesteDag(fremgang: MikrotraeningFremgang, antalDage: number): number | null {
	for (let dag = 1; dag <= antalDage; dag++) {
		if (!fremgang.gennemforte.includes(dag)) {
			return dag;
		}
	}
	return null;
}

/**
 * Filtrerer øvelser så kun dem der passer til programmets udstyr beholdes.
 * Hvis programmet bruger kettlebell, er alle øvelser tilladt.
 * Hvis programmet er uden kettlebell, fjernes alle øvelser der kræver kettlebell.
 */
export function filtrerOvelserTilProgram(
	exercises: Exercise[],
	programUdstyr: Udstyr[]
): Exercise[] {
	if (programUdstyr.includes('kettlebell')) {
		return exercises;
	}
	return exercises.filter((e) => !e.udstyr.includes('kettlebell'));
}

/**
 * Markerer en dag som gennemført i fremgang-objektet.
 * Idempotent: tilføjer kun dagen hvis den ikke allerede står i listen.
 * Holder gennemforte sorteret stigende så UI'et viser rigtig rækkefølge.
 */
export function markerDagSomGennemfort(
	fremgang: MikrotraeningFremgang,
	dag: number
): MikrotraeningFremgang {
	if (fremgang.gennemforte.includes(dag)) return fremgang;
	return {
		...fremgang,
		gennemforte: [...fremgang.gennemforte, dag].sort((a, b) => a - b)
	};
}

/**
 * Registrerer feedback for en specifik dag.
 * Overskriver eksisterende feedback hvis brugeren ændrer mening.
 */
export function registrerFeedback(
	fremgang: MikrotraeningFremgang,
	dag: number,
	feedback: Feedback
): MikrotraeningFremgang {
	return {
		...fremgang,
		feedback: { ...fremgang.feedback, [dag]: feedback }
	};
}

/**
 * Genererer et standardprogram med 1 ben-, 1 overkrop- og 1 core/stabilitet-øvelse pr dag.
 * Cycler deterministisk gennem øvelserne så hver bliver brugt så jævnt som muligt.
 * Default: 3 sæt × 30s arbejde × 10s hvile, ingen bonus.
 */
export function genererStandardProgram(antalDage: number, exercises: Exercise[]): TrainingDay[] {
	return genererProgramMedConfig(antalDage, exercises, {
		antalOvelser: 3,
		sets: 3,
		workSec: 30,
		restSec: 10
	});
}

export interface GenererConfig {
	/** Antal øvelser pr dag (mindst 1, anbefalet 3-5). */
	antalOvelser: number;
	/** Antal sæt pr øvelse. */
	sets: number;
	/** Arbejdstid i sekunder pr sæt. */
	workSec: number;
	/** Hviletid i sekunder mellem sæt. */
	restSec: number;
}

/**
 * Variant af genererStandardProgram der lader admin præ-konfigurere
 * antal øvelser, sæt, arbejdstid og hviletid før auto-gen.
 *
 * Kategorier vælges deterministisk fra puljerne i rækkefølgen:
 * ben, overkrop, core/stabilitet, og derefter cykles videre. Hvis admin
 * vælger flere end 3 øvelser pr dag, får hver dag en anden kombination
 * fra sammenflettede kategorier.
 */
export function genererProgramMedConfig(
	antalDage: number,
	exercises: Exercise[],
	config: GenererConfig,
	opts: { markSidsteSomBonus?: boolean } = {}
): TrainingDay[] {
	const ben = exercises.filter((e) => e.cat === 'ben').map((e) => e.id);
	const overkrop = exercises.filter((e) => e.cat === 'overkrop').map((e) => e.id);
	const coreStab = exercises
		.filter((e) => e.cat === 'core' || e.cat === 'stabilitet')
		.map((e) => e.id);

	if (ben.length === 0 || overkrop.length === 0 || coreStab.length === 0) {
		throw new Error('Mangler øvelser i en eller flere kategorier — kan ikke generere program.');
	}
	if (config.antalOvelser < 1) {
		throw new Error('Antal øvelser skal være mindst 1.');
	}

	// Cykler ben → overkrop → core/stab → ben → ... så fordelingen er jævn
	const kategorier = [ben, overkrop, coreStab];
	const markSidste = opts.markSidsteSomBonus === true;
	const sidsteIdx = config.antalOvelser - 1;

	return Array.from({ length: antalDage }, (_, i) => ({
		dagNummer: i + 1,
		titel: '',
		indledning: '',
		exercises: Array.from({ length: config.antalOvelser }, (_, j) => {
			const kat = kategorier[j % kategorier.length];
			// Forskyd index pr dag så samme dag ikke får samme øvelse hver runde
			const idx = (i + Math.floor(j / kategorier.length)) % kat.length;
			return {
				exerciseId: kat[idx],
				sets: config.sets,
				workSec: config.workSec,
				restSec: config.restSec,
				bonus: markSidste && j === sidsteIdx
			};
		})
	}));
}
