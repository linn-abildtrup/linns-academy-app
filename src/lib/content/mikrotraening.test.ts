import { describe, it, expect } from 'vitest';
import {
	beregnDagensTid,
	antalNormaleOvelser,
	harGennemfortDag,
	beregnProgramFremgang,
	naesteDag,
	filtrerOvelserTilProgram,
	genererStandardProgram,
	markerDagSomGennemfort,
	registrerFeedback,
	tommeDageSkelet,
	maxNulDageForForlob,
	type Exercise,
	type TrainingDay,
	type MikrotraeningFremgang
} from './mikrotraening';

describe('maxNulDageForForlob', () => {
	it('Kropsro-prefix giver 21', () => {
		expect(maxNulDageForForlob('kropsro_maj_2026')).toBe(21);
	});

	it('andet (Kickstart) giver 14', () => {
		expect(maxNulDageForForlob('kickstart_juni_2026')).toBe(14);
		expect(maxNulDageForForlob(null)).toBe(14);
	});

	it('eksplicit pulje vinder over prefix-default', () => {
		expect(maxNulDageForForlob('sommer_reset_2026', 7)).toBe(7);
		expect(maxNulDageForForlob('kropsro_maj_2026', 0)).toBe(0);
	});

	it('ignorerer ugyldig pulje (negativ) og bruger default', () => {
		expect(maxNulDageForForlob('kickstart_juni_2026', -3)).toBe(14);
		expect(maxNulDageForForlob('sommer_reset_2026', null)).toBe(14);
	});
});

const eksempelExercises: Exercise[] = [
	{
		id: 'squat',
		name: 'Squat',
		desc: '',
		how: [],
		cat: 'ben',
		catLabel: 'Ben',
		tags: [],
		videoPath: 'squat.mp4',
		treaningsformer: ['mikrotraening'],
		udstyr: ['ingen'],
		aktiv: true
	},
	{
		id: 'goblet',
		name: 'Goblet squat',
		desc: '',
		how: [],
		cat: 'ben',
		catLabel: 'Ben',
		tags: [],
		videoPath: 'goblet.mp4',
		treaningsformer: ['mikrotraening'],
		udstyr: ['kettlebell'],
		aktiv: true
	},
	{
		id: 'pushup',
		name: 'Push-up',
		desc: '',
		how: [],
		cat: 'overkrop',
		catLabel: 'Overkrop',
		tags: [],
		videoPath: 'pushup.mp4',
		treaningsformer: ['mikrotraening'],
		udstyr: ['ingen'],
		aktiv: true
	},
	{
		id: 'planke',
		name: 'Planke',
		desc: '',
		how: [],
		cat: 'core',
		catLabel: 'Core',
		tags: [],
		videoPath: 'planke.mp4',
		treaningsformer: ['mikrotraening'],
		udstyr: ['ingen'],
		aktiv: true
	}
];

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

describe('filtrerOvelserTilProgram', () => {
	it('beholder alle øvelser når programmet bruger kettlebell', () => {
		const filtreret = filtrerOvelserTilProgram(eksempelExercises, ['kettlebell']);
		expect(filtreret.length).toBe(eksempelExercises.length);
	});

	it('fjerner kettlebell-øvelser når programmet er uden kettlebell', () => {
		const filtreret = filtrerOvelserTilProgram(eksempelExercises, ['ingen']);
		expect(filtreret.length).toBe(3);
		expect(filtreret.find((e) => e.id === 'goblet')).toBeUndefined();
	});

	it('returnerer tom liste hvis intet matcher', () => {
		const kunKettlebell: Exercise[] = [
			{ ...eksempelExercises[1] } // goblet med kettlebell
		];
		const filtreret = filtrerOvelserTilProgram(kunKettlebell, ['ingen']);
		expect(filtreret.length).toBe(0);
	});
});

describe('markerDagSomGennemfort', () => {
	it('tilføjer en ny dag til en tom liste', () => {
		const fremgang: MikrotraeningFremgang = { gennemforte: [], feedback: {} };
		const opdateret = markerDagSomGennemfort(fremgang, 1);
		expect(opdateret.gennemforte).toEqual([1]);
	});

	it('er idempotent — tilføjer ikke en dag der allerede står på listen', () => {
		const fremgang: MikrotraeningFremgang = { gennemforte: [1, 2], feedback: {} };
		const opdateret = markerDagSomGennemfort(fremgang, 2);
		expect(opdateret.gennemforte).toEqual([1, 2]);
	});

	it('returnerer en sorteret liste når dage tilføjes ude af rækkefølge', () => {
		const fremgang: MikrotraeningFremgang = { gennemforte: [3, 1], feedback: {} };
		const opdateret = markerDagSomGennemfort(fremgang, 2);
		expect(opdateret.gennemforte).toEqual([1, 2, 3]);
	});

	it('bevarer feedback uændret', () => {
		const fremgang: MikrotraeningFremgang = { gennemforte: [], feedback: { 1: 'let' } };
		const opdateret = markerDagSomGennemfort(fremgang, 2);
		expect(opdateret.feedback).toEqual({ 1: 'let' });
	});
});

