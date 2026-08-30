import { describe, it, expect } from 'vitest';
import { harLoebendeAbonnement, forlobReglerFor } from './forlobRegler';
import type { UserDoc } from '$lib/types';

const DAG = 24 * 60 * 60 * 1000;
const bruger = (over: Partial<UserDoc> = {}) => ({ ...over }) as UserDoc;

const FORLOB = {
	navn: 'Kickstart August 2026',
	maaltidsFokus: [{ fraDag: 0, tilDag: 7, maaltider: ['morgenmad'] }],
	traeningStartDag: 3
};

describe('harLoebendeAbonnement', () => {
	it('nej uden abo-felter', () => {
		expect(harLoebendeAbonnement(bruger())).toBe(false);
		expect(harLoebendeAbonnement(null)).toBe(false);
	});

	it('ja naar abonnementet loeber endnu', () => {
		expect(
			harLoebendeAbonnement(bruger({ aboProdukt: 'basisabo', aboSlutterAt: Date.now() + 30 * DAG }))
		).toBe(true);
	});

	it('nej naar perioden er udloebet', () => {
		expect(
			harLoebendeAbonnement(bruger({ aboProdukt: 'basisabo', aboSlutterAt: Date.now() - DAG }))
		).toBe(false);
	});

	it('ja for en konto uden slutdato, fx comp eller manuelt oprettet', () => {
		expect(harLoebendeAbonnement(bruger({ aboProdukt: 'basisabo' }))).toBe(true);
	});

	it('ser paa abo-felterne, ikke paa accessSource', () => {
		// Importen skrev accessSource om til forloeb. Hun er stadig app-kunde.
		const u = bruger({
			accessSource: 'forløb',
			activeSubscription: false,
			aboProdukt: 'basisabo',
			aboSlutterAt: Date.now() + 90 * DAG
		});
		expect(harLoebendeAbonnement(u)).toBe(true);
	});
});

describe('forlobReglerFor', () => {
	it('lader forloebets regler staa for en rigtig deltager', () => {
		const r = forlobReglerFor(FORLOB, bruger({ accessSource: 'forløb' }));
		expect(r?.traeningStartDag).toBe(3);
		expect(r?.maaltidsFokus).toHaveLength(1);
	});

	it('fjerner begraensningerne for en app-kunde', () => {
		const r = forlobReglerFor(
			FORLOB,
			bruger({ aboProdukt: 'basisabo', aboSlutterAt: Date.now() + 30 * DAG })
		);
		expect(r?.traeningStartDag).toBeUndefined();
		expect(r?.maaltidsFokus).toBeUndefined();
	});

	it('roerer ikke resten af forloebet', () => {
		const r = forlobReglerFor(
			FORLOB,
			bruger({ aboProdukt: 'basisabo', aboSlutterAt: Date.now() + 30 * DAG })
		);
		expect(r?.navn).toBe('Kickstart August 2026');
	});

	it('giver null naar der ikke er noget forloeb', () => {
		expect(forlobReglerFor(null, bruger())).toBeNull();
	});
});
