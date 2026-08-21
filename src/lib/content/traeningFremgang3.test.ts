import { describe, it, expect } from 'vitest';
import type { Traeningsprogram3 } from './traeningsprogram3';
import {
	antalKlaret3,
	antalTraeninger3,
	erFaerdig3,
	erIGang3,
	fremgangTekst3,
	iGangMed3,
	kundeProgrammer3,
	maaAabnes3,
	maaTilbydesNyRunde3,
	naesteRunde3,
	naesteTraening3,
	runde3,
	rundeTekst3,
	procentKlaret3,
	tomFremgang3,
	traeningstilstand3,
	type Traeningsfremgang3
} from './traeningFremgang3';

function program(felter: Partial<Traeningsprogram3> = {}): Traeningsprogram3 {
	return {
		id: 'p1',
		navn: 'Kickstart 21',
		beskrivelse: '',
		kategoriId: 'krop',
		antalDage: 21,
		starterForfra: true,
		klar: true,
		oprettetAt: 0,
		opdateretAt: 0,
		...felter
	};
}

function fremgang(gennemfoerte: number[], senestAt = 0, runde = 1): Traeningsfremgang3 {
	return { programId: 'p1', gennemfoerte, senestAt, runde };
}

describe('antalKlaret3', () => {
	it('taeller de klarede', () => {
		expect(antalKlaret3(fremgang([1, 2, 3]), 21)).toBe(3);
	});

	it('taeller ikke numre uden for programmet', () => {
		// Bliver et program kortere, skal de gamle numre ikke taelle med.
		expect(antalKlaret3(fremgang([1, 2, 30]), 21)).toBe(2);
	});

	it('taeller en dublet én gang', () => {
		expect(antalKlaret3(fremgang([1, 1, 2]), 21)).toBe(2);
	});
});

describe('naesteTraening3', () => {
	it('er 1 naar hun ikke har traenet', () => {
		expect(naesteTraening3(tomFremgang3('p1'), 21)).toBe(1);
	});

	it('er den laveste hun ikke har klaret', () => {
		expect(naesteTraening3(fremgang([1, 2, 3, 4]), 21)).toBe(5);
	});

	it('finder hullet, ikke bare den hoejeste plus én', () => {
		// Har hun taget 1, 2 og 4 om, mangler 3 stadig.
		expect(naesteTraening3(fremgang([1, 2, 4]), 21)).toBe(3);
	});

	// Foer 20. august gav den 1 igen med det samme paa et program der
	// loopede. Det var baade en fejl, se runde-feltet, og forkert over for
	// kunden. Nu er der ingen naeste foer hun har sagt ja til en runde til.
	it('giver null naar runden er koert igennem, ogsaa paa et loopende program', () => {
		expect(naesteTraening3(fremgang([1, 2, 3]), 3)).toBeNull();
	});

	it('giver null for et program uden traeninger', () => {
		expect(naesteTraening3(tomFremgang3('p1'), 0)).toBeNull();
	});
});

describe('runde3 og rundeTekst3', () => {
	it('foerste runde som standard', () => {
		expect(runde3(tomFremgang3('p1'))).toBe(1);
	});

	// Gamle dokumenter fra foer 20. august har ikke feltet.
	it('et gammelt dokument uden feltet laeses som runde 1', () => {
		expect(runde3({ programId: 'p1', gennemfoerte: [], senestAt: 0, runde: 0 })).toBe(1);
	});

	it('foerste gang siger ingenting', () => {
		expect(rundeTekst3(fremgang([], 0, 1))).toBe('');
	});

	it('anden gang staar der 2. gang igennem', () => {
		expect(rundeTekst3(fremgang([], 0, 2))).toBe('2. gang igennem');
	});

	it('og videre op', () => {
		expect(rundeTekst3(fremgang([], 0, 5))).toBe('5. gang igennem');
	});
});

