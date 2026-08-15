import { describe, it, expect } from 'vitest';
import type { TrainingDay } from './mikrotraening';
import {
	antalPrKategori,
	antalTommeDage,
	dagErTom,
	dagensMinutter,
	filtrerProgrammer3,
	fletUdkast,
	flytIListe,
	justerAntalDage,
	manglerTekst,
	manglerTekstFor,
	sorterProgrammer3,
	tomDag3,
	tommeDageFor,
	validerOevelse3,
	validerProgram3,
	type Traeningsprogram3
} from './traeningsprogram3';

function dag(nr: number, antalOevelser: number, titel = ''): TrainingDay {
	return {
		dagNummer: nr,
		titel,
		indledning: '',
		exercises: Array.from({ length: antalOevelser }, (_, i) => ({
			exerciseId: `oevelse_${nr}_${i}`,
			sets: 3,
			workSec: 30,
			restSec: 10,
			bonus: false
		}))
	};
}

function program(felter: Partial<Traeningsprogram3> = {}): Traeningsprogram3 {
	return {
		id: 'p1',
		navn: 'Program',
		beskrivelse: '',
		kategoriId: 'kat1',
		antalDage: 21,
		starterForfra: true,
		klar: false,
		oprettetAt: 0,
		opdateretAt: 0,
		...felter
	};
}

describe('validerProgram3', () => {
	it('kraever et navn', () => {
		expect(validerProgram3({ navn: '   ', kategoriId: 'k', antalDage: 21 })).toBe(
			'Programmet skal have et navn.'
		);
	});

	it('kraever en kategori', () => {
		expect(validerProgram3({ navn: 'Sommer', kategoriId: '', antalDage: 21 })).toBe(
			'Vælg en kategori.'
		);
	});

	it('afviser for langt navn', () => {
		const langt = 'a'.repeat(61);
		expect(validerProgram3({ navn: langt, kategoriId: 'k', antalDage: 1 })).toContain('60 tegn');
	});

	it('afviser nul dage og halve dage', () => {
		expect(validerProgram3({ navn: 'A', kategoriId: 'k', antalDage: 0 })).toContain('mindst 1');
		expect(validerProgram3({ navn: 'A', kategoriId: 'k', antalDage: 2.5 })).toContain('mindst 1');
	});

	it('afviser flere end 365 dage', () => {
		expect(validerProgram3({ navn: 'A', kategoriId: 'k', antalDage: 366 })).toContain('365');
	});

	it('godkender et rigtigt program', () => {
		expect(validerProgram3({ navn: 'Kropsro 84', kategoriId: 'k', antalDage: 84 })).toBeNull();
	});
});

describe('validerOevelse3', () => {
	it('godkender standardvaerdierne', () => {
		expect(validerOevelse3({ sets: 3, workSec: 30, restSec: 10 })).toBeNull();
	});

	it('tillader pause paa nul', () => {
		expect(validerOevelse3({ sets: 1, workSec: 5, restSec: 0 })).toBeNull();
	});

	it('afviser urimelige tal', () => {
		expect(validerOevelse3({ sets: 0, workSec: 30, restSec: 10 })).toContain('sæt');
		expect(validerOevelse3({ sets: 3, workSec: 4, restSec: 10 })).toContain('Arbejdstid');
		expect(validerOevelse3({ sets: 3, workSec: 30, restSec: 601 })).toContain('Pause');
	});
});

describe('justerAntalDage', () => {
	it('fylder op med tomme dage naar tallet saettes op', () => {
		const resultat = justerAntalDage([dag(1, 3), dag(2, 3)], 4);
		expect(resultat).toHaveLength(4);
		expect(resultat[0].exercises).toHaveLength(3);
		expect(resultat[3].exercises).toHaveLength(0);
		expect(resultat[3].dagNummer).toBe(4);
	});

	it('skaerer de sidste af naar tallet saettes ned', () => {
		const resultat = justerAntalDage([dag(1, 3), dag(2, 3), dag(3, 3)], 2);
		expect(resultat).toHaveLength(2);
		expect(resultat.map((d) => d.dagNummer)).toEqual([1, 2]);
	});

	it('bevarer indholdet paa de dage der bliver', () => {
		const resultat = justerAntalDage([dag(1, 2, 'Ben og balance')], 3);
		expect(resultat[0].titel).toBe('Ben og balance');
		expect(resultat[0].exercises).toHaveLength(2);
	});

	it('holder hver dag paa sit eget nummer selv om der er huller', () => {
		// Dag 2 mangler helt i de gemte data. Dag 3 skal ikke rykke op paa 2.
		const resultat = justerAntalDage([dag(1, 1), dag(3, 5)], 3);
		expect(resultat[1].exercises).toHaveLength(0);
		expect(resultat[2].exercises).toHaveLength(5);
	});

	it('giver en tom liste ved nul', () => {
		expect(justerAntalDage([dag(1, 3)], 0)).toEqual([]);
	});
});

describe('tomme dage', () => {
	it('kender en tom dag', () => {
		expect(dagErTom(tomDag3(1))).toBe(true);
		expect(dagErTom(dag(1, 1))).toBe(false);
	});

	it('taeller hullerne', () => {
		expect(antalTommeDage([dag(1, 3), tomDag3(2), tomDag3(3)])).toBe(2);
	});
});

