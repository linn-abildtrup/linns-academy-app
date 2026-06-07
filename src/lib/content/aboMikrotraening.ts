// Abo-mikrotræning — typer og pure-funktioner.
//
// Modsat forløbs-mikrotræningen (under forlob/{forlobId}/...) er abo-versionen
// et fast 21-dages program der LOOPER: efter dag 21 starter brugeren forfra
// på dag 1.
//
// Pr 7/6 2026: kalender-baseret rotation. Hver kunde har en aboStartDato
// (dagen hun foerste gang aabnede abo-mikrotraening). Aktuel dag i programmet
// = (dage siden aboStartDato % antalDage) + 1. Hver kalenderdato har sin
// egen oevelse uanset om kunden har trenet i gaar. Det matcher forloebs-
// modulets adfaerd og er det kunderne forventer.
//
// Tidligere brugte vi gennemfoersels-baseret rotation
// (totalGennemforte % antalDage + 1) — den gamle aktuelAboDag findes
// stadig som fallback for brugere uden aboStartDato sat.

import type { Timestamp } from 'firebase/firestore';
import type { Feedback, TrainingDay, TrainingProgram } from './mikrotraening';

/**
 * Default antal dage hvis caller ikke kender programmets faktiske længde
 * (fx forsidens preload før programmet er hentet). Alle aktive abo-programmer
 * pr 7/6 2026 er 21 dage — det gamle 14-dages basis-program er kun fallback.
 *
 * Sørg ALTID for at sende program.antalDage ind i aktuelAboDag/genemfoerAboDag
 * når programmet er kendt. Default'en bruges kun som sikkerhedsnet.
 */
export const ABO_MIKROTRAENING_DAGE = 21;

/** Brugerens fremgang i abo-mikrotræning. Single doc pr bruger. */
export interface AboMikrotraeningFremgang {
	totalGennemforte: number;
	feedback: Record<string, Feedback>;
	opdateretAt?: Timestamp;
	/** YYYY-MM-DD. Dagen kunden foerste gang aabnede abo-mikrotraening.
	 *  Bruges som anker til kalender-baseret rotation. Hvis null/undefined
	 *  falder vi tilbage til gennemfoersels-baseret rotation. */
	aboStartDato?: string;
}

/**
 * Logger en gennemført træning bundet til en specifik dato.
 * Bruges til 'Tidligere træninger'-historikken så brugeren kan scrolle
 * tilbage og se hvad hun trænede på en bestemt dag.
 */
export interface AboMikrotraeningTraening {
	dato: string; // YYYY-MM-DD
	programDag: number; // 1-14
	runde: number; // 1, 2, 3, ...
	feedback?: Feedback;
	savedAt?: Timestamp;
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
 * LEGACY (gennemfoersels-baseret). Bevarer som fallback for brugere uden
 * aboStartDato. Nye callers boer bruge aktuelAboDagForDato.
 */
export function aktuelAboDag(
	fremgang: AboMikrotraeningFremgang | null,
	antalDage: number = ABO_MIKROTRAENING_DAGE
): number {
	if (!fremgang || fremgang.totalGennemforte === 0) return 1;
	return (fremgang.totalGennemforte % antalDage) + 1;
}

/**
 * Beregner antal kalenderdage mellem to ISO-datoer (YYYY-MM-DD). Positiv
 * hvis 'til' er senere end 'fra'. UTC-baseret for at undgaa DST-fejl.
 */
export function dageMellem(fra: string, til: string): number {
	const a = Date.UTC(
		Number(fra.slice(0, 4)),
		Number(fra.slice(5, 7)) - 1,
		Number(fra.slice(8, 10))
	);
	const b = Date.UTC(
		Number(til.slice(0, 4)),
		Number(til.slice(5, 7)) - 1,
		Number(til.slice(8, 10))
	);
	return Math.floor((b - a) / (24 * 60 * 60 * 1000));
}

/**
 * Beregner hvilken dag i programmet (1..antalDage) en given kalenderdato
 * peger paa. Kalender-baseret: dag = (dage_siden_aboStartDato % antalDage) + 1.
 *
 * Hvis fremgang ikke har aboStartDato sat (gamle kunder, eller foer auto-set
 * naar at koere), falder vi tilbage til den legacy gennemfoersels-baserede
 * aktuelAboDag — saa kunden ikke pludselig hopper.
 *
 * Datoer foer aboStartDato cykler baglaens — diff=-1 giver dag 21, diff=-2
 * giver dag 20 osv. Det er matematisk konsistent med fremad-rotationen og
 * lader kunden bladre tilbage uden at se en flad "dag 1"-vaeg.
 */
export function aktuelAboDagForDato(
	fremgang: AboMikrotraeningFremgang | null,
	dato: string,
	antalDage: number = ABO_MIKROTRAENING_DAGE
): number {
	if (!fremgang?.aboStartDato) return aktuelAboDag(fremgang, antalDage);
	const diff = dageMellem(fremgang.aboStartDato, dato);
	// JS-modulo bevarer fortegn (-1 % 21 = -1), saa vi adderer antalDage
	// foer endelig modulo for at faa positiv rest.
	return (((diff % antalDage) + antalDage) % antalDage) + 1;
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
 *
 * I kalender-mode (fremgang har aboStartDato) er totalGennemforte bare en
 * raa taeller af antal traeninger — vi inkrementerer altid med 1 uanset
 * hvilken dag-nummer kunden traener. Daglig rotation bestemmes af kalenderen,
 * ikke af denne taeller.
 *
 * I legacy gennemfoersels-mode (ingen aboStartDato) kan kunden kun
 * gennemfoere den aktuelle dag (totalGennemforte % antalDage + 1). Ellers
 * ignoreres kaldet for at undgaa at tableten hopper ud af cyklus.
 */
export function genemfoerAboDag(
	fremgang: AboMikrotraeningFremgang | null,
	dagNummer: number,
	antalDage: number = ABO_MIKROTRAENING_DAGE
): number {
	const nuvaerende = fremgang?.totalGennemforte ?? 0;
	if (fremgang?.aboStartDato) return nuvaerende + 1;
	const aktuelDag = (nuvaerende % antalDage) + 1;
	if (dagNummer !== aktuelDag) return nuvaerende;
	return nuvaerende + 1;
}
