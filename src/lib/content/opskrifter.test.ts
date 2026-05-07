import { describe, it, expect } from 'vitest';
import {
	skalerMaengde,
	formatMaengde,
	filtrerOpskrifter,
	type Opskrift
} from './opskrifter';

const havregroed: Opskrift = {
	id: 'havregroed',
	titel: 'Havregrød med skyr',
	beskrivelse: 'Klassisk morgenmad med protein',
	billedeUrl: null,
	kategorier: ['morgenmad'],
	defaultPortioner: 2,
	ingredienser: [
		{ navn: 'havregryn', maengde: 100, enhed: 'g' },
		{ navn: 'mælk', maengde: 4, enhed: 'dl' }
	],
	instruktioner: 'Kog havregryn i mælk.',
	dietTags: ['vegetar'],
	aktiv: true
};

const salat: Opskrift = {
	id: 'salat',
	titel: 'Kyllingesalat',
	beskrivelse: 'Hurtig frokost med protein',
	billedeUrl: null,
	kategorier: ['frokost', 'aftensmad'],
	defaultPortioner: 4,
	ingredienser: [{ navn: 'kylling', maengde: 400, enhed: 'g' }],
	instruktioner: 'Skær og bland.',
	dietTags: ['glutenfri'],
	aktiv: true
};

describe('skalerMaengde', () => {
	it('skalerer op fra 2 til 4 portioner', () => {
		expect(skalerMaengde(100, 2, 4)).toBe(200);
	});

	it('skalerer ned fra 4 til 2 portioner', () => {
		expect(skalerMaengde(400, 4, 2)).toBe(200);
	});

	it('returnerer 0 ved 0 portioner', () => {
		expect(skalerMaengde(100, 2, 0)).toBe(0);
		expect(skalerMaengde(100, 0, 4)).toBe(0);
	});

	it('runder til to decimaler', () => {
		expect(skalerMaengde(1, 3, 1)).toBe(0.33);
	});
});

describe('formatMaengde', () => {
	it('returnerer tom streng for 0', () => {
		expect(formatMaengde(0)).toBe('');
	});

	it('formaterer hele tal uden decimal', () => {
		expect(formatMaengde(2)).toBe('2');
		expect(formatMaengde(100)).toBe('100');
	});

	it('bruger komma som decimal-separator (dansk)', () => {
		expect(formatMaengde(1.5)).toBe('1,5');
		expect(formatMaengde(0.5)).toBe('0,5');
	});

	it('runder til to decimaler', () => {
		expect(formatMaengde(0.333)).toBe('0,33');
	});
});

describe('filtrerOpskrifter', () => {
	const liste = [havregroed, salat];

	it('returnerer alle ved tomt søgeord og ingen kategorier', () => {
		expect(filtrerOpskrifter(liste, '', [])).toEqual(liste);
	});

	it('filtrerer på enkel kategori', () => {
		expect(filtrerOpskrifter(liste, '', ['morgenmad'])).toEqual([havregroed]);
	});

	it('OR-logik mellem kategorier', () => {
		expect(filtrerOpskrifter(liste, '', ['morgenmad', 'frokost'])).toEqual(liste);
	});

	it('filtrerer på søgeord (case-insensitiv)', () => {
		expect(filtrerOpskrifter(liste, 'KYLLING', [])).toEqual([salat]);
	});

	it('søger også i beskrivelsen', () => {
		expect(filtrerOpskrifter(liste, 'protein', [])).toEqual(liste);
	});

	it('kombinerer søgeord og kategori', () => {
		expect(filtrerOpskrifter(liste, 'kylling', ['morgenmad'])).toEqual([]);
	});

	it('filtrerer på dietTags (AND-logik)', () => {
		expect(filtrerOpskrifter(liste, '', [], ['vegetar'])).toEqual([havregroed]);
		expect(filtrerOpskrifter(liste, '', [], ['glutenfri'])).toEqual([salat]);
	});

	it('AND-logik mellem flere dietTags kræver alle', () => {
		expect(filtrerOpskrifter(liste, '', [], ['vegetar', 'glutenfri'])).toEqual([]);
	});
});