describe('maaTilbydesNyRunde3', () => {
	const loop = { antalDage: 3, starterForfra: true };
	const engang = { antalDage: 3, starterForfra: false };

	it('tilbydes naar hun er igennem og programmet looper', () => {
		expect(maaTilbydesNyRunde3(fremgang([1, 2, 3]), loop)).toBe(true);
	});

	it('tilbydes ikke naar hun ikke er igennem', () => {
		expect(maaTilbydesNyRunde3(fremgang([1, 2]), loop)).toBe(false);
	});

	// Fluebenet staar paa hvert program i admin.
	it('tilbydes ikke naar programmet er en gang igennem', () => {
		expect(maaTilbydesNyRunde3(fremgang([1, 2, 3]), engang)).toBe(false);
	});
});

describe('naesteRunde3', () => {
	it('toemmer listen og taeller runden op', () => {
		const ny = naesteRunde3(fremgang([1, 2, 3], 500, 1));
		expect(ny.gennemfoerte).toEqual([]);
		expect(ny.runde).toBe(2);
	});

	it('senestAt bliver staaende, saa raekkefoelgen paa listen holder', () => {
		expect(naesteRunde3(fremgang([1, 2, 3], 500)).senestAt).toBe(500);
	});

	it('og videre fra runde 2 til 3', () => {
		expect(naesteRunde3(fremgang([1, 2, 3], 0, 2)).runde).toBe(3);
	});

	// Efter en ny runde skal hun kunne begynde paa 1 igen. Det var
	// praecis dét der ikke virkede foer.
	it('efter en ny runde er naeste traening 1 igen', () => {
		const ny = naesteRunde3(fremgang([1, 2, 3]));
		expect(naesteTraening3(ny, 3)).toBe(1);
	});
});

describe('erIGang3 og erFaerdig3', () => {
	it('er ikke i gang foer hun har traenet', () => {
		expect(erIGang3(tomFremgang3('p1'), 21)).toBe(false);
	});

	it('er i gang midt i', () => {
		expect(erIGang3(fremgang([1, 2]), 21)).toBe(true);
		expect(erFaerdig3(fremgang([1, 2]), 21)).toBe(false);
	});

	it('er faerdig og ikke i gang naar alt er klaret', () => {
		expect(erIGang3(fremgang([1, 2, 3]), 3)).toBe(false);
		expect(erFaerdig3(fremgang([1, 2, 3]), 3)).toBe(true);
	});
});

describe('procentKlaret3', () => {
	it('regner procenten', () => {
		expect(procentKlaret3(fremgang([1, 2, 3, 4]), 21)).toBe(19);
		expect(procentKlaret3(fremgang([1, 2, 3]), 3)).toBe(100);
		expect(procentKlaret3(tomFremgang3('p1'), 21)).toBe(0);
	});

	it('deler ikke med nul', () => {
		expect(procentKlaret3(tomFremgang3('p1'), 0)).toBe(0);
	});
});

describe('maaAabnes3', () => {
	const f = fremgang([1, 2, 3, 4]);
	const naeste = 5;

	it('lader hende tage en klaret traening om', () => {
		expect(maaAabnes3(2, f, naeste)).toBe(true);
	});

	it('lader hende aabne den naeste', () => {
		expect(maaAabnes3(5, f, naeste)).toBe(true);
	});

	it('lader hende IKKE springe frem', () => {
		// Linns valg 15. august: nej frem, ja tilbage.
		expect(maaAabnes3(6, f, naeste)).toBe(false);
		expect(maaAabnes3(12, f, naeste)).toBe(false);
	});
});

describe('traeningstilstand3', () => {
	it('kender de tre tilstande', () => {
		const f = fremgang([1, 2]);
		expect(traeningstilstand3(1, f, 3)).toBe('klaret');
		expect(traeningstilstand3(3, f, 3)).toBe('naeste');
		expect(traeningstilstand3(4, f, 3)).toBe('venter');
	});
});

describe('antalTraeninger3', () => {
	it('laeser det gamle felt', () => {
		expect(antalTraeninger3(program({ antalDage: 14 }))).toBe(14);
	});
});

