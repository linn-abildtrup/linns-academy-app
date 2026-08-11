import { describe, it, expect } from 'vitest';
import {
	normaliserTekst,
	soegetermer,
	traefFor,
	grundTekst,
	fremhaev,
	filtrerOpskrifter3,
	type SoegbarOpskrift
} from './opskriftSoeg3';

// Rigtige titler fra samlingen, brugt saa testene beskytter det Linn faktisk
// har staaende og ikke en opdigtet verden.
const KYLLING_BROCCOLI: SoegbarOpskrift[] = [
	{ titel: 'Lun broccolisalat med kylling og mandler' },
	{ titel: 'Proteinpasta med kylling og broccoli' },
	{ titel: 'Kylling med broccoli i grøn pestosauce' },
	{ titel: 'Kylling i cremet sennepssauce med broccoli' }
];

describe('normaliser', () => {
	it('saenker store bogstaver', () => {
		expect(normaliserTekst('Grøn Grød')).toBe('groen groed');
	});

	it('folder danske bogstaver til ae, oe og aa', () => {
		expect(normaliserTekst('æg')).toBe('aeg');
		expect(normaliserTekst('bønner')).toBe('boenner');
		expect(normaliserTekst('rødgrød')).toBe('roedgroed');
		expect(normaliserTekst('kål')).toBe('kaal');
	});

	it('fjerner accenter', () => {
		expect(normaliserTekst('purée')).toBe('puree');
		expect(normaliserTekst('crème fraîche')).toBe('creme fraiche');
	});

	it('taaler tom tekst', () => {
		expect(normaliserTekst('')).toBe('');
	});

	// Det her er hele grunden til at vi IKKE folder til a/o/a som admin gor.
	it('lader ikke aeg traeffe ord med ag i', () => {
		const termer = soegetermer('æg');
		expect(traefFor({ titel: 'Bagt omelet med feta' }, termer).traf).toBe(false);
		expect(traefFor({ titel: 'Mager skyr med bær' }, termer).traf).toBe(false);
		expect(traefFor({ titel: 'Æggewrap med spinat' }, termer).traf).toBe(true);
	});

	it('finder danske ord selv om der skrives uden danske tegn', () => {
		expect(traefFor({ titel: 'Æggewrap med spinat' }, soegetermer('aeg')).traf).toBe(true);
		expect(traefFor({ titel: 'Grøn grød' }, soegetermer('groed')).traf).toBe(true);
		expect(traefFor({ titel: 'Bønnesalat' }, soegetermer('boenne')).traf).toBe(true);
	});
});

describe('soegetermer', () => {
	it('deler ved mellemrum', () => {
		expect(soegetermer('kylling broccoli')).toEqual(['kylling', 'broccoli']);
	});

	it('deler ogsaa ved komma og semikolon som den gamle app', () => {
		expect(soegetermer('kylling, broccoli')).toEqual(['kylling', 'broccoli']);
		expect(soegetermer('kylling; broccoli')).toEqual(['kylling', 'broccoli']);
	});

	it('taaler ekstra mellemrum og blandet skilletegn', () => {
		expect(soegetermer('  kylling ,,  broccoli  ')).toEqual(['kylling', 'broccoli']);
	});

	it('normaliserer termerne', () => {
		expect(soegetermer('Æg BØNNER')).toEqual(['aeg', 'boenner']);
	});

	it('fjerner dubletter', () => {
		expect(soegetermer('laks laks')).toEqual(['laks']);
	});

	it('giver tom liste ved tom soegning', () => {
		expect(soegetermer('')).toEqual([]);
		expect(soegetermer('   ')).toEqual([]);
		expect(soegetermer(',;')).toEqual([]);
	});
});

