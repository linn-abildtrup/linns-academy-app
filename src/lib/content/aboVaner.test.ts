import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
	formaterDato,
	parseDato,
	erUgentligCheckinDag,
	maksAntalVaner,
	dagensBonus,
	kanSkifteVaner,
	beregnLockUdloeb,
	beregnAboDagsStatus,
	beregnAboFlowerNiveau,
	aboVaneStatistik,
	beregnAboFremgang,
	LOCK_PERIODE_DAGE,
	type ValgtVane,
	type AboBonusForslag,
	type AboVanedagEntry,
	type AboVaneOpsaetning
} from './aboVaner';

const vaner3: ValgtVane[] = [
	{ id: 'pm', label: 'Protein til morgenmad', kilde: 'kurateret' },
	{ id: 'sk', label: '10.000 skridt', kilde: 'kurateret' },
	{ id: 'sv', label: '7+ timers søvn', kilde: 'egen' }
];

const bonusPulje: AboBonusForslag[] = [
	{ id: 'b1', label: 'Træk vejret 1 min' },
	{ id: 'b2', label: 'Gå 5 min udenfor' },
	{ id: 'b3', label: 'Drik et stort glas vand' }
];

const tomEntry = (dato: string): AboVanedagEntry => ({
	dato,
	checks: {},
	bonus: {},
	checkin: {},
	note: ''
});

describe('formaterDato / parseDato', () => {
	it('formaterer som YYYY-MM-DD med leading zeros', () => {
		expect(formaterDato(new Date(2026, 0, 5))).toBe('2026-01-05');
	});

	it('round-tripper en dato', () => {
		const d = new Date(2026, 4, 10);
		expect(formaterDato(parseDato(formaterDato(d)))).toBe('2026-05-10');
	});
});

describe('erUgentligCheckinDag', () => {
	it('søndag = true', () => {
		expect(erUgentligCheckinDag(new Date(2026, 4, 10))).toBe(true); // 10. maj 2026 er søndag
	});

	it('mandag = false', () => {
		expect(erUgentligCheckinDag(new Date(2026, 4, 11))).toBe(false);
	});
});

describe('maksAntalVaner', () => {
	it('basis = 3', () => {
		expect(maksAntalVaner('basis')).toBe(3);
	});

	it('premium = 7', () => {
		expect(maksAntalVaner('premium')).toBe(7);
	});
});

describe('dagensBonus', () => {
	it('returnerer null for tom pulje', () => {
		expect(dagensBonus([], '2026-05-10')).toBeNull();
	});

	it('er deterministisk for samme dato', () => {
		const a = dagensBonus(bonusPulje, '2026-05-10');
		const b = dagensBonus(bonusPulje, '2026-05-10');
		expect(a).toBe(b);
	});

	it('roterer mellem datoer', () => {
		const datoer = ['2026-05-10', '2026-05-11', '2026-05-12', '2026-05-13', '2026-05-14'];
		const ids = datoer.map((d) => dagensBonus(bonusPulje, d)?.id);
		const unikke = new Set(ids);
		expect(unikke.size).toBeGreaterThan(1);
	});
});

describe('kanSkifteVaner / beregnLockUdloeb', () => {
	it('null opsætning = altid lov til at vælge', () => {
		expect(kanSkifteVaner(null)).toBe(true);
	});

	it('låst hvis laastIndtil er i fremtiden', () => {
		const fremtid = new Date();
		fremtid.setDate(fremtid.getDate() + 5);
		const o: AboVaneOpsaetning = {
			valgteVaner: vaner3,
			produktType: 'basis',
			laastIndtil: Timestamp.fromDate(fremtid),
			oprettetAt: Timestamp.now(),
			opdateretAt: Timestamp.now()
		};
		expect(kanSkifteVaner(o)).toBe(false);
	});

	it('åben hvis laastIndtil er i fortiden', () => {
		const fortid = new Date();
		fortid.setDate(fortid.getDate() - 1);
		const o: AboVaneOpsaetning = {
			valgteVaner: vaner3,
			produktType: 'basis',
			laastIndtil: Timestamp.fromDate(fortid),
			oprettetAt: Timestamp.now(),
			opdateretAt: Timestamp.now()
		};
		expect(kanSkifteVaner(o)).toBe(true);
	});

	it('beregnLockUdloeb = nu + 21 dage', () => {
		const nu = new Date(2026, 4, 10);
		const udloeb = beregnLockUdloeb(nu);
		const diff = (udloeb.getTime() - nu.getTime()) / (1000 * 60 * 60 * 24);
		expect(Math.round(diff)).toBe(LOCK_PERIODE_DAGE);
	});
});

