import { describe, it, expect } from 'vitest';
import {
	beregnDagsStatus,
	beregnFlowerNiveau,
	vaneStatistik,
	beregnSamletFremgang,
	CHECKIN_SPORGSMAAL,
	type VaneProgramDag,
	type VanedagEntry
} from './vaner';

const baselineDag: VaneProgramDag = {
	dagNummer: 0,
	uge: 0,
	reflection: '',
	checks: [],
	bonus: null,
	isCheckin: true,
	isBaseline: true,
	isWin: false
};

const dag3: VaneProgramDag = {
	dagNummer: 3,
	uge: 1,
	reflection: 'Hvordan har min krop det?',
	checks: [
		{ id: 'pm', label: 'Protein til morgenmad' },
		{ id: 'fi', label: '30g fiber' },
		{ id: 'mk', label: 'Mikrotræning 3 min' }
	],
	bonus: { id: 'b3', label: 'Træk vejret 1 min' },
	isCheckin: false,
	isBaseline: false,
	isWin: false
};

const dag7: VaneProgramDag = {
	...dag3,
	dagNummer: 7,
	isCheckin: true
};

const tomEntry = (dagNummer: number): VanedagEntry => ({
	dagNummer,
	checks: {},
	bonus: {},
	checkin: {},
	note: ''
});

describe('beregnDagsStatus', () => {
	describe('baseline', () => {
		it('empty når ingen check-in svar er sat', () => {
			expect(beregnDagsStatus(baselineDag, tomEntry(0))).toBe('empty');
		});

		it('completed når alle 5 check-in svar er sat', () => {
			const e = tomEntry(0);
			e.checkin = { energi: 7, mave: 6, cravings: 5, humor: 8, sovn: 7 };
			expect(beregnDagsStatus(baselineDag, e)).toBe('completed');
		});

		it('partial når kun nogle check-in svar er sat', () => {
			const e = tomEntry(0);
			e.checkin = { energi: 7, mave: 6 };
			expect(beregnDagsStatus(baselineDag, e)).toBe('partial');
		});

		it('empty når entry er null', () => {
			expect(beregnDagsStatus(baselineDag, null)).toBe('empty');
		});
	});

	describe('almindelig dag', () => {
		it('empty når intet er svaret', () => {
			expect(beregnDagsStatus(dag3, tomEntry(3))).toBe('empty');
		});

		it('completed når alle vaner er ja', () => {
			const e = tomEntry(3);
			e.checks = { pm: 'ja', fi: 'ja', mk: 'ja' };
			expect(beregnDagsStatus(dag3, e)).toBe('completed');
		});

		it('partial når kun en vane er ja', () => {
			const e = tomEntry(3);
			e.checks = { pm: 'ja' };
			expect(beregnDagsStatus(dag3, e)).toBe('partial');
		});

		it('partial når en vane er delvist', () => {
			const e = tomEntry(3);
			e.checks = { pm: 'ja', fi: 'delvist', mk: 'ja' };
			expect(beregnDagsStatus(dag3, e)).toBe('partial');
		});

		it('partial når kun bonus er svaret', () => {
			const e = tomEntry(3);
			e.bonus = { b3: 'ja' };
			expect(beregnDagsStatus(dag3, e)).toBe('partial');
		});

		it('partial når kun note er skrevet', () => {
			const e = tomEntry(3);
			e.note = 'En vigtig refleksion';
			expect(beregnDagsStatus(dag3, e)).toBe('partial');
		});
	});

	describe('check-in dag (dag 7)', () => {
		it('partial når alle vaner er ja men check-in mangler', () => {
			const e = tomEntry(7);
			e.checks = { pm: 'ja', fi: 'ja', mk: 'ja' };
			expect(beregnDagsStatus(dag7, e)).toBe('partial');
		});

		it('completed når alle vaner og check-in er udfyldt', () => {
			const e = tomEntry(7);
			e.checks = { pm: 'ja', fi: 'ja', mk: 'ja' };
			e.checkin = { energi: 7, mave: 6, cravings: 5, humor: 8, sovn: 7 };
			expect(beregnDagsStatus(dag7, e)).toBe('completed');
		});
	});
});

