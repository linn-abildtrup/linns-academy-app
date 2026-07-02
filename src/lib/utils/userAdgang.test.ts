import { describe, it, expect } from 'vitest';
import { effektivState } from './userAdgang';
import type { UserDoc } from '$lib/types';

function ud(overrides: Partial<UserDoc>): UserDoc {
	return {
		firstName: 'Test',
		email: 'test@example.com',
		accessLevel: 'premium',
		createdAt: 0,
		...overrides
	} as UserDoc;
}

const nu = Date.now();
const iGaar = nu - 86400000;
const iMorgen = nu + 86400000;

describe('effektivState — abo-udløb (aboSlutterAt)', () => {
	it('abo med aboSlutterAt i fremtiden er aktiv modulbruger', () => {
		const k = ud({ accessSource: 'abonnement', activeSubscription: true, aboSlutterAt: iMorgen });
		expect(effektivState(k)).toBe('modulbruger');
	});

	it('abo med aboSlutterAt i fortiden er udløbet', () => {
		const k = ud({ accessSource: 'abonnement', activeSubscription: true, aboSlutterAt: iGaar });
		expect(effektivState(k)).toBe('udlobet');
	});

	it('abo UDEN aboSlutterAt (comp/manuel) har løbende adgang', () => {
		const k = ud({ accessSource: 'abonnement', activeSubscription: true });
		expect(effektivState(k)).toBe('modulbruger');
	});

	it('forløbskunde påvirkes ikke af aboSlutterAt-logikken', () => {
		// accessSource=forløb: aboSlutterAt er irrelevant, expiresAt styrer.
		const aktiv = ud({ accessSource: 'forløb', expiresAt: iMorgen, aboSlutterAt: iGaar });
		expect(effektivState(aktiv)).toBe('forlobskunde');
		const udloebet = ud({ accessSource: 'forløb', expiresAt: iGaar });
		expect(effektivState(udloebet)).toBe('udlobet');
	});

	it('ingen accessLevel -> udlobet', () => {
		expect(effektivState(ud({ accessLevel: 'none', accessSource: 'abonnement' }))).toBe('udlobet');
	});
});
