import { describe, it, expect } from 'vitest';
import {
	beregnDagensTid,
	antalNormaleOvelser,
	harGennemfortDag,
	beregnProgramFremgang,
	naesteDag,
	type TrainingDay,
	type MikrotraeningFremgang
} from './mikrotraening';

const eksempelDag: TrainingDay = {
	dagNummer: 1,
	titel: 'overkrop',
	indledning: 'I dag arbejder vi med overkrop',
	exercises: [
		{ exerciseId: 'incline_pushup', sets: 3, workSec: 30, restSec: 10, bonus: false },
		{ exerciseId: 'bent_over_row', sets: 3, workSec: 30, restSec: 10, bonus: false },
		{ exerciseId: 'superman', sets: 3, workSec: 30, restSec: 10, bonus: true }
	]
};

describe('beregnDagensTid', () => {
	it('beregner total tid for tre øvelser med tre sæt', () => {
		// Pr øvelse: 3 sæt * 30s arbejd = 90s. 2 hvil * 10s = 20s. Total: 110s pr øvelse.
		// 3 øvelser * 110s = 330s
		expect(beregnDagensTid(eksempelDag)).toBe(330);
	});

	it('returnerer 0 for en dag uden øvelser', () => {
		const tom: TrainingDay = { dagNummer: 1, titel: '', indledning: '', exercises: [] };
		expect(beregnDagensTid(tom)).toBe(0);
	});

	it('håndterer en øvelse med kun ét sæt (ingen hvil)', () => {
		const enkel: TrainingDay = {
			dagNummer: 1,
			titel: '',
			indledning: '',
			exercises: [{ exerciseId: 'x', sets: 1, workSec: 30, restSec: 10, bonus: false }]
		};
		expect(beregnDagensTid(enkel)).toBe(30);
	});
});

describe('antalNormaleOvelser', () => {
	it('tæller kun ikke-bonus øvelser', () => {
		expect(antalNormaleOvelser(eksempelDag)).toBe(2);
	});

	it('returnerer 0 når alle øvelser er bonus', () => {
		const kunBonus: TrainingDay = {
			dagNummer: 1,
			titel: '',
			indledning: '',
			exercises: [{ exerciseId: 'x', sets: 3, workSec: 30, restSec: 10, bonus: true }]
		};
		expect(antalNormaleOvelser(kunBonus)).toBe(0);
	});

	it('tæller alle øvelser når ingen er bonus', () => {
		const ingenBonus: TrainingDay = {
			...eksempelDag,
			exercises: eksempelDag.exercises.map((ex) => ({ ...ex, bonus: false }))
		};
		expect(antalNormaleOvelser(ingenBonus)).toBe(3);
	});
});

describe('harGennemfortDag', () => {
	const fremgang: MikrotraeningFremgang = {
		gennemforte: [1, 2, 5],
		feedback: {}
	};

	it('returnerer true for gennemførte dage', () => {
		expect(harGennemfortDag(fremgang, 1)).toBe(true);
		expect(harGennemfortDag(fremgang, 5)).toBe(true);
	});

	it('returnerer false for dage der ikke er gennemført', () => {
		expect(harGennemfortDag(fremgang, 3)).toBe(false);
		expect(harGennemfortDag(fremgang, 21)).toBe(false);
	});
});

describe('beregnProgramFremgang', () => {
	it('returnerer 0 når intet er gennemført', () => {
		const fremgang: MikrotraeningFremgang = { gennemforte: [], feedback: {} };
		expect(beregnProgramFremgang(fremgang, 21)).toBe(0);
	});

	it('returnerer 100 når alle dage er gennemført', () => {
		const alle = Array.from({ length: 21 }, (_, i) => i + 1);
		const fremgang: MikrotraeningFremgang = { gennemforte: alle, feedback: {} };
		expect(beregnProgramFremgang(fremgang, 21)).toBe(100);
	});

	it('runder til nærmeste hele procent', () => {
		const fremgang: MikrotraeningFremgang = { gennemforte: [1, 2, 3], feedback: {} };
		expect(beregnProgramFremgang(fremgang, 21)).toBe(14);
	});

	it('returnerer 0 hvis antalDage er 0', () => {
		const fremgang: MikrotraeningFremgang = { gennemforte: [], feedback: {} };
		expect(beregnProgramFremgang(fremgang, 0)).toBe(0);
	});
});

describe('naesteDag', () => {
	it('returnerer dag 1 hvis intet er gennemført', () => {
		const fremgang: MikrotraeningFremgang = { gennemforte: [], feedback: {} };
		expect(naesteDag(fremgang, 21)).toBe(1);
	});

	it('returnerer den laveste ikke-gennemførte dag', () => {
		const fremgang: MikrotraeningFremgang = { gennemforte: [1, 2, 4], feedback: {} };
		expect(naesteDag(fremgang, 21)).toBe(3);
	});

	it('returnerer null når alle dage er gennemført', () => {
		const alle = Array.from({ length: 21 }, (_, i) => i + 1);
		const fremgang: MikrotraeningFremgang = { gennemforte: alle, feedback: {} };
		expect(naesteDag(fremgang, 21)).toBeNull();
	});

	it('springer over gennemførte dage i tilfældig rækkefølge', () => {
		const fremgang: MikrotraeningFremgang = { gennemforte: [3, 1, 5], feedback: {} };
		expect(naesteDag(fremgang, 21)).toBe(2);
	});
});
