import { describe, expect, it } from 'vitest';
import {
	KARANTAENE_MS3,
	dagNoti3,
	maaSende3,
	savnNoti3,
	svarNoti3,
	uddrag3,
	udenforKarantaene3,
	vaelgKanal3,
	type NotiRegler3
} from './notifikation3';

describe('maaSende3', () => {
	it('alt er til naar ingen har taget stilling', () => {
		expect(maaSende3('svar', null, null, null)).toBe(true);
		expect(maaSende3('savn', {}, {}, 'hold')).toBe(true);
	});

	it('KUNDEN VINDER ALTID naar hun har slaaet fra', () => {
		const r: NotiRegler3 = { medlemmer: { savn: true }, forlob: { hold: { savn: true } } };
		expect(maaSende3('savn', r, { savn: false }, 'hold')).toBe(false);
	});

	it('men kunden kan ikke slaa noget TIL som Linn har lukket', () => {
		const r: NotiRegler3 = { forlob: { hold: { savn: false } } };
		expect(maaSende3('savn', r, { savn: true }, 'hold')).toBe(false);
	});

	it('forloebet vinder over medlems-linjen', () => {
		const r: NotiRegler3 = { medlemmer: { dag: true }, forlob: { hold: { dag: false } } };
		expect(maaSende3('dag', r, null, 'hold')).toBe(false);
		expect(maaSende3('dag', r, null, 'andet_hold')).toBe(true);
	});

	it('en kunde uden forloeb foelger medlems-linjen', () => {
		const r: NotiRegler3 = { medlemmer: { savn: false } };
		expect(maaSende3('savn', r, null, null)).toBe(false);
		expect(maaSende3('svar', r, null, null)).toBe(true);
	});

	it('de tre slags afgoeres hver for sig', () => {
		const r: NotiRegler3 = { forlob: { hold: { savn: false } } };
		expect(maaSende3('svar', r, null, 'hold')).toBe(true);
	});
});

describe('udenforKarantaene3', () => {
	const nu = 1_700_000_000_000;

	it('foerste gang maa altid sendes', () => {
		expect(udenforKarantaene3('svar', null, nu)).toBe(true);
		expect(udenforKarantaene3('dag', undefined, nu)).toBe(true);
	});

	it('to svar lige efter hinanden bliver til ét', () => {
		expect(udenforKarantaene3('svar', nu - 10 * 60 * 1000, nu)).toBe(false);
	});

	it('men næste dag maa der godt komme et nyt', () => {
		expect(udenforKarantaene3('svar', nu - 25 * 60 * 60 * 1000, nu)).toBe(true);
	});

	it('dagen-er-klar kommer hoejst én gang i doegnet', () => {
		expect(udenforKarantaene3('dag', nu - 12 * 60 * 60 * 1000, nu)).toBe(false);
		expect(udenforKarantaene3('dag', nu - 21 * 60 * 60 * 1000, nu)).toBe(true);
	});

	it('savn er den mest taalmodige af dem alle', () => {
		expect(KARANTAENE_MS3.savn).toBeGreaterThan(KARANTAENE_MS3.dag);
		expect(udenforKarantaene3('savn', nu - 6 * 24 * 60 * 60 * 1000, nu)).toBe(false);
		expect(udenforKarantaene3('savn', nu - 8 * 24 * 60 * 60 * 1000, nu)).toBe(true);
	});
});

describe('uddrag3', () => {
	it('et kort svar staar helt', () => {
		expect(uddrag3('Det er helt normalt.')).toBe('Det er helt normalt.');
	});

	it('et langt svar klippes ved et helt ord', () => {
		const langt =
			'Det er helt normalt de første uger, og det plejer at gå over af sig selv når kroppen vænner sig til det.';
		const u = uddrag3(langt);
		expect(u.endsWith('…')).toBe(true);
		expect(u.length).toBeLessThanOrEqual(82);
		expect(u).not.toContain('  ');
		// Ingen halve ord foer prikkerne.
		expect(langt.startsWith(u.slice(0, -1))).toBe(true);
	});

	it('linjeskift og dobbelte mellemrum bliver til ét', () => {
		expect(uddrag3('Hej\n\n  Linn')).toBe('Hej Linn');
	});
});

describe('teksterne', () => {
	it('svaret peger paa Beskeder og viser LINNS ord', () => {
		const n = svarNoti3('Prøv at spise lidt mere protein til morgenmad');
		expect(n.titel).toBe('Linn har svaret dig');
		expect(n.tekst).toContain('protein');
		expect(n.sti).toBe('/ny/beskeder');
	});

	it('dagen naevner hvad der venter', () => {
		expect(dagNoti3(12, 2, true).tekst).toBe('2 lektioner og din træning venter');
		expect(dagNoti3(3, 1, false).tekst).toBe('1 lektion venter');
		expect(dagNoti3(3, 0, false).tekst).toContain('noget nyt');
		expect(dagNoti3(12, 2, true).titel).toBe('Dag 12 er klar');
	});

	it('savn bruger Linns egne ord naar hun har skrevet nogen', () => {
		expect(savnNoti3(4, 'Jeg tænkte på dig').tekst).toBe('Jeg tænkte på dig');
		expect(savnNoti3(4, '   ').tekst).toContain('4 dage');
	});
});

describe('vaelgKanal3', () => {
	it('telefonen vinder naar hun kan naas der', () => {
		expect(vaelgKanal3(true, true)).toBe('telefon');
	});

	it('mail er reserven', () => {
		expect(vaelgKanal3(false, true)).toBe('mail');
	});

	it('kan hun ikke naas, sender vi ingenting', () => {
		expect(vaelgKanal3(false, false)).toBe('ingen');
	});
});
