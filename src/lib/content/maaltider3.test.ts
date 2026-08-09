import { describe, it, expect } from 'vitest';
import {
	opgoerDag,
	resumeAf,
	harProteinMaal,
	pladsTal,
	PROTEIN_DAGS_MAAL,
	FIBER_DAGS_MAAL,
	type MaaltidKilde
} from './maaltider3';

function m(delvis: Partial<MaaltidKilde> & { type: MaaltidKilde['type'] }): MaaltidKilde {
	return { id: Math.random().toString(36).slice(2), navn: 'Noget', totalP: 0, totalF: 0, ...delvis };
}

describe('harProteinMaal', () => {
	it('de tre maaltider har et maal', () => {
		expect(harProteinMaal('morgenmad')).toBe(true);
		expect(harProteinMaal('frokost')).toBe(true);
		expect(harProteinMaal('aftensmad')).toBe(true);
	});

	// Der skal aldrig staa "mangler 30 g" paa en haandfuld mandler.
	it('snack har intet maal', () => {
		expect(harProteinMaal('snack')).toBe(false);
	});
});

describe('resumeAf', () => {
	it('giver tom streng uden poster', () => {
		expect(resumeAf([])).toBe('');
	});

	it('viser ét navn som det er', () => {
		expect(resumeAf([{ navn: 'Skyr Skovbær' }])).toBe('Skyr Skovbær');
	});

	it('binder to sammen med og', () => {
		expect(resumeAf([{ navn: 'Skyr' }, { navn: 'Havregryn' }])).toBe('Skyr og Havregryn');
	});

	// To navne og et tal, ikke seks afkortede navne.
	it('taeller resten naar der er flere', () => {
		expect(resumeAf([{ navn: 'Skyr' }, { navn: 'Havregryn' }, { navn: 'Blåbær' }])).toBe(
			'Skyr, Havregryn og 1 mere'
		);
		expect(
			resumeAf([{ navn: 'A' }, { navn: 'B' }, { navn: 'C' }, { navn: 'D' }, { navn: 'E' }])
		).toBe('A, B og 3 mere');
	});

	it('springer tomme navne over', () => {
		expect(resumeAf([{ navn: 'Skyr' }, { navn: '  ' }])).toBe('Skyr');
	});
});

