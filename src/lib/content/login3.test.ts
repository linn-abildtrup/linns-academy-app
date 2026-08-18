import { describe, it, expect } from 'vitest';
import {
	erEmail,
	glemtKvittering,
	intetKoebTekst,
	kanSende,
	loginFejlTekst,
	renEmail,
	RESERVE_FEJL,
	teksterFor,
	tjekFelter
} from './login3';

describe('loginFejlTekst', () => {
	it('oversaetter en kendt kode til dansk', () => {
		expect(loginFejlTekst({ code: 'auth/wrong-password' })).toBe(
			'Forkert adgangskode eller email. Prøv igen.'
		);
	});

	// Forkert kode og ukendt email skal give det SAMME svar, ellers kan
	// siden bruges til at gaette hvem der er kunde.
	it('forkert kode og forkert email giver samme besked', () => {
		expect(loginFejlTekst({ code: 'auth/wrong-password' })).toBe(
			loginFejlTekst({ code: 'auth/invalid-credential' })
		);
	});

	it('en ukendt kode giver reservebeskeden', () => {
		expect(loginFejlTekst({ code: 'auth/noget-nyt' })).toBe(RESERVE_FEJL);
	});

	it('noget der slet ikke er en fejl giver ogsaa reservebeskeden', () => {
		expect(loginFejlTekst(null)).toBe(RESERVE_FEJL);
		expect(loginFejlTekst('boom')).toBe(RESERVE_FEJL);
		expect(loginFejlTekst({})).toBe(RESERVE_FEJL);
	});

	it('ingen fejlkode slipper ud paa skaermen', () => {
		const koder = [
			'auth/wrong-password',
			'auth/user-not-found',
			'auth/too-many-requests',
			'auth/weak-password'
		];
		for (const code of koder) {
			expect(loginFejlTekst({ code })).not.toContain('auth/');
		}
	});
});

describe('intetKoebTekst', () => {
	// Linns beslutning 18. august: naevn ikke hvor koebet er sket.
	it('naevner ikke Simplero', () => {
		expect(intetKoebTekst('Mette@Eksempel.DK')).not.toMatch(/simplero/i);
	});

	it('siger hvad hun skal goere, og hvor hun kan skrive', () => {
		const t = intetKoebTekst('mette@eksempel.dk');
		expect(t).toContain('samme email');
		expect(t).toContain('kontakt@linnsacademy.dk');
	});

	it('skriver emailen med smaa bogstaver', () => {
		expect(intetKoebTekst('  Mette@Eksempel.DK ')).toContain('mette@eksempel.dk');
	});
});

describe('glemtKvittering', () => {
	// Samme kvittering uanset om kontoen findes.
	it('lover ikke at emailen findes', () => {
		expect(glemtKvittering('mette@eksempel.dk')).toContain('Er mette@eksempel.dk registreret');
	});
});

describe('renEmail', () => {
	it('trimmer og saenker', () => {
		expect(renEmail('  Mette@Eksempel.DK ')).toBe('mette@eksempel.dk');
	});

	it('tom bliver tom', () => {
		expect(renEmail('   ')).toBe('');
	});
});

describe('erEmail', () => {
	it('godtager en almindelig adresse', () => {
		expect(erEmail('mette@eksempel.dk')).toBe(true);
	});

	it('godtager mellemrum omkring', () => {
		expect(erEmail('  mette@eksempel.dk  ')).toBe(true);
	});

	it('afviser en uden snabel-a', () => {
		expect(erEmail('mette.eksempel.dk')).toBe(false);
	});

	it('afviser en uden endelse', () => {
		expect(erEmail('mette@eksempel')).toBe(false);
	});

	it('afviser en tom', () => {
		expect(erEmail('')).toBe(false);
	});

	it('afviser mellemrum inde i adressen', () => {
		expect(erEmail('met te@eksempel.dk')).toBe(false);
	});
});

describe('tjekFelter', () => {
	it('login uden email siger det', () => {
		expect(tjekFelter('login', '', 'kode123')).toBe('Skriv din email.');
	});

	it('login uden kode siger det', () => {
		expect(tjekFelter('login', 'mette@eksempel.dk', '')).toBe('Skriv din adgangskode.');
	});

	it('login med begge dele er i orden', () => {
		expect(tjekFelter('login', 'mette@eksempel.dk', 'hvadsomhelst')).toBeNull();
	});

	// Ved login skal en kort kode IKKE afvises. Har hun en gammel konto med
	// fire tegn, skal hun stadig kunne komme ind.
	it('login godtager en kort kode', () => {
		expect(tjekFelter('login', 'mette@eksempel.dk', '1234')).toBeNull();
	});

	it('opret afviser en kode under seks tegn', () => {
		expect(tjekFelter('opret', 'mette@eksempel.dk', '12345')).toBe(
			'Adgangskoden skal være mindst 6 tegn.'
		);
	});

	it('opret godtager seks tegn', () => {
		expect(tjekFelter('opret', 'mette@eksempel.dk', '123456')).toBeNull();
	});

	it('glemt kode kræver kun en email', () => {
		expect(tjekFelter('glemt', 'mette@eksempel.dk', '')).toBeNull();
	});

	it('glemt kode afviser en forkert email', () => {
		expect(tjekFelter('glemt', 'ikke en email', '')).toBe(
			'Den email ser ikke rigtig ud. Tjek den lige.'
		);
	});
});

describe('kanSende', () => {
	it('er sand naar felterne er i orden', () => {
		expect(kanSende('login', 'mette@eksempel.dk', 'kode123', false)).toBe(true);
	});

	it('er falsk mens vi sender', () => {
		expect(kanSende('login', 'mette@eksempel.dk', 'kode123', true)).toBe(false);
	});

	it('er falsk naar et felt mangler', () => {
		expect(kanSende('login', 'mette@eksempel.dk', '', false)).toBe(false);
	});
});

describe('teksterFor', () => {
	it('login har ingen undertekst', () => {
		expect(teksterFor('login')).toEqual({ titel: 'Velkommen tilbage', under: '', knap: 'Log ind' });
	});

	it('opret fortæller om emailen uden at nævne hvor købet skete', () => {
		const t = teksterFor('opret');
		expect(t.under).toBe('Brug den samme email som da du købte.');
		expect(t.under).not.toMatch(/simplero/i);
	});

	it('glemt kode forklarer hvad der sker', () => {
		expect(teksterFor('glemt').knap).toBe('Send mig et link');
	});

	it('velkomst har ingen knaptekst, for der er to knapper', () => {
		expect(teksterFor('velkommen').knap).toBe('');
	});
});
