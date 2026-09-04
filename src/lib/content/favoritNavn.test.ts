import { describe, expect, it } from 'vitest';
import {
	favoritNavnErOptaget,
	findFavoritMedNavn,
	normaliserFavoritNavn
} from './favoritNavn';
import type { FavoritMaaltid } from './kost';

const f = (id: string, navn: string): FavoritMaaltid => ({ id, navn, items: [] });

// Hannes rigtige liste fra 4. september 2026: fire favoritter, ét navn.
const HANNES_LISTE: FavoritMaaltid[] = [
	f('a', 'Morgenmad'),
	f('b', 'Morgenmad'),
	f('c', 'Morgenmad'),
	f('d', 'Morgenmad')
];

describe('normaliserFavoritNavn', () => {
	it('fjerner mellemrum i enderne', () => {
		expect(normaliserFavoritNavn('  Morgenmad ')).toBe('morgenmad');
	});

	it('slaar dobbelte mellemrum sammen', () => {
		expect(normaliserFavoritNavn('Yoghurt  med   baer')).toBe('yoghurt med baer');
	});

	it('regner store og sma bogstaver som det samme', () => {
		expect(normaliserFavoritNavn('MORGENMAD')).toBe(normaliserFavoritNavn('morgenmad'));
	});

	it('haandterer ae, oe og aa', () => {
		expect(normaliserFavoritNavn('GRØD MED ÆBLE OG BLÅBÆR')).toBe('grød med æble og blåbær');
	});

	it('giver tom streng for et navn der kun er mellemrum', () => {
		expect(normaliserFavoritNavn('   ')).toBe('');
	});
});

describe('findFavoritMedNavn', () => {
	it('finder favoritten uanset store bogstaver og mellemrum', () => {
		expect(findFavoritMedNavn(HANNES_LISTE, ' morgenmad ')?.id).toBe('a');
	});

	it('returnerer null naar navnet er nyt', () => {
		expect(findFavoritMedNavn(HANNES_LISTE, 'Yoghurt med baer og aeg')).toBeNull();
	});

	it('returnerer null for et tomt navn', () => {
		expect(findFavoritMedNavn(HANNES_LISTE, '  ')).toBeNull();
	});

	it('springer den favorit over der er undtaget', () => {
		expect(findFavoritMedNavn([f('a', 'Morgenmad')], 'Morgenmad', 'a')).toBeNull();
	});

	it('finder en anden med samme navn selv om én er undtaget', () => {
		expect(findFavoritMedNavn(HANNES_LISTE, 'Morgenmad', 'a')?.id).toBe('b');
	});

	it('returnerer null paa en tom liste', () => {
		expect(findFavoritMedNavn([], 'Morgenmad')).toBeNull();
	});
});

describe('favoritNavnErOptaget', () => {
	it('siger ja naar navnet findes', () => {
		expect(favoritNavnErOptaget(HANNES_LISTE, 'Morgenmad')).toBe(true);
	});

	it('siger nej naar navnet er nyt', () => {
		expect(favoritNavnErOptaget(HANNES_LISTE, 'Frokost')).toBe(false);
	});
});
