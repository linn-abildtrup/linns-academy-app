import { describe, it, expect } from 'vitest';
import { fremgangsmaade, tilberedningstid } from './opskriftTekst3';

// Formatet som det faktisk ser ud paa alle 130 opskrifter, maalt 12. august.
const ECHTE = `Rør æggene sammen med et nip salt.
Steg dem blødt på panden ved svag varme.
Server på rugbrød med laks og avocado.

Protein: 32 g | Fiber: 7 g  | Kulhydrater: 30 g | Fedt: 18 g | Kalorier: 420 kcal | Tid: 10 minutter`;

describe('fremgangsmaade', () => {
	it('klipper makro-linjen af', () => {
		const ud = fremgangsmaade(ECHTE);
		expect(ud).not.toContain('Protein:');
		expect(ud).not.toContain('Kalorier:');
		expect(ud).not.toContain('Tid:');
	});

	it('beholder alle madlavnings-trinnene', () => {
		const ud = fremgangsmaade(ECHTE);
		expect(ud).toContain('Rør æggene sammen');
		expect(ud).toContain('Steg dem blødt');
		expect(ud).toContain('Server på rugbrød');
	});

	it('efterlader ikke tomme linjer i bunden', () => {
		expect(fremgangsmaade(ECHTE).endsWith('avocado.')).toBe(true);
	});

	// Den vigtigste. Stod tallene midt i en linje med rigtige instruktioner,
	// ville en for grov regel slette et helt trin. Reglen fejler paa den sikre
	// side: saa bliver linjen staaende, praecis som den goer i dag.
	it('sletter ALDRIG en linje hvor Protein staar midt i en instruktion', () => {
		const t = 'Kog pastaen. Protein: 20 g er nok til én portion.';
		expect(fremgangsmaade(t)).toBe(t);
	});

	it('taaler en tekst helt uden makro-linje', () => {
		expect(fremgangsmaade('Bland det hele.')).toBe('Bland det hele.');
	});

	it('taaler tom og manglende tekst', () => {
		expect(fremgangsmaade('')).toBe('');
		expect(fremgangsmaade(undefined)).toBe('');
	});

	it('klarer flere makro-linjer hvis nogen skulle have tastet to', () => {
		const t = 'Trin et.\nProtein: 10 g | Tid: 5 minutter\nProtein: 20 g | Tid: 9 minutter';
		expect(fremgangsmaade(t)).toBe('Trin et.');
	});
});

describe('tilberedningstid', () => {
	it('finder tiden i makro-linjen', () => {
		expect(tilberedningstid(ECHTE)).toBe('10 minutter');
	});

	it('stopper ved den lodrette streg og tager ikke resten med', () => {
		expect(tilberedningstid('Protein: 5 g | Tid: 35 minutter | noget andet')).toBe('35 minutter');
	});

	// 1 af 130 mangler feltet. Den skal bare ikke vise noget.
	it('giver null naar der ingen tid er', () => {
		expect(tilberedningstid('Protein: 5 g | Fiber: 2 g')).toBeNull();
		expect(tilberedningstid('')).toBeNull();
		expect(tilberedningstid(undefined)).toBeNull();
	});

	it('giver null naar feltet staar tomt', () => {
		expect(tilberedningstid('Protein: 5 g | Tid:   ')).toBeNull();
	});
});
