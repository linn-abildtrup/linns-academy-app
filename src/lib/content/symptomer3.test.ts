import { describe, it, expect } from 'vitest';
import { symptomKurve, symptomOverblik, symptomTekst, type SymptomKilde } from './symptomer3';

function ms(aar: number, maaned: number, dag: number): number {
	return new Date(aar, maaned - 1, dag, 12, 0, 0).getTime();
}

function m(timestamp: number, total?: number, kunSliders = false): SymptomKilde {
	return { timestamp, total, kunSliders };
}

describe('symptomKurve', () => {
	it('tager totalen med og sorterer i tid', () => {
		const k = symptomKurve([m(ms(2026, 8, 1), 11), m(ms(2026, 4, 1), 20)]);
		expect(k.map((p) => p.vaerdi)).toEqual([20, 11]);
	});

	// De blev flyttet over fra vaner-modulet og har ingen symptom-score.
	// Uden det her ville de ligge som nuller i bunden og ligne en kunde
	// der pludselig var helt rask.
	it('udfyldelser med kun skydere springes over', () => {
		expect(symptomKurve([m(ms(2026, 4, 1), 0, true)])).toEqual([]);
	});

	it('en maaling helt uden total springes over', () => {
		expect(symptomKurve([m(ms(2026, 4, 1), undefined)])).toEqual([]);
	});

	it('nul gener er et gyldigt svar og skal med', () => {
		expect(symptomKurve([m(ms(2026, 4, 1), 0)])).toHaveLength(1);
	});

	it('ingen maalinger giver en tom kurve', () => {
		expect(symptomKurve([])).toEqual([]);
	});
});

describe('symptomOverblik', () => {
	// FAERRE gener er fremgang. Det er omvendt af alt andet paa siden.
	it('faerre gener giver et positivt tal', () => {
		const o = symptomOverblik([m(ms(2026, 4, 1), 20), m(ms(2026, 8, 1), 11)]);
		expect(o).toEqual({ foer: 20, nu: 11, faerre: 9 });
	});

	it('flere gener giver et negativt tal', () => {
		expect(symptomOverblik([m(ms(2026, 4, 1), 11), m(ms(2026, 8, 1), 20)])?.faerre).toBe(-9);
	});

	it('med én maaling er der ikke noget at sammenligne', () => {
		expect(symptomOverblik([m(ms(2026, 4, 1), 20)])).toEqual({ foer: 20, nu: 20, faerre: null });
	});

	it('uden maalinger er der intet overblik', () => {
		expect(symptomOverblik([])).toBeNull();
	});
});

describe('symptomTekst', () => {
	it('forklarer retningen ved den foerste maaling', () => {
		const t = symptomTekst({ foer: 20, nu: 20, faerre: null });
		expect(t).toContain('udgangspunkt');
		expect(t).toContain('Færre gener er bedre');
	});

	it('roser fremgangen med rene ord', () => {
		expect(symptomTekst({ foer: 20, nu: 11, faerre: 9 })).toContain('9 point færre');
	});

	// Vigtigst af alt: gaar det den forkerte vej, maa teksten ikke pege
	// paa hende. Det er kroppen der har haft en haard periode.
	it('bebrejder hende ingenting naar det gaar den forkerte vej', () => {
		const t = symptomTekst({ foer: 11, nu: 20, faerre: -9 });
		expect(t).toContain('hårdere periode');
		expect(t).toContain('siger ikke noget om hvor godt du gør det');
		for (const ord of ['fejl', 'sprunget', 'manglende', 'desværre', 'burde']) {
			expect(t.toLowerCase()).not.toContain(ord);
		}
	});

	it('staar det stille, siges det roligt', () => {
		expect(symptomTekst({ foer: 11, nu: 11, faerre: 0 })).toContain('samme sted');
	});

	it('ingenting at vise giver ingen tekst', () => {
		expect(symptomTekst(null)).toBe('');
	});
});
