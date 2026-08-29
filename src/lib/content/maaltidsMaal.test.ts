import { describe, it, expect } from 'vitest';
import {
	antalMaaltiderIFokus,
	fokusForklaring,
	fokusLinje,
	maalForDagen,
	skalerMaal
} from './maaltidsMaal';
import type { MaaltidsFokusPeriode } from './maaltidsFokus';
import { STANDARD_DAGLIGE_MAL } from './naering';

// Kickstart: tre uger der bygger op ét maaltid ad gangen.
const KICKSTART: MaaltidsFokusPeriode[] = [
	{ fraDag: 0, tilDag: 7, maaltider: ['morgenmad', 'snack'] },
	{ fraDag: 8, tilDag: 14, maaltider: ['morgenmad', 'frokost', 'snack'] },
	{ fraDag: 15, tilDag: 21, maaltider: ['morgenmad', 'frokost', 'aftensmad', 'snack'] }
];

describe('antalMaaltiderIFokus', () => {
	it('taeller kun hovedmaaltider, ikke snack', () => {
		// Snack skal taelle op i maalet, men ikke haeve det. Ellers ville uge 1
		// blive 60 g i stedet for 30.
		expect(antalMaaltiderIFokus(['morgenmad', 'snack'])).toBe(1);
		expect(antalMaaltiderIFokus(['morgenmad', 'frokost', 'snack'])).toBe(2);
	});

	it('ingen begraensning betyder hele dagen', () => {
		expect(antalMaaltiderIFokus(null)).toBe(3);
	});

	it('en periode med kun snack falder tilbage paa hele dagen', () => {
		// Ellers ville maalet blive nul, og hun havde naaet det foer hun begyndte.
		expect(antalMaaltiderIFokus(['snack'])).toBe(3);
	});
});

describe('skalerMaal', () => {
	it('deler med tre hovedmaaltider', () => {
		const en = skalerMaal(STANDARD_DAGLIGE_MAL, 1);
		expect(en.protein).toBe(30);
		expect(en.fiber).toBe(10);
	});

	it('to maaltider giver to tredjedele', () => {
		const to = skalerMaal(STANDARD_DAGLIGE_MAL, 2);
		expect(to.protein).toBe(60);
		expect(to.fiber).toBe(20);
	});

	it('tre maaltider roerer ikke tallene', () => {
		expect(skalerMaal(STANDARD_DAGLIGE_MAL, 3)).toEqual(STANDARD_DAGLIGE_MAL);
	});

	it('runder til hele gram', () => {
		// Kunden skal ikke moede 33,3.
		const eget = { ...STANDARD_DAGLIGE_MAL, protein: 100 };
		expect(skalerMaal(eget, 1).protein).toBe(33);
		expect(skalerMaal(eget, 2).protein).toBe(67);
	});
});

describe('maalForDagen paa Kickstart', () => {
	it('uge 1 er 30 g protein og 10 g fiber', () => {
		const m = maalForDagen(undefined, KICKSTART, 3);
		expect(m.maal.protein).toBe(30);
		expect(m.maal.fiber).toBe(10);
		expect(m.skaleret).toBe(true);
	});

	it('uge 2 er 60 og 20', () => {
		const m = maalForDagen(undefined, KICKSTART, 10);
		expect(m.maal.protein).toBe(60);
		expect(m.maal.fiber).toBe(20);
	});

	it('uge 3 rammer hendes normale maal af sig selv', () => {
		const m = maalForDagen(undefined, KICKSTART, 18);
		expect(m.maal.protein).toBe(90);
		expect(m.maal.fiber).toBe(30);
		expect(m.skaleret).toBe(false);
	});

	it('foelger hendes eget maal, ikke et tal vi har skrevet ind', () => {
		// Har hun sat protein til 105 paa profilen, skal uge 1 vaere 35.
		const eget = { ...STANDARD_DAGLIGE_MAL, protein: 105 };
		expect(maalForDagen(eget, KICKSTART, 3).maal.protein).toBe(35);
		expect(maalForDagen(eget, KICKSTART, 10).maal.protein).toBe(70);
		expect(maalForDagen(eget, KICKSTART, 18).maal.protein).toBe(105);
	});

	it('hendes egne maal staar uroert ved siden af', () => {
		const m = maalForDagen(undefined, KICKSTART, 3);
		expect(m.fuldeMaal.protein).toBe(90);
	});
});

describe('forloeb uden fokus-perioder er uaendrede', () => {
	it('hun maales paa hele dagen som hidtil', () => {
		const m = maalForDagen(undefined, null, 3);
		expect(m.maal).toEqual(STANDARD_DAGLIGE_MAL);
		expect(m.skaleret).toBe(false);
	});

	it('og en abonnent uden forloebsdag ogsaa', () => {
		const m = maalForDagen(undefined, KICKSTART, null);
		expect(m.maal.protein).toBe(90);
		expect(m.skaleret).toBe(false);
	});
});

describe('teksterne kunden ser', () => {
	it('forsiden siger hvad ugen taeller', () => {
		expect(fokusLinje(maalForDagen(undefined, KICKSTART, 3))).toBe('Denne uge tæller morgenmaden');
		expect(fokusLinje(maalForDagen(undefined, KICKSTART, 10))).toBe(
			'Denne uge tæller morgenmaden og frokosten'
		);
	});

	it('ingen linje naar maalet ikke er skaleret', () => {
		expect(fokusLinje(maalForDagen(undefined, KICKSTART, 18))).toBeNull();
		expect(fokusLinje(maalForDagen(undefined, null, 3))).toBeNull();
	});

	it('dagbogen forklarer tallene, saa banner og tal ikke siger hver sit', () => {
		const t = fokusForklaring(maalForDagen(undefined, KICKSTART, 3)) ?? '';
		expect(t).toContain('30 g protein');
		expect(t).toContain('10 g fiber');
	});
});
