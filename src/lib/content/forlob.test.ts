import { describe, it, expect } from 'vitest';
import { getCurrentDay, formatDato, aktivtForlob } from './forlob';

describe('getCurrentDay', () => {
	it('returnerer 1 på første dag', () => {
		const forlob = { ...aktivtForlob, startDato: '2026-05-01' };
		const now = new Date(2026, 4, 1, 10, 0);
		expect(getCurrentDay(forlob, now)).toBe(1);
	});

	it('returnerer 8 på dag 8', () => {
		const forlob = { ...aktivtForlob, startDato: '2026-04-27' };
		const now = new Date(2026, 4, 4, 10, 0);
		expect(getCurrentDay(forlob, now)).toBe(8);
	});

	it('returnerer 21 på sidste dag af 21-dages forløb', () => {
		const forlob = { ...aktivtForlob, startDato: '2026-04-27' };
		const now = new Date(2026, 4, 17, 10, 0);
		expect(getCurrentDay(forlob, now)).toBe(21);
	});

	it('returnerer null hvis startdato er i fremtiden', () => {
		const forlob = { ...aktivtForlob, startDato: '2027-01-01' };
		const now = new Date(2026, 4, 4, 10, 0);
		expect(getCurrentDay(forlob, now)).toBeNull();
	});

	it('ignorerer klokkeslæt og bruger kun dato', () => {
		const forlob = { ...aktivtForlob, startDato: '2026-05-01' };
		const morgen = new Date(2026, 4, 1, 5, 0);
		const aften = new Date(2026, 4, 1, 23, 59);
		expect(getCurrentDay(forlob, morgen)).toBe(1);
		expect(getCurrentDay(forlob, aften)).toBe(1);
	});
});

describe('formatDato', () => {
	it('formaterer en mandag i januar', () => {
		const d = new Date(2026, 0, 5);
		expect(formatDato(d)).toBe('Mandag, 5. januar');
	});

	it('formaterer en tirsdag i juni', () => {
		const d = new Date(2026, 5, 2);
		expect(formatDato(d)).toBe('Tirsdag, 2. juni');
	});

	it('formaterer en søndag i december', () => {
		const d = new Date(2026, 11, 27);
		expect(formatDato(d)).toBe('Søndag, 27. december');
	});
});
