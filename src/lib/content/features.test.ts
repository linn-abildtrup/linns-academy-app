import { describe, it, expect } from 'vitest';
import {
	kundetypeFor,
	harFeatureAdgang,
	STANDARD_MATRIX,
	FEATURES,
	type FeatureMatrix
} from './features';
import type { UserDoc } from '$lib/types';

function ud(overrides: Partial<UserDoc>): UserDoc {
	return {
		firstName: 'Test',
		email: 'test@example.com',
		accessLevel: 'premium',
		accessSource: 'forløb',
		createdAt: 0,
		...overrides
	} as UserDoc;
}

const kickstartKunde = ud({
	accessSource: 'forløb',
	aktivtTraeningsprogram: {
		kilde: 'tildelt',
		programId: 'mikrotraening_kettlebell',
		forlobId: 'kickstart_juni_2026'
	},
	forlobIds: ['kickstart_juni_2026']
});
const kropsroKunde = ud({
	accessSource: 'forløb',
	aktivtTraeningsprogram: {
		kilde: 'tildelt',
		programId: 'kropsro_84_med_kb',
		forlobId: 'kropsro_maj_2026'
	},
	forlobIds: ['kropsro_maj_2026']
});
const appKunde = ud({ accessLevel: 'basis', accessSource: 'abonnement', activeSubscription: true });
const udloebetKunde = ud({ accessSource: 'forløb', expiresAt: 1 });

describe('kundetypeFor', () => {
	it('aktiv Kickstart-forløbskunde -> kickstart', () => {
		expect(kundetypeFor(kickstartKunde)).toBe('kickstart');
	});
	it('aktiv Kropsro-forløbskunde -> kropsro', () => {
		expect(kundetypeFor(kropsroKunde)).toBe('kropsro');
	});
	it('app-abonnent -> app', () => {
		expect(kundetypeFor(appKunde)).toBe('app');
	});
	it('udløbet kunde -> null (ingen funktioner)', () => {
		expect(kundetypeFor(udloebetKunde)).toBeNull();
	});
	it('null userDoc -> null', () => {
		expect(kundetypeFor(null)).toBeNull();
	});
});

describe('STANDARD_MATRIX', () => {
	it('Kickstart + Kropsro har funktionerne (undtagen Linn AI + nul-dage); app ingen', () => {
		const slukketForAlle: string[] = ['linn-ai', 'nul-dage', 'byg-eget-program', 'ai-madplan'];
		for (const f of FEATURES) {
			const forventetForlob = !slukketForAlle.includes(f.key);
			expect(STANDARD_MATRIX.kickstart[f.key]).toBe(forventetForlob);
			expect(STANDARD_MATRIX.kropsro[f.key]).toBe(forventetForlob);
			expect(STANDARD_MATRIX.app[f.key]).toBe(false);
		}
	});

	it('Linn AI + nul-dage + byg-eget + ai-madplan er slukket for alle (styres via testere)', () => {
		for (const key of ['linn-ai', 'nul-dage', 'byg-eget-program', 'ai-madplan'] as const) {
			expect(STANDARD_MATRIX.kickstart[key]).toBe(false);
			expect(STANDARD_MATRIX.kropsro[key]).toBe(false);
			expect(STANDARD_MATRIX.app[key]).toBe(false);
		}
	});
});

