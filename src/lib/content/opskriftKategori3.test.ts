import { describe, it, expect } from 'vitest';
import { MAALTIDSTYPER } from './kost';
import {
	kategorier3,
	kategoriForMaaltid,
	farveKategori,
	antalPrKategori,
	fliseBogstav,
	KATEGORIER3
} from './opskriftKategori3';

describe('kategorier3', () => {
	it('beholder de fire rigtige maaltider', () => {
		expect(kategorier3(['morgenmad'])).toEqual(['morgenmad']);
		expect(kategorier3(['frokost'])).toEqual(['frokost']);
		expect(kategorier3(['aftensmad'])).toEqual(['aftensmad']);
	});

	// Hele grunden til modulet: den gamle indlaeser mistede snack.
	it('beholder snack som sin egen kategori', () => {
		expect(kategorier3(['snack'])).toEqual(['snack']);
	});

	it('folder salat, dessert og tilbehor ind under andet', () => {
		expect(kategorier3(['salat'])).toEqual(['andet']);
		expect(kategorier3(['dessert'])).toEqual(['andet']);
		expect(kategorier3(['tilbehor'])).toEqual(['andet']);
		expect(kategorier3(['tilbehør'])).toEqual(['andet']);
	});

	it('lader ukendte vaerdier lande i andet i stedet for at forsvinde', () => {
		expect(kategorier3(['noget-nyt'])).toEqual(['andet']);
	});

	it('fjerner dubletter naar flere gamle ids folder sammen', () => {
		expect(kategorier3(['salat', 'dessert', 'andet'])).toEqual(['andet']);
	});

	it('giver altid fast raekkefoelge uanset input', () => {
		expect(kategorier3(['snack', 'morgenmad', 'aftensmad'])).toEqual([
			'morgenmad',
			'aftensmad',
			'snack'
		]);
	});

	it('er ligeglad med store bogstaver og mellemrum', () => {
		expect(kategorier3([' Morgenmad '])).toEqual(['morgenmad']);
	});

	it('taaler tomt og forkert input', () => {
		expect(kategorier3(undefined)).toEqual([]);
		expect(kategorier3([])).toEqual([]);
		expect(kategorier3('morgenmad')).toEqual([]);
		expect(kategorier3([null, 42])).toEqual([]);
	});
});

describe('farveKategori', () => {
	it('tager den foerste i fast raekkefoelge uden filter', () => {
		expect(farveKategori(['aftensmad', 'morgenmad'])).toBe('morgenmad');
		expect(farveKategori(['andet', 'frokost'])).toBe('frokost');
	});

	// Det loeser opskrifter der hoerer til flere maaltider: farven er altid
	// sand for det hun kigger paa lige nu.
	it('lader filteret vinde', () => {
		expect(farveKategori(['morgenmad', 'frokost'], ['frokost'])).toBe('frokost');
		expect(farveKategori(['morgenmad', 'aftensmad'], ['aftensmad'])).toBe('aftensmad');
	});

	it('ignorerer et filter opskriften ikke selv har', () => {
		expect(farveKategori(['morgenmad'], ['aftensmad'])).toBe('morgenmad');
	});

	it('tager den foerste i raekkefoelgen naar flere filtre passer', () => {
		expect(farveKategori(['morgenmad', 'snack'], ['snack', 'morgenmad'])).toBe('morgenmad');
	});

	it('giver null naar opskriften ingen kategori har', () => {
		expect(farveKategori([])).toBe(null);
		expect(farveKategori([], ['frokost'])).toBe(null);
	});
});

describe('antalPrKategori', () => {
	const LISTE = [
		{ kategorier3: ['morgenmad' as const] },
		{ kategorier3: ['morgenmad' as const, 'snack' as const] },
		{ kategorier3: ['aftensmad' as const] },
		{ kategorier3: [] }
	];

	it('taeller hver kategori for sig', () => {
		const a = antalPrKategori(LISTE);
		expect(a.morgenmad).toBe(2);
		expect(a.snack).toBe(1);
		expect(a.aftensmad).toBe(1);
		expect(a.frokost).toBe(0);
		expect(a.andet).toBe(0);
	});

	it('taeller en opskrift med i alle sine kategorier', () => {
		expect(antalPrKategori([{ kategorier3: ['morgenmad', 'snack'] }])).toMatchObject({
			morgenmad: 1,
			snack: 1
		});
	});

	it('har alle fem noegler ogsaa ved tom liste', () => {
		expect(Object.keys(antalPrKategori([])).sort()).toEqual([...KATEGORIER3].sort());
	});
});

describe('fliseBogstav', () => {
	it('tager foerste bogstav i stort', () => {
		expect(fliseBogstav('Grøn grød')).toBe('G');
		expect(fliseBogstav('laksebowl')).toBe('L');
	});

	it('taaler danske bogstaver', () => {
		expect(fliseBogstav('Æggewrap')).toBe('Æ');
	});

	it('springer foranstillet mellemrum over', () => {
		expect(fliseBogstav('  Skyrbowl')).toBe('S');
	});

	it('giver en prik ved tom titel', () => {
		expect(fliseBogstav('')).toBe('·');
		expect(fliseBogstav('   ')).toBe('·');
	});
});

describe('kategoriForMaaltid', () => {
	it('oversaetter de fire maaltider', () => {
		expect(kategoriForMaaltid('morgenmad')).toBe('morgenmad');
		expect(kategoriForMaaltid('frokost')).toBe('frokost');
		expect(kategoriForMaaltid('aftensmad')).toBe('aftensmad');
		expect(kategoriForMaaltid('snack')).toBe('snack');
	});

	// Faelden: et femte maaltid ville lande i andet og dermed forvaelge et
	// filter der skjuler alt. Bedre at forvaelge ingenting.
	it('giver null for noget der ikke er et maaltid', () => {
		expect(kategoriForMaaltid('andet')).toBe(null);
		expect(kategoriForMaaltid('salat')).toBe(null);
		expect(kategoriForMaaltid('noget-nyt')).toBe(null);
		expect(kategoriForMaaltid('')).toBe(null);
	});

	it('har et svar for HVERT maaltid i MAALTIDSTYPER', () => {
		for (const m of MAALTIDSTYPER) {
			expect(kategoriForMaaltid(m), `maaltidet ${m} mangler en kategori`).not.toBe(null);
		}
	});
});
