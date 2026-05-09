import { describe, it, expect } from 'vitest';
import { getKoebForUser, formatUdlobsdato } from './koeb';

describe('getKoebForUser', () => {
	it('returnerer Kickstart aktiv for forløbskunde', () => {
		const koeb = getKoebForUser('forlobskunde');
		expect(koeb).toHaveLength(1);
		expect(koeb[0].kortNavn).toBe('Kickstart');
		expect(koeb[0].status).toBe('aktiv');
	});

	it('returnerer mikrotræning og kost for modulbruger', () => {
		const koeb = getKoebForUser('modulbruger');
		expect(koeb).toHaveLength(2);
	});

	it('alle modulbruger-køb er aktive', () => {
		const koeb = getKoebForUser('modulbruger');
		expect(koeb.every((k) => k.status === 'aktiv')).toBe(true);
	});

	it('returnerer Kickstart med læseadgang for udløbet', () => {
		const koeb = getKoebForUser('udlobet');
		expect(koeb).toHaveLength(1);
		expect(koeb[0].kortNavn).toBe('Kickstart');
		expect(koeb[0].status).toBe('laeseadgang');
	});

	it('udløbet-Kickstart har udløbsdato', () => {
		const koeb = getKoebForUser('udlobet');
		const kickstart = koeb.find((k) => k.kortNavn === 'Kickstart');
		expect(kickstart?.udlobsdato).toBe('2026-11-15');
	});
});

describe('formatUdlobsdato', () => {
	it('formaterer en dato i maj', () => {
		expect(formatUdlobsdato('2026-05-18')).toBe('18. maj 2026');
	});

	it('formaterer en dato i november', () => {
		expect(formatUdlobsdato('2026-11-15')).toBe('15. nov 2026');
	});

	it('formaterer en dato i januar', () => {
		expect(formatUdlobsdato('2027-01-05')).toBe('5. jan 2027');
	});
});