describe('harFeatureAdgang', () => {
	it('bruger STANDARD_MATRIX som fallback når matrix er null', () => {
		// udvidet-naering er taendt for Kickstart, slukket for app i standard
		expect(harFeatureAdgang(kickstartKunde, null, 'udvidet-naering')).toBe(true);
		expect(harFeatureAdgang(appKunde, null, 'udvidet-naering')).toBe(false);
		// Linn AI er slukket for alle i standard
		expect(harFeatureAdgang(kickstartKunde, null, 'linn-ai')).toBe(false);
	});

	it('respekterer en custom matrix', () => {
		const custom: FeatureMatrix = {
			kickstart: { ...STANDARD_MATRIX.kickstart, 'linn-ai': false },
			kropsro: STANDARD_MATRIX.kropsro,
			fleksibelt: STANDARD_MATRIX.fleksibelt,
			app: { ...STANDARD_MATRIX.app, 'ai-madplan': true }
		};
		expect(harFeatureAdgang(kickstartKunde, custom, 'linn-ai')).toBe(false);
		expect(harFeatureAdgang(kickstartKunde, custom, 'udvidet-naering')).toBe(true);
		expect(harFeatureAdgang(appKunde, custom, 'ai-madplan')).toBe(true);
	});

	it('udløbet kunde har ingen funktioner uanset matrix', () => {
		expect(harFeatureAdgang(udloebetKunde, null, 'linn-ai')).toBe(false);
	});

	it('tester-undtagelse: udvalgt tester får funktionen uanset skemaet', () => {
		// app-kunde har normalt IKKE linn-ai, men som tester får hun den
		const tester = ud({
			accessLevel: 'basis',
			accessSource: 'abonnement',
			activeSubscription: true,
			testerFeatures: ['linn-ai']
		});
		expect(harFeatureAdgang(appKunde, null, 'linn-ai')).toBe(false);
		expect(harFeatureAdgang(tester, null, 'linn-ai')).toBe(true);
		// men kun for den funktion hun er tester for
		expect(harFeatureAdgang(tester, null, 'ai-madplan')).toBe(false);
	});

	it('falder tilbage til standard for en funktion uden gemt værdi', () => {
		// matrix mangler 'ai-opskrift' for kickstart -> brug standard (true)
		const delvis = {
			kickstart: { 'linn-ai': false },
			kropsro: {},
			app: {}
		} as unknown as FeatureMatrix;
		expect(harFeatureAdgang(kickstartKunde, delvis, 'ai-opskrift')).toBe(true);
		expect(harFeatureAdgang(kickstartKunde, delvis, 'linn-ai')).toBe(false);
	});
});

describe('harFeatureAdgang — fleksible/byggede forløb (fleksibelt-kolonne)', () => {
	// Byggede forløb (fx SommerRo) har activeProduct = forløbets egen produktNøgle.
	const fleksKunde = ud({
		accessSource: 'forløb',
		accessLevel: 'premium',
		activeProduct: 'sommerro_ny',
		forlobIds: ['sommerro_ny']
	});

	it('byggede forløb klassificeres som fleksibelt (via activeProduct)', () => {
		expect(kundetypeFor(fleksKunde)).toBe('fleksibelt');
	});

	it('fleksibelt har Linn AI tændt', () => {
		expect(harFeatureAdgang(fleksKunde, null, 'linn-ai')).toBe(true);
	});

	it('fleksibelt har IKKE beskeder-til-linn (kun Linn AI)', () => {
		expect(harFeatureAdgang(fleksKunde, null, 'beskeder-til-linn')).toBe(false);
	});

	it('fleksibelt har IKKE nul-dage', () => {
		expect(harFeatureAdgang(fleksKunde, null, 'nul-dage')).toBe(false);
	});

	it('fleksibelt har udvidet-naering og ai-opskrift (som Kropsro-niveau)', () => {
		expect(harFeatureAdgang(fleksKunde, null, 'udvidet-naering')).toBe(true);
		expect(harFeatureAdgang(fleksKunde, null, 'ai-opskrift')).toBe(true);
	});

	it('Kickstart og Kropsro beholder beskeder-til-linn (standard tændt)', () => {
		expect(harFeatureAdgang(kickstartKunde, null, 'beskeder-til-linn')).toBe(true);
		expect(harFeatureAdgang(kropsroKunde, null, 'beskeder-til-linn')).toBe(true);
	});

	it('udløbet fleksibel kunde får ingen funktioner', () => {
		const udloebet = ud({
			accessSource: 'forløb',
			expiresAt: 1,
			activeProduct: 'sommerro_ny',
			forlobIds: ['sommerro_ny']
		});
		expect(harFeatureAdgang(udloebet, null, 'linn-ai')).toBe(false);
	});
});
