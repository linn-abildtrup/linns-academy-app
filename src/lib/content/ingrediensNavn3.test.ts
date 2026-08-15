import { describe, it, expect } from 'vitest';
import { kerneNavn, tilstand, sammeVare, grupper } from './ingrediensNavn3';

describe('tilstand', () => {
	it('giver ingen tilstand paa varer hvor det er ligegyldigt', () => {
		expect(tilstand('gulerod')).toBeNull();
		expect(tilstand('kyllingebryst')).toBeNull();
		expect(tilstand('kogte gulerødder')).toBeNull();
	});

	it('laeser toer og afdryppet paa baelgfrugter', () => {
		expect(tilstand('grønne linser, tørre')).toBe('toer');
		expect(tilstand('grønne linser, afdryppede')).toBe('afdryppet');
		expect(tilstand('kikærter, afdryppede')).toBe('afdryppet');
		expect(tilstand('sorte bønner, afdryppede')).toBe('afdryppet');
	});

	it('regner en daase som afdryppet', () => {
		expect(tilstand('dåse kikærter')).toBe('afdryppet');
		expect(tilstand('dåse sorte bønner, afdryppede')).toBe('afdryppet');
	});

	it('regner raavarer som toerre naar der intet staar', () => {
		// Linns praecisering: raavarer er raa.
		expect(tilstand('quinoa')).toBe('toer');
		expect(tilstand('bulgur')).toBe('toer');
		expect(tilstand('fuldkornsris')).toBe('toer');
	});

	it('laeser kogt naar det staar', () => {
		expect(tilstand('brune ris, kogte')).toBe('kogt');
	});

	it('regner friske og frosne baelge som groentsager uden tilstand', () => {
		// Groenne boenner har 1,8 g protein. Toerre hvide boenner har 21.
		// Faar de groenne stemplet toer, bliver retten ti gange for
		// proteinrig.
		expect(tilstand('grønne bønner')).toBeNull();
		expect(tilstand('edamamebønner, frosne')).toBeNull();
		expect(tilstand('sukkerærter eller grønne bønner')).toBeNull();
		expect(tilstand('frisk spinat')).toBeNull();
	});

	it('men toerre baelgfrugter er stadig toerre', () => {
		expect(tilstand('hvide bønner, afdryppede')).toBe('afdryppet');
		expect(tilstand('kidneybønner, afdryppede')).toBe('afdryppet');
	});
});

describe('kerneNavn', () => {
	it('samler de fem stavemaader af olivenolie', () => {
		const alle = [
			'olivenolie',
			'Olivenolie',
			'olievenolie',
			'olivenolie til stegning',
			'olivenolie til topping',
			'olivenolie (til tzatziki)'
		];
		const kerner = new Set(alle.map(kerneNavn));
		expect(kerner.size).toBe(1);
		expect([...kerner][0]).toBe('olivenolie');
	});

	it('samler avocado og avokado', () => {
		// 25 linjer var delt paa fire skrivemaader.
		expect(kerneNavn('avocado')).toBe('avocado');
		expect(kerneNavn('avokado')).toBe('avocado');
		expect(kerneNavn('avokado, i tern')).toBe('avocado');
		expect(kerneNavn('moden avokado')).toBe('avocado');
	});

	it('samler de syv skrivemaader af dild', () => {
		const alle = ['dild', 'frisk dild', 'Lidt frisk dild', 'dild, hakket', 'hakket frisk dild', 'Frisk dild'];
		expect(new Set(alle.map(kerneNavn)).size).toBe(1);
	});

	it('samler mandler uanset om de er hakkede eller ristede', () => {
		const alle = ['mandler', 'mandler, hakkede', 'hakkede mandler', 'ristede, hakkede mandler', 'ristede mandler'];
		expect(new Set(alle.map(kerneNavn)).size).toBe(1);
	});

	it('HOLDER toerre og afdryppede linser adskilt', () => {
		// Den vigtigste test i filen. Toerre har 20 g protein, afdryppede
		// har 5,7. Bliver de slaaet sammen, er makroen fire gange forkert.
		expect(kerneNavn('grønne linser, tørre')).not.toBe(kerneNavn('grønne linser, afdryppede'));
	});

	it('HOLDER toerre og afdryppede kikaerter adskilt', () => {
		expect(kerneNavn('kikærter, tørre')).not.toBe(kerneNavn('kikærter, afdryppede'));
	});

	it('samler de samme baelgfrugter i samme tilstand', () => {
		expect(kerneNavn('kikærter, afdryppede')).toBe(kerneNavn('Kikærter, afdryppede'));
		expect(kerneNavn('sorte bønner, afdryppede')).toBe(kerneNavn('dåse sorte bønner, afdryppede'));
		expect(kerneNavn('røde linser, tørre')).toBe(kerneNavn('Røde linser, tørre'));
	});

	it('fjerner procent-angivelser der kun er en variant', () => {
		expect(kerneNavn('græsk yoghurt 10%')).toBe(kerneNavn('græsk yoghurt'));
	});

	it('samler stavefejlen tahin med tahini', () => {
		expect(kerneNavn('tahin')).toBe(kerneNavn('tahini'));
	});

	it('samler soja med sojasauce', () => {
		expect(kerneNavn('soja')).toBe(kerneNavn('sojasauce'));
	});

	it('lader varer der reelt er forskellige vaere forskellige', () => {
		expect(kerneNavn('rugbrød')).not.toBe(kerneNavn('fuldkornstortilla'));
		expect(kerneNavn('tomat')).not.toBe(kerneNavn('cherrytomater'));
		expect(kerneNavn('løg')).not.toBe(kerneNavn('rødløg'));
		expect(kerneNavn('hvidløg')).not.toBe(kerneNavn('løg'));
	});

	it('holder fed hvidloeg og hvidloeg adskilt fra loeg', () => {
		expect(kerneNavn('fed hvidløg')).toContain('hvidloeg');
		expect(kerneNavn('fed hvidløg')).not.toBe(kerneNavn('løg'));
	});
});

describe('sammeVare', () => {
	it('siger ja til to skrivemaader af det samme', () => {
		expect(sammeVare('Kyllingebryst', 'kyllingebryst i tern')).toBe(true);
	});

	it('siger nej til to tilstande af en baelgfrugt', () => {
		expect(sammeVare('grønne linser, tørre', 'grønne linser, afdryppede')).toBe(false);
	});
});

describe('grupper', () => {
	it('samler varianter under ét kernenavn og taeller dem', () => {
		const g = grupper(['avocado', 'avokado', 'avocado', 'rugbrød']);
		expect(g).toHaveLength(2);
		expect(g[0].kerne).toBe('avocado');
		expect(g[0].antal).toBe(3);
		expect(g[0].varianter).toHaveLength(2);
	});

	it('sorterer de hyppigste foerst', () => {
		const g = grupper(['salt', 'salt', 'salt', 'peber']);
		expect(g[0].kerne).toBe('salt');
	});
});
