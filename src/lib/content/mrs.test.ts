import { describe, it, expect } from 'vitest';
import {
	calculateSubscales,
	calculateTotal,
	getInterpretation,
	MRS_ITEMS,
	SUBSCALES,
	validerScores
} from './mrs';

const alleNul: Record<number, number> = Object.fromEntries(
	MRS_ITEMS.map((i) => [i.id, 0])
);
const maxScores: Record<number, number> = Object.fromEntries(
	MRS_ITEMS.map((i) => [i.id, 4])
);

describe('MRS_ITEMS', () => {
	it('har præcis 11 spørgsmål', () => {
		expect(MRS_ITEMS).toHaveLength(11);
	});

	it('har id 1-11 i rækkefølge', () => {
		const ids = MRS_ITEMS.map((i) => i.id);
		expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
	});

	it('dækker alle 11 spørgsmål via subskalaerne', () => {
		const subskalaIds = [
			...SUBSCALES.somatisk.items,
			...SUBSCALES.psykologisk.items,
			...SUBSCALES.urogenital.items
		].sort((a, b) => a - b);
		expect(subskalaIds).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
	});
});

describe('calculateSubscales', () => {
	it('returnerer 0 for alle subskalaer når intet er udfyldt', () => {
		expect(calculateSubscales(alleNul)).toEqual({
			somatisk: 0,
			psykologisk: 0,
			urogenital: 0
		});
	});

	it('returnerer max-værdier ved alle 4', () => {
		expect(calculateSubscales(maxScores)).toEqual({
			somatisk: 16,
			psykologisk: 16,
			urogenital: 12
		});
	});

	it('beregner korrekt for blandet input', () => {
		const scores = { ...alleNul, 1: 2, 4: 3, 8: 1 };
		expect(calculateSubscales(scores)).toEqual({
			somatisk: 2,
			psykologisk: 3,
			urogenital: 1
		});
	});
});

describe('calculateTotal', () => {
	it('returnerer 0 for alle nul', () => {
		expect(calculateTotal(alleNul)).toBe(0);
	});

	it('returnerer 44 for alle max', () => {
		expect(calculateTotal(maxScores)).toBe(44);
	});

	it('summerer korrekt for blandet input', () => {
		const scores = { ...alleNul, 1: 2, 4: 3, 8: 1 };
		expect(calculateTotal(scores)).toBe(6);
	});
});

describe('getInterpretation', () => {
	it('0-4 = ingen eller meget få gener', () => {
		expect(getInterpretation(0).label).toMatch(/[Ii]ngen/);
		expect(getInterpretation(4).label).toMatch(/[Ii]ngen/);
	});

	it('5-8 = lette gener', () => {
		expect(getInterpretation(5).label).toMatch(/[Ll]ette/);
		expect(getInterpretation(8).label).toMatch(/[Ll]ette/);
	});

	it('9-16 = mærkbare gener', () => {
		expect(getInterpretation(9).label).toMatch(/[Mm]ærkbare/);
		expect(getInterpretation(16).label).toMatch(/[Mm]ærkbare/);
	});

	it('17-24 = tydelige gener', () => {
		expect(getInterpretation(17).label).toMatch(/[Tt]ydelige/);
		expect(getInterpretation(24).label).toMatch(/[Tt]ydelige/);
	});

	it('25+ = kraftige gener', () => {
		expect(getInterpretation(25).label).toMatch(/[Kk]raftige/);
		expect(getInterpretation(44).label).toMatch(/[Kk]raftige/);
	});

	it('alle returnerer en hex-farve', () => {
		for (let i = 0; i <= 44; i++) {
			expect(getInterpretation(i).color).toMatch(/^#[0-9A-F]{6}$/i);
		}
	});
});

describe('validerScores', () => {
	it('godkender fuldt udfyldt skema', () => {
		expect(validerScores(alleNul)).toBeNull();
		expect(validerScores(maxScores)).toBeNull();
	});

	it('afviser manglende svar', () => {
		const ufuldstaendigt = { ...alleNul };
		delete ufuldstaendigt[5];
		expect(validerScores(ufuldstaendigt)).toMatch(/[Mm]angler svar/);
	});

	it('afviser ugyldig værdi (under 0)', () => {
		expect(validerScores({ ...alleNul, 1: -1 })).toMatch(/[Uu]gyldigt/);
	});

	it('afviser ugyldig værdi (over 4)', () => {
		expect(validerScores({ ...alleNul, 1: 5 })).toMatch(/[Uu]gyldigt/);
	});

	it('afviser ikke-heltal', () => {
		expect(validerScores({ ...alleNul, 1: 2.5 })).toMatch(/[Uu]gyldigt/);
	});
});
