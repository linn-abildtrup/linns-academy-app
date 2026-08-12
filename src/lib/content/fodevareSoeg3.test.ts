import { describe, it, expect } from 'vitest';
import { MAKS_TRAEF, erHeltOrd, rang, soegFodevarer } from './fodevareSoeg3';
import type { Fodevare } from './kost';

function f(navn: string): Fodevare {
	return { id: navn, name: navn, cat: 'andet', p: 10, f: 0 };
}

describe('erHeltOrd', () => {
	it('finder ordet naar det staar alene', () => {
		expect(erHeltOrd('Æg', 'æg')).toBe(true);
	});

	it('finder ordet midt i et navn', () => {
		expect(erHeltOrd('Pålæg med æg', 'æg')).toBe(true);
	});

	// Det er hele pointen: aeg er IKKE et helt ord i aeggenudler.
	it('siger nej naar ordet er en del af et laengere ord', () => {
		expect(erHeltOrd('Æggenudler', 'æg')).toBe(false);
	});

	it('deler ogsaa ved bindestreg, skraastreg og parentes', () => {
		expect(erHeltOrd('Skyr-vanilje', 'skyr')).toBe(true);
		expect(erHeltOrd('Ost/ris', 'ris')).toBe(true);
		expect(erHeltOrd('Mælk (sødmælk)', 'sødmælk')).toBe(true);
	});

	it('er ligeglad med store bogstaver', () => {
		expect(erHeltOrd('ÆG', 'æg')).toBe(true);
	});

	it('siger nej til et tomt soegeord', () => {
		expect(erHeltOrd('Æg', '')).toBe(false);
	});

	it('rang giver nul til hele ord og ét til resten', () => {
		expect(rang('Æg', 'æg')).toBe(0);
		expect(rang('Æggenudler', 'æg')).toBe(1);
	});
});

describe('soegFodevarer', () => {
	const foods = [
		f('Æggenudler'),
		f('Pålæg med æg'),
		f('Æg'),
		f('Æggeblomme'),
		f('Røræg')
	];

	// DEN VIGTIGSTE TEST. Soeger hun aeg, skal hun ikke laese sig gennem
	// aeggenudler foerst.
	it('saetter hele ord foerst', () => {
		const r = soegFodevarer(foods, 'æg').map((x) => x.name);
		expect(r.slice(0, 2)).toEqual(['Æg', 'Pålæg med æg']);
	});

	// Sorteringen SKJULER ingenting. Det er forskellen paa den her og
	// den gamle apps afkryds.
	it('smider ikke de brede traeffere vaek', () => {
		const r = soegFodevarer(foods, 'æg').map((x) => x.name);
		expect(r).toContain('Æggenudler');
		expect(r).toContain('Røræg');
	});

	it('saetter korteste navn foerst inden for hver gruppe', () => {
		const r = soegFodevarer([f('Skyr med vanilje'), f('Skyr'), f('Skyr drik')], 'skyr');
		expect(r.map((x) => x.name)).toEqual(['Skyr', 'Skyr drik', 'Skyr med vanilje']);
	});

	it('sorterer alfabetisk naar navnene er lige lange', () => {
		const r = soegFodevarer([f('Bost'), f('Aost')], 'ost');
		expect(r.map((x) => x.name)).toEqual(['Aost', 'Bost']);
	});

	it('finder stadig alt der indeholder ordet', () => {
		expect(soegFodevarer(foods, 'æg').length).toBe(5);
	});

	it('giver ingenting paa et tomt soegeord', () => {
		expect(soegFodevarer(foods, '   ')).toEqual([]);
	});

	it('giver ingenting naar intet passer', () => {
		expect(soegFodevarer(foods, 'kylling')).toEqual([]);
	});

	it('viser hoejst otte', () => {
		const mange = Array.from({ length: 20 }, (_, i) => f(`Ost nummer ${i}`));
		expect(soegFodevarer(mange, 'ost').length).toBe(MAKS_TRAEF);
	});

	it('kan bede om et andet antal', () => {
		const mange = Array.from({ length: 20 }, (_, i) => f(`Ost nummer ${i}`));
		expect(soegFodevarer(mange, 'ost', 3).length).toBe(3);
	});
});
