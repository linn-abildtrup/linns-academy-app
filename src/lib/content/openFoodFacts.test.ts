import { describe, it, expect } from 'vitest';
import { tjekNaering } from './openFoodFacts';

describe('tjekNaering', () => {
	it('godkender et komplet, plausibelt produkt (Lurpak med fulde tal)', () => {
		const r = tjekNaering({ kcal: 707, protein: 0.6, kh: 0.7, fedt: 78 });
		expect(r.ok).toBe(true);
		expect(r.advarsler).toHaveLength(0);
	});

	it('fanger 0 kcal når der er makroer (det ødelagte Lurpak)', () => {
		const r = tjekNaering({ kcal: 0, protein: 0.6, kh: 0, fedt: 78 });
		expect(r.ok).toBe(false);
		expect(r.advarsler).toContain('Kalorier mangler');
	});

	it('fanger helt tomt produkt', () => {
		const r = tjekNaering({ kcal: 0, protein: 0, kh: 0, fedt: 0 });
		expect(r.ok).toBe(false);
		expect(r.advarsler).toContain('Produktet har ingen næringstal');
	});

	it('fanger kcal der ikke passer til makroerne', () => {
		// makroer giver ~57 kcal, men produktet påstår 300
		const r = tjekNaering({ kcal: 300, protein: 10, kh: 4, fedt: 0.2 });
		expect(r.ok).toBe(false);
		expect(r.advarsler).toContain('Kalorier passer ikke til makroerne');
	});

	it('godkender almindelig skyr (kcal tæt på makro-udregning)', () => {
		const r = tjekNaering({ kcal: 63, protein: 10, kh: 4, fedt: 0.2 });
		expect(r.ok).toBe(true);
	});

	it('fanger urealistisk høje kalorier', () => {
		const r = tjekNaering({ kcal: 1200, protein: 0, kh: 0, fedt: 100 });
		expect(r.advarsler).toContain('Kalorier er urealistisk høje (over 900 pr 100 g)');
	});
});
