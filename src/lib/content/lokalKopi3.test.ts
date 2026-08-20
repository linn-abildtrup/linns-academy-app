import { describe, it, expect } from 'vitest';
import { erAendret3, kopiDuer3 } from './lokalKopi3';

const r = (...ids: string[]) => ids.map((id) => ({ id }));

describe('erAendret3', () => {
	it('to ens lister er ikke aendret', () => {
		expect(erAendret3(r('a', 'b', 'c'), r('a', 'b', 'c'))).toBe(false);
	});

	it('en tilfoejet raekke er en aendring', () => {
		expect(erAendret3(r('a', 'b'), r('a', 'b', 'c'))).toBe(true);
	});

	it('en fjernet raekke er en aendring', () => {
		expect(erAendret3(r('a', 'b', 'c'), r('a', 'b'))).toBe(true);
	});

	it('en udskiftet raekke er en aendring', () => {
		expect(erAendret3(r('a', 'b'), r('a', 'z'))).toBe(true);
	});

	// Begge lister sorteres det samme sted, saa forskellig raekkefoelge
	// betyder at noget er galt et andet sted og skal give sandt.
	it('samme id-er i anden raekkefoelge er en aendring', () => {
		expect(erAendret3(r('a', 'b'), r('b', 'a'))).toBe(true);
	});

	it('to tomme lister er ikke aendret', () => {
		expect(erAendret3([], [])).toBe(false);
	});

	it('tom mod fyldt er en aendring', () => {
		expect(erAendret3([], r('a'))).toBe(true);
	});
});

describe('kopiDuer3', () => {
	it('en kopi med indhold duer', () => {
		expect(kopiDuer3(r('a'))).toBe(true);
	});

	// Foerste gang paa en ny telefon, eller efter browseren har ryddet op.
	it('en tom kopi duer ikke', () => {
		expect(kopiDuer3([])).toBe(false);
	});

	it('ingen kopi duer ikke', () => {
		expect(kopiDuer3(null)).toBe(false);
	});
});
