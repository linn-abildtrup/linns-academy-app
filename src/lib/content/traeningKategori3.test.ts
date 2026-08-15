import { describe, it, expect } from 'vitest';
import type { Exercise, Udstyr } from './mikrotraening';
import type { Traeningsprogram3 } from './traeningsprogram3';
import {
	filtrerOevelserTilKategori,
	flytKategori3,
	kategoriKanSlettes3,
	kategoriNavn3,
	kraeverIntetUdstyr,
	naesteRaekkefolge3,
	sorterKategorier3,
	validerKategori3,
	type TraeningKategori3
} from './traeningKategori3';

function kat(id: string, navn: string, raekkefolge: number): TraeningKategori3 {
	return { id, navn, visesAltid: false, udstyrTag: null, raekkefolge };
}

function oevelse(id: string, udstyr: Udstyr[], aktiv = true): Exercise {
	return {
		id,
		name: id,
		desc: '',
		how: [],
		cat: 'ben',
		catLabel: 'Ben',
		tags: [],
		videoPath: `${id}.mp4`,
		treaningsformer: ['mikrotraening'],
		udstyr,
		aktiv
	};
}

describe('validerKategori3', () => {
	const alle = [kat('a', 'Med kettlebell', 0)];

	it('kraever et navn', () => {
		expect(validerKategori3('  ', alle)).toBe('Kategorien skal have et navn.');
	});

	it('afviser for langt navn', () => {
		expect(validerKategori3('n'.repeat(41), alle)).toContain('40 tegn');
	});

	it('afviser et navn der findes i forvejen, uanset store bogstaver', () => {
		expect(validerKategori3('med kettlebell', alle)).toBe(
			'Der findes allerede en kategori med det navn.'
		);
	});

	it('tillader at en kategori beholder sit eget navn', () => {
		expect(validerKategori3('Med kettlebell', alle, 'a')).toBeNull();
	});

	it('godkender et nyt navn', () => {
		expect(validerKategori3('Med sjippetov', alle)).toBeNull();
	});
});

describe('raekkefoelgen', () => {
	it('sorterer paa raekkefoelge', () => {
		const navne = sorterKategorier3([kat('a', 'B', 2), kat('b', 'A', 0)]).map((k) => k.navn);
		expect(navne).toEqual(['A', 'B']);
	});

	it('bruger navnet naar to har samme plads', () => {
		const navne = sorterKategorier3([kat('a', 'Bravo', 0), kat('b', 'Alfa', 0)]).map((k) => k.navn);
		expect(navne).toEqual(['Alfa', 'Bravo']);
	});

	it('laegger en ny nederst', () => {
		expect(naesteRaekkefolge3([kat('a', 'A', 0), kat('b', 'B', 3)])).toBe(4);
		expect(naesteRaekkefolge3([])).toBe(0);
	});

	it('flytter op og nummererer om uden huller', () => {
		const flyttet = flytKategori3([kat('a', 'A', 0), kat('b', 'B', 5), kat('c', 'C', 9)], 'c', 'op');
		expect(flyttet.map((k) => k.id)).toEqual(['a', 'c', 'b']);
		expect(flyttet.map((k) => k.raekkefolge)).toEqual([0, 1, 2]);
	});

	it('flytter ned', () => {
		const flyttet = flytKategori3([kat('a', 'A', 0), kat('b', 'B', 1)], 'a', 'ned');
		expect(flyttet.map((k) => k.id)).toEqual(['b', 'a']);
	});

	it('goer ingenting naar den allerede ligger yderst', () => {
		const start = [kat('a', 'A', 0), kat('b', 'B', 1)];
		expect(flytKategori3(start, 'a', 'op').map((k) => k.id)).toEqual(['a', 'b']);
		expect(flytKategori3(start, 'b', 'ned').map((k) => k.id)).toEqual(['a', 'b']);
	});

	it('goer ingenting ved et ukendt id', () => {
		expect(flytKategori3([kat('a', 'A', 0)], 'findes-ikke', 'op').map((k) => k.id)).toEqual(['a']);
	});
});

describe('kategoriKanSlettes3', () => {
	const programmer = [
		{ id: 'p1', kategoriId: 'kb' },
		{ id: 'p2', kategoriId: 'kb' }
	] as Traeningsprogram3[];

	it('tillader sletning naar kategorien er tom', () => {
		expect(kategoriKanSlettes3('tom', programmer)).toBeNull();
	});

	it('spaerrer naar der ligger programmer', () => {
		expect(kategoriKanSlettes3('kb', programmer)).toBe(
			'Der ligger 2 programmer i kategorien. Flyt dem først.'
		);
	});

	it('boejer ental rigtigt', () => {
		expect(kategoriKanSlettes3('kb', [programmer[0]])).toContain('1 program i kategorien');
	});
});

describe('kategoriNavn3', () => {
	it('finder navnet', () => {
		expect(kategoriNavn3('a', [kat('a', 'Med kettlebell', 0)])).toBe('Med kettlebell');
	});

	it('giver tom streng hvis kategorien er slettet under os', () => {
		expect(kategoriNavn3('vaek', [kat('a', 'A', 0)])).toBe('');
	});
});

describe('kraeverIntetUdstyr', () => {
	it('er sand for tomt udstyr', () => {
		expect(kraeverIntetUdstyr(oevelse('a', []))).toBe(true);
	});

	it('er sand naar der udtrykkeligt staar ingen', () => {
		expect(kraeverIntetUdstyr(oevelse('a', ['ingen']))).toBe(true);
	});

	it('er falsk naar der skal et redskab til', () => {
		expect(kraeverIntetUdstyr(oevelse('a', ['kettlebell']))).toBe(false);
	});
});

describe('filtrerOevelserTilKategori', () => {
	const bank = [
		oevelse('krop', ['ingen']),
		oevelse('kb', ['kettlebell']),
		oevelse('haand', ['haandvaegte']),
		oevelse('slukket', ['ingen'], false)
	];

	it('giver alle aktive naar der ingen kobling er', () => {
		const ids = filtrerOevelserTilKategori(bank, null).map((e) => e.id);
		expect(ids).toEqual(['krop', 'kb', 'haand']);
	});

	it('tager aldrig en slukket oevelse med', () => {
		expect(filtrerOevelserTilKategori(bank, 'ingen').map((e) => e.id)).toEqual(['krop']);
	});

	it('tager kropsvaegt med i en redskabs-kategori', () => {
		// Et kettlebell-program indeholder ogsaa oevelser uden redskaber.
		expect(filtrerOevelserTilKategori(bank, 'kettlebell').map((e) => e.id)).toEqual(['krop', 'kb']);
	});

	it('holder et andet redskab ude', () => {
		expect(filtrerOevelserTilKategori(bank, 'kettlebell').map((e) => e.id)).not.toContain('haand');
	});

	it('giver kun kropsvaegt naar kategorien er uden redskaber', () => {
		expect(filtrerOevelserTilKategori(bank, 'ingen').map((e) => e.id)).toEqual(['krop']);
	});
});