describe('kundeProgrammer3', () => {
	const a = program({ id: 'a', navn: 'Alfa', antalDage: 10 });
	const b = program({ id: 'b', navn: 'Bravo', antalDage: 10 });
	const c = program({ id: 'c', navn: 'Charlie', antalDage: 10 });

	it('laegger i gang foerst, saa ikke begyndt, saa faerdige', () => {
		const kort = new Map([
			['a', { programId: 'a', gennemfoerte: [1, 2], senestAt: 100, runde: 1 }],
			[
				'c',
				{
					programId: 'c',
					gennemfoerte: Array.from({ length: 10 }, (_, i) => i + 1),
					senestAt: 200,
					runde: 1
				}
			]
		]);
		const r = kundeProgrammer3([a, b, c], kort);
		expect(r.map((x) => x.program.id)).toEqual(['a', 'b', 'c']);
	});

	it('laegger den hun sidst traenede oeverst blandt dem i gang', () => {
		const kort = new Map([
			['a', { programId: 'a', gennemfoerte: [1], senestAt: 100, runde: 1 }],
			['b', { programId: 'b', gennemfoerte: [1], senestAt: 900, runde: 1 }]
		]);
		const r = kundeProgrammer3([a, b], kort);
		expect(r[0].program.id).toBe('b');
	});

	it('sorterer alfabetisk inden for de andre grupper', () => {
		const r = kundeProgrammer3([c, b, a], new Map());
		expect(r.map((x) => x.program.navn)).toEqual(['Alfa', 'Bravo', 'Charlie']);
	});

	it('beriger med tal hun kan se paa skaermen', () => {
		const kort = new Map([['a', { programId: 'a', gennemfoerte: [1, 2], senestAt: 5, runde: 1 }]]);
		const r = kundeProgrammer3([a], kort)[0];
		expect(r.klaret).toBe(2);
		expect(r.naeste).toBe(3);
		expect(r.procent).toBe(20);
		expect(r.iGang).toBe(true);
		expect(r.faerdig).toBe(false);
	});

	it('giver et program uden fremgang en tom fremgang', () => {
		const r = kundeProgrammer3([a], new Map())[0];
		expect(r.klaret).toBe(0);
		expect(r.naeste).toBe(1);
	});
});

describe('iGangMed3', () => {
	it('finder den hun er i gang med', () => {
		const a = program({ id: 'a', navn: 'Alfa', antalDage: 10 });
		const kort = new Map([['a', { programId: 'a', gennemfoerte: [1], senestAt: 1, runde: 1 }]]);
		expect(iGangMed3(kundeProgrammer3([a], kort))?.program.id).toBe('a');
	});

	it('giver null naar hun ikke er i gang med noget', () => {
		expect(iGangMed3(kundeProgrammer3([program()], new Map()))).toBeNull();
	});
});

describe('fremgangTekst3', () => {
	const a = program({ id: 'a', antalDage: 21 });

	it('siger ikke begyndt', () => {
		expect(fremgangTekst3(kundeProgrammer3([a], new Map())[0])).toBe('21 træninger · ikke begyndt');
	});

	it('siger hvor langt hun er', () => {
		const kort = new Map([
			['a', { programId: 'a', gennemfoerte: [1, 2, 3, 4], senestAt: 1, runde: 1 }]
		]);
		expect(fremgangTekst3(kundeProgrammer3([a], kort)[0])).toBe('Træning 5 af 21');
	});

	it('siger det naar alt er klaret', () => {
		const kort = new Map([
			[
				'a',
				{
					programId: 'a',
					gennemfoerte: Array.from({ length: 21 }, (_, i) => i + 1),
					senestAt: 1,
					runde: 1
				}
			]
		]);
		expect(fremgangTekst3(kundeProgrammer3([a], kort)[0])).toBe('Du er igennem alle 21 træninger');
	});

	it('bruger aldrig ordet dag', () => {
		const kort = new Map([['a', { programId: 'a', gennemfoerte: [1], senestAt: 1, runde: 1 }]]);
		for (const k of kundeProgrammer3([a], kort)) {
			expect(fremgangTekst3(k).toLowerCase()).not.toContain('dag');
		}
	});
});