describe('registrerFeedback', () => {
	it('tilføjer feedback for en ny dag', () => {
		const fremgang: MikrotraeningFremgang = { gennemforte: [1], feedback: {} };
		const opdateret = registrerFeedback(fremgang, 1, 'tilpas');
		expect(opdateret.feedback).toEqual({ 1: 'tilpas' });
	});

	it('overskriver eksisterende feedback for samme dag', () => {
		const fremgang: MikrotraeningFremgang = { gennemforte: [1], feedback: { 1: 'let' } };
		const opdateret = registrerFeedback(fremgang, 1, 'udfordrende');
		expect(opdateret.feedback).toEqual({ 1: 'udfordrende' });
	});

	it('bevarer feedback fra andre dage', () => {
		const fremgang: MikrotraeningFremgang = { gennemforte: [1, 2], feedback: { 1: 'let' } };
		const opdateret = registrerFeedback(fremgang, 2, 'tilpas');
		expect(opdateret.feedback).toEqual({ 1: 'let', 2: 'tilpas' });
	});

	it('bevarer gennemforte uændret', () => {
		const fremgang: MikrotraeningFremgang = { gennemforte: [1, 2, 3], feedback: {} };
		const opdateret = registrerFeedback(fremgang, 1, 'let');
		expect(opdateret.gennemforte).toEqual([1, 2, 3]);
	});
});

describe('genererStandardProgram', () => {
	it('genererer det rigtige antal dage', () => {
		const dage = genererStandardProgram(21, eksempelExercises);
		expect(dage.length).toBe(21);
	});

	it('giver hver dag tre øvelser: ben, overkrop og core/stabilitet', () => {
		const dage = genererStandardProgram(3, eksempelExercises);
		dage.forEach((dag) => {
			expect(dag.exercises.length).toBe(3);
			const cats = dag.exercises.map((e) => {
				const ex = eksempelExercises.find((x) => x.id === e.exerciseId);
				return ex?.cat;
			});
			expect(cats[0]).toBe('ben');
			expect(cats[1]).toBe('overkrop');
			expect(cats[2]).toMatch(/core|stabilitet/);
		});
	});

	it('default-værdier er 3 sæt × 30s × 10s, ingen bonus', () => {
		const dage = genererStandardProgram(1, eksempelExercises);
		const ex = dage[0].exercises[0];
		expect(ex.sets).toBe(3);
		expect(ex.workSec).toBe(30);
		expect(ex.restSec).toBe(10);
		expect(ex.bonus).toBe(false);
	});

	it('cycler øvelser deterministisk', () => {
		const dage = genererStandardProgram(4, eksempelExercises);
		expect(dage[0].exercises[0].exerciseId).toBe(dage[2].exercises[0].exerciseId);
		expect(dage[1].exercises[0].exerciseId).toBe(dage[3].exercises[0].exerciseId);
	});

	it('kaster fejl hvis en kategori er tom', () => {
		const kunBen = eksempelExercises.filter((e) => e.cat === 'ben');
		expect(() => genererStandardProgram(21, kunBen)).toThrow();
	});

	it('numererer dage fra 1', () => {
		const dage = genererStandardProgram(3, eksempelExercises);
		expect(dage[0].dagNummer).toBe(1);
		expect(dage[2].dagNummer).toBe(3);
	});
});

describe('tommeDageSkelet', () => {
	it('genererer det rigtige antal dage med tomme exercises-arrays', () => {
		const dage = tommeDageSkelet(5);
		expect(dage).toHaveLength(5);
		expect(dage[0].dagNummer).toBe(1);
		expect(dage[4].dagNummer).toBe(5);
		expect(dage.every((d) => d.exercises.length === 0)).toBe(true);
		expect(dage.every((d) => d.titel === '' && d.indledning === '')).toBe(true);
	});

	it('returnerer tom array for 0 dage', () => {
		expect(tommeDageSkelet(0)).toEqual([]);
	});
});