describe('manglerTekst', () => {
	it('siger ingenting naar alt er fyldt ud', () => {
		expect(manglerTekst([dag(1, 3), dag(2, 3)])).toBeNull();
	});

	it('taeller hullerne', () => {
		expect(manglerTekst([dag(1, 3), tomDag3(2), tomDag3(3)])).toBe('2 træninger mangler øvelser');
	});

	it('boejer ental rigtigt', () => {
		expect(manglerTekst([dag(1, 3), tomDag3(2)])).toBe('1 træning mangler øvelser');
	});

	it('siger det tydeligt naar hele programmet er tomt', () => {
		expect(manglerTekst([tomDag3(1), tomDag3(2), tomDag3(3)])).toBe(
			'Alle 3 træninger mangler øvelser'
		);
	});

	it('kan regne paa tal alene, saa listen slipper for at hente 84 dage', () => {
		expect(manglerTekstFor(0, 84)).toBeNull();
		expect(manglerTekstFor(32, 84)).toBe('32 træninger mangler øvelser');
		expect(manglerTekstFor(84, 84)).toBe('Alle 84 træninger mangler øvelser');
	});
});

describe('tommeDageFor', () => {
	it('bruger tallet paa programmet', () => {
		expect(tommeDageFor(program({ antalDage: 84, tommeDage: 32 }))).toBe(32);
	});

	it('gaar ud fra at alt er tomt hvis tallet mangler', () => {
		// Pessimistisk med vilje. En manglende advarsel er vaerre end en
		// overfloedig, fordi den kan sende et halvbygget program ud til et hold.
		expect(tommeDageFor(program({ antalDage: 84, tommeDage: undefined }))).toBe(84);
	});

	it('accepterer nul som et rigtigt svar', () => {
		expect(tommeDageFor(program({ antalDage: 84, tommeDage: 0 }))).toBe(0);
	});
});

describe('dagensMinutter', () => {
	it('giver nul for en tom dag', () => {
		expect(dagensMinutter(tomDag3(1))).toBe(0);
	});

	it('regner arbejde og hvile med', () => {
		// 3 oevelser a 3 saet: 3*30 arbejde + 2*10 hvile = 110 sek pr oevelse.
		// 330 sek i alt, altsaa 6 minutter naar der rundes af.
		expect(dagensMinutter(dag(1, 3))).toBe(6);
	});

	it('runder aldrig ned til nul paa en dag der har oevelser', () => {
		const kort: TrainingDay = {
			dagNummer: 1,
			titel: '',
			indledning: '',
			exercises: [{ exerciseId: 'a', sets: 1, workSec: 10, restSec: 0, bonus: false }]
		};
		expect(dagensMinutter(kort)).toBe(1);
	});
});

describe('listen af programmer', () => {
	it('sorterer alfabetisk paa dansk', () => {
		const navne = sorterProgrammer3([
			program({ id: 'a', navn: 'Ærlig styrke' }),
			program({ id: 'b', navn: 'Kickstart' }),
			program({ id: 'c', navn: 'Aben' })
		]).map((p) => p.navn);
		expect(navne).toEqual(['Aben', 'Kickstart', 'Ærlig styrke']);
	});

	it('roerer ikke den oprindelige liste', () => {
		const liste = [program({ id: 'a', navn: 'B' }), program({ id: 'b', navn: 'A' })];
		sorterProgrammer3(liste);
		expect(liste[0].navn).toBe('B');
	});

	it('filtrerer paa kategori', () => {
		const liste = [
			program({ id: 'a', kategoriId: 'kb' }),
			program({ id: 'b', kategoriId: 'ingen' })
		];
		expect(filtrerProgrammer3(liste, 'kb')).toHaveLength(1);
		expect(filtrerProgrammer3(liste, null)).toHaveLength(2);
	});

	it('taeller pr kategori til chipsene', () => {
		const tal = antalPrKategori([
			program({ id: 'a', kategoriId: 'kb' }),
			program({ id: 'b', kategoriId: 'kb' }),
			program({ id: 'c', kategoriId: 'ingen' })
		]);
		expect(tal).toEqual({ kb: 2, ingen: 1 });
	});
});

describe('flytIListe', () => {
	it('flytter op', () => {
		expect(flytIListe(['a', 'b', 'c'], 1, 'op')).toEqual(['b', 'a', 'c']);
	});

	it('flytter ned', () => {
		expect(flytIListe(['a', 'b', 'c'], 1, 'ned')).toEqual(['a', 'c', 'b']);
	});

	it('goer ingenting i enderne', () => {
		expect(flytIListe(['a', 'b'], 0, 'op')).toEqual(['a', 'b']);
		expect(flytIListe(['a', 'b'], 1, 'ned')).toEqual(['a', 'b']);
	});

	it('goer ingenting ved et index der ikke findes', () => {
		expect(flytIListe(['a', 'b'], 7, 'op')).toEqual(['a', 'b']);
	});
});

describe('fletUdkast', () => {
	const eksisterende = [dag(1, 3, 'Min egen dag'), tomDag3(2), dag(3, 4)];
	const udkast = [dag(1, 5), dag(2, 5), dag(3, 5)];

	it('roerer kun de tomme dage naar kunTomme er sat', () => {
		const resultat = fletUdkast(eksisterende, udkast, true);
		expect(resultat[0].exercises).toHaveLength(3);
		expect(resultat[1].exercises).toHaveLength(5);
		expect(resultat[2].exercises).toHaveLength(4);
	});

	it('erstatter alle dage naar kunTomme er slaaet fra', () => {
		const resultat = fletUdkast(eksisterende, udkast, false);
		expect(resultat.map((d) => d.exercises.length)).toEqual([5, 5, 5]);
	});

	it('beholder altid Linns egen titel', () => {
		const resultat = fletUdkast(eksisterende, udkast, false);
		expect(resultat[0].titel).toBe('Min egen dag');
	});

	it('lader en dag staa hvis udkastet ikke naar saa langt', () => {
		const resultat = fletUdkast(eksisterende, [dag(1, 5)], false);
		expect(resultat[2].exercises).toHaveLength(4);
	});
});
