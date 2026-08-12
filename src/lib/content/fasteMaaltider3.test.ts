import { describe, it, expect } from 'vitest';
import {
	antalTing,
	brugsstatistik,
	delLinjer,
	erAendret,
	foreslaaNavn,
	kanKommeMed,
	linjeAftryk,
	maaltidFor,
	navnDuger,
	nyeLinjer,
	rensNavn,
	sorterTilHylde,
	vareAftryk,
	type DagsMaaltid,
	type FastMaaltid
} from './fasteMaaltider3';
import type { GemtMaaltid, MaaltidsItem, Maaltidstype } from './kost';

/** Ét maaltids-dokument som 3.0 skriver det: én madvare pr dokument. */
function vare(id: string, navn: string, foodId: string, portion = 100, enhedId = 'g'): GemtMaaltid {
	return {
		id,
		navn,
		type: 'morgenmad',
		dato: '2026-08-12',
		items: [{ foodId, portion, enhedId }],
		totalP: 0,
		totalF: 0
	};
}

/** En opskrift eller et fast maaltid lagt i som ÉN samlet linje. */
function sammensat(id: string, navn: string): GemtMaaltid {
	return {
		id,
		navn,
		type: 'morgenmad',
		dato: '2026-08-12',
		items: [{ foodId: '', portion: 1, manuel: { navn, enhed: 'portion' } }],
		totalP: 0,
		totalF: 0
	};
}

function fast(id: string, navn: string, varer: [string, number?][], maaltid?: Maaltidstype): FastMaaltid {
	return {
		id,
		navn,
		maaltid,
		items: varer.map(([foodId, portion]) => ({ foodId, portion: portion ?? 100, enhedId: 'g' }))
	};
}

function dag(dato: string, type: Maaltidstype, ...foodIds: string[]): DagsMaaltid {
	return { dato, type, items: foodIds.map((foodId) => ({ foodId })) };
}

describe('hvad der kan gemmes', () => {
	it('en madvare kan komme med', () => {
		expect(kanKommeMed({ foodId: 'havre', portion: 60 })).toBe(true);
	});

	// Den vigtigste regel i filen. En linje uden foodId taeller nul gram.
	it('en opskrift-linje kan IKKE komme med', () => {
		expect(kanKommeMed({ foodId: '', portion: 1, manuel: { navn: 'Kikaertesalat', enhed: 'portion' } })).toBe(
			false
		);
	});

	it('deler maaltidet i det der kan og det der ikke kan', () => {
		const { med, uden } = delLinjer([
			vare('a', 'Rugbrød', 'rug', 80),
			vare('b', 'Æg', 'aeg', 2),
			sammensat('c', 'Kikærtesalat')
		]);
		expect(med.map((i) => i.foodId)).toEqual(['rug', 'aeg']);
		expect(uden).toEqual(['Kikærtesalat']);
	});

	it('giver et tomt maaltid to tomme lister', () => {
		expect(delLinjer([])).toEqual({ med: [], uden: [] });
	});
});

describe('foreslaaNavn', () => {
	it('bruger madvarens eget navn naar der kun er én', () => {
		expect(foreslaaNavn([vare('a', 'Skyr, naturel', 'skyr')], 'morgenmad')).toBe('Skyr, naturel');
	});

	it('bruger maaltidets navn naar der er flere', () => {
		expect(foreslaaNavn([vare('a', 'Havregryn', 'havre'), vare('b', 'Skyr', 'skyr')], 'morgenmad')).toBe(
			'Morgenmad'
		);
	});

	// En opskrift kan ikke gemmes, saa den maa heller ikke give navnet.
	it('regner ikke en opskrift-linje med', () => {
		expect(foreslaaNavn([vare('a', 'Skyr', 'skyr'), sammensat('b', 'Grød')], 'frokost')).toBe('Skyr');
	});
});

describe('navnet', () => {
	it('trimmer og klemmer mellemrum sammen', () => {
		expect(rensNavn('  Havregrød   med skyr ')).toBe('Havregrød med skyr');
	});

	it('siger fra ved et tomt navn', () => {
		expect(navnDuger('   ')).toBe(false);
		expect(navnDuger('Grød')).toBe(true);
	});
});

describe('fingeraftryk', () => {
	it('vareAftryk er den samme uanset raekkefoelge', () => {
		expect(vareAftryk([{ foodId: 'a' }, { foodId: 'b' }])).toBe(vareAftryk([{ foodId: 'b' }, { foodId: 'a' }]));
	});

	// Den vigtige forskel paa de to. Maengden maa svinge naar vi taeller
	// brug, men ikke naar vi ser efter om hun har aendret noget.
	it('vareAftryk er ligeglad med maengden, linjeAftryk er ikke', () => {
		const a: MaaltidsItem[] = [{ foodId: 'havre', portion: 40, enhedId: 'g' }];
		const b: MaaltidsItem[] = [{ foodId: 'havre', portion: 60, enhedId: 'g' }];
		expect(vareAftryk(a)).toBe(vareAftryk(b));
		expect(linjeAftryk(a)).not.toBe(linjeAftryk(b));
	});

	it('springer linjer uden foodId over', () => {
		expect(linjeAftryk([{ foodId: '', portion: 1, manuel: { navn: 'Grød', enhed: 'portion' } }])).toBe('');
	});
});

