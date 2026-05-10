// Abo-mikrotræning — typer og pure-funktioner.
//
// Modsat forløbs-mikrotræningen (under forlob/{forlobId}/...) er abo-versionen
// et fast 14-dages program der LOOPER: efter dag 14 starter brugeren forfra
// på dag 1. Brugerens fremgang spores som totalGennemforte (cumulativ),
// og aktuel dag i programmet udregnes som (totalGennemforte % 14) + 1.

import type { Timestamp } from 'firebase/firestore';
import type { Feedback, TrainingDay, TrainingProgram } from './mikrotraening';

export const ABO_MIKROTRAENING_DAGE = 14;

/** Brugerens fremgang i abo-mikrotræning. Single doc pr bruger. */
export interface AboMikrotraeningFremgang {
	totalGennemforte: number;
	feedback: Record<string, Feedback>;
	opdateretAt?: Timestamp;
}

/**
 * Programmets øverste doc — TrainingProgram udvidet med en valgfri
 * genererConfig så admin kan huske sine præ-indstillinger til næste auto-gen.
 */
export interface AboMikrotraeningProgram extends TrainingProgram {
	genererConfig?: {
		antalOvelser: number;
		sets: number;
		workSec: number;
		restSec: number;
	};
}

/** Programmets dage — genbruger TrainingDay-typen fra forløbs-modellen. */
export type AboMikrotraeningDag = TrainingDay;

/**
 * Beregner hvilken dag i programmet (1-14) brugeren skal lave næst.
 * Hvis fremgang er null returnerer vi dag 1.
 */
export function aktuelAboDag(
	fremgang: AboMikrotraeningFremgang | null,
	antalDage: number = ABO_MIKROTRAENING_DAGE
): number {
	if (!fremgang || fremgang.totalGennemforte === 0) return 1;
	return (fremgang.totalGennemforte % antalDage) + 1;
}

/**
 * Returnerer hvor mange runder brugeren har gennemført + er i gang med.
 * Runde 1 = totalGennemforte 0-13. Runde 2 = 14-27. Osv.
 */
export function aboRundeNummer(
	fremgang: AboMikrotraeningFremgang | null,
	antalDage: number = ABO_MIKROTRAENING_DAGE
): number {
	if (!fremgang) return 1;
	return Math.floor(fremgang.totalGennemforte / antalDage) + 1;
}

/**
 * Returnerer true hvis dagen er klaret i den AKTUELLE runde.
 * Bruges til at vise grøn checkmark i grid-visningen.
 */
export function harKlaretAboDagIRunde(
	fremgang: AboMikrotraeningFremgang | null,
	dagNummer: number,
	antalDage: number = ABO_MIKROTRAENING_DAGE
): boolean {
	if (!fremgang) return false;
	const dagIRunde = (fremgang.totalGennemforte % antalDage) + 1;
	// Dagen er klaret hvis dens nummer er mindre end aktuel-dag (i denne runde).
	// Hvis vi lige har afsluttet en runde (totalGennemforte er multiplum af 14),
	// er ingen dage klaret i den nye runde.
	if (fremgang.totalGennemforte > 0 && fremgang.totalGennemforte % antalDage === 0) {
		return false;
	}
	return dagNummer < dagIRunde;
}

/**
 * Returnerer den nye totalGennemforte efter at brugeren har gennemført dagen.
 * Bruges af gem-handlere i klient-UI'et. Idempotent: hvis brugeren prøver
 * at markere samme dag igen i samme runde, øges count ikke.
 */
export function genemfoerAboDag(
	fremgang: AboMikrotraeningFremgang | null,
	dagNummer: number,
	antalDage: number = ABO_MIKROTRAENING_DAGE
): number {
	const nuvaerende = fremgang?.totalGennemforte ?? 0;
	const aktuelDag = (nuvaerende % antalDage) + 1;
	// Brugeren skal være på den dag hun forsøger at gennemføre
	if (dagNummer !== aktuelDag) return nuvaerende;
	return nuvaerende + 1;
}
