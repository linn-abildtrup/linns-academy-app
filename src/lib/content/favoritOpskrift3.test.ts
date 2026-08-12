import { describe, it, expect } from 'vitest';
import {
	favoritterFra,
	erFavorit,
	skiftFavorit,
	HJERTE_ETIKET,
	FAVORIT_FELT
} from './favoritOpskrift3';

describe('favoritterFra', () => {
	it('giver tom liste naar feltet slet ikke er der', () => {
		// Tilstanden for hver eneste kunde indtil hun markerer sin foerste.
		expect(favoritterFra({})).toEqual([]);
		expect(favoritterFra(null)).toEqual([]);
		expect(favoritterFra(undefined)).toEqual([]);
	});

	it('laeser id-listen naar den er der', () => {
		expect(favoritterFra({ [FAVORIT_FELT]: ['a', 'b'] })).toEqual(['a', 'b']);
	});

	it('taaler at feltet ikke er et array', () => {
		expect(favoritterFra({ [FAVORIT_FELT]: 'a' })).toEqual([]);
		expect(favoritterFra({ [FAVORIT_FELT]: 42 })).toEqual([]);
	});

	it('sorterer alt fra der ikke er en rigtig tekst', () => {
		expect(favoritterFra({ [FAVORIT_FELT]: ['a', 1, null, '', '  ', 'b'] })).toEqual(['a', 'b']);
	});

	// En dublet ville faa fanen til at taelle forkert, saa vi luger dem ud
	// ved laesningen i stedet for at stole paa at de aldrig opstaar.
	it('fjerner dubletter', () => {
		expect(favoritterFra({ [FAVORIT_FELT]: ['a', 'b', 'a'] })).toEqual(['a', 'b']);
	});

	it('trimmer mellemrum', () => {
		expect(favoritterFra({ [FAVORIT_FELT]: [' a '] })).toEqual(['a']);
	});
});

describe('erFavorit', () => {
	it('finder den markerede', () => {
		expect(erFavorit(['a', 'b'], 'b')).toBe(true);
	});

	it('siger nej til en der ikke er markeret', () => {
		expect(erFavorit(['a', 'b'], 'c')).toBe(false);
	});

	it('siger nej ved tom liste og tomt id', () => {
		expect(erFavorit([], 'a')).toBe(false);
		expect(erFavorit(['a'], '')).toBe(false);
	});
});

describe('skiftFavorit', () => {
	it('laegger en ny til bagest', () => {
		expect(skiftFavorit(['a'], 'b')).toEqual(['a', 'b']);
	});

	it('fjerner en der allerede er der', () => {
		expect(skiftFavorit(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
	});

	it('virker paa en tom liste', () => {
		expect(skiftFavorit([], 'a')).toEqual(['a']);
	});

	// Vigtigt for Svelte: aendrer vi listen indeni, opdager komponenten det
	// ikke, og hjertet ville blive staaende som det var.
	it('roerer ALDRIG den liste der kom ind', () => {
		const foer = ['a', 'b'];
		const efter = skiftFavorit(foer, 'c');
		expect(foer).toEqual(['a', 'b']);
		expect(efter).not.toBe(foer);
	});

	it('giver en kopi tilbage selv naar der intet sker', () => {
		const foer = ['a'];
		const efter = skiftFavorit(foer, '');
		expect(efter).toEqual(['a']);
		expect(efter).not.toBe(foer);
	});

	it('kan slaas til og fra igen og lander samme sted', () => {
		const start = ['a', 'b'];
		const til = skiftFavorit(start, 'c');
		expect(skiftFavorit(til, 'c')).toEqual(start);
	});
});

describe('HJERTE_ETIKET', () => {
	// Knappen er en kontakt. Tilstanden meldes af aria-pressed, saa navnet
	// skal blive det samme. Skiftede det med, ville en skaermlaeser sige
	// baade handlingen og tilstanden paa én gang, og det er uklart.
	it('er ét fast navn og ikke to', () => {
		expect(HJERTE_ETIKET).toBe('Favorit');
	});
});
