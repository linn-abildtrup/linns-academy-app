import { describe, it, expect } from 'vitest';
import {
	punkter,
	linje,
	retning,
	udviklingTekst,
	yAkse,
	RAMME_TOTAL,
	RAMME_SLIDER
} from './mrsGraf3';

const M = (t: number, v: number) => ({ t, v });

describe('punkter', () => {
	it('saetter aeldste maaling til venstre uanset raekkefoelgen ind', () => {
		const p = punkter([M(300, 10), M(100, 30), M(200, 20)], RAMME_TOTAL);
		expect(p.map((x) => x.v)).toEqual([30, 20, 10]);
		expect(p[0].x).toBeLessThan(p[2].x);
	});

	it('LAEGGER ET LAVT MRS-TAL HOEJT PAA SKAERMEN, fordi lavt er bedst', () => {
		const p = punkter([M(1, 0), M(2, 44)], RAMME_TOTAL);
		// 0 er bunden af skalaen og tegnes nederst, 44 oeverst.
		expect(p[0].y).toBeGreaterThan(p[1].y);
	});

	it('holder sig inden for rammen', () => {
		for (const p of punkter([M(1, 0), M(2, 44)], RAMME_TOTAL)) {
			expect(p.y).toBeGreaterThanOrEqual(RAMME_TOTAL.kant);
			expect(p.y).toBeLessThanOrEqual(RAMME_TOTAL.hoejde - RAMME_TOTAL.kant);
			expect(p.x).toBeGreaterThanOrEqual(RAMME_TOTAL.kant);
			expect(p.x).toBeLessThanOrEqual(RAMME_TOTAL.bredde - RAMME_TOTAL.kant);
		}
	});

	it('SAETTER ÉN MAALING I MIDTEN. En prik yderst ligner en halv kurve', () => {
		const p = punkter([M(1, 20)], RAMME_TOTAL);
		expect(p[0].x).toBe(RAMME_TOTAL.bredde / 2);
	});

	it('klarer at der ikke er nogen maalinger', () => {
		expect(punkter([], RAMME_TOTAL)).toEqual([]);
	});

	it('klemmer en vaerdi uden for skalaen ind i stedet for at tegne udenfor', () => {
		const p = punkter([M(1, 99)], RAMME_SLIDER);
		expect(p[0].y).toBe(RAMME_SLIDER.kant);
	});

	it('fordeler jaevnt, ikke efter hvor lang tid der gik imellem', () => {
		// To maalinger taet paa hinanden og én lang tid efter skal staa
		// med samme afstand. Ellers bliver en pause til en bred maaling.
		const p = punkter([M(0, 10), M(1, 10), M(100000, 10)], RAMME_TOTAL);
		expect(p[1].x - p[0].x).toBeCloseTo(p[2].x - p[1].x);
	});
});

describe('linje', () => {
	it('tegner ingen linje ved én maaling', () => {
		expect(linje(punkter([M(1, 10)], RAMME_TOTAL))).toBe('');
	});

	it('starter med et flyt og fortsaetter med streger', () => {
		const d = linje(punkter([M(1, 10), M(2, 20), M(3, 30)], RAMME_TOTAL));
		expect(d.startsWith('M ')).toBe(true);
		expect(d.split('L')).toHaveLength(3);
	});
});

describe('retning', () => {
	it('MRS: et faldende tal er bedre', () => {
		expect(retning([M(1, 20), M(2, 12)], true)).toBe('bedre');
		expect(retning([M(1, 12), M(2, 20)], true)).toBe('daarligere');
	});

	it('SLIDERE VENDER MODSAT: et stigende tal er bedre', () => {
		expect(retning([M(1, 4), M(2, 8)], false)).toBe('bedre');
		expect(retning([M(1, 8), M(2, 4)], false)).toBe('daarligere');
	});

	it('siger ens naar tallet ikke har flyttet sig', () => {
		expect(retning([M(1, 10), M(2, 10)], true)).toBe('ens');
	});

	it('siger fra naar der kun er én maaling', () => {
		expect(retning([M(1, 10)], true)).toBe('for-faa');
		expect(retning([], true)).toBe('for-faa');
	});

	it('sammenligner foerste og sidste, ikke to tilfaeldige', () => {
		expect(retning([M(1, 20), M(2, 40), M(3, 10)], true)).toBe('bedre');
	});
});

describe('udviklingTekst', () => {
	it('BEBREJDER IKKE naar det er gaaet den forkerte vej', () => {
		const t = udviklingTekst([M(1, 10), M(2, 22)], true, 'Hendes tal');
		expect(t).toContain('hårdere periode');
		expect(t).toContain('siger ikke noget om hvor godt hun gør det');
	});

	it('siger hvor hun kom fra og hvor hun er', () => {
		expect(udviklingTekst([M(1, 22), M(2, 10)], true, 'Hendes tal')).toContain('fra 22 til 10');
	});

	it('siger til naar der ikke er nok at se paa', () => {
		expect(udviklingTekst([M(1, 10)], true, 'Hendes tal')).toContain('to målinger');
	});

	it('siger det samme naar tallet ikke har flyttet sig', () => {
		expect(udviklingTekst([M(1, 10), M(2, 10)], true, 'Hendes tal')).toContain('det samme');
	});
});

describe('yAkse', () => {
	it('giver skalaen med det hoejeste tal foerst', () => {
		expect(yAkse(RAMME_TOTAL, 5)).toEqual([44, 33, 22, 11, 0]);
		expect(yAkse(RAMME_SLIDER, 3)).toEqual([10, 6, 1]);
	});
});
