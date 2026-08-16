import { describe, it, expect } from 'vitest';
import {
	beskedAdgang3,
	beskedFaner3,
	visFaneraekke3,
	startFane3,
	nyesteUlaesteSvar3,
	harNytSvar3,
	kanSendeVidere3,
	erSendtVidere3,
	samtaleErFuld3,
	fortsaetSamtale3,
	dagLabel3,
	grupperEfterDag3,
	MAX_BESKEDER_I_SAMTALE_3,
	type BeskedAdgang3,
	type SvarKilde3,
	type SamtaleKilde3,
	type SamtaleBesked3
} from './beskedside3';

const BEGGE: BeskedAdgang3 = { ai: true, linn: true };
const KUN_AI: BeskedAdgang3 = { ai: true, linn: false };
const INGEN: BeskedAdgang3 = { ai: false, linn: false };

describe('beskedAdgang3', () => {
	it('giver Linn AI til alle, ogsaa et medlem uden forloeb', () => {
		expect(beskedAdgang3(false).ai).toBe(true);
		expect(beskedAdgang3(true).ai).toBe(true);
	});

	it('lader kun en forloebskunde sende videre til Linn', () => {
		expect(beskedAdgang3(true).linn).toBe(true);
		expect(beskedAdgang3(false).linn).toBe(false);
	});

	// Reglen maa ALDRIG afhaenge af det delte adgangs-skema, for det styrer
	// ogsaa den gamle app. Linns besked 16. august.
	it('afhaenger kun af om hun har et aktivt forloeb', () => {
		expect(beskedAdgang3(true)).toEqual({ ai: true, linn: true });
		expect(beskedAdgang3(false)).toEqual({ ai: true, linn: false });
	});
});

describe('beskedFaner3', () => {
	it('giver begge faner naar hun har begge dele', () => {
		expect(beskedFaner3(BEGGE)).toEqual(['ai', 'linn']);
	});

	it('giver kun Linn AI til et medlem', () => {
		expect(beskedFaner3(KUN_AI)).toEqual(['ai']);
	});

	it('giver ingen faner naar hun ikke har adgang til noget', () => {
		expect(beskedFaner3(INGEN)).toEqual([]);
	});

	it('Linn AI staar altid foerst', () => {
		expect(beskedFaner3(BEGGE)[0]).toBe('ai');
	});

	// Kan ske hvis Linn slukker Linn AI for en kundetype men lader
	// skriv-til-Linn staa. Saa skal fanen Linn stadig virke.
	it('giver fanen Linn alene hvis kun den er taendt', () => {
		expect(beskedFaner3({ ai: false, linn: true })).toEqual(['linn']);
	});
});

describe('visFaneraekke3', () => {
	it('tegner raekken naar der er to faner', () => {
		expect(visFaneraekke3(['ai', 'linn'])).toBe(true);
	});

	it('én fane er ingen fane', () => {
		expect(visFaneraekke3(['ai'])).toBe(false);
	});

	it('ingen faner giver ingen raekke', () => {
		expect(visFaneraekke3([])).toBe(false);
	});
});

describe('startFane3', () => {
	it('aabner paa Linn AI som standard, ogsaa naar hun har begge', () => {
		expect(startFane3(['ai', 'linn'])).toBe('ai');
	});

	it('respekterer et eksplicit oenske om fanen Linn', () => {
		expect(startFane3(['ai', 'linn'], 'linn')).toBe('linn');
	});

	it('ignorerer et oenske hun ikke har adgang til', () => {
		expect(startFane3(['ai'], 'linn')).toBe('ai');
	});

	it('ignorerer noget der slet ikke er en fane', () => {
		expect(startFane3(['ai', 'linn'], 'vroevl')).toBe('ai');
	});

	it('giver null naar hun ingen faner har', () => {
		expect(startFane3([], 'linn')).toBeNull();
	});
});

describe('nyesteUlaesteSvar3 og harNytSvar3', () => {
	const traade: SvarKilde3[] = [
		{ id: 'a', spoergsmaal: 'Foerste', svar: 'Svar A', besvaretMs: 1000 },
		{ id: 'b', spoergsmaal: 'Anden', svar: 'Svar B', besvaretMs: 3000 },
		{ id: 'c', spoergsmaal: 'Uden svar endnu' }
	];

	it('finder det nyeste svar hun ikke har set', () => {
		expect(nyesteUlaesteSvar3(traade, 0)?.id).toBe('b');
	});

	it('ser bort fra svar hun allerede har laest', () => {
		expect(nyesteUlaesteSvar3(traade, 2000)?.id).toBe('b');
		expect(nyesteUlaesteSvar3(traade, 3000)).toBeNull();
	});

	it('taeller ikke et spoergsmaal uden svar', () => {
		expect(nyesteUlaesteSvar3([{ id: 'c', spoergsmaal: 'Venter' }], 0)).toBeNull();
	});

	// Et svar uden tidsstempel kan ikke sammenlignes, og saa maa prikken
	// hellere mangle end lyse for evigt.
	it('taeller ikke et svar uden tidspunkt', () => {
		expect(nyesteUlaesteSvar3([{ id: 'd', spoergsmaal: 'Q', svar: 'S' }], 0)).toBeNull();
	});

	it('harNytSvar3 svarer paa det samme', () => {
		expect(harNytSvar3(traade, 0)).toBe(true);
		expect(harNytSvar3(traade, 5000)).toBe(false);
	});
});

