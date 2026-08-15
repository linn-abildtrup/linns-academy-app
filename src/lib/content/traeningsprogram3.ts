// Traeningsprogrammer i 3.0. Bid 1 af traeningsmodulet, 15. august 2026.
//
// HVORFOR ET NYT STED
// Programmerne ligger i dag tre steder: forlob/{id}/mikrotraeningProgrammer,
// aboMikrotraening/{premium|basis} og trainingPrograms. Linn skal have ÉT
// sted at bygge dem, og de skal vaere uafhaengige af om kunden er paa
// forloeb eller abonnement. Alt nyt ligger derfor i traeningsprogrammer3,
// som kun 3.0 laeser. Den gamle app ser ingenting, og de 760 kunder i drift
// maerker ingenting.
//
// DAGENE GENBRUGER DEN GAMLE FORM
// En dag er stadig TrainingDay med DayExercise, altsaa exerciseId, sets,
// workSec, restSec og bonus. Det er med vilje. Saa kan de seks programmer
// der koerer i dag kopieres over uden at blive skrevet om, udkast-
// generatoren fra den gamle app kan bruges som den er, og afspilleren i
// bid 4 kan bygges paa den samme form.
//
// KLADDE OG KLAR
// Et program er kladde indtil Linn selv saetter det til klar. Kun et klart
// program kan tildeles. Uden den spaerre kan et halvbygget 84-dages program
// lande hos et helt hold, og det opdager man foerst naar en kunde staar med
// en tom dag.

import { beregnDagensTid, type DayExercise, type TrainingDay } from './mikrotraening';

export interface Traeningsprogram3 {
	id: string;
	navn: string;
	beskrivelse: string;
	/** Doc-id paa kategorien i traeningKategorier3. */
	kategoriId: string;
	antalDage: number;
	/** Starter forfra paa dag 1 naar sidste dag er klaret. */
	starterForfra: boolean;
	/** Falsk = kladde. Kun et klart program kan tildeles en kunde. */
	klar: boolean;
	/**
	 * Hvor mange dage der mangler oevelser. Staar paa selve programmet, saa
	 * listen kan advare uden at hente 84 dage for hvert eneste program.
	 * Skrives hver gang dagene gemmes, se firestore/traeningsprogram3.
	 */
	tommeDage?: number;
	oprettetAt: number;
	opdateretAt: number;
}

export const MAX_PROGRAM_NAVN = 60;
export const MAX_DAGE = 365;

/** Standardvaerdier for en oevelse der laegges paa en dag. Samme som den
 *  gamle generators default, saa et haandlavet program ligner et udkast. */
export const STANDARD_OEVELSE3: Omit<DayExercise, 'exerciseId'> = {
	sets: 3,
	workSec: 30,
	restSec: 10,
	bonus: false
};

/** En tom dag med det angivne nummer. */
export function tomDag3(dagNummer: number): TrainingDay {
	return { dagNummer, titel: '', indledning: '', exercises: [] };
}

/**
 * Validerer det Linn taster naar hun opretter eller retter et program.
 * Returnerer en besked hun kan laese, eller null hvis alt er i orden.
 */
export function validerProgram3(felter: {
	navn: string;
	kategoriId: string;
	antalDage: number;
}): string | null {
	const navn = felter.navn.trim();
	if (!navn) return 'Programmet skal have et navn.';
	if (navn.length > MAX_PROGRAM_NAVN) {
		return `Navnet må højst være ${MAX_PROGRAM_NAVN} tegn.`;
	}
	if (!felter.kategoriId) return 'Vælg en kategori.';
	if (!Number.isInteger(felter.antalDage) || felter.antalDage < 1) {
		return 'Antal dage skal være mindst 1.';
	}
	if (felter.antalDage > MAX_DAGE) return `Antal dage må højst være ${MAX_DAGE}.`;
	return null;
}

/** Validerer sæt, arbejdstid og pause paa én oevelse. */
export function validerOevelse3(o: Pick<DayExercise, 'sets' | 'workSec' | 'restSec'>): string | null {
	if (!Number.isInteger(o.sets) || o.sets < 1 || o.sets > 20) {
		return 'Antal sæt skal være mellem 1 og 20.';
	}
	if (!Number.isInteger(o.workSec) || o.workSec < 5 || o.workSec > 600) {
		return 'Arbejdstid skal være mellem 5 og 600 sekunder.';
	}
	if (!Number.isInteger(o.restSec) || o.restSec < 0 || o.restSec > 600) {
		return 'Pause skal være mellem 0 og 600 sekunder.';
	}
	return null;
}

/**
 * Retter dage-listen til naar Linn aendrer antal dage.
 *
 * Dage hun allerede har fyldt ud bliver staaende paa deres eget nummer.
 * Saetter hun tallet op, kommer de nye tomme. Saetter hun det ned,
 * forsvinder de sidste. Det sidste er med vilje: alternativet er at gemme
 * usynlige dage der pludselig dukker op igen, og det er vaerre.
 */
