import { describe, it, expect } from 'vitest';
import {
	valider,
	advarsler,
	talFra,
	noget,
	foerRettelseAf,
	skrivefelter,
	fortrydFelter,
	opgoerAendringer,
	type RettbarVare,
	type RettedeTal
} from './ingrediensRettelse3';

function vare(ekstra: Partial<RettbarVare> = {}): RettbarVare {
	return {
		id: 'f1',
		name: 'Kyllingebryst',
		cat: 'andet',
		p: 23,
		f: 0,
		kh: 0,
		fedt: 1.5,
		kcal: 110,
		kildeType: 'dtu',
		...ekstra
	} as RettbarVare;
}

const gyldig: RettedeTal = { p: 20, f: 2, kh: 5, fedt: 3, kcal: 130 };

describe('valider', () => {
	it('godtager et rigtigt saet tal med en note', () => {
		expect(valider(gyldig, 'Målt på pakken')).toEqual([]);
	});

	it('kraever protein og fiber, for de er hele konceptet i 30-30', () => {
		const f = valider({ ...gyldig, p: null, f: null }, 'note');
		expect(f.map((x) => x.felt)).toEqual(expect.arrayContaining(['p', 'f']));
	});

	it('lader kulhydrat, fedt og kalorier staa tomme', () => {
		expect(valider({ p: 20, f: 2, kh: null, fedt: null, kcal: null }, 'note')).toEqual([]);
	});

	it('kraever en note, ellers ved ingen hvorfor tallet er rettet', () => {
		expect(valider(gyldig, '').map((x) => x.felt)).toContain('note');
		expect(valider(gyldig, '   ').map((x) => x.felt)).toContain('note');
	});

	it('afviser negative tal', () => {
		expect(valider({ ...gyldig, p: -1 }, 'note').map((x) => x.felt)).toContain('p');
	});

	it('afviser over 100 g pr 100 g, som er hele pakkens tal tastet forkert', () => {
		expect(valider({ ...gyldig, p: 120 }, 'note').map((x) => x.felt)).toContain('p');
	});

	it('tillader kalorier op til 900, for rent fedt er 900', () => {
		expect(valider({ ...gyldig, kcal: 900 }, 'note')).toEqual([]);
		expect(valider({ ...gyldig, kcal: 901 }, 'note').map((x) => x.felt)).toContain('kcal');
	});

	it('tillader praecis 100 g, for det findes, fx rent fedtstof', () => {
		expect(valider({ p: 0, f: 0, kh: 0, fedt: 100, kcal: 884 }, 'note')).toEqual([]);
	});
});

describe('advarsler', () => {
	it('siger ikke noget om et almindeligt tal', () => {
		expect(advarsler({ p: 20, f: 0, kh: 0, fedt: 3, kcal: 107 })).toEqual([]);
	});

	it('advarer naar kalorierne ikke passer med makroen', () => {
		// 27 g protein alene er 108 kalorier, saa 30 kan ikke passe. Det er
		// den fejl der blev set 13. august, hvor en omelet stod til 27 g
		// protein og 130 kalorier.
		expect(advarsler({ p: 27, f: 0, kh: 0, fedt: 0, kcal: 30 }).length).toBeGreaterThan(0);
	});

	it('spaerrer ikke, den advarer kun', () => {
		const tal = { p: 27, f: 0, kh: 0, fedt: 0, kcal: 30 };
		expect(advarsler(tal).length).toBeGreaterThan(0);
		expect(valider(tal, 'note')).toEqual([]);
	});

	it('giver falsk alarm paa et rent fiberprodukt, og det er accepteret', () => {
		// Bellwell med 76 g fiber og 360 kalorier. Vi lever med den, for
		// alternativet var at slaekke tjekket for alle. Se 9.50 i
		// overdragelsen og begrundelsen i openFoodFacts.
		expect(advarsler({ p: 4, f: 76, kh: 4, fedt: 2, kcal: 360 }).length).toBeGreaterThan(0);
	});
});

describe('talFra og noget', () => {
	it('laeser de fem tal af varen', () => {
		expect(talFra(vare())).toEqual({ p: 23, f: 0, kh: 0, fedt: 1.5, kcal: 110 });
	});

	it('giver null og ikke nul naar et tal mangler', () => {
		expect(talFra(vare({ kcal: undefined })).kcal).toBeNull();
	});

	it('ser naar noget har flyttet sig, og naar intet har', () => {
		const g = talFra(vare());
		expect(noget(g, g)).toBe(false);
		expect(noget(g, { ...g, p: 24 })).toBe(true);
		expect(noget(g, { ...g, kcal: null })).toBe(true);
	});
});

