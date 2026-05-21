import { describe, it, expect } from 'vitest';
import {
	calculateSubscales,
	calculateTotal,
	getInterpretation,
	getSubskalaFortolkning,
	MRS_ITEMS,
	naesteSoendagEfter,
	naesteUdfyldelseDato,
	skalUdfyldeNu,
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

	it('alle niveauer har en beskrivelse', () => {
		for (const total of [0, 5, 9, 17, 25]) {
			expect(getInterpretation(total).beskrivelse).toBeTruthy();
			expect(getInterpretation(total).beskrivelse.length).toBeGreaterThan(20);
		}
	});
});

describe('getSubskalaFortolkning', () => {
	it('somatisk: 0-2 = ingen, 3-4 = mild, 5-8 = moderat, 9+ = svaer', () => {
		expect(getSubskalaFortolkning('somatisk', 0).niveau).toBe('ingen');
		expect(getSubskalaFortolkning('somatisk', 2).niveau).toBe('ingen');
		expect(getSubskalaFortolkning('somatisk', 3).niveau).toBe('mild');
		expect(getSubskalaFortolkning('somatisk', 4).niveau).toBe('mild');
		expect(getSubskalaFortolkning('somatisk', 5).niveau).toBe('moderat');
		expect(getSubskalaFortolkning('somatisk', 8).niveau).toBe('moderat');
		expect(getSubskalaFortolkning('somatisk', 9).niveau).toBe('svaer');
		expect(getSubskalaFortolkning('somatisk', 16).niveau).toBe('svaer');
	});

	it('psykologisk: 0-1 = ingen, 2-3 = mild, 4-6 = moderat, 7+ = svaer', () => {
		expect(getSubskalaFortolkning('psykologisk', 0).niveau).toBe('ingen');
		expect(getSubskalaFortolkning('psykologisk', 1).niveau).toBe('ingen');
		expect(getSubskalaFortolkning('psykologisk', 2).niveau).toBe('mild');
		expect(getSubskalaFortolkning('psykologisk', 3).niveau).toBe('mild');
		expect(getSubskalaFortolkning('psykologisk', 4).niveau).toBe('moderat');
		expect(getSubskalaFortolkning('psykologisk', 6).niveau).toBe('moderat');
		expect(getSubskalaFortolkning('psykologisk', 7).niveau).toBe('svaer');
		expect(getSubskalaFortolkning('psykologisk', 16).niveau).toBe('svaer');
	});

	it('urogenital: 0 = ingen, 1-2 = mild, 3-5 = moderat, 6+ = svaer', () => {
		expect(getSubskalaFortolkning('urogenital', 0).niveau).toBe('ingen');
		expect(getSubskalaFortolkning('urogenital', 1).niveau).toBe('mild');
		expect(getSubskalaFortolkning('urogenital', 2).niveau).toBe('mild');
		expect(getSubskalaFortolkning('urogenital', 3).niveau).toBe('moderat');
		expect(getSubskalaFortolkning('urogenital', 5).niveau).toBe('moderat');
		expect(getSubskalaFortolkning('urogenital', 6).niveau).toBe('svaer');
		expect(getSubskalaFortolkning('urogenital', 12).niveau).toBe('svaer');
	});

	it('alle returnerer en label', () => {
		for (const sub of ['somatisk', 'psykologisk', 'urogenital'] as const) {
			for (let i = 0; i <= 16; i++) {
				expect(getSubskalaFortolkning(sub, i).label).toBeTruthy();
			}
		}
	});
});

describe('naesteSoendagEfter', () => {
	it('mandag → samme uges søndag', () => {
		const mandag = new Date(2026, 4, 18); // 18. maj 2026 er mandag
		const ud = naesteSoendagEfter(mandag);
		expect(ud.getDay()).toBe(0);
		expect(ud.getDate()).toBe(24);
	});

	it('søndag → næste uges søndag (7 dage frem)', () => {
		const soendag = new Date(2026, 4, 24); // 24. maj 2026 er søndag
		const ud = naesteSoendagEfter(soendag);
		expect(ud.getDay()).toBe(0);
		expect(ud.getDate()).toBe(31);
	});

	it('lørdag → næste dags søndag', () => {
		const loerdag = new Date(2026, 4, 23); // 23. maj 2026 er lørdag
		const ud = naesteSoendagEfter(loerdag);
		expect(ud.getDay()).toBe(0);
		expect(ud.getDate()).toBe(24);
	});
});

describe('naesteUdfyldelseDato', () => {
	it('ingen tidligere → returnerer i dag (sammen med nu)', () => {
		const ud = naesteUdfyldelseDato('abonnement', 'basisabo', null);
		const nu = Date.now();
		expect(Math.abs(ud.getTime() - nu)).toBeLessThan(1000);
	});

	it('app-kunde → 30 dage efter sidste', () => {
		const sidste = new Date(2026, 4, 1).getTime();
		const ud = naesteUdfyldelseDato('abonnement', 'basisabo', sidste);
		expect(ud.getDate()).toBe(31);
		expect(ud.getMonth()).toBe(4); // maj
	});

	it('Kickstart-kunde → næste søndag', () => {
		// 1. maj 2026 er fredag
		const sidste = new Date(2026, 4, 1).getTime();
		const ud = naesteUdfyldelseDato('forløb', 'kickstart', sidste);
		expect(ud.getDay()).toBe(0); // søndag
	});

	it('Kropsro-kunde (premiumforløb) → 28 dage efter', () => {
		const sidste = new Date(2026, 4, 1).getTime();
		const ud = naesteUdfyldelseDato('forløb', 'premiumforløb', sidste);
		expect(ud.getDate()).toBe(29);
		expect(ud.getMonth()).toBe(4);
	});
});

describe('skalUdfyldeNu', () => {
	it('aldrig udfyldt → true', () => {
		expect(skalUdfyldeNu('abonnement', 'basisabo', null)).toBe(true);
	});

	it('app-kunde udfyldt for 31 dage siden → true', () => {
		const sidste = Date.now() - 31 * 24 * 60 * 60 * 1000;
		expect(skalUdfyldeNu('abonnement', 'basisabo', sidste)).toBe(true);
	});

	it('app-kunde udfyldt i dag → false', () => {
		expect(skalUdfyldeNu('abonnement', 'basisabo', Date.now())).toBe(false);
	});

	it('Kropsro udfyldt for 29 dage siden → true', () => {
		const sidste = Date.now() - 29 * 24 * 60 * 60 * 1000;
		expect(skalUdfyldeNu('forløb', 'premiumforløb', sidste)).toBe(true);
	});

	it('Kropsro udfyldt for 7 dage siden → false', () => {
		const sidste = Date.now() - 7 * 24 * 60 * 60 * 1000;
		expect(skalUdfyldeNu('forløb', 'premiumforløb', sidste)).toBe(false);
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
