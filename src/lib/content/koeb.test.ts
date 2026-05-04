import { describe, it, expect } from 'vitest';
import { getKoebForUser, formatUdlobsdato } from './koeb';

describe('getKoebForUser', () => {
	it('returnerer 2 køb for forløbskunde', () => {
		const koeb = getKoebForUser('forlobskunde');
		expect(koeb).toHaveLength(2);
	});

	it('forløbskunde får Kickstart aktiv som første køb', () => {
		const koeb = getKoebForUser('forlobskunde');
		expect(koeb[0].kortNavn).toBe('Kickstart');
		expect(koeb[0].status).toBe('aktiv');
	});

	it('forløbskunde får Vanetracker aktiv som andet køb', () => {
		const koeb = getKoebForUser('forlobskunde');
		expect(koeb[1].kortNavn).toBe('Vanetracker');
		expect(koeb[1].status).toBe('aktiv');
	});

	it('returnerer 3 køb for modulbruger', () => {
		const koeb = getKoebForUser('modulbruger');
		expect(koeb).toHaveLength(3);
	});

	it('alle modulbruger-køb er aktive', () => {
		const koeb = getKoebForUser('modulbruger');
		expect(koeb.every((k) => k.status === 'aktiv')).toBe(true);
	});

	it('returnerer 2 køb for udløbet', () => {
		const koeb = getKoebForUser('udlobet');
		expect(koeb).toHaveLength(2);
	});

	it('alle udløbet-køb har læseadgang-status', () => {
		const koeb = getKoebForUser('udlobet');
		expect(koeb.every((k) => k.status === 'laeseadgang')).toBe(true);
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