describe('brugsstatistik', () => {
	// 3.0 skriver ét dokument pr madvare, saa de fem linjer i et fast
	// maaltid ligger som fem dokumenter paa den samme dag.
	const historik: DagsMaaltid[] = [
		dag('2026-08-10', 'morgenmad', 'havre'),
		dag('2026-08-10', 'morgenmad', 'skyr'),
		dag('2026-08-10', 'morgenmad', 'baer'),
		dag('2026-08-11', 'morgenmad', 'havre'),
		dag('2026-08-11', 'morgenmad', 'skyr'),
		dag('2026-08-11', 'morgenmad', 'baer'),
		// Her mangler baer, saa groeden taeller ikke med den dag.
		dag('2026-08-12', 'morgenmad', 'havre'),
		dag('2026-08-12', 'morgenmad', 'skyr'),
		dag('2026-08-12', 'frokost', 'rug', 'aeg')
	];

	const groed = fast('f1', 'Havregrød med skyr', [['havre'], ['skyr'], ['baer']]);
	const rugbroed = fast('f2', 'Æggemad', [['rug'], ['aeg']]);

	it('taeller paa tvaers af dokumenterne fra den samme dag', () => {
		const b = brugsstatistik(historik, [groed]);
		expect(b.get('f1')?.antal).toBe(2);
	});

	it('taeller ikke en dag hvor en af madvarerne mangler', () => {
		const b = brugsstatistik(historik, [fast('f3', 'Kun bær', [['baer']])]);
		// Baer staar der den 10. og 11., ikke den 12.
		expect(b.get('f3')?.antal).toBe(2);
	});

	// Den gamle app skriver ét dokument med alle linjerne i. Det skal
	// give det samme svar, ellers ville tallet skifte alt efter hvilken
	// app hun brugte den dag.
	it('taeller den gamle apps form ens', () => {
		const gammel: DagsMaaltid[] = [dag('2026-09-01', 'morgenmad', 'havre', 'skyr', 'baer')];
		expect(brugsstatistik(gammel, [groed]).get('f1')?.antal).toBe(1);
	});

	it('gaetter maaltidet ud af historikken', () => {
		const b = brugsstatistik(historik, [groed, rugbroed]);
		expect(b.get('f1')?.maaltid).toBe('morgenmad');
		expect(b.get('f2')?.maaltid).toBe('frokost');
	});

	it('giver nul til et fast maaltid hun aldrig har brugt', () => {
		const b = brugsstatistik(historik, [fast('f4', 'Laks', [['laks']])]);
		expect(b.get('f4')).toEqual({ antal: 0, maaltid: undefined });
	});

	it('taaler et fast maaltid uden brugbare linjer', () => {
		const tomt: FastMaaltid = { id: 'f5', navn: 'Tom', items: [] };
		expect(brugsstatistik(historik, [tomt]).get('f5')).toEqual({ antal: 0 });
	});
});

describe('maaltidFor', () => {
	it('lader hendes eget valg vinde over gaettet', () => {
		const f = fast('f1', 'Grød', [['havre']], 'snack');
		expect(maaltidFor(f, { antal: 9, maaltid: 'morgenmad' })).toBe('snack');
	});

	// De 2.905 fra den gamle app har ingen maaltidstype.
	it('falder tilbage paa gaettet naar feltet mangler', () => {
		const f = fast('f1', 'Grød', [['havre']]);
		expect(maaltidFor(f, { antal: 9, maaltid: 'morgenmad' })).toBe('morgenmad');
	});

	it('giver undefined naar der hverken er felt eller historik', () => {
		expect(maaltidFor(fast('f1', 'Grød', [['havre']]), undefined)).toBeUndefined();
	});
});