describe('traefFor', () => {
	it('tom soegning traeffer alt', () => {
		expect(traefFor({ titel: 'Hvad som helst' }, []).traf).toBe(true);
	});

	it('finder ord i titlen uden at give en grund', () => {
		const t = traefFor({ titel: 'Grøn grød' }, soegetermer('grød'));
		expect(t.traf).toBe(true);
		expect(t.grunde).toEqual([]);
	});

	it('finder ord som del af et laengere ord', () => {
		expect(traefFor({ titel: 'Hytteost med bær' }, soegetermer('ost')).traf).toBe(true);
	});

	// Det maalte fund: 56% af traefferne staar ikke i titlen.
	it('finder ord i ingredienserne og siger hvorfor', () => {
		const o: SoegbarOpskrift = {
			titel: 'Meal prep boks med kyllingefrikadeller',
			ingredienser: [{ navn: 'broccoli' }, { navn: 'gulerod' }]
		};
		const t = traefFor(o, soegetermer('broccoli'));
		expect(t.traf).toBe(true);
		expect(t.grunde).toEqual([{ term: 'broccoli', felt: 'ingredienser' }]);
	});

	it('finder ord i beskrivelsen og siger hvorfor', () => {
		const o: SoegbarOpskrift = {
			titel: 'Meal prep boks',
			beskrivelse: 'En mættende ret der holder sig i køleskabet'
		};
		const t = traefFor(o, soegetermer('mættende'));
		expect(t.traf).toBe(true);
		expect(t.grunde).toEqual([{ term: 'maettende', felt: 'beskrivelse' }]);
	});

	it('foretraekker ingredienser frem for beskrivelsen', () => {
		const o: SoegbarOpskrift = {
			titel: 'Aftensmad',
			beskrivelse: 'Serveres med broccoli',
			ingredienser: [{ navn: 'broccoli' }]
		};
		expect(traefFor(o, soegetermer('broccoli')).grunde).toEqual([
			{ term: 'broccoli', felt: 'ingredienser' }
		]);
	});

	it('kraever at ALLE ord findes', () => {
		const o: SoegbarOpskrift = { titel: 'Proteinpasta med kylling og broccoli' };
		expect(traefFor(o, soegetermer('kylling broccoli')).traf).toBe(true);
		expect(traefFor(o, soegetermer('kylling laks')).traf).toBe(false);
	});

	it('er ligeglad med raekkefoelgen', () => {
		const o: SoegbarOpskrift = { titel: 'Lun broccolisalat med kylling og mandler' };
		expect(traefFor(o, soegetermer('kylling broccoli')).traf).toBe(true);
		expect(traefFor(o, soegetermer('broccoli kylling')).traf).toBe(true);
	});

	it('lader ordene findes i hvert sit felt', () => {
		const o: SoegbarOpskrift = {
			titel: 'Proteinpasta med kylling',
			ingredienser: [{ navn: 'broccoli' }]
		};
		const t = traefFor(o, soegetermer('kylling broccoli'));
		expect(t.traf).toBe(true);
		expect(t.grunde).toEqual([{ term: 'broccoli', felt: 'ingredienser' }]);
	});

	// De fire findes i samlingen i dag og gav ALLE nul i den gamle app.
	it('finder de fire rigtige opskrifter paa "kylling broccoli"', () => {
		const termer = soegetermer('kylling broccoli');
		const fundet = KYLLING_BROCCOLI.filter((o) => traefFor(o, termer).traf);
		expect(fundet).toHaveLength(4);
	});

	it('taaler manglende felter', () => {
		expect(traefFor({}, soegetermer('laks')).traf).toBe(false);
		expect(traefFor({ titel: 'Laks' }, soegetermer('laks')).traf).toBe(true);
		expect(traefFor({ titel: 'Salat', ingredienser: [] }, soegetermer('laks')).traf).toBe(false);
	});

	it('bruger ikke stavefejls-tolerance', () => {
		expect(traefFor({ titel: 'Kylling med broccoli' }, soegetermer('kyling')).traf).toBe(false);
	});
});

describe('grundTekst', () => {
	it('er tom naar alt stod i titlen', () => {
		expect(grundTekst([])).toBe('');
	});

	it('skriver ét ord i ingredienserne', () => {
		expect(grundTekst([{ term: 'broccoli', felt: 'ingredienser' }])).toBe(
			'broccoli i ingredienser'
		);
	});

	it('samler flere ord i samme felt', () => {
		expect(
			grundTekst([
				{ term: 'broccoli', felt: 'ingredienser' },
				{ term: 'tomat', felt: 'ingredienser' }
			])
		).toBe('broccoli og tomat i ingredienser');
	});

	it('samler tre ord med komma og og', () => {
		expect(
			grundTekst([
				{ term: 'broccoli', felt: 'ingredienser' },
				{ term: 'tomat', felt: 'ingredienser' },
				{ term: 'løg', felt: 'ingredienser' }
			])
		).toBe('broccoli, tomat og løg i ingredienser');
	});

	it('skriver ingredienser foer beskrivelsen', () => {
		expect(
			grundTekst([
				{ term: 'mættende', felt: 'beskrivelse' },
				{ term: 'broccoli', felt: 'ingredienser' }
			])
		).toBe('broccoli i ingredienser, mættende i beskrivelsen');
	});
});