describe('foerRettelseAf', () => {
	it('tager varens nuvaerende tal foerste gang', () => {
		expect(foerRettelseAf(vare())).toEqual({
			p: 23,
			f: 0,
			kh: 0,
			fedt: 1.5,
			kcal: 110,
			kildeType: 'dtu'
		});
	});

	it('BEVARER det oprindelige ved anden rettelse', () => {
		const v = vare({ p: 25, foerRettelse: { p: 23, f: 0, kcal: 110, kildeType: 'dtu' } });
		expect(foerRettelseAf(v)).toEqual({ p: 23, f: 0, kcal: 110, kildeType: 'dtu' });
	});

	it('tager ikke felter med der ikke findes', () => {
		const f = foerRettelseAf(vare({ kh: undefined, fedt: undefined, kcal: undefined }));
		expect(f).not.toHaveProperty('kcal');
		expect(f.p).toBe(23);
	});
});

describe('skrivefelter', () => {
	it('skriver de fem tal, kilden, noten og det oprindelige', () => {
		const ud = skrivefelter(vare(), gyldig, '  Målt på pakken  ');
		expect(ud.p).toBe(20);
		expect(ud.kildeType).toBe('linn');
		expect(ud.linnRettet).toBe(true);
		expect(ud.linnNote).toBe('Målt på pakken');
		expect(ud.foerRettelse).toEqual({ p: 23, f: 0, kh: 0, fedt: 1.5, kcal: 110, kildeType: 'dtu' });
	});

	it('skriver et tomt felt som null og ALDRIG som nul', () => {
		const ud = skrivefelter(vare(), { ...gyldig, kcal: null }, 'note');
		expect(ud.kcal).toBeNull();
	});

	it('saetter kilden til linn, for tallet er ikke laengere databasens', () => {
		expect(skrivefelter(vare(), gyldig, 'note').kildeType).toBe('linn');
	});
});

describe('fortrydFelter', () => {
	it('saetter tallene OG kilden tilbage', () => {
		const v = vare({
			p: 20,
			kildeType: 'linn',
			linnRettet: true,
			foerRettelse: { p: 23, f: 0, kh: 0, fedt: 1.5, kcal: 110, kildeType: 'dtu' }
		});
		const ud = fortrydFelter(v);
		expect(ud?.p).toBe(23);
		expect(ud?.kildeType).toBe('dtu');
		expect(ud?.linnRettet).toBe(false);
		expect(ud?.linnNote).toBeNull();
	});

	it('giver null naar der ikke er noget at fortryde', () => {
		expect(fortrydFelter(vare())).toBeNull();
	});

	it('rydder felter der ikke fandtes foer, i stedet for at lade dem staa', () => {
		const v = vare({ foerRettelse: { p: 23, f: 0 } });
		const ud = fortrydFelter(v);
		expect(ud?.kcal).toBeNull();
		expect(ud?.kh).toBeNull();
	});
});

describe('opgoerAendringer', () => {
	const titler = { o1: 'Ret A', o2: 'Ret B' };

	it('finder kun dem der har flyttet sig', () => {
		const foer = { o1: { protein: 20, kalorier: 300 }, o2: { protein: 10, kalorier: 200 } };
		const efter = { o1: { protein: 22, kalorier: 300 }, o2: { protein: 10, kalorier: 200 } };
		const ud = opgoerAendringer(foer, efter, titler);
		expect(ud).toHaveLength(1);
		expect(ud[0].opskriftId).toBe('o1');
		expect(ud[0].foerProtein).toBe(20);
		expect(ud[0].efterProtein).toBe(22);
	});

	it('taeller ikke en afrundings-forskel som en aendring', () => {
		const foer = { o1: { protein: 32.299999999, kalorier: 300 } };
		const efter = { o1: { protein: 32.3, kalorier: 300 } };
		expect(opgoerAendringer(foer, efter, titler)).toHaveLength(0);
	});

	it('fanger ogsaa en aendring der kun er paa kalorierne', () => {
		const foer = { o1: { protein: 20, kalorier: 300 } };
		const efter = { o1: { protein: 20, kalorier: 340 } };
		expect(opgoerAendringer(foer, efter, titler)).toHaveLength(1);
	});

	it('springer opskrifter over der ikke fandtes foer', () => {
		const efter = { ny: { protein: 20, kalorier: 300 } };
		expect(opgoerAendringer({}, efter, titler)).toHaveLength(0);
	});

	it('sorterer efter titel', () => {
		const foer = { o2: { protein: 10, kalorier: 200 }, o1: { protein: 20, kalorier: 300 } };
		const efter = { o2: { protein: 12, kalorier: 200 }, o1: { protein: 22, kalorier: 300 } };
		expect(opgoerAendringer(foer, efter, titler).map((x) => x.titel)).toEqual(['Ret A', 'Ret B']);
	});
});
