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
	const ben = exercises.filter((e) => e.cat === 'ben').map((e) => e.id);
	const overkrop = exercises.filter((e) => e.cat === 'overkrop').map((e) => e.id);
	const coreStab = exercises
		.filter((e) => e.cat === 'core' || e.cat === 'stabilitet')
		.map((e) => e.id);

	if (ben.length === 0 || overkrop.length === 0 || coreStab.length === 0) {
		throw new Error('Mangler øvelser i en eller flere kategorier — kan ikke generere program.');
	}

	return Array.from({ length: antalDage }, (_, i) => ({
		dagNummer: i + 1,
		titel: '',
		indledning: '',
		exercises: [
			{
				exerciseId: ben[i % ben.length],
				sets: 3,
				workSec: 30,
				restSec: 10,
				bonus: false
			},
			{
				exerciseId: overkrop[i % overkrop.length],
				sets: 3,
				workSec: 30,
				restSec: 10,
				bonus: false
			},
			{
				exerciseId: coreStab[i % coreStab.length],
				sets: 3,
				workSec: 30,
				restSec: 10,
				bonus: false
			}
		]
	}));
}
