import { describe, it, expect } from 'vitest';
import {
	formaterHistorikDato,
	senesteEntry,
	type TraeningHistorikEntry
} from './traeningHistorik';

describe('formaterHistorikDato', () => {
	it('formaterer dato som YYYY-MM-DD med padding', () => {
		expect(formaterHistorikDato(new Date(2026, 0, 5))).toBe('2026-01-05');
		expect(formaterHistorikDato(new Date(2026, 11, 31))).toBe('2026-12-31');
	});

	it('håndterer enkelt-cifret måned og dag', () => {
		expect(formaterHistorikDato(new Date(2026, 2, 9))).toBe('2026-03-09');
	});
});

describe('senesteEntry', () => {
	const tidlig: TraeningHistorikEntry = {
		dato: '2026-05-20',
		kilde: 'mikrotraening',
		programNavn: 'Mikrotræning',
		gennemfoertAt: 1716200000000
	};
	const sen: TraeningHistorikEntry = {
		dato: '2026-05-20',
		kilde: 'eget',
		programId: 'mit-program',
		programNavn: 'Mit ben-program',
		gennemfoertAt: 1716210000000
	};

	it('returnerer null for tom liste', () => {
		expect(senesteEntry([])).toBeNull();
	});

	it('returnerer den eneste entry hvis kun én', () => {
		expect(senesteEntry([tidlig])).toBe(tidlig);
	});

	it('returnerer den seneste entry baseret på gennemfoertAt', () => {
		expect(senesteEntry([tidlig, sen])).toBe(sen);
		expect(senesteEntry([sen, tidlig])).toBe(sen);
	});
});
