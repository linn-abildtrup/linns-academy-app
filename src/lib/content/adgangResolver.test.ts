import { describe, it, expect } from 'vitest';
import { resolverAktuelAdgang, type ForlobVindue, type AboPeriode } from './adgangResolver';

const nu = 1_000_000_000_000;
const dag = 86400000;

const forlob = (o: Partial<ForlobVindue>): ForlobVindue => ({
	id: 'f1',
	startMs: nu - 10 * dag,
	slutMs: nu + 10 * dag,
	accessLevel: 'premium',
	activeProduct: 'sommerro_ny',
	...o
});
const abo = (o: Partial<AboPeriode>): AboPeriode => ({
	produkt: 'premiumabo',
	accessLevel: 'premium',
	slutterAt: nu + 100 * dag,
	...o
});

describe('resolverAktuelAdgang', () => {
	it('aktivt forløb vinder over abo', () => {
		const r = resolverAktuelAdgang(nu, [forlob({})], abo({}));
		expect(r.state).toBe('forlobskunde');
		expect(r.accessSource).toBe('forløb');
		expect(r.aktivtForlobId).toBe('f1');
	});

	it('før forløb-start: app-kunde (abo gyldig)', () => {
		const r = resolverAktuelAdgang(nu, [forlob({ startMs: nu + 5 * dag })], abo({}));
		expect(r.state).toBe('modulbruger');
		expect(r.activeProduct).toBe('premiumabo');
	});

	it('efter forløb-slut med gyldig abo: tilbage til app', () => {
		const r = resolverAktuelAdgang(nu, [forlob({ slutMs: nu - dag })], abo({}));
		expect(r.state).toBe('modulbruger');
		expect(r.accessSource).toBe('abonnement');
	});

	it('efter forløb-slut med UDLØBET abo: udlobet (lydløst)', () => {
		const r = resolverAktuelAdgang(nu, [forlob({ slutMs: nu - dag })], abo({ slutterAt: nu - 2 * dag }));
		expect(r.state).toBe('udlobet');
	});

	it('abo udløber MENS forløbet kører: stadig forløbskunde (abo lapser lydløst)', () => {
		const r = resolverAktuelAdgang(nu, [forlob({})], abo({ slutterAt: nu - dag }));
		expect(r.state).toBe('forlobskunde');
	});

	it('ingen forløb, gyldig abo: app-kunde', () => {
		expect(resolverAktuelAdgang(nu, [], abo({})).state).toBe('modulbruger');
	});

	it('ingen forløb, udløbet abo: udlobet', () => {
		expect(resolverAktuelAdgang(nu, [], abo({ slutterAt: nu - dag })).state).toBe('udlobet');
	});

	it('comp-abo uden slutdato: løbende app-adgang', () => {
		const r = resolverAktuelAdgang(nu, [], abo({ slutterAt: undefined }));
		expect(r.state).toBe('modulbruger');
		expect(r.expiresAt).toBeUndefined();
	});

	it('hverken forløb eller abo: udlobet', () => {
		expect(resolverAktuelAdgang(nu, [], {}).state).toBe('udlobet');
	});

	it('ved overlappende forløb vælges det med senest slut', () => {
		const r = resolverAktuelAdgang(
			nu,
			[
				forlob({ id: 'kort', slutMs: nu + 2 * dag }),
				forlob({ id: 'lang', slutMs: nu + 30 * dag })
			],
			abo({})
		);
		expect(r.aktivtForlobId).toBe('lang');
	});
});
