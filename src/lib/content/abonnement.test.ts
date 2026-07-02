import { describe, it, expect } from 'vitest';
import { aboVisning, PAAMIND_DAGE } from './abonnement';
import type { UserDoc } from '$lib/types';

function ud(overrides: Partial<UserDoc>): UserDoc {
	return { firstName: 'Test', email: 't@e.dk', createdAt: 0, ...overrides } as UserDoc;
}
const nu = Date.now();
const dag = 86400000;

describe('aboVisning', () => {
	it('uden aboSlutterAt: ingen periode, ingen påmindelse', () => {
		const v = aboVisning(ud({ accessSource: 'abonnement' }), nu);
		expect(v.harPeriode).toBe(false);
		expect(v.taetPaaUdloeb).toBe(false);
	});

	it('med slutdato langt ude: periode, men ingen påmindelse', () => {
		const v = aboVisning(ud({ aboSlutterAt: nu + 100 * dag }), nu);
		expect(v.harPeriode).toBe(true);
		expect(v.dageTilbage).toBe(100);
		expect(v.taetPaaUdloeb).toBe(false);
	});

	it('slutdato inden for påmindelses-vinduet: taetPaaUdloeb', () => {
		const v = aboVisning(ud({ aboSlutterAt: nu + 5 * dag }), nu);
		expect(v.taetPaaUdloeb).toBe(true);
		expect(v.dageTilbage).toBe(5);
	});

	it('præcis på grænsen (PAAMIND_DAGE dage) er stadig påmindelse', () => {
		const v = aboVisning(ud({ aboSlutterAt: nu + PAAMIND_DAGE * dag }), nu);
		expect(v.taetPaaUdloeb).toBe(true);
	});

	it('allerede passeret: ingen påmindelse, dageTilbage=0', () => {
		const v = aboVisning(ud({ aboSlutterAt: nu - 2 * dag }), nu);
		expect(v.taetPaaUdloeb).toBe(false);
		expect(v.dageTilbage).toBe(0);
	});
});
