import { describe, it, expect } from 'vitest';
import {
	STJERNE_FELT,
	erStjernet,
	skiftStjerne,
	stjernedeFodevarer,
	stjernerFra
} from './stjerneFodevare3';
import type { Fodevare } from './kost';

function f(id: string, name: string): Fodevare {
	return { id, name, cat: 'andet', p: 10, f: 0 };
}

describe('stjernerFra', () => {
	it('laeser feltet fra kundens dokument', () => {
		expect(stjernerFra({ [STJERNE_FELT]: ['a', 'b'] })).toEqual(['a', 'b']);
	});

	// Tilstanden for alle kunder indtil de stjerner deres foerste.
	it('taaler at feltet mangler helt', () => {
		expect(stjernerFra({})).toEqual([]);
		expect(stjernerFra(null)).toEqual([]);
		expect(stjernerFra(undefined)).toEqual([]);
	});

	it('taaler at der ligger noget maerkeligt i feltet', () => {
		expect(stjernerFra({ [STJERNE_FELT]: ['a', 3, null, '  ', 'b'] })).toEqual(['a', 'b']);
		expect(stjernerFra({ [STJERNE_FELT]: 'ikke en liste' })).toEqual([]);
	});

	// Kan ikke opstaa via skiftStjerne, men et gammelt dokument kunne have
	// dem, og saa ville listen taelle forkert.
	it('fjerner dubletter', () => {
		expect(stjernerFra({ [STJERNE_FELT]: ['a', 'a', 'b'] })).toEqual(['a', 'b']);
	});

	it('trimmer mellemrum', () => {
		expect(stjernerFra({ [STJERNE_FELT]: [' a '] })).toEqual(['a']);
	});
});

describe('skiftStjerne', () => {
	it('saetter en stjerne der ikke var der', () => {
		expect(skiftStjerne(['a'], 'b')).toEqual(['a', 'b']);
	});

	it('fjerner en der var der', () => {
		expect(skiftStjerne(['a', 'b'], 'a')).toEqual(['b']);
	});

	it('roerer ikke den oprindelige liste', () => {
		const foer = ['a'];
		skiftStjerne(foer, 'b');
		expect(foer).toEqual(['a']);
	});

	it('goer ingenting uden et id', () => {
		expect(skiftStjerne(['a'], '')).toEqual(['a']);
	});

	it('erStjernet svarer paa begge', () => {
		expect(erStjernet(['a'], 'a')).toBe(true);
		expect(erStjernet(['a'], 'b')).toBe(false);
	});
});

describe('stjernedeFodevarer', () => {
	const foods = new Map([
		['skyr', f('skyr', 'Skyr, naturel')],
		['havre', f('havre', 'Havregryn')],
		['mit', f('mit', 'Bagerens rugbrød')]
	]);

	it('giver de stjernede, alfabetisk', () => {
		const r = stjernedeFodevarer(['skyr', 'havre'], foods, new Set());
		expect(r.map((x) => x.name)).toEqual(['Havregryn', 'Skyr, naturel']);
	});

	// DEN VIGTIGSTE TEST. 72 % af stjernerne er hendes egne varer, sat
	// automatisk af den gamle app. De staar i forvejen under Mine egne,
	// og uden filteret ville de staa to gange i det samme ark.
	it('holder hendes EGNE foedevarer ude', () => {
		const r = stjernedeFodevarer(['skyr', 'mit'], foods, new Set(['mit']));
		expect(r.map((x) => x.id)).toEqual(['skyr']);
	});

	// En tom raekke ligner en fejl.
	it('springer en stjerne over paa noget der ikke findes laengere', () => {
		const r = stjernedeFodevarer(['skyr', 'slettet'], foods, new Set());
		expect(r.map((x) => x.id)).toEqual(['skyr']);
	});

	it('giver en tom liste naar hun ingen stjerner har', () => {
		expect(stjernedeFodevarer([], foods, new Set())).toEqual([]);
	});

	it('giver en tom liste naar alle stjerner er hendes egne', () => {
		expect(stjernedeFodevarer(['mit'], foods, new Set(['mit']))).toEqual([]);
	});
});
