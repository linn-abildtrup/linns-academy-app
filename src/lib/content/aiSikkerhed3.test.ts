import { describe, it, expect } from 'vitest';
import { sikkerhedsLinje3, USIKKER_UNDER_3 } from './aiSikkerhed3';

describe('sikkerhedsLinje3', () => {
	it('skriver tallet som i den gamle app', () => {
		const l = sikkerhedsLinje3(87, true);
		expect(l.lav).toBe(false);
		expect(l.tekst).toBe('87 % sikker på at dette er som Linn ville svare');
	});

	it('tilbyder Linn naar tallet er lavt', () => {
		const l = sikkerhedsLinje3(42, true);
		expect(l.lav).toBe(true);
		expect(l.tekst).toBe(
			'42 % sikker på at dette er som Linn ville svare — overvej at spørge Linn'
		);
	});

	it('graensen gaar ved 60: 60 er ikke lav, 59 er', () => {
		expect(sikkerhedsLinje3(USIKKER_UNDER_3, true).lav).toBe(false);
		expect(sikkerhedsLinje3(USIKKER_UNDER_3 - 1, true).lav).toBe(true);
	});

	// Sker i knap hvert tiende svar. Foer stod der ingenting, og et svar
	// uden linje saa mere sikkert ud end et med.
	it('siger det med ord naar tallet mangler', () => {
		for (const tom of [null, undefined]) {
			const l = sikkerhedsLinje3(tom, true);
			expect(l.lav).toBe(true);
			expect(l.tekst).toBe(
				'Jeg kan ikke måle hvor tæt det her er på Linns eget svar — spørg Linn hvis det er vigtigt'
			);
		}
	});

	// Har hun ikke adgang til at skrive til Linn, peger henvisningen paa
	// en doer der ikke findes.
	it('henviser ikke til Linn naar hun ikke kan skrive til hende', () => {
		expect(sikkerhedsLinje3(42, false).tekst).toBe(
			'42 % sikker på at dette er som Linn ville svare'
		);
		expect(sikkerhedsLinje3(null, false).tekst).toBe(
			'Jeg kan ikke måle hvor tæt det her er på Linns eget svar'
		);
	});

	it('klipper tal modellen har fundet paa, paa plads', () => {
		expect(sikkerhedsLinje3(137, true).tekst).toContain('100 %');
		expect(sikkerhedsLinje3(-8, true).tekst).toContain('0 %');
	});

	it('runder af, saa der aldrig staar 86,4 %', () => {
		expect(sikkerhedsLinje3(86.4, true).tekst).toContain('86 %');
		expect(sikkerhedsLinje3(86.6, true).tekst).toContain('87 %');
	});
});