export function justerAntalDage(dage: TrainingDay[], antal: number): TrainingDay[] {
	const efterNummer = new Map(dage.map((d) => [d.dagNummer, d]));
	return Array.from({ length: Math.max(0, antal) }, (_, i) => {
		const nr = i + 1;
		const fundet = efterNummer.get(nr);
		return fundet ? { ...fundet, dagNummer: nr } : tomDag3(nr);
	});
}

/** En dag uden oevelser. Kunden ville se en tom skaerm. */
export function dagErTom(dag: TrainingDay): boolean {
	return dag.exercises.length === 0;
}

export function antalTommeDage(dage: TrainingDay[]): number {
	return dage.filter(dagErTom).length;
}

/** Anslaaet tid for én dag i hele minutter. Tom dag giver 0. */
export function dagensMinutter(dag: TrainingDay): number {
	if (dagErTom(dag)) return 0;
	return Math.max(1, Math.round(beregnDagensTid(dag) / 60));
}

/**
 * Linjen der advarer om huller i programmet. Returnerer null naar der
 * ingen huller er, saa kaldstedet kan lade vaere med at vise noget.
 */
export function manglerTekstFor(tomme: number, antalDage: number): string | null {
	if (tomme <= 0) return null;
	if (tomme >= antalDage) {
		return antalDage === 1
			? 'Træningen mangler øvelser'
			: `Alle ${antalDage} træninger mangler øvelser`;
	}
	return tomme === 1 ? '1 træning mangler øvelser' : `${tomme} træninger mangler øvelser`;
}

export function manglerTekst(dage: TrainingDay[]): string | null {
	return manglerTekstFor(antalTommeDage(dage), dage.length);
}

/**
 * Hvor mange tomme dage listen skal regne med. Staar tallet ikke paa
 * programmet, gaar vi ud fra at ALLE dage er tomme. Det er det pessimistiske
 * gaet med vilje: en manglende advarsel er vaerre end en overfloedig, fordi
 * den kan sende et halvbygget program ud til et hold.
 */
export function tommeDageFor(program: Traeningsprogram3): number {
	return typeof program.tommeDage === 'number' ? program.tommeDage : program.antalDage;
}

/** Alfabetisk paa dansk, saa "Kickstart 21 dage" i to udgaver staar sammen. */
export function sorterProgrammer3(programmer: Traeningsprogram3[]): Traeningsprogram3[] {
	return [...programmer].sort((a, b) => a.navn.localeCompare(b.navn, 'da'));
}

/** kategoriId null betyder alle. */
export function filtrerProgrammer3(
	programmer: Traeningsprogram3[],
	kategoriId: string | null
): Traeningsprogram3[] {
	if (!kategoriId) return programmer;
	return programmer.filter((p) => p.kategoriId === kategoriId);
}

/** Tallet paa hver kategori-chip. */
export function antalPrKategori(programmer: Traeningsprogram3[]): Record<string, number> {
	const tal: Record<string, number> = {};
	for (const p of programmer) {
		tal[p.kategoriId] = (tal[p.kategoriId] ?? 0) + 1;
	}
	return tal;
}

/**
 * Flytter et element én plads op eller ned. Bruges baade til oevelserne
 * paa en dag og til kategoriernes raekkefoelge.
 *
 * Traek og slip blev fravalgt: paa en telefon er det upraecist, og der er
 * sjaeldent mere end fem oevelser paa en dag. To pile rammer hver gang.
 */
export function flytIListe<T>(liste: T[], index: number, retning: 'op' | 'ned'): T[] {
	const til = retning === 'op' ? index - 1 : index + 1;
	if (index < 0 || index >= liste.length || til < 0 || til >= liste.length) {
		return liste;
	}
	const ny = [...liste];
	[ny[index], ny[til]] = [ny[til], ny[index]];
	return ny;
}

/**
 * Laegger et automatisk udkast oveni de dage der allerede findes.
 *
 * kunTomme er standarden og den sikre: dage Linn selv har fyldt ud bliver
 * staaende, og kun hullerne bliver fyldt. Uden den kunne et tryk paa
 * knappen kaste en hel aftens arbejde vaek.
 *
 * Titel og indledning er altid hendes, og de overlever begge veje.
 * Generatoren skriver dem alligevel ikke.
 */
export function fletUdkast(
	eksisterende: TrainingDay[],
	udkast: TrainingDay[],
	kunTomme: boolean
): TrainingDay[] {
	const udkastEfterNummer = new Map(udkast.map((d) => [d.dagNummer, d]));
	return eksisterende.map((dag) => {
		const nyt = udkastEfterNummer.get(dag.dagNummer);
		if (!nyt) return dag;
		if (kunTomme && !dagErTom(dag)) return dag;
		return { ...dag, exercises: nyt.exercises };
	});
}
