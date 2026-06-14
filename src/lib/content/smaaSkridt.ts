// Samlet "Små skridt"-model (admin). Et lille skridt er en vane med en tidsplan
// for HVILKE dage i forløbet det gælder. Tanken er at samle de tidligere
// "faste vaner" (pr dag) og uge-baserede små skridt til ét begreb med fleksibel
// tidsplan.
//
// ETAPE 1 = kun admin-modellen + overblik. Synk til det kunde-læste dag-system
// (vaneprogram.checks) kommer i en senere etape, så kundernes data og svar ikke
// røres endnu.

import type { Timestamp } from 'firebase/firestore';

/** Tidsplan for hvornår et lille skridt gælder. */
export type SmaaSkridtPlan =
	| { type: 'alle' }
	| { type: 'uger'; uger: number[] }
	| { type: 'interval'; fra: number; til: number | null } // til = null → til forløbets slut
	| { type: 'ugedage'; ugedage: number[] } // 1=mandag ... 7=søndag
	| { type: 'dage'; dage: number[] }; // bestemte enkelte dagnumre

export interface SmaaSkridt {
	id: string;
	// Stabilt id der bruges som nøgle i vaneprogram.checks OG i kundens svar.
	// Bevares uændret ved redigering, så svar ikke knækker. Ved import af
	// eksisterende faste vaner sættes checkId = den oprindelige vane-id.
	checkId: string;
	label: string;
	plan: SmaaSkridtPlan;
	oprettetAf?: string;
	oprettetAt?: Timestamp;
}

/** Ugedag for en dato: 1=mandag ... 7=søndag. */
export function ugedagFor(dato: Date): number {
	return ((dato.getDay() + 6) % 7) + 1;
}

export const UGEDAGS_NAVNE = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];

/**
 * Udregner de konkrete dag-numre (1..antalDage) som et skridt gælder for.
 * startDato = forløbets dag 0 (baseline). Dag N = startDato + N kalenderdage.
 */
export function dageForPlan(plan: SmaaSkridtPlan, antalDage: number, startDato: Date): number[] {
	const dage: number[] = [];
	for (let d = 1; d <= antalDage; d++) {
		let med = false;
		if (plan.type === 'alle') {
			med = true;
		} else if (plan.type === 'uger') {
			med = plan.uger.includes(Math.ceil(d / 7));
		} else if (plan.type === 'interval') {
			const til = plan.til ?? antalDage;
			med = d >= plan.fra && d <= til;
		} else if (plan.type === 'ugedage') {
			const dato = new Date(startDato);
			dato.setDate(dato.getDate() + d);
			med = plan.ugedage.includes(ugedagFor(dato));
		} else if (plan.type === 'dage') {
			med = plan.dage.includes(d);
		}
		if (med) dage.push(d);
	}
	return dage;
}

/** Kort menneskelig beskrivelse af en tidsplan (til listen). */
export function planTekst(plan: SmaaSkridtPlan): string {
	if (plan.type === 'alle') return 'Alle dage';
	if (plan.type === 'uger')
		return plan.uger.length
			? `Uge ${[...plan.uger].sort((a, b) => a - b).join(', ')}`
			: 'Ingen uger valgt';
	if (plan.type === 'interval')
		return plan.til == null ? `Fra dag ${plan.fra} og frem` : `Dag ${plan.fra}–${plan.til}`;
	if (plan.type === 'ugedage')
		return plan.ugedage.length
			? [...plan.ugedage]
					.sort((a, b) => a - b)
					.map((u) => UGEDAGS_NAVNE[u - 1])
					.join(', ')
			: 'Ingen ugedage valgt';
	if (plan.type === 'dage')
		return plan.dage.length
			? `Dag ${[...plan.dage].sort((a, b) => a - b).join(', ')}`
			: 'Ingen dage valgt';
	return '';
}
