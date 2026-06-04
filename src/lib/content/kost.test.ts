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
	renseIngrediensNavn,
	splitListeIngrediens,
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
			kh: 0,
			fedt: 0,
			kcal: 0,
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
		expect(r).toEqual({ protein: 0, fiber: 0, kh: 0, fedt: 0, kcal: 0 });
	});

	it('returnerer 0 for tomt måltid', () => {
		expect(beregnMaaltid([], map)).toEqual({ protein: 0, fiber: 0, kh: 0, fedt: 0, kcal: 0 });
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
		expect(formatGram(100)).toBe('100 gram');
		expect(formatGram(0)).toBe('0 gram');
	});

	it('runder til én decimal', () => {
		expect(formatGram(15.5)).toBe('15.5 gram');
		expect(formatGram(15.55)).toBe('15.6 gram');
	});

	it('fjerner overflødig .0', () => {
		expect(formatGram(15.0)).toBe('15 gram');
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

describe('renseIngrediensNavn', () => {
	it('fjerner alt efter første komma', () => {
		expect(renseIngrediensNavn('agurk, i tern')).toBe('agurk');
		expect(renseIngrediensNavn('kylling, kogt')).toBe('kylling');
	});

	it('fjerner indledende mængde og enhed', () => {
		expect(renseIngrediensNavn('2 spsk olivenolie')).toBe('olivenolie');
		expect(renseIngrediensNavn('100g kylling')).toBe('kylling');
		expect(renseIngrediensNavn('1 dl havregryn')).toBe('havregryn');
	});

	it('fjerner indledende størrelses-ord', () => {
		expect(renseIngrediensNavn('1 stor gulerod')).toBe('gulerod');
		expect(renseIngrediensNavn('lille æble')).toBe('æble');
	});

	it('fjerner indledende tilberedningsord', () => {
		expect(renseIngrediensNavn('frisk persille')).toBe('persille');
		expect(renseIngrediensNavn('hakket løg')).toBe('løg');
		expect(renseIngrediensNavn('finthakket hvidløg')).toBe('hvidløg');
	});

	it('lader simple navne være uændret', () => {
		expect(renseIngrediensNavn('skyr')).toBe('skyr');
		expect(renseIngrediensNavn('havregryn')).toBe('havregryn');
	});

	it('lower-caser alt', () => {
		expect(renseIngrediensNavn('AGURK, i tern')).toBe('agurk');
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

	it('finder match efter rensning af komma-suffix', () => {
		const agurk: Fodevare = {
			id: 'agurk',
			name: 'Agurk, rå',
			cat: 'gront',
			p: 0.6,
			f: 0.5
		};
		const r = findFodevareForIngrediens('agurk, i tern', [agurk]);
		expect(r).toEqual(agurk);
	});

	it('finder match efter fjernelse af mængde-prefiks', () => {
		const olie: Fodevare = {
			id: 'olivenolie',
			name: 'Olivenolie',
			cat: 'andet',
			p: 0,
			f: 0
		};
		const r = findFodevareForIngrediens('2 spsk olivenolie', [olie]);
		expect(r).toEqual(olie);
	});

	it('finder match efter fjernelse af tilberedningsord', () => {
		const persille: Fodevare = {
			id: 'persille',
			name: 'Persille, rå',
			cat: 'gront',
			p: 3,
			f: 5
		};
		const r = findFodevareForIngrediens('frisk persille', [persille]);
		expect(r).toEqual(persille);
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
		expect(r.items).toHaveLength(2);
		expect(r.items[0].foodId).toBe('skyr');
		expect(r.items[0].portion).toBe(200);
		expect(r.items[1].foodId).toBe('havre');
		expect(r.items[1].enhedId).toBe('dl');
		expect(r.ikkeMatchede).toHaveLength(0);
	});

	it('returnerer ikke-matchede som manuelle items i listen', () => {
		const r = matchIngredienserMaltid(
			[
				{ navn: 'skyr', maengde: 100, enhed: 'g' },
				{ navn: 'eksotisk_ingrediens', maengde: 50, enhed: 'g' }
			],
			liste
		);
		expect(r.items).toHaveLength(2);
		expect(r.items[0].foodId).toBe('skyr');
		expect(r.items[1].foodId).toBe('');
		expect(r.items[1].manuel).toEqual({ navn: 'eksotisk_ingrediens', enhed: 'g' });
		expect(r.ikkeMatchede).toHaveLength(1);
	});

	it('inkluderer ingredienser med 0 mængde som manuelle (fx krydderier)', () => {
		const r = matchIngredienserMaltid(
			[{ navn: 'salt og peber', maengde: 0, enhed: 'stk' }],
			liste
		);
		expect(r.items).toHaveLength(1);
		expect(r.items[0].manuel?.navn).toBe('salt og peber');
		expect(r.ikkeMatchede).toHaveLength(1);
	});

	it('springer helt tomme ingredienser over', () => {
		const r = matchIngredienserMaltid([{ navn: '', maengde: 0, enhed: '' }], liste);
		expect(r.items).toHaveLength(0);
		expect(r.ikkeMatchede).toHaveLength(0);
	});

	it('falder tilbage til gram-portion hvis enhed ikke findes på fødevaren', () => {
		const r = matchIngredienserMaltid(
			[{ navn: 'broccoli', maengde: 100, enhed: 'stk' }],
			liste
		);
		expect(r.items).toHaveLength(1);
		expect(r.items[0].enhedId).toBeUndefined();
	});
});

describe('erManueltItem og beregnItem for manuel', () => {
	it('manuel item har 0 protein og fiber', () => {
		const r = beregnItem({ foodId: '', portion: 1, manuel: { navn: 'salt', enhed: 'tsk' } }, undefined);
		expect(r.protein).toBe(0);
		expect(r.fiber).toBe(0);
	});

	it('manuel item ignoreres af beregnMaaltid', () => {
		const map = new Map([['skyr', skyr]]);
		const items: MaaltidsItem[] = [
			{ foodId: 'skyr', portion: 100 },
			{ foodId: '', portion: 1, manuel: { navn: 'salt', enhed: 'tsk' } }
		];
		const r = beregnMaaltid(items, map);
		expect(r.protein).toBe(11);
	});
});

describe('findFodevareForIngrediens multi-word', () => {
	const peberHvid: Fodevare = {
		id: 'peber_hvid',
		name: 'Peber, hvid',
		cat: 'andet',
		p: 0,
		f: 0,
		kh: 0,
		fedt: 0,
		kcal: 0
	};
	const peberfrugtRod: Fodevare = {
		id: 'peberfrugt_rod',
		name: 'Peberfrugt, rød',
		cat: 'frugt-gront',
		p: 1,
		f: 2,
		kh: 5,
		fedt: 0,
		kcal: 25
	};
	const peberfrugtGron: Fodevare = {
		id: 'peberfrugt_gron',
		name: 'Peberfrugt, grøn',
		cat: 'frugt-gront',
		p: 1,
		f: 2,
		kh: 4,
		fedt: 0,
		kcal: 20
	};
	const foods = [peberHvid, peberfrugtRod, peberfrugtGron];

	it('"rød peber" matcher Peberfrugt, rød (ikke Peber, hvid)', () => {
		const r = findFodevareForIngrediens('rød peber', foods);
		expect(r?.id).toBe('peberfrugt_rod');
	});

	it('"grøn peber" matcher Peberfrugt, grøn', () => {
		const r = findFodevareForIngrediens('grøn peber', foods);
		expect(r?.id).toBe('peberfrugt_gron');
	});

	it('kun "peber" matcher korteste peber-fødevare', () => {
		const r = findFodevareForIngrediens('peber', foods);
		// "Peber, hvid" (11) < "Peberfrugt, rød" (15) < "Peberfrugt, grøn" (16)
		expect(r?.id).toBe('peber_hvid');
	});
});

describe('splitListeIngrediens', () => {
	it('returnerer null for enkelt ingrediens', () => {
		expect(splitListeIngrediens('Æble')).toBeNull();
		expect(splitListeIngrediens('Skyr, naturel')).toBeNull(); // 1 komma = modifier, ikke liste
	});

	it('Pattern 1: parenteser med liste-indhold deles', () => {
		const r = splitListeIngrediens(
			'grøntsager (gulerødder, rød peber, tomat, agurk eller bladselleri)'
		);
		expect(r).toEqual(['gulerødder', 'rød peber', 'tomat', 'agurk', 'bladselleri']);
	});

	it('Pattern 1: parenteser med kun procent eller tal returnerer null', () => {
		// "70%" filtreres ud (intet bogstav), 0 parts -> null
		expect(splitListeIngrediens('Mørk chokolade (70%)')).toBeNull();
	});

	it('Pattern 2: "blanding af A, B og C" deles', () => {
		const r = splitListeIngrediens(
			'blanding af hakkede mandler, solsikkekerner, hakket mørk chokolade 70% og hasselnødder'
		);
		expect(r).toEqual([
			'hakkede mandler',
			'solsikkekerner',
			'hakket mørk chokolade 70%',
			'hasselnødder'
		]);
	});

	it('Pattern 2: "håndfuld af A og B" deles', () => {
		const r = splitListeIngrediens('lille håndfuld af mandler og rosiner');
		expect(r).toEqual(['mandler', 'rosiner']);
	});

	it('Pattern 3: 2+ separatorer uden prefix deles', () => {
		const r = splitListeIngrediens('mandler, solsikkekerner og hasselnødder');
		expect(r).toEqual(['mandler', 'solsikkekerner', 'hasselnødder']);
	});

	it('Pattern 3 udløses IKKE af kun 1 separator (undgår modifier-misfortolkning)', () => {
		// "Æble, rå" har 1 komma — modifier, ikke liste
		expect(splitListeIngrediens('Æble, rå')).toBeNull();
		// "Æble og banan" har 1 og — kunne være liste, men vi vil ikke risikere
		expect(splitListeIngrediens('Æble og banan')).toBeNull();
	});

	it('filtrerer tomme dele og kun-tegn-dele', () => {
		// "ca. 100g" har ingen bogstaver fra tags, men noget kan slippe igennem.
		// Test at "70%" alene filtreres
		const r = splitListeIngrediens('chokolade af kakao 70% og smør og mælk');
		expect(r).toEqual(['kakao 70%', 'smør', 'mælk']);
	});
});

describe('matchIngredienserMaltid med liste-splitting', () => {
	const mandler: Fodevare = {
		id: 'mandler',
		name: 'Mandler',
		cat: 'andet',
		p: 21,
		f: 12,
		kh: 22,
		fedt: 50,
		kcal: 580
	};
	const solsikkekerner: Fodevare = {
		id: 'solsikkekerner',
		name: 'Solsikkekerner',
		cat: 'andet',
		p: 20,
		f: 8,
		kh: 20,
		fedt: 51,
		kcal: 584
	};
	const hasselnoedder: Fodevare = {
		id: 'hasselnoedder',
		name: 'Hasselnødder',
		cat: 'andet',
		p: 15,
		f: 10,
		kh: 17,
		fedt: 61,
		kcal: 628
	};
	const baerblanding: Fodevare = {
		id: 'baerblanding',
		name: 'Bærblanding, frossen',
		cat: 'andet',
		p: 1,
		f: 4,
		kh: 8,
		fedt: 0,
		kcal: 40
	};
	const foods = [mandler, solsikkekerner, hasselnoedder, baerblanding];

	it('liste-ingrediens splittes til separate items med lige fordelt mængde', () => {
		const ingredienser = [
			{
				navn: 'blanding af hakkede mandler, solsikkekerner og hasselnødder',
				maengde: 30,
				enhed: 'g'
			}
		];
		const r = matchIngredienserMaltid(ingredienser, foods);
		expect(r.items).toHaveLength(3);
		// 30 / 3 = 10 g hver
		expect(r.items[0].portion).toBe(10);
		expect(r.items[1].portion).toBe(10);
		expect(r.items[2].portion).toBe(10);
		// Skal IKKE matche "Bærblanding, frossen"
		expect(r.items.find((i) => i.foodId === 'baerblanding')).toBeUndefined();
		// Skal matche de 3 rigtige
		expect(r.items.find((i) => i.foodId === 'mandler')).toBeDefined();
		expect(r.items.find((i) => i.foodId === 'solsikkekerner')).toBeDefined();
		expect(r.items.find((i) => i.foodId === 'hasselnoedder')).toBeDefined();
	});

	it('enkelt ingrediens (uden komma/og) bevares som ét item', () => {
		const r = matchIngredienserMaltid([{ navn: 'Mandler', maengde: 25, enhed: 'g' }], foods);
		expect(r.items).toHaveLength(1);
		expect(r.items[0].foodId).toBe('mandler');
		expect(r.items[0].portion).toBe(25);
	});
});
