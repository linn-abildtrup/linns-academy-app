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
	aktivtTraeningsprogram: { kilde: 'tildelt', programId: 'mikrotraening_kettlebell', forlobId: 'kickstart_juni_2026' },
	forlobIds: ['kickstart_juni_2026']
});
const kropsroKunde = ud({
	accessSource: 'forløb',
	aktivtTraeningsprogram: { kilde: 'tildelt', programId: 'kropsro_84_med_kb', forlobId: 'kropsro_maj_2026' },
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

describe('STANDARD_MATRIX matcher nuværende adgang', () => {
	it('Kickstart + Kropsro har alle funktioner, app ingen', () => {
		for (const f of FEATURES) {
			expect(STANDARD_MATRIX.kickstart[f.key]).toBe(true);
			expect(STANDARD_MATRIX.kropsro[f.key]).toBe(true);
			expect(STANDARD_MATRIX.app[f.key]).toBe(false);
		}
	});
});

describe('harFeatureAdgang', () => {
	it('bruger STANDARD_MATRIX som fallback når matrix er null', () => {
		expect(harFeatureAdgang(kickstartKunde, null, 'linn-ai')).toBe(true);
		expect(harFeatureAdgang(appKunde, null, 'linn-ai')).toBe(false);
	});

	it('respekterer en custom matrix', () => {
		const custom: FeatureMatrix = {
			kickstart: { ...STANDARD_MATRIX.kickstart, 'linn-ai': false },
			kropsro: STANDARD_MATRIX.kropsro,
			app: { ...STANDARD_MATRIX.app, 'ai-madplan': true }
		};
		expect(harFeatureAdgang(kickstartKunde, custom, 'linn-ai')).toBe(false);
		expect(harFeatureAdgang(kickstartKunde, custom, 'udvidet-naering')).toBe(true);
		expect(harFeatureAdgang(appKunde, custom, 'ai-madplan')).toBe(true);
	});

	it('udløbet kunde har ingen funktioner uanset matrix', () => {
		expect(harFeatureAdgang(udloebetKunde, null, 'linn-ai')).toBe(false);
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