describe('sorterTilHylde', () => {
	const a = fast('a', 'Æggemad', [['rug']], 'frokost');
	const b = fast('b', 'Havregrød', [['havre']], 'morgenmad');
	const c = fast('c', 'Skyr', [['skyr']], 'morgenmad');
	const brug = new Map([
		['a', { antal: 4 }],
		['b', { antal: 12 }],
		['c', { antal: 1 }]
	]);

	it('laegger dem der hoerer til maaltidet for sig', () => {
		const h = sorterTilHylde([a, b, c], brug, 'morgenmad');
		expect(h.tilMaaltidet.map((f) => f.id)).toEqual(['b', 'c']);
		expect(h.andre.map((f) => f.id)).toEqual(['a']);
	});

	it('saetter mest brugte oeverst', () => {
		const h = sorterTilHylde([c, b], brug, 'morgenmad');
		expect(h.tilMaaltidet.map((f) => f.id)).toEqual(['b', 'c']);
	});

	it('sorterer alfabetisk naar de er brugt lige meget', () => {
		const ens = new Map([
			['b', { antal: 2 }],
			['c', { antal: 2 }]
		]);
		const h = sorterTilHylde([c, b], ens, 'morgenmad');
		expect(h.tilMaaltidet.map((f) => f.navn)).toEqual(['Havregrød', 'Skyr']);
	});

	it('bruger det gaettede maaltid naar feltet mangler', () => {
		const uden = fast('d', 'Grød', [['havre']]);
		const h = sorterTilHylde([uden], new Map([['d', { antal: 3, maaltid: 'morgenmad' as Maaltidstype }]]), 'morgenmad');
		expect(h.tilMaaltidet.map((f) => f.id)).toEqual(['d']);
	});

	it('skjuler ikke noget, alt er med i én af de to', () => {
		const h = sorterTilHylde([a, b, c], brug, 'aftensmad');
		expect(h.tilMaaltidet.length + h.andre.length).toBe(3);
	});
});

describe('naar hun retter i det bagefter', () => {
	const groed = fast('f1', 'Havregrød med skyr', [
		['havre', 60],
		['skyr', 150],
		['baer', 50]
	]);

	// Hun havde en aeggemad staaende i forvejen. Den er ikke en del af
	// groeden, og den maa aldrig blive det.
	const foerIds = ['gammel'];
	const efterIlaegning: GemtMaaltid[] = [
		vare('gammel', 'Æggemad', 'rug', 80),
		vare('n1', 'Havregryn', 'havre', 60),
		vare('n2', 'Skyr', 'skyr', 150),
		vare('n3', 'Blåbær', 'baer', 50)
	];

	it('regner kun de nye linjer med', () => {
		expect(nyeLinjer(efterIlaegning, foerIds).map((i) => i.foodId)).toEqual(['havre', 'skyr', 'baer']);
	});

	it('spoerger ikke naar intet er aendret', () => {
		expect(erAendret(groed, nyeLinjer(efterIlaegning, foerIds))).toBe(false);
	});

	it('spoerger naar hun fjerner en af dem', () => {
		const uden = efterIlaegning.filter((p) => p.id !== 'n3');
		expect(erAendret(groed, nyeLinjer(uden, foerIds))).toBe(true);
	});

	it('spoerger naar hun laegger noget til', () => {
		const med = [...efterIlaegning, vare('n4', 'Mandler', 'mandler', 15)];
		expect(erAendret(groed, nyeLinjer(med, foerIds))).toBe(true);
	});

	it('spoerger naar hun aendrer maengden', () => {
		const anden = efterIlaegning.map((p) => (p.id === 'n1' ? vare('n1', 'Havregryn', 'havre', 90) : p));
		expect(erAendret(groed, nyeLinjer(anden, foerIds))).toBe(true);
	});

	// Fjerner hun den aeggemad der laa der i forvejen, har hun ikke
	// roert sit faste maaltid.
	it('spoerger IKKE naar hun fjerner noget der laa der i forvejen', () => {
		const uden = efterIlaegning.filter((p) => p.id !== 'gammel');
		expect(erAendret(groed, nyeLinjer(uden, foerIds))).toBe(false);
	});

	// Hun er formentlig i gang med at fortryde det hele.
	it('spoerger ikke naar hun har fjernet alt', () => {
		expect(erAendret(groed, nyeLinjer([vare('gammel', 'Æggemad', 'rug', 80)], foerIds))).toBe(false);
	});

	it('regner en opskrift hun laegger oveni som en aendring', () => {
		// Opskrift-linjen kan ikke gemmes, saa den taeller ikke med. Men
		// den aendrer heller ikke groeden, og saa skal vi ikke spoerge.
		const med = [...efterIlaegning, sammensat('n5', 'Kikærtesalat')];
		expect(erAendret(groed, nyeLinjer(med, foerIds))).toBe(false);
	});
});

describe('antalTing', () => {
	it('taeller kun de linjer der virker', () => {
		expect(antalTing(fast('f1', 'Grød', [['havre'], ['skyr']]))).toBe(2);
	});

	it('taeller ikke en linje uden foodId med', () => {
		const f: FastMaaltid = {
			id: 'f1',
			navn: 'Blandet',
			items: [{ foodId: 'havre', portion: 60 }, { foodId: '', portion: 1, manuel: { navn: 'X', enhed: 'portion' } }]
		};
		expect(antalTing(f)).toBe(1);
	});
});