describe('beregnFlowerNiveau', () => {
	it('none når intet er svaret', () => {
		expect(beregnFlowerNiveau(dag3, tomEntry(3))).toBe('none');
	});

	it('excellent når alle vaner er ja', () => {
		const e = tomEntry(3);
		e.checks = { pm: 'ja', fi: 'ja', mk: 'ja' };
		expect(beregnFlowerNiveau(dag3, e)).toBe('excellent');
	});

	it('good når 2 ja og 1 delvist (83%)', () => {
		const e = tomEntry(3);
		e.checks = { pm: 'ja', fi: 'ja', mk: 'delvist' };
		expect(beregnFlowerNiveau(dag3, e)).toBe('good');
	});

	it('medium når 2 ja og 1 nej (67%)', () => {
		const e = tomEntry(3);
		e.checks = { pm: 'ja', fi: 'ja', mk: 'nej' };
		expect(beregnFlowerNiveau(dag3, e)).toBe('medium');
	});

	it('low når 1 ja og 1 delvist (50%)', () => {
		const e = tomEntry(3);
		e.checks = { pm: 'ja', fi: 'delvist' };
		expect(beregnFlowerNiveau(dag3, e)).toBe('low');
	});

	it('low når 1 ja af 3 (33%)', () => {
		const e = tomEntry(3);
		e.checks = { pm: 'ja' };
		expect(beregnFlowerNiveau(dag3, e)).toBe('low');
	});

	it('poor når kun 1 delvist af 3 (17%)', () => {
		const e = tomEntry(3);
		e.checks = { pm: 'delvist' };
		expect(beregnFlowerNiveau(dag3, e)).toBe('poor');
	});

	it('none når en dag ingen checks har', () => {
		const dagUdenChecks: VaneProgramDag = { ...dag3, checks: [] };
		expect(beregnFlowerNiveau(dagUdenChecks, tomEntry(3))).toBe('none');
	});

	it('baseline excellent når alle 5 check-in svar er sat', () => {
		const e = tomEntry(0);
		e.checkin = { energi: 5, mave: 5, cravings: 5, humor: 5, sovn: 5 };
		expect(beregnFlowerNiveau(baselineDag, e)).toBe('excellent');
	});

	it('baseline none når check-in er ufuldstændig', () => {
		const e = tomEntry(0);
		e.checkin = { energi: 5, mave: 5 };
		expect(beregnFlowerNiveau(baselineDag, e)).toBe('none');
	});
});

describe('vaneStatistik', () => {
	const program: VaneProgramDag[] = [dag3, { ...dag3, dagNummer: 4 }, { ...dag3, dagNummer: 5 }];

	it('returnerer 0/0 når ingen dage er besvaret', () => {
		const r = vaneStatistik('pm', program, new Map());
		expect(r).toEqual({ antal: 0, score: 0 });
	});

	it('beregner score som procent af 1', () => {
		const e = new Map<number, VanedagEntry>();
		e.set(3, { ...tomEntry(3), checks: { pm: 'ja' } });
		e.set(4, { ...tomEntry(4), checks: { pm: 'ja' } });
		const r = vaneStatistik('pm', program, e);
		expect(r).toEqual({ antal: 2, score: 100 });
	});

	it('delvist tæller som 0.5', () => {
		const e = new Map<number, VanedagEntry>();
		e.set(3, { ...tomEntry(3), checks: { pm: 'ja' } });
		e.set(4, { ...tomEntry(4), checks: { pm: 'delvist' } });
		const r = vaneStatistik('pm', program, e);
		expect(r).toEqual({ antal: 2, score: 75 });
	});

	it('inkluderer kun dage hvor vanen er besvaret', () => {
		const e = new Map<number, VanedagEntry>();
		e.set(3, { ...tomEntry(3), checks: { pm: 'ja' } });
		e.set(4, tomEntry(4)); // ingen pm
		const r = vaneStatistik('pm', program, e);
		expect(r.antal).toBe(1);
		expect(r.score).toBe(100);
	});
});

describe('beregnSamletFremgang', () => {
	const program: VaneProgramDag[] = [
		baselineDag,
		{ ...dag3, dagNummer: 1 },
		{ ...dag3, dagNummer: 2 },
		{ ...dag3, dagNummer: 3 }
	];

	it('returnerer 0/0 når intet er åbent', () => {
		const r = beregnSamletFremgang(program, new Map(), 0);
		expect(r).toEqual({ gennemforte: 0, iAlt: 0 });
	});

	it('tæller kun gennemførte dage', () => {
		const e = new Map<number, VanedagEntry>();
		e.set(1, { ...tomEntry(1), checks: { pm: 'ja', fi: 'ja', mk: 'ja' } });
		e.set(2, { ...tomEntry(2), checks: { pm: 'ja' } }); // partial
		const r = beregnSamletFremgang(program, e, 3);
		expect(r).toEqual({ gennemforte: 1, iAlt: 3 });
	});

	it('udelukker baseline-dag fra fremgangstælling', () => {
		const e = new Map<number, VanedagEntry>();
		e.set(0, { ...tomEntry(0), checkin: { energi: 5, mave: 5, cravings: 5, humor: 5, sovn: 5 } });
		const r = beregnSamletFremgang(program, e, 0);
		expect(r.iAlt).toBe(0);
	});
});

describe('CHECKIN_SPORGSMAAL', () => {
	it('har præcis fem spørgsmål', () => {
		expect(CHECKIN_SPORGSMAAL).toHaveLength(5);
	});

	it('har stabile id-værdier', () => {
		expect(CHECKIN_SPORGSMAAL.map((q) => q.id)).toEqual([
			'energi',
			'mave',
			'cravings',
			'humor',
			'sovn'
		]);
	});
});
