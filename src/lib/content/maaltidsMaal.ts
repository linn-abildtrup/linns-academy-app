// ============================================================
// Naerings-maal der foelger ugens fokus.
//
// Kickstart bygger op i tre uger: uge 1 kun morgenmad, uge 2 morgenmad
// og frokost, uge 3 alle tre. Foer denne fil blev kunden maalt paa hele
// dagens 90 g protein fra dag ét, ogsaa i den uge hvor hun kun maatte
// registrere morgenmad. Soejlen kunne dermed aldrig fyldes, og en god
// foerste uge saa ud som et nederlag.
//
// REGNESTYKKET: maalet er hendes eget daglige maal delt med de tre
// hovedmaaltider, gange antallet af hovedmaaltider i fokus. Derfor
// rammer uge 3 hendes normale maal helt af sig selv, og en kunde der
// har sat sit eget protein til 105 faar 35 i uge 1 i stedet for et tal
// vi har skrevet ind. Se STANDARD_DAGLIGE_MAL i naering.ts.
//
// SNACK: taeller op i maalet, men haever det ikke. Linns valg 29.
// august. Ellers ville uge 1 blive 60 g i stedet for 30, og hele
// pointen med at oeve ét maaltid ad gangen forsvandt.
//
// REGLEN ÉT STED: forsiden, dagbogen, udviklingen og madplan-forslagene
// spoerger alle her. Gjorde de ikke det, ville de vise hver sit maal for
// den samme dag.
// ============================================================

import type { Maaltidstype } from './kost';
import type { DagligeMaal } from '$lib/types';
import { dagligeMalForBruger } from './naering';
import { tilladteMaaltiderForDag, type MaaltidsFokusPeriode } from './maaltidsFokus';

/**
 * De maaltider konceptet regner i. Snack staar med vilje udenfor: den
 * maa gerne spises og taelles med i det hun har naaet, men den er ikke
 * et af de maaltider hun oever sig paa, og den skal derfor ikke haeve
 * maalet.
 */
export const HOVEDMAALTIDER: Maaltidstype[] = ['morgenmad', 'frokost', 'aftensmad'];

/** Antal hovedmaaltider. Divisoren i regnestykket. */
export const ANTAL_HOVEDMAALTIDER = HOVEDMAALTIDER.length;

/**
 * Hvor mange hovedmaaltider er i fokus. Null (ingen fokus-periode)
 * betyder hele dagen, altsaa alle tre.
 */
export function antalMaaltiderIFokus(tilladte: Maaltidstype[] | null): number {
	if (!tilladte) return ANTAL_HOVEDMAALTIDER;
	const hoved = tilladte.filter((m) => HOVEDMAALTIDER.includes(m));
	// En periode der KUN indeholder snack ville ellers give maalet nul, og
	// saa stod kunden med et maal hun havde naaet foer hun begyndte.
	return hoved.length > 0 ? hoved.length : ANTAL_HOVEDMAALTIDER;
}

/**
 * Skalerer et helt dags-maal ned til det antal maaltider der er i fokus.
 * Rundes til hele gram, saa kunden ikke moeder 33,3.
 */
export function skalerMaal(dagsMaal: DagligeMaal, antalMaaltider: number): DagligeMaal {
	const faktor = antalMaaltider / ANTAL_HOVEDMAALTIDER;
	if (faktor >= 1) return { ...dagsMaal };
	return {
		protein: Math.round(dagsMaal.protein * faktor),
		fiber: Math.round(dagsMaal.fiber * faktor),
		kh: Math.round(dagsMaal.kh * faktor),
		fedt: Math.round(dagsMaal.fedt * faktor),
		kcal: Math.round(dagsMaal.kcal * faktor)
	};
}

export interface MaalForDagen {
	/** Maalene hun skal maales paa i dag. */
	maal: DagligeMaal;
	/** Hendes egne dags-maal, uskaleret. Til tekster som "af dagens 90 g". */
	fuldeMaal: DagligeMaal;
	/** Er maalet skaleret ned lige nu. */
	skaleret: boolean;
	/** Hovedmaaltiderne i fokus, i raekkefoelge. Tom = ingen begraensning. */
	maaltiderIFokus: Maaltidstype[];
}

/**
 * Dagens maal for en kunde paa et forloeb.
 *
 * `perioder` er forlob.maaltidsFokus og `forlobsDag` den dag hun staar
 * paa. Er der ingen periode for dagen, faar hun sine egne dags-maal
 * uaendret, praecis som hidtil.
 */
export function maalForDagen(
	egneMaal: DagligeMaal | undefined,
	perioder: MaaltidsFokusPeriode[] | null | undefined,
	forlobsDag: number | null | undefined
): MaalForDagen {
	const fulde = dagligeMalForBruger(egneMaal);
	if (typeof forlobsDag !== 'number') {
		return { maal: fulde, fuldeMaal: fulde, skaleret: false, maaltiderIFokus: [] };
	}
	const tilladte = tilladteMaaltiderForDag(perioder, forlobsDag);
	const antal = antalMaaltiderIFokus(tilladte);
	const skaleret = antal < ANTAL_HOVEDMAALTIDER;
	return {
		maal: skaleret ? skalerMaal(fulde, antal) : fulde,
		fuldeMaal: fulde,
		skaleret,
		maaltiderIFokus: tilladte ? tilladte.filter((m) => HOVEDMAALTIDER.includes(m)) : []
	};
}

const MAALTID_ORD: Record<Maaltidstype, string> = {
	morgenmad: 'morgenmaden',
	frokost: 'frokosten',
	aftensmad: 'aftensmaden',
	snack: 'snacken'
};

/**
 * Den korte linje paa forsiden, fx "Denne uge taeller morgenmaden".
 * Null naar maalet ikke er skaleret, saa forsiden ser ud som foer.
 */
export function fokusLinje(m: MaalForDagen): string | null {
	if (!m.skaleret || m.maaltiderIFokus.length === 0) return null;
	const ord = m.maaltiderIFokus.map((t) => MAALTID_ORD[t]);
	if (ord.length === 1) return `Denne uge tæller ${ord[0]}`;
	const sidste = ord.pop();
	return `Denne uge tæller ${ord.join(', ')} og ${sidste}`;
}

/**
 * Den laengere forklaring i dagbogen, saa banneret og tallene ikke
 * siger hver sit. Null naar maalet ikke er skaleret.
 */
export function fokusForklaring(m: MaalForDagen): string | null {
	if (!m.skaleret) return null;
	return `Dit mål følger med, så det er ${m.maal.protein} g protein og ${m.maal.fiber} g fiber i denne uge.`;
}
