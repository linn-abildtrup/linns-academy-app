import { describe, it, expect } from 'vitest';
import { byggMakroLinje, skrivMakroLinje, tidenILinjen } from './makroLinje';
import { parseOpskriftMakro } from './opskrifter';

const FULD = { protein: 24, fiber: 11, kh: 44, fedt: 16, kalorier: 440 };
const OPSKRIFT =
	'1. Rør det hele sammen.\n2. Bag i 20 minutter.\n\nProtein: 24 g | Fiber: 11 g | Kulhydrater: 44 g | Fedt: 16 g | Kalorier: 440 kcal | Tid: 15 minutter';

describe('tidenILinjen', () => {
	it('finder tiden', () => {
		expect(tidenILinjen(OPSKRIFT)).toBe('15 minutter');
	});

	it('giver null naar den ikke er der', () => {
		expect(tidenILinjen('1. Bag den.')).toBeNull();
	});
});

describe('byggMakroLinje', () => {
	it('skriver alle fem plus tiden', () => {
		expect(byggMakroLinje(FULD, '15 minutter')).toBe(
			'Protein: 24 g | Fiber: 11 g | Kulhydrater: 44 g | Fedt: 16 g | Kalorier: 440 kcal | Tid: 15 minutter'
		);
	});

	it('springer tomme felter over i stedet for at skrive nul', () => {
		expect(byggMakroLinje({ ...FULD, fedt: null, kh: null }, null)).toBe(
			'Protein: 24 g | Fiber: 11 g | Kalorier: 440 kcal'
		);
	});

	it('skriver kommatal paa dansk', () => {
		expect(byggMakroLinje({ ...FULD, fiber: 7.5 }, null)).toContain('Fiber: 7,5 g');
	});
});

describe('skrivMakroLinje', () => {
	it('bytter den eksisterende linje ud og lader resten staa', () => {
		const ny = skrivMakroLinje(OPSKRIFT, { ...FULD, protein: 30 }, '15 minutter');
		expect(ny).toContain('1. Rør det hele sammen.');
		expect(ny).toContain('2. Bag i 20 minutter.');
		expect(ny).toContain('Protein: 30 g');
		expect(ny.match(/Protein:/g)).toHaveLength(1);
	});

	it('bevarer tiden', () => {
		expect(skrivMakroLinje(OPSKRIFT, FULD, tidenILinjen(OPSKRIFT))).toContain('Tid: 15 minutter');
	});

	it('saetter linjen paa naar den mangler helt', () => {
		const ny = skrivMakroLinje('1. Bag den.', FULD, null);
		expect(ny).toBe('1. Bag den.\n\nProtein: 24 g | Fiber: 11 g | Kulhydrater: 44 g | Fedt: 16 g | Kalorier: 440 kcal');
	});

	it('fjerner linjen helt naar alle tal ryddes', () => {
		const tom = { protein: null, fiber: null, kh: null, fedt: null, kalorier: null };
		const ny = skrivMakroLinje(OPSKRIFT, tom, null);
		expect(ny).toBe('1. Rør det hele sammen.\n2. Bag i 20 minutter.');
	});

	it('roerer ikke et trin der tilfaeldigvis naevner protein', () => {
		const tekst = '1. Kom proteinpulver i.\n\nProtein: 24 g | Fiber: 11 g';
		const ny = skrivMakroLinje(tekst, { ...FULD, protein: 30 }, null);
		expect(ny).toContain('1. Kom proteinpulver i.');
		expect(ny).toContain('Protein: 30 g');
	});

	it('det den skriver, kan appen laese igen', () => {
		const ny = skrivMakroLinje(OPSKRIFT, { protein: 31, fiber: 9, kh: 40, fedt: 12, kalorier: 380 }, '20 minutter');
		expect(parseOpskriftMakro(ny)).toEqual({
			protein: 31,
			fiber: 9,
			kh: 40,
			fedt: 12,
			kalorier: 380
		});
	});
});
