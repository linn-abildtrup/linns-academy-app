import { describe, it, expect } from 'vitest';
import {
	springFor,
	skridt,
	kanTrykkeMinus,
	formatPortion,
	naeringFor,
	genvejeFor,
	enhederFor,
	SPRING
} from './maengde3';
import type { Fodevare } from './kost';

const havregryn: Fodevare = {
	id: 'havre',
	name: 'Havregryn, grove',
	cat: 'korn',
	p: 11,
	f: 10,
	units: [
		{ u: 'spsk', label: 'spsk', g: 15 },
		{ u: 'dl', label: 'dl', g: 35 }
	]
};

const aeg: Fodevare = {
	id: 'aeg',
	name: 'Æg, kogt',
	cat: 'mejeri',
	p: 13,
	f: 0,
	units: [{ u: 'stk', label: 'stk', g: 60 }]
};

describe('springFor', () => {
	// Godkendt af Linn 10. august. Med 1 g pr tryk ville 40 til 65 vaere
	// femogtyve tryk.
	it('gram springer fem', () => {
		expect(springFor('g')).toBe(5);
	});

	it('styk og skive springer én', () => {
		expect(springFor('stk')).toBe(1);
		expect(springFor('skive')).toBe(1);
	});

	it('deciliter og portion springer en halv', () => {
		expect(springFor('dl')).toBe(0.5);
		expect(springFor('portion')).toBe(0.5);
	});

	it('bruger en halv til enheder vi ikke kender', () => {
		expect(springFor('noget-nyt')).toBe(0.5);
	});

	it('bruger gram naar enheden mangler', () => {
		expect(springFor(undefined)).toBe(SPRING.g);
	});
});

describe('skridt', () => {
	it('laegger et spring til', () => {
		expect(skridt(40, 'g', 1)).toBe(45);
		expect(skridt(2, 'stk', 1)).toBe(3);
	});

	it('traekker et spring fra', () => {
		expect(skridt(65, 'g', -1)).toBe(60);
	});

	// Minus skal slukke, ikke vise nul eller et negativt tal.
	it('gaar aldrig under ét spring', () => {
		expect(skridt(5, 'g', -1)).toBe(5);
		expect(skridt(1, 'stk', -1)).toBe(1);
		expect(skridt(0.5, 'dl', -1)).toBe(0.5);
	});

	it('regner rent med halve', () => {
		expect(skridt(1, 'dl', 1)).toBe(1.5);
		expect(skridt(1.5, 'dl', 1)).toBe(2);
	});
});

describe('kanTrykkeMinus', () => {
	it('er slukket ved det mindste', () => {
		expect(kanTrykkeMinus(5, 'g')).toBe(false);
		expect(kanTrykkeMinus(1, 'stk')).toBe(false);
	});

	it('er taendt derover', () => {
		expect(kanTrykkeMinus(10, 'g')).toBe(true);
	});
});

describe('formatPortion', () => {
	it('viser hele tal uden komma', () => {
		expect(formatPortion(40)).toBe('40');
		expect(formatPortion(1)).toBe('1');
	});

	it('viser halve med dansk komma', () => {
		expect(formatPortion(1.5)).toBe('1,5');
		expect(formatPortion(0.5)).toBe('0,5');
	});
});

describe('naeringFor', () => {
	it('regner gram om til protein og fiber', () => {
		const n = naeringFor(havregryn, 40, 'g');
		expect(n.gram).toBe(40);
		expect(n.protein).toBe(4.4);
		expect(n.fiber).toBe(4);
	});

	it('regner en enhed om til gram foerst', () => {
		const n = naeringFor(havregryn, 2, 'spsk');
		expect(n.gram).toBe(30);
		expect(n.protein).toBe(3.3);
	});

	it('regner styk om', () => {
		const n = naeringFor(aeg, 2, 'stk');
		expect(n.gram).toBe(120);
		expect(n.protein).toBe(15.6);
	});

	it('giver nul uden madvare', () => {
		expect(naeringFor(undefined, 40, 'g')).toEqual({
			protein: 0,
			fiber: 0,
			gram: 0,
			kh: 0,
			fedt: 0,
			kcal: 0
		});
	});

	// Udvidet naering vises kun for kunder der har adgang, men tallene
	// regnes altid ud. Adgangen afgoeres i visningen, ikke her.
	it('regner ogsaa kulhydrat, fedt og kalorier ud', () => {
		const rug: Fodevare = {
			id: 'rug',
			name: 'Rugbrød',
			cat: 'korn',
			p: 6,
			f: 8,
			kh: 40,
			fedt: 2,
			kcal: 220
		};
		const n = naeringFor(rug, 50, 'g');
		expect(n.kh).toBe(20);
		expect(n.fedt).toBe(1);
		expect(n.kcal).toBe(110);
	});
});

describe('genvejeFor', () => {
	it('viser madvarens egne enheder og hundrede gram', () => {
		const g = genvejeFor(havregryn);
		expect(g.map((x) => x.label)).toContain('1 spsk');
		expect(g.map((x) => x.label)).toContain('1 dl');
		expect(g.map((x) => x.label)).toContain('100 g');
	});

	// Hun skal ikke traeffe et valg hun har truffet tredive gange foer.
	it('saetter hendes saedvanlige foerst', () => {
		const g = genvejeFor(havregryn, { portion: 40, enhedId: 'g' });
		expect(g[0].label).toBe('40 g');
		expect(g[0].portion).toBe(40);
	});

	it('gentager ikke den saedvanlige hvis den allerede er der', () => {
		const g = genvejeFor(havregryn, { portion: 100, enhedId: 'g' });
		expect(g.filter((x) => x.portion === 100 && x.enhedId === 'g')).toHaveLength(1);
	});

	it('holder sig til fire, saa chipsene bliver paa én raekke', () => {
		expect(genvejeFor(havregryn, { portion: 40, enhedId: 'g' }).length).toBeLessThanOrEqual(4);
	});

	it('giver ingenting uden madvare', () => {
		expect(genvejeFor(undefined)).toEqual([]);
	});
});

describe('enhederFor', () => {
	it('har altid gram foerst', () => {
		expect(enhederFor(havregryn)[0].u).toBe('g');
	});

	it('tager madvarens egne med', () => {
		expect(enhederFor(havregryn).map((e) => e.u)).toEqual(['g', 'spsk', 'dl']);
	});

	it('bruger milliliter til vaesker', () => {
		const maelk: Fodevare = { id: 'm', name: 'Mælk', cat: 'mejeri', p: 3.5, f: 0, liquid: true };
		expect(enhederFor(maelk)[0].u).toBe('ml');
	});

	it('giver gram uden madvare', () => {
		expect(enhederFor(undefined)).toEqual([{ u: 'g', label: 'gram', g: 1 }]);
	});
});
