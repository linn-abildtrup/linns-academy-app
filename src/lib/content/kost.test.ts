import { describe, it, expect } from 'vitest';
import {
	gramForEnhed,
	beregnItem,
	beregnMaaltid,
	procentMod,
	formatGram,
	filtrerFodevarer,
	sorterFodevarer,
	findFodevareForIngrediens,
	matchIngredienserMaltid,
	type Fodevare,
	type MaaltidsItem
} from './kost';

const skyr: Fodevare = {
	id: 'skyr',
	name: 'Skyr, naturel',
	cat: 'mejeri',
	p: 11,
	f: 0,
	units: [
		{ u: 'dl', label: 'dl', g: 100 },
		{ u: 'spsk', label: 'spsk', g: 15 }
	]
};

const havre: Fodevare = {
	id: 'havre',
	name: 'Havregryn',
	cat: 'korn',
	p: 13.5,
	f: 10,
	units: [{ u: 'dl', label: 'dl', g: 35 }]
};

const broccoli: Fodevare = {
	id: 'broccoli',
	name: 'Broccoli',
	cat: 'gront',
	p: 2.8,
	f: 2.6
};

describe('gramForEnhed', () => {
	it('returnerer 1 for undefined eller g', () => {
		expect(gramForEnhed(skyr, undefined)).toBe(1);
		expect(gramForEnhed(skyr, 'g')).toBe(1);
	});

	it('finder enheden i fødevarens units-liste', () => {
		expect(gramForEnhed(skyr, 'dl')).toBe(100);
		expect(gramForEnhed(skyr, 'spsk')).toBe(15);
	});

	it('returnerer 1 hvis enheden ikke findes', () => {
		expect(gramForEnhed(skyr, 'kg')).toBe(1);
	});

	it('returnerer 1 hvis fødevaren er undefined', () => {
		expect(gramForEnhed(undefined, 'dl')).toBe(1);
	});
});

describe('beregnItem', () => {
	it('beregner protein og fiber for 100g skyr', () => {
		const r = beregnItem({ foodId: 'skyr', portion: 100 }, skyr);
		expect(r.protein).toBe(11);
		expect(r.fiber).toBe(0);
		expect(r.gram).toBe(100);
	});

	it('skalerer korrekt til 50g (halv portion)', () => {
		const r = beregnItem({ foodId: 'skyr', portion: 50 }, skyr);
		expect(r.protein).toBe(5.5);
	});

	it('bruger enhed til at finde gram-vægt', () => {
		const r = beregnItem({ foodId: 'skyr', portion: 2, enhedId: 'dl' }, skyr);
		expect(r.gram).toBe(200);
		expect(r.protein).toBe(22);
	});

	it('beregner spsk-portion korrekt', () => {
		const r = beregnItem({ foodId: 'skyr', portion: 2, enhedId: 'spsk' }, skyr);
		expect(r.gram).toBe(30);
		expect(r.protein).toBe(3.3);
	});

	it('returnerer 0 hvis fødevaren er undefined', () => {
		expect(beregnItem({ foodId: 'x', portion: 100 }, undefined)).toEqual({
			protein: 0,
			fiber: 0,
			gram: 0
		});
	});
});

describe('beregnMaaltid', () => {
	const map = new Map([
		['skyr', skyr],
		['havre', havre]
	]);

	it('lægger items sammen', () => {
		const items: MaaltidsItem[] = [
			{ foodId: 'skyr', portion: 2, enhedId: 'dl' },
			{ foodId: 'havre', portion: 1, enhedId: 'dl' }
		];
		const r = beregnMaaltid(items, map);
		expect(r.protein).toBeCloseTo(22 + (13.5 * 35) / 100, 5);
		expect(r.fiber).toBeCloseTo((10 * 35) / 100, 5);
	});

	it('ignorerer items med ukendt foodId', () => {
		const r = beregnMaaltid([{ foodId: 'ukendt', portion: 100 }], map);
		expect(r).toEqual({ protein: 0, fiber: 0 });
	});

	it('returnerer 0 for tomt måltid', () => {
		expect(beregnMaaltid([], map)).toEqual({ protein: 0, fiber: 0 });
	});
});

describe('procentMod', () => {
	it('beregner procent korrekt', () => {
		expect(procentMod(30, 15)).toBe(50);
		expect(procentMod(30, 30)).toBe(100);
	});

	it('cappes ved 100', () => {
		expect(procentMod(30, 60)).toBe(100);
	});

	it('returnerer 0 ved mål 0', () => {
		expect(procentMod(0, 5)).toBe(0);
	});

	it('runder til nærmeste hele procent', () => {
		expect(procentMod(30, 10)).toBe(33);
	});
});

describe('formatGram', () => {
	it('formaterer hele tal uden decimal', () => {
		expect(formatGram(100)).toBe('100g');
		expect(formatGram(0)).toBe('0g');
	});

	it('runder til én decimal', () => {
		expect(formatGram(15.5)).toBe('15.5g');
		expect(formatGram(15.55)).toBe('15.6g');
	});

	it('fjerner overflødig .0', () => {
		expect(formatGram(15.0)).toBe('15g');
	});
});

