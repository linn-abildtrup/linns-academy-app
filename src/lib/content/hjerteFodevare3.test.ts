import { describe, it, expect } from 'vitest';
import {
	HJERTE_FELT,
	erHjertet,
	skiftHjerte,
	hjertedeFodevarer,
	hjerterFra
} from './hjerteFodevare3';
import type { Fodevare } from './kost';

function f(id: string, name: string): Fodevare {
	return { id, name, cat: 'andet', p: 10, f: 0 };
}

describe('hjerterFra', () => {
	it('laeser feltet fra kundens dokument', () => {
		expect(hjerterFra({ [HJERTE_FELT]: ['a', 'b'] })).toEqual(['a', 'b']);
	});

	// Tilstanden for alle kunder indtil de hjerter deres foerste.
	it('taaler at feltet mangler helt', () => {
		expect(hjerterFra({})).toEqual([]);
		expect(hjerterFra(null)).toEqual([]);
		expect(hjerterFra(undefined)).toEqual([]);
	});

	it('taaler at der ligger noget maerkeligt i feltet', () => {
		expect(hjerterFra({ [HJERTE_FELT]: ['a', 3, null, '  ', 'b'] })).toEqual(['a', 'b']);
		expect(hjerterFra({ [HJERTE_FELT]: 'ikke en liste' })).toEqual([]);
	});

	// Kan ikke opstaa via skiftHjerte, men et gammelt dokument kunne have
	// dem, og saa ville listen taelle forkert.
	it('fjerner dubletter', () => {
		expect(hjerterFra({ [HJERTE_FELT]: ['a', 'a', 'b'] })).toEqual(['a', 'b']);
	});

	it('trimmer mellemrum', () => {
		expect(hjerterFra({ [HJERTE_FELT]: [' a '] })).toEqual(['a']);
	});
});

describe('skiftHjerte', () => {
	it('saetter en hjerte der ikke var der', () => {
		expect(skiftHjerte(['a'], 'b')).toEqual(['a', 'b']);
	});

	it('fjerner en der var der', () => {
		expect(skiftHjerte(['a', 'b'], 'a')).toEqual(['b']);
	});

	it('roerer ikke den oprindelige liste', () => {
		const foer = ['a'];
		skiftHjerte(foer, 'b');
		expect(foer).toEqual(['a']);
	});

	it('goer ingenting uden et id', () => {
		expect(skiftHjerte(['a'], '')).toEqual(['a']);
	});

	it('erHjertet svarer paa begge', () => {
		expect(erHjertet(['a'], 'a')).toBe(true);
		expect(erHjertet(['a'], 'b')).toBe(false);
	});
});

describe('hjertedeFodevarer', () => {
	const foods = new Map([
		['skyr', f('skyr', 'Skyr, naturel')],
		['havre', f('havre', 'Havregryn')],
		['mit', f('mit', 'Bagerens rugbrød')]
	]);

	it('giver de hjertede, alfabetisk', () => {
		const r = hjertedeFodevarer(['skyr', 'havre'], foods, new Set());
		expect(r.map((x) => x.name)).toEqual(['Havregryn', 'Skyr, naturel']);
	});

	// DEN VIGTIGSTE TEST. 72 % af hjerterne er hendes egne varer, sat
	// automatisk af den gamle app. De staar i forvejen under Mine egne,
	// og uden filteret ville de staa to gange i det samme ark.
	it('holder hendes EGNE foedevarer ude', () => {
		const r = hjertedeFodevarer(['skyr', 'mit'], foods, new Set(['mit']));
		expect(r.map((x) => x.id)).toEqual(['skyr']);
	});

	// En tom raekke ligner en fejl.
	it('springer en hjerte over paa noget der ikke findes laengere', () => {
		const r = hjertedeFodevarer(['skyr', 'slettet'], foods, new Set());
		expect(r.map((x) => x.id)).toEqual(['skyr']);
	});

	it('giver en tom liste naar hun ingen hjerter har', () => {
		expect(hjertedeFodevarer([], foods, new Set())).toEqual([]);
	});

	it('giver en tom liste naar alle hjerter er hendes egne', () => {
		expect(hjertedeFodevarer(['mit'], foods, new Set(['mit']))).toEqual([]);
	});
});
