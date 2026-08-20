import { describe, it, expect } from 'vitest';
import {
	antalTekst,
	filtrerOevelser,
	kategoriAntal,
	normaliser,
	soegetermer,
	udstyrAntal,
	udstyrTekst,
	type SoegbarOevelse
} from './oevelsesSoeg3';

function oe(over: Partial<SoegbarOevelse> = {}): SoegbarOevelse {
	return {
		id: 'x',
		name: 'Bodyweight squat',
		desc: 'Styrker ben og baller.',
		catLabel: 'Ben & Baller',
		tags: [],
		udstyr: ['ingen'],
		...over
	};
}

describe('normaliser', () => {
	// Hun skriver ikke aeoeaa paa et tastatur i en fart.
	it('skriver æ, ø og å ud', () => {
		expect(normaliser('Ankelstræk')).toBe('ankelstraek');
		expect(normaliser('Øvelse')).toBe('oevelse');
		expect(normaliser('Håndvægte')).toBe('haandvaegte');
	});

	it('taaler tomt', () => {
		expect(normaliser('')).toBe('');
	});
});

describe('soegetermer', () => {
	it('deler paa mellemrum og dropper gentagelser', () => {
		expect(soegetermer('squat  kettlebell squat')).toEqual(['squat', 'kettlebell']);
	});

	it('giver ingen termer paa tomt', () => {
		expect(soegetermer('   ')).toEqual([]);
	});
});

describe('filtrerOevelser, soegning', () => {
	const liste = [
		oe({ id: 'a', name: 'Bodyweight squat', catLabel: 'Ben & Baller' }),
		oe({ id: 'b', name: 'Bird dog', desc: 'Træner ryggen og balancen.', catLabel: 'Core' }),
		oe({ id: 'c', name: 'Bent-over row', catLabel: 'Overkrop – Træk', udstyr: ['kettlebell'] }),
		oe({ id: 'd', name: 'Ankelstræk', catLabel: 'Mobilitet & opvarmning' })
	];

	it('finder paa navnet', () => {
		expect(filtrerOevelser(liste, { soegeord: 'squat' }).map((o) => o.id)).toEqual(['a']);
	});

	// Ingen oevelse HEDDER ryg, men flere traener den.
	it('finder ogsaa paa beskrivelsen', () => {
		expect(filtrerOevelser(liste, { soegeord: 'ryggen' }).map((o) => o.id)).toEqual(['b']);
	});

	it('finder paa kategorien', () => {
		expect(filtrerOevelser(liste, { soegeord: 'core' }).map((o) => o.id)).toEqual(['b']);
	});

	it('finder paa udstyret skrevet med ord', () => {
		expect(filtrerOevelser(liste, { soegeord: 'kettlebell' }).map((o) => o.id)).toEqual(['c']);
	});

	it('finder æ uden at hun skriver æ', () => {
		expect(filtrerOevelser(liste, { soegeord: 'ankelstraek' }).map((o) => o.id)).toEqual(['d']);
	});

	// Alle ord skal findes, men gerne i hver sit felt.
	it('kraever at ALLE ord passer', () => {
		expect(filtrerOevelser(liste, { soegeord: 'row kettlebell' }).map((o) => o.id)).toEqual(['c']);
		expect(filtrerOevelser(liste, { soegeord: 'squat kettlebell' })).toEqual([]);
	});

	it('giver hele listen uden soegeord', () => {
		expect(filtrerOevelser(liste, {})).toHaveLength(4);
	});
});

describe('filtrerOevelser, filtre', () => {
	const liste = [
		oe({ id: 'a', catLabel: 'Core', udstyr: ['ingen'] }),
		oe({ id: 'b', catLabel: 'Core', udstyr: ['kettlebell'] }),
		oe({ id: 'c', catLabel: 'Balance', udstyr: ['ingen', 'forhojning'] })
	];

	it('filtrerer paa kategori', () => {
		expect(filtrerOevelser(liste, { kategorier: ['Core'] }).map((o) => o.id)).toEqual(['a', 'b']);
	});

	it('filtrerer paa udstyr', () => {
		expect(filtrerOevelser(liste, { udstyr: ['kettlebell'] }).map((o) => o.id)).toEqual(['b']);
	});

	// En oevelse med to slags udstyr skal med naar ét af dem er valgt.
	it('tager en oevelse med naar bare ét af dens udstyr passer', () => {
		expect(filtrerOevelser(liste, { udstyr: ['forhojning'] }).map((o) => o.id)).toEqual(['c']);
	});

	it('kan kombinere kategori, udstyr og soegning', () => {
		const ud = filtrerOevelser(liste, { kategorier: ['Core'], udstyr: ['ingen'] });
		expect(ud.map((o) => o.id)).toEqual(['a']);
	});

	it('bevarer raekkefoelgen fra listen', () => {
		expect(filtrerOevelser(liste, { udstyr: ['ingen'] }).map((o) => o.id)).toEqual(['a', 'c']);
	});
});

describe('kategoriAntal', () => {
	it('taeller og saetter den stoerste foerst', () => {
		const liste = [
			oe({ catLabel: 'Core' }),
			oe({ catLabel: 'Ben & Baller' }),
			oe({ catLabel: 'Ben & Baller' })
		];
		expect(kategoriAntal(liste)).toEqual([
			{ navn: 'Ben & Baller', antal: 2 },
			{ navn: 'Core', antal: 1 }
		]);
	});

	it('springer tomme kategorier over', () => {
		expect(kategoriAntal([oe({ catLabel: '' })])).toEqual([]);
	});
});

describe('udstyrAntal', () => {
	it('taeller hvert udstyr for sig', () => {
		const liste = [oe({ udstyr: ['ingen'] }), oe({ udstyr: ['ingen', 'kettlebell'] })];
		expect(udstyrAntal(liste)).toEqual([
			{ id: 'ingen', navn: 'Uden udstyr', antal: 2 },
			{ id: 'kettlebell', navn: 'Kettlebell', antal: 1 }
		]);
	});
});

describe('udstyrTekst', () => {
	it('skriver udstyret som kunden laeser det', () => {
		expect(udstyrTekst(['ingen'])).toBe('Uden udstyr');
		expect(udstyrTekst(['ingen', 'forhojning'])).toBe('Uden udstyr · Forhøjning');
	});

	it('giver tom tekst naar der ikke staar noget', () => {
		expect(udstyrTekst([])).toBe('');
	});
});

describe('antalTekst', () => {
	it('boejer ordet', () => {
		expect(antalTekst(1)).toBe('1 øvelse');
		expect(antalTekst(62)).toBe('62 øvelser');
		expect(antalTekst(0)).toBe('0 øvelser');
	});
});
