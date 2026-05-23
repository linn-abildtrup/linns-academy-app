import { describe, it, expect } from 'vitest';
import { getKoebForUser, formatUdlobsdato } from './koeb';
import type { UserDoc } from '$lib/types';

function lavUserDoc(overrides: Partial<UserDoc>): UserDoc {
	return {
		firstName: 'Test',
		email: 'test@example.com',
		state: 'modulbruger',
		createdAt: Date.now(),
		...overrides
	};
}

describe('getKoebForUser', () => {
	it('returnerer "App" for basisabo-bruger', () => {
		const koeb = getKoebForUser(
			lavUserDoc({
				activeProduct: 'basisabo',
				accessLevel: 'basis',
				accessSource: 'abonnement'
			})
		);
		expect(koeb).toHaveLength(1);
		expect(koeb[0].kortNavn).toBe('App');
		expect(koeb[0].status).toBe('aktiv');
		expect(koeb[0].lobende).toBe(true);
	});

	it('returnerer "App" for premiumabo-bruger', () => {
		const koeb = getKoebForUser(
			lavUserDoc({
				activeProduct: 'premiumabo',
				accessLevel: 'premium',
				accessSource: 'abonnement'
			})
		);
		expect(koeb).toHaveLength(1);
		expect(koeb[0].kortNavn).toBe('App');
		expect(koeb[0].lobende).toBe(true);
	});

	it('returnerer Kickstart for kickstart-forløbskunde', () => {
		const koeb = getKoebForUser(
			lavUserDoc({
				state: 'forlobskunde',
				activeProduct: 'kickstart',
				accessLevel: 'basis',
				accessSource: 'forløb'
			})
		);
		expect(koeb).toHaveLength(1);
		expect(koeb[0].kortNavn).toBe('Kickstart');
		expect(koeb[0].status).toBe('aktiv');
		expect(koeb[0].lobende).toBe(false);
	});

	it('returnerer Kropsro for premiumforløb-kunde', () => {
		const koeb = getKoebForUser(
			lavUserDoc({
				state: 'forlobskunde',
				activeProduct: 'premiumforløb',
				accessLevel: 'premium',
				accessSource: 'forløb'
			})
		);
		expect(koeb).toHaveLength(1);
		expect(koeb[0].kortNavn).toBe('Kropsro');
	});

	it('returnerer Kickstart med læseadgang når bruger er i bonus-periode efter forløb', () => {
		const fremtid = Date.now() + 30 * 24 * 60 * 60 * 1000;
		const koeb = getKoebForUser(
			lavUserDoc({
				state: 'udlobet',
				activeProduct: 'kickstart',
				accessLevel: 'none',
				accessSource: 'forløb',
				bonusPeriodEndsAt: fremtid
			})
		);
		expect(koeb).toHaveLength(1);
		expect(koeb[0].status).toBe('laeseadgang');
		expect(koeb[0].udlobsdato).toBeDefined();
	});

	it('returnerer tom liste for bruger uden activeProduct', () => {
		const koeb = getKoebForUser(lavUserDoc({}));
		expect(koeb).toEqual([]);
	});

	it('returnerer tom liste for null userDoc', () => {
		expect(getKoebForUser(null)).toEqual([]);
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