describe('filtrerFodevarer', () => {
	const liste = [skyr, havre, broccoli];

	it('returnerer alle ved tomt søgeord og kategori all', () => {
		expect(filtrerFodevarer(liste, '', 'all')).toEqual(liste);
	});

	it('filtrerer på kategori', () => {
		expect(filtrerFodevarer(liste, '', 'mejeri')).toEqual([skyr]);
	});

	it('filtrerer på søgeord (case-insensitiv)', () => {
		expect(filtrerFodevarer(liste, 'skyr', 'all')).toEqual([skyr]);
		expect(filtrerFodevarer(liste, 'BROCCOLI', 'all')).toEqual([broccoli]);
	});

	it('kombinerer søgeord og kategori', () => {
		expect(filtrerFodevarer(liste, 'skyr', 'korn')).toEqual([]);
	});
});

describe('sorterFodevarer', () => {
	const liste = [havre, skyr, broccoli];

	it('sorterer alfabetisk', () => {
		const r = sorterFodevarer(liste, 'alpha');
		expect(r.map((f) => f.id)).toEqual(['broccoli', 'havre', 'skyr']);
	});

	it('sorterer efter mest protein', () => {
		const r = sorterFodevarer(liste, 'protein');
		expect(r.map((f) => f.id)).toEqual(['havre', 'skyr', 'broccoli']);
	});

	it('sorterer efter mest fiber', () => {
		const r = sorterFodevarer(liste, 'fiber');
		expect(r.map((f) => f.id)).toEqual(['havre', 'broccoli', 'skyr']);
	});

	it('muterer ikke originallisten', () => {
		const original = [havre, skyr, broccoli];
		const oprindelig = original.map((f) => f.id);
		sorterFodevarer(original, 'alpha');
		expect(original.map((f) => f.id)).toEqual(oprindelig);
	});
});

describe('findFodevareForIngrediens', () => {
	const liste = [skyr, havre, broccoli];

	it('finder eksakt match (case-insensitiv)', () => {
		expect(findFodevareForIngrediens('Skyr, naturel', liste)).toEqual(skyr);
		expect(findFodevareForIngrediens('skyr, naturel', liste)).toEqual(skyr);
	});

	it('finder match hvor fødevare-navn starter med ingrediens', () => {
		expect(findFodevareForIngrediens('skyr', liste)).toEqual(skyr);
	});

	it('finder match hvor ingrediens er indeholdt i navn', () => {
		expect(findFodevareForIngrediens('havre', liste)).toEqual(havre);
	});

	it('returnerer null når intet matcher', () => {
		expect(findFodevareForIngrediens('xyz123', liste)).toBeNull();
	});

	it('returnerer null for tom streng', () => {
		expect(findFodevareForIngrediens('', liste)).toBeNull();
	});
});

describe('matchIngredienserMaltid', () => {
	const liste = [skyr, havre, broccoli];

	it('matcher ingredienser til fødevarer og bevarer mængde', () => {
		const r = matchIngredienserMaltid(
			[
				{ navn: 'skyr', maengde: 200, enhed: 'g' },
				{ navn: 'havre', maengde: 1, enhed: 'dl' }
			],
			liste
		);
		expect(r.matchede).toHaveLength(2);
		expect(r.matchede[0].foodId).toBe('skyr');
		expect(r.matchede[0].portion).toBe(200);
		expect(r.matchede[1].foodId).toBe('havre');
		expect(r.matchede[1].enhedId).toBe('dl');
		expect(r.ikkeMatchede).toHaveLength(0);
	});

	it('rapporterer ikke-matchede ingredienser separat', () => {
		const r = matchIngredienserMaltid(
			[
				{ navn: 'skyr', maengde: 100, enhed: 'g' },
				{ navn: 'eksotisk_ingrediens', maengde: 50, enhed: 'g' }
			],
			liste
		);
		expect(r.matchede).toHaveLength(1);
		expect(r.ikkeMatchede).toHaveLength(1);
		expect(r.ikkeMatchede[0].navn).toBe('eksotisk_ingrediens');
	});

	it('springer ingredienser med 0 mængde over (uden navn) men inkluderer dem ved navn', () => {
		const r = matchIngredienserMaltid(
			[
				{ navn: 'salt og peber', maengde: 0, enhed: 'stk' },
				{ navn: '', maengde: 0, enhed: '' }
			],
			liste
		);
		expect(r.matchede).toHaveLength(0);
		expect(r.ikkeMatchede).toHaveLength(1);
		expect(r.ikkeMatchede[0].navn).toBe('salt og peber');
	});

	it('falder tilbage til gram-portion hvis enhed ikke findes på fødevaren', () => {
		const r = matchIngredienserMaltid(
			[{ navn: 'broccoli', maengde: 100, enhed: 'stk' }],
			liste
		);
		expect(r.matchede).toHaveLength(1);
		expect(r.matchede[0].enhedId).toBeUndefined();
	});
});