describe('opgoerDag', () => {
	const dag: MaaltidKilde[] = [
		m({ type: 'morgenmad', navn: 'Skyr Skovbær', totalP: 18, totalF: 1, opdateretMs: 100 }),
		m({ type: 'morgenmad', navn: 'Havregryn', totalP: 5, totalF: 5, opdateretMs: 200 }),
		m({ type: 'frokost', navn: 'Kylling', totalP: 26, totalF: 2, opdateretMs: 300 }),
		m({ type: 'snack', navn: 'Mandler', totalP: 6, totalF: 3, opdateretMs: 400 }),
		m({ type: 'snack', navn: 'Banan', totalP: 1, totalF: 3, opdateretMs: 500 })
	];

	it('laver fire pladser i fast raekkefoelge', () => {
		const o = opgoerDag(dag);
		expect(o.pladser.map((p) => p.type)).toEqual([
			'morgenmad',
			'frokost',
			'aftensmad',
			'snack'
		]);
	});

	it('lægger maaltidernes protein sammen pr plads', () => {
		const o = opgoerDag(dag);
		expect(o.pladser[0].protein).toBe(23);
		expect(o.pladser[1].protein).toBe(26);
	});

	// Det vigtigste af dem alle: snacken maa ikke forsvinde ud af dagen.
	it('taeller snacken med i dagens protein og fiber', () => {
		const o = opgoerDag(dag);
		expect(o.proteinIAlt).toBe(56);
		expect(o.fiberIAlt).toBe(14);
	});

	it('giver snack-pladsen hverken maal, stribe eller mangler', () => {
		const snack = opgoerDag(dag).pladser[3];
		expect(snack.maal).toBeNull();
		expect(snack.procent).toBeNull();
		expect(snack.mangler).toBeNull();
		expect(snack.protein).toBe(7);
	});

	it('siger hvor meget der mangler paa de tre maaltider', () => {
		const o = opgoerDag(dag);
		expect(o.pladser[0].mangler).toBe(7);
		expect(o.pladser[2].mangler).toBe(30);
	});

	it('siger ikke at noget mangler naar maalet er naaet', () => {
		const o = opgoerDag([m({ type: 'frokost', totalP: 34 })]);
		expect(o.pladser[1].mangler).toBeNull();
		expect(o.pladser[1].procent).toBe(100);
	});

	it('lader ikke striben gaa over hundrede', () => {
		const o = opgoerDag([m({ type: 'frokost', totalP: 90 })]);
		expect(o.pladser[1].procent).toBe(100);
	});

	// Naar hun tilfoejer flere ting i traek, skal den seneste staa foerst.
	it('saetter nyeste oeverst i pladsen', () => {
		const o = opgoerDag(dag);
		expect(o.pladser[0].poster.map((p) => p.navn)).toEqual(['Havregryn', 'Skyr Skovbær']);
	});

	it('folder pladsen sammen til én linje', () => {
		const o = opgoerDag(dag);
		expect(o.pladser[0].resume).toBe('Havregryn og Skyr Skovbær');
		expect(o.pladser[2].resume).toBe('');
	});

	it('bruger standardmaalene naar kunden ikke har sine egne', () => {
		const o = opgoerDag([]);
		expect(o.proteinMaal).toBe(PROTEIN_DAGS_MAAL);
		expect(o.fiberMaal).toBe(FIBER_DAGS_MAAL);
	});

	it('bruger kundens egne maal naar de er sat', () => {
		const o = opgoerDag([], { proteinMaal: 110, fiberMaal: 35 });
		expect(o.proteinMaal).toBe(110);
		expect(o.fiberMaal).toBe(35);
	});

	it('falder tilbage til standarden ved et ubrugeligt maal', () => {
		const o = opgoerDag([], { proteinMaal: 0 });
		expect(o.proteinMaal).toBe(PROTEIN_DAGS_MAAL);
	});

	it('taeller alle madvarer paa dagen', () => {
		expect(opgoerDag(dag).antalPoster).toBe(5);
	});

	it('taaler en helt tom dag', () => {
		const o = opgoerDag([]);
		expect(o.pladser).toHaveLength(4);
		expect(o.proteinIAlt).toBe(0);
		expect(o.pladser.every((p) => p.resume === '')).toBe(true);
	});

	describe('maaltids-fokus', () => {
		it('viser kun de maaltider Linn har aabnet', () => {
			const o = opgoerDag(dag, { tilladte: ['morgenmad', 'frokost'] });
			expect(o.pladser.map((p) => p.type)).toEqual(['morgenmad', 'frokost']);
		});

		// Ellers ville hendes dagstal se forkerte ud uden nogen forklaring.
		it('taeller stadig skjulte maaltider med i dagens tal', () => {
			const o = opgoerDag(dag, { tilladte: ['morgenmad'] });
			expect(o.proteinIAlt).toBe(56);
			expect(o.pladser).toHaveLength(1);
		});

		it('viser alle fire naar der ikke er sat fokus', () => {
			expect(opgoerDag(dag, { tilladte: null }).pladser).toHaveLength(4);
		});
	});
});

describe('pladsTal', () => {
	it('siger hvad der mangler paa en tom plads', () => {
		const o = opgoerDag([]);
		expect(pladsTal(o.pladser[0])).toBe('mangler 30 g');
	});

	it('viser tallet naar der er noget', () => {
		const o = opgoerDag([m({ type: 'morgenmad', totalP: 23 })]);
		expect(pladsTal(o.pladser[0])).toBe('23 g');
	});

	// Snack er tom paa en anden maade: der mangler ingenting.
	it('siger aldrig mangler paa en snack', () => {
		const o = opgoerDag([]);
		expect(pladsTal(o.pladser[3])).toBe('0 g');
	});
});