describe('fremhaev', () => {
	it('giver hele teksten uden traef naar der ikke soeges', () => {
		expect(fremhaev('Grøn grød', [])).toEqual([{ tekst: 'Grøn grød', traef: false }]);
	});

	it('deler teksten om det fundne ord', () => {
		expect(fremhaev('Grøn grød', ['groen'])).toEqual([
			{ tekst: 'Grøn', traef: true },
			{ tekst: ' grød', traef: false }
		]);
	});

	// Fremhaevningen skal ramme det rigtige sted selv om ae fylder to tegn
	// normaliseret hvor det fyldte ét i originalen.
	it('rammer rigtigt paa tvaers af danske bogstaver', () => {
		expect(fremhaev('Æggewrap', ['aeg'])).toEqual([
			{ tekst: 'Æg', traef: true },
			{ tekst: 'gewrap', traef: false }
		]);
	});

	it('fremhaever midt i et ord', () => {
		expect(fremhaev('Hytteost', ['ost'])).toEqual([
			{ tekst: 'Hytte', traef: false },
			{ tekst: 'ost', traef: true }
		]);
	});

	it('fremhaever alle forekomster', () => {
		expect(fremhaev('laks med laks', ['laks'])).toEqual([
			{ tekst: 'laks', traef: true },
			{ tekst: ' med ', traef: false },
			{ tekst: 'laks', traef: true }
		]);
	});

	it('fremhaever begge soegte ord', () => {
		expect(fremhaev('Kylling og broccoli', ['kylling', 'broccoli'])).toEqual([
			{ tekst: 'Kylling', traef: true },
			{ tekst: ' og ', traef: false },
			{ tekst: 'broccoli', traef: true }
		]);
	});

	it('slaar overlappende traef sammen til ét', () => {
		expect(fremhaev('kartoffel', ['kart', 'toffel'])).toEqual([
			{ tekst: 'kartoffel', traef: true }
		]);
	});

	it('taaler tom tekst', () => {
		expect(fremhaev('', ['laks'])).toEqual([]);
	});

	it('bevarer den oprindelige tekst praecis', () => {
		const titel = 'Winnis frodige laksesalat med ramsløgspesto';
		const samlet = fremhaev(titel, ['laks'])
			.map((s) => s.tekst)
			.join('');
		expect(samlet).toBe(titel);
	});
});

describe('filtrerOpskrifter3', () => {
	const LISTE = [
		{
			titel: 'Grøn grød',
			kategorier: ['morgenmad'],
			dietTags: ['vegetar', 'glutenfri'],
			ingredienser: [{ navn: 'havregryn' }, { navn: 'spinat' }]
		},
		{
			titel: 'Proteinpasta med kylling og broccoli',
			kategorier: ['aftensmad'],
			dietTags: [],
			ingredienser: [{ navn: 'pasta' }, { navn: 'kylling' }]
		},
		{
			titel: 'Skyrbowl med mandler',
			kategorier: ['morgenmad', 'snack'],
			dietTags: ['vegetar'],
			ingredienser: [{ navn: 'skyr' }, { navn: 'havregryn' }]
		}
	];

	it('giver alt tilbage uden filtre', () => {
		expect(filtrerOpskrifter3(LISTE, {})).toHaveLength(3);
	});

	it('filtrerer paa kategori', () => {
		const ud = filtrerOpskrifter3(LISTE, { kategorier: ['morgenmad'] });
		expect(ud.map((r) => r.opskrift.titel)).toEqual(['Grøn grød', 'Skyrbowl med mandler']);
	});

	it('en opskrift i flere kategorier findes af begge', () => {
		expect(filtrerOpskrifter3(LISTE, { kategorier: ['snack'] })).toHaveLength(1);
	});

	it('kraever ALLE valgte diaet-tags', () => {
		expect(filtrerOpskrifter3(LISTE, { dietTags: ['vegetar'] })).toHaveLength(2);
		expect(filtrerOpskrifter3(LISTE, { dietTags: ['vegetar', 'glutenfri'] })).toHaveLength(1);
	});

	it('kombinerer soegning og filtre', () => {
		const ud = filtrerOpskrifter3(LISTE, { soegeord: 'havregryn', kategorier: ['morgenmad'] });
		expect(ud).toHaveLength(2);
	});

	it('giver grunden med tilbage', () => {
		const ud = filtrerOpskrifter3(LISTE, { soegeord: 'havregryn' });
		expect(ud).toHaveLength(2);
		expect(ud[0].grunde).toEqual([{ term: 'havregryn', felt: 'ingredienser' }]);
	});

	it('giver ingen grund naar ordet stod i titlen', () => {
		const ud = filtrerOpskrifter3(LISTE, { soegeord: 'skyrbowl' });
		expect(ud).toHaveLength(1);
		expect(ud[0].grunde).toEqual([]);
	});

	it('bevarer raekkefoelgen fra input', () => {
		const ud = filtrerOpskrifter3(LISTE, { soegeord: 'a' });
		const titler = ud.map((r) => r.opskrift.titel);
		expect(titler).toEqual(LISTE.filter((o) => titler.includes(o.titel)).map((o) => o.titel));
	});

	it('giver tom liste naar intet passer', () => {
		expect(filtrerOpskrifter3(LISTE, { soegeord: 'blæksprutte' })).toEqual([]);
	});
});
