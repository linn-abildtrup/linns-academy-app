import { describe, it, expect } from 'vitest';
import { visStartDato3 } from './forside3';

describe('visStartDato3', () => {
	// Det almindelige: to maalinger i hver sin ende af kurven.
	it('viser startdatoen naar kurven spaender bredt', () => {
		expect(visStartDato3(17, 283, '1. sep', '4. okt')).toBe(true);
	});

	// Ligger maalingerne taet, vokser de to datoer ind i hinanden.
	it('skjuler startdatoen naar punkterne ligger taet', () => {
		expect(visStartDato3(120, 150, '1. sep', '4. sep')).toBe(false);
	});

	// En dato med aarstal fylder mere, og saa skal der mere plads til.
	// Samme afstand, men den lange dato fylder saa meget at der ikke er
	// plads til begge. Det er derfor bredden regnes af teksten og ikke er
	// et fast tal.
	it('tager hoejde for at datoen kan have aarstal', () => {
		expect(visStartDato3(100, 170, '1. sep', '4. okt')).toBe(true);
		expect(visStartDato3(100, 170, '26. dec 2025', '4. okt')).toBe(false);
	});

	it('siger nej naar de to punkter er samme sted', () => {
		expect(visStartDato3(150, 150, '1. sep', '1. sep')).toBe(false);
	});
});
