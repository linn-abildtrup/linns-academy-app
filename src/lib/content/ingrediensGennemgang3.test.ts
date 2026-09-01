import { describe, it, expect } from 'vitest';
import {
	antalGennemgaaet,
	datoTekst,
	erGennemgaaet,
	fjernGennemgaaet,
	kunIkkeGennemgaaede,
	markerGennemgaaet,
	type Gennemgangskort
} from './ingrediensGennemgang3';

const raekker = [{ kerne: 'olivenolie' }, { kerne: 'hytteost' }, { kerne: 'kikaerter' }];

describe('gennemgaaet', () => {
	it('et tomt kort betyder at intet er set efter', () => {
		expect(erGennemgaaet({}, 'olivenolie')).toBe(false);
		expect(antalGennemgaaet(raekker, {})).toBe(0);
	});

	it('markerer og fjerner én ad gangen uden at roere de andre', () => {
		let kort: Gennemgangskort = markerGennemgaaet({}, 'olivenolie', 'uid1');
		kort = markerGennemgaaet(kort, 'hytteost', 'uid1');
		expect(antalGennemgaaet(raekker, kort)).toBe(2);
		kort = fjernGennemgaaet(kort, 'olivenolie');
		expect(erGennemgaaet(kort, 'olivenolie')).toBe(false);
		expect(erGennemgaaet(kort, 'hytteost')).toBe(true);
	});

	it('gemmer hvem der markerede og hvornaar', () => {
		const kort = markerGennemgaaet({}, 'olivenolie', 'uid1', new Date('2026-09-01T09:12:00Z'));
		expect(kort['olivenolie'].af).toBe('uid1');
		expect(datoTekst(kort['olivenolie'].naar)).toBe('1. september 2026');
	});

	it('taeller ikke navne der ikke laengere staar i en opskrift med', () => {
		// Linn markerer en ingrediens og retter bagefter teksten paa den i
		// opskriften. Det gamle navn maa ikke taelle med i "x af y".
		const kort = markerGennemgaaet({}, 'olivenolie gammel stavemaade', 'uid1');
		expect(antalGennemgaaet(raekker, kort)).toBe(0);
	});

	it('filtrerer de gennemgaaede fra', () => {
		const kort = markerGennemgaaet({}, 'hytteost', 'uid1');
		expect(kunIkkeGennemgaaede(raekker, kort).map((r) => r.kerne)).toEqual([
			'olivenolie',
			'kikaerter'
		]);
	});

	it('en oedelagt dato giver tom tekst i stedet for at vaelte siden', () => {
		expect(datoTekst('ikke en dato')).toBe('');
	});
});