describe('beregnAboDagsStatus', () => {
	const bonus = bonusPulje[0];

	it('empty når intet er svaret', () => {
		expect(beregnAboDagsStatus(vaner3, bonus, false, tomEntry('2026-05-10'))).toBe('empty');
	});

	it('completed når alle vaner er ja og ikke check-in dag', () => {
		const e = tomEntry('2026-05-11');
		e.checks = { pm: 'ja', sk: 'ja', sv: 'ja' };
		expect(beregnAboDagsStatus(vaner3, bonus, false, e)).toBe('completed');
	});

	it('partial når kun nogle vaner er ja', () => {
		const e = tomEntry('2026-05-11');
		e.checks = { pm: 'ja' };
		expect(beregnAboDagsStatus(vaner3, bonus, false, e)).toBe('partial');
	});

	it('partial på check-in dag når sliders mangler men vaner er ja', () => {
		const e = tomEntry('2026-05-10');
		e.checks = { pm: 'ja', sk: 'ja', sv: 'ja' };
		expect(beregnAboDagsStatus(vaner3, bonus, true, e)).toBe('partial');
	});

	it('completed på check-in dag når alt er udfyldt', () => {
		const e = tomEntry('2026-05-10');
		e.checks = { pm: 'ja', sk: 'ja', sv: 'ja' };
		e.checkin = { energi: 7, mave: 6, cravings: 5, humor: 8, sovn: 7 };
		expect(beregnAboDagsStatus(vaner3, bonus, true, e)).toBe('completed');
	});

	it('partial når kun bonus er svaret', () => {
		const e = tomEntry('2026-05-11');
		e.bonus = { b1: 'ja' };
		expect(beregnAboDagsStatus(vaner3, bonus, false, e)).toBe('partial');
	});

	it('partial når kun note er skrevet', () => {
		const e = tomEntry('2026-05-11');
		e.note = 'En refleksion';
		expect(beregnAboDagsStatus(vaner3, bonus, false, e)).toBe('partial');
	});
});

describe('beregnAboFlowerNiveau', () => {
	it('none uden valgte vaner', () => {
		expect(beregnAboFlowerNiveau([], tomEntry('2026-05-10'))).toBe('none');
	});

	it('excellent når alle ja', () => {
		const e = tomEntry('2026-05-10');
		e.checks = { pm: 'ja', sk: 'ja', sv: 'ja' };
		expect(beregnAboFlowerNiveau(vaner3, e)).toBe('excellent');
	});

	it('good når 2 ja og 1 delvist', () => {
		const e = tomEntry('2026-05-10');
		e.checks = { pm: 'ja', sk: 'ja', sv: 'delvist' };
		expect(beregnAboFlowerNiveau(vaner3, e)).toBe('good');
	});

	it('low når 1 af 3', () => {
		const e = tomEntry('2026-05-10');
		e.checks = { pm: 'ja' };
		expect(beregnAboFlowerNiveau(vaner3, e)).toBe('low');
	});
});

describe('aboVaneStatistik', () => {
	it('returnerer 0/0 for tom liste', () => {
		expect(aboVaneStatistik('pm', [])).toEqual({ antal: 0, score: 0 });
	});

	it('beregner score', () => {
		const entries: AboVanedagEntry[] = [
			{ ...tomEntry('2026-05-10'), checks: { pm: 'ja' } },
			{ ...tomEntry('2026-05-11'), checks: { pm: 'delvist' } },
			{ ...tomEntry('2026-05-12'), checks: { pm: 'ja' } }
		];
		expect(aboVaneStatistik('pm', entries)).toEqual({ antal: 3, score: 83 });
	});

	it('udelukker dage uden svar på den vane', () => {
		const entries: AboVanedagEntry[] = [
			{ ...tomEntry('2026-05-10'), checks: { pm: 'ja' } },
			{ ...tomEntry('2026-05-11'), checks: {} }
		];
		expect(aboVaneStatistik('pm', entries)).toEqual({ antal: 1, score: 100 });
	});
});

describe('beregnAboFremgang', () => {
	it('tæller completed dage i interval', () => {
		const entries = new Map<string, AboVanedagEntry>();
		entries.set('2026-05-11', { ...tomEntry('2026-05-11'), checks: { pm: 'ja', sk: 'ja', sv: 'ja' } });
		entries.set('2026-05-12', { ...tomEntry('2026-05-12'), checks: { pm: 'ja' } });
		const r = beregnAboFremgang(vaner3, entries, bonusPulje, '2026-05-11', '2026-05-13');
		expect(r).toEqual({ gennemforte: 1, iAlt: 3 });
	});
});