describe('kanSendeVidere3', () => {
	it('lader en forloebskunde sende et AI-svar videre', () => {
		expect(kanSendeVidere3(BEGGE, true, false)).toBe(true);
	});

	it('lader aldrig et medlem sende videre', () => {
		expect(kanSendeVidere3(KUN_AI, true, false)).toBe(false);
	});

	it('kan ikke sende hendes egen besked videre, kun AI-svaret', () => {
		expect(kanSendeVidere3(BEGGE, false, false)).toBe(false);
	});

	it('kan ikke sende det samme svar to gange', () => {
		expect(kanSendeVidere3(BEGGE, true, true)).toBe(false);
	});
});

describe('erSendtVidere3', () => {
	const sendte = ['Jeg sover dårligt for tiden'];

	it('genkender et spoergsmaal hun allerede har sendt', () => {
		expect(erSendtVidere3('Jeg sover dårligt for tiden', sendte)).toBe(true);
	});

	it('lader sig ikke snyde af store bogstaver og ekstra mellemrum', () => {
		expect(erSendtVidere3('  jeg sover   DÅRLIGT for tiden ', sendte)).toBe(true);
	});

	it('siger nej til et andet spoergsmaal', () => {
		expect(erSendtVidere3('Hvad spiser jeg til morgen?', sendte)).toBe(false);
	});

	it('siger nej naar hun ikke har sendt noget endnu', () => {
		expect(erSendtVidere3('Hvad som helst', [])).toBe(false);
	});
});

describe('samtaleErFuld3 og fortsaetSamtale3', () => {
	it('er ikke fuld foer graensen', () => {
		expect(samtaleErFuld3(MAX_BESKEDER_I_SAMTALE_3 - 1)).toBe(false);
	});

	it('er fuld paa graensen', () => {
		expect(samtaleErFuld3(MAX_BESKEDER_I_SAMTALE_3)).toBe(true);
	});

	it('vaelger den nyeste samtale der ikke er fuld', () => {
		const samtaler: SamtaleKilde3[] = [
			{ id: 'gammel', antalBeskeder: 10, opdateretMs: 100 },
			{ id: 'ny', antalBeskeder: 4, opdateretMs: 900 }
		];
		expect(fortsaetSamtale3(samtaler)?.id).toBe('ny');
	});

	it('springer den fulde over og tager den naestnyeste', () => {
		const samtaler: SamtaleKilde3[] = [
			{ id: 'fuld', antalBeskeder: MAX_BESKEDER_I_SAMTALE_3, opdateretMs: 900 },
			{ id: 'plads', antalBeskeder: 3, opdateretMs: 100 }
		];
		expect(fortsaetSamtale3(samtaler)?.id).toBe('plads');
	});

	it('giver null naar der ingen samtaler er, saa kalderen opretter en', () => {
		expect(fortsaetSamtale3([])).toBeNull();
	});

	it('giver null naar alle er fulde', () => {
		expect(
			fortsaetSamtale3([{ id: 'f', antalBeskeder: 500, opdateretMs: 1 }])
		).toBeNull();
	});
});

describe('dagLabel3', () => {
	const NU = new Date(2026, 7, 16, 14, 0).getTime();

	it('skriver I dag med ord', () => {
		expect(dagLabel3(new Date(2026, 7, 16, 7, 30).getTime(), NU)).toBe('I dag');
	});

	it('skriver I går med ord', () => {
		expect(dagLabel3(new Date(2026, 7, 15, 23, 50).getTime(), NU)).toBe('I går');
	});

	it('skriver dato for aeldre dage i samme aar', () => {
		expect(dagLabel3(new Date(2026, 7, 3, 9, 0).getTime(), NU)).toBe('3. august');
	});

	it('tager aarstallet med naar det er et andet aar', () => {
		expect(dagLabel3(new Date(2025, 11, 24, 9, 0).getTime(), NU)).toBe('24. december 2025');
	});

	// En besked skrevet klokken 23.59 og en klokken 00.01 er to dage, ogsaa
	// selv om der kun er to minutter imellem.
	it('sammenligner paa dato og ikke paa timer', () => {
		const iGaarSent = new Date(2026, 7, 15, 23, 59).getTime();
		const iDagTidligt = new Date(2026, 7, 16, 0, 1).getTime();
		expect(dagLabel3(iGaarSent, NU)).toBe('I går');
		expect(dagLabel3(iDagTidligt, NU)).toBe('I dag');
	});
});

describe('grupperEfterDag3', () => {
	const NU = new Date(2026, 7, 16, 14, 0).getTime();
	const iGaar = new Date(2026, 7, 15, 10, 0).getTime();
	const iDag = new Date(2026, 7, 16, 10, 0).getTime();

	const beskeder: SamtaleBesked3[] = [
		{ rolle: 'user', indhold: 'Q1', ms: iGaar },
		{ rolle: 'assistant', indhold: 'S1', ms: iGaar },
		{ rolle: 'user', indhold: 'Q2', ms: iDag },
		{ rolle: 'assistant', indhold: 'S2', ms: iDag }
	];

	it('samler beskeder fra samme dag', () => {
		const dage = grupperEfterDag3(beskeder, NU);
		expect(dage).toHaveLength(2);
		expect(dage[0].label).toBe('I går');
		expect(dage[0].beskeder).toHaveLength(2);
		expect(dage[1].label).toBe('I dag');
	});

	it('bevarer raekkefoelgen, aeldst foerst', () => {
		const dage = grupperEfterDag3(beskeder, NU);
		expect(dage[1].beskeder.map((b) => b.indhold)).toEqual(['Q2', 'S2']);
	});

	it('giver en tom liste for en tom samtale', () => {
		expect(grupperEfterDag3([], NU)).toEqual([]);
	});
});
