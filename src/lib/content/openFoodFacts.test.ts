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


describe('tjekNaering: fiber giver aldrig alarm', () => {
	// Linns beslutning 24/8 2026: vi kontrollerer ikke hvad fremmede
	// databaser siger. Kommer der x gram fiber ind, stoler vi paa det.
	// Testene her holder fast i at ingen fiber-vaerdi i sig selv kan
	// udloese en advarsel, og at de fiberrige varer gaar rent igennem.
	it('godkender selv en absurd fiber-vaerdi, fordi vi stoler paa kilden', () => {
		expect(tjekNaering({ kcal: 466, protein: 6.3, fiber: 52, kh: 68, fedt: 17 }).ok).toBe(true);
		expect(tjekNaering({ kcal: 300, protein: 1, fiber: 140, kh: 1, fedt: 1 }).ok).toBe(true);
	});

	// Herunder staar aegte varer fra jeres egen database. Foer 24/8 2026 gav
	// Husk og alle rene fiberprodukter en falsk advarsel, fordi fiber ikke
	// talte med i kalorie-regnestykket.
	it('giver IKKE alarm paa Husk, som aegte har 87 g fiber', () => {
		expect(tjekNaering({ kcal: 200, protein: 2.4, fiber: 87 }).ok).toBe(true);
	});

	it('giver IKKE alarm paa chiafroe', () => {
		expect(tjekNaering({ kcal: 490, protein: 17, fiber: 34, kh: 24, fedt: 31 }).ok).toBe(true);
	});

	it('giver IKKE alarm paa kokosmel', () => {
		expect(tjekNaering({ kcal: 660, protein: 14, fiber: 33, kh: 2.3, fedt: 61.3 }).ok).toBe(true);
	});

	it('giver IKKE alarm paa krydderier, hvor fiber ofte er talt med i kulhydrat', () => {
		expect(tjekNaering({ kcal: 282, protein: 13, fiber: 34, kh: 50, fedt: 15 }).ok).toBe(true);
		expect(tjekNaering({ kcal: 354, protein: 8, fiber: 21, kh: 67, fedt: 10 }).ok).toBe(true);
	});

	it('giver IKKE alarm paa hvedeklid', () => {
		expect(tjekNaering({ kcal: 216, protein: 16, fiber: 43, kh: 22, fedt: 4 }).ok).toBe(true);
	});

	it('taaler at fiber slet ikke er sendt med', () => {
		expect(tjekNaering({ kcal: 216, protein: 16, kh: 22, fedt: 4 }).ok).toBe(true);
	});
});
