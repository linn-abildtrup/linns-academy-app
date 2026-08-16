import { describe, it, expect } from 'vitest';
import { byggBeskeder, formaterUgedagDato, type BeskedGrundlag } from './beskeder3';

const FORNY = 'https://linn.example/forny';

function grundlag(delvis: Partial<BeskedGrundlag> = {}): BeskedGrundlag {
	return { nyestSvar: null, udloeb: null, fornyUrl: FORNY, ...delvis };
}

const SVAR = { id: 'q1', spoergsmaal: 'Er jeg for traet?', svar: '  Ja, det er normalt.  ' };

describe('byggBeskeder', () => {
	it('giver en tom liste naar der ikke er noget', () => {
		expect(byggBeskeder(grundlag())).toEqual([]);
	});

	it('viser svaret fra Linn med selve teksten, ikke spoergsmaalet', () => {
		const [b] = byggBeskeder(grundlag({ nyestSvar: SVAR }));
		expect(b.slags).toBe('svar');
		expect(b.titel).toBe('Nyt svar fra Linn');
		expect(b.uddrag).toBe('Ja, det er normalt.');
		expect(b.href).toBe('/ny/beskeder?fane=linn');
		expect(b.ekstern).toBe(false);
	});

	it('viser udloeb med dato og peger paa forny-linket', () => {
		const slutterAt = new Date(2026, 7, 12).getTime();
		const [b] = byggBeskeder(grundlag({ udloeb: { dageTilbage: 6, slutterAt } }));
		expect(b.titel).toBe('Din adgang udløber om 6 dage');
		expect(b.uddrag).toContain('12. august');
		expect(b.href).toBe(FORNY);
		expect(b.ekstern).toBe(true);
	});

	it('boejer dagene rigtigt', () => {
		const slutterAt = Date.UTC(2026, 7, 12);
		const titel = (d: number) => byggBeskeder(grundlag({ udloeb: { dageTilbage: d, slutterAt } }))[0].titel;
		expect(titel(0)).toBe('Din adgang udløber i dag');
		expect(titel(1)).toBe('Din adgang udløber i morgen');
		expect(titel(2)).toBe('Din adgang udløber om 2 dage');
	});

	it('saetter svaret oeverst naar der er god tid til udloebet', () => {
		const liste = byggBeskeder(
			grundlag({ nyestSvar: SVAR, udloeb: { dageTilbage: 10, slutterAt: Date.UTC(2026, 7, 12) } })
		);
		expect(liste.map((b) => b.slags)).toEqual(['svar', 'udloeb']);
	});

	it('saetter udloebet oeverst naar der er tre dage eller mindre', () => {
		const liste = byggBeskeder(
			grundlag({ nyestSvar: SVAR, udloeb: { dageTilbage: 3, slutterAt: Date.UTC(2026, 7, 12) } })
		);
		expect(liste.map((b) => b.slags)).toEqual(['udloeb', 'svar']);
	});

	it('giver hver besked sin egen noegle', () => {
		const liste = byggBeskeder(
			grundlag({ nyestSvar: SVAR, udloeb: { dageTilbage: 9, slutterAt: Date.UTC(2026, 7, 12) } })
		);
		expect(new Set(liste.map((b) => b.id)).size).toBe(2);
	});
});

describe('formaterUgedagDato', () => {
	it('skriver ugedag og dato paa dansk', () => {
		expect(formaterUgedagDato(new Date(2026, 7, 12).getTime())).toBe('onsdag den 12. august');
	});
});
