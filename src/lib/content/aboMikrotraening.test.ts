import { describe, it, expect } from 'vitest';
import {
	aktuelAboDag,
	aboRundeNummer,
	harKlaretAboDagIRunde,
	genemfoerAboDag,
	ABO_MIKROTRAENING_DAGE,
	type AboMikrotraeningFremgang
} from './aboMikrotraening';

// ABO_MIKROTRAENING_DAGE er 21 pr 7/6 2026 (default for nye basis_kettlebell
// og basis_no_kettlebell programmer). Konstanten bruges som default naar
// caller ikke kender programmets faktiske antalDage.
const tom: AboMikrotraeningFremgang = { totalGennemforte: 0, feedback: {} };
const halvejs: AboMikrotraeningFremgang = { totalGennemforte: 7, feedback: {} };
const slutAfRunde1: AboMikrotraeningFremgang = { totalGennemforte: 21, feedback: {} };
const midtIRunde2: AboMikrotraeningFremgang = { totalGennemforte: 25, feedback: {} };

describe('aktuelAboDag', () => {
	it('returnerer 1 for null fremgang', () => {
		expect(aktuelAboDag(null)).toBe(1);
	});

	it('returnerer 1 for tom fremgang', () => {
		expect(aktuelAboDag(tom)).toBe(1);
	});

	it('returnerer 8 efter 7 gennemførte dage', () => {
		expect(aktuelAboDag(halvejs)).toBe(8);
	});

	it('returnerer 1 efter 21 gennemførte (start runde 2)', () => {
		expect(aktuelAboDag(slutAfRunde1)).toBe(1);
	});

	it('returnerer 5 midt i runde 2 (totalGennemforte=25)', () => {
		expect(aktuelAboDag(midtIRunde2)).toBe(5);
	});

	it('respekterer eksplicit antalDage-argument (14-dages program)', () => {
		// Forløb-kunder paa det gamle 14-dages basis-program har stadig
		// brug for korrekt beregning. Caller sender da program.antalDage=14.
		expect(aktuelAboDag({ totalGennemforte: 14, feedback: {} }, 14)).toBe(1);
		expect(aktuelAboDag({ totalGennemforte: 18, feedback: {} }, 14)).toBe(5);
	});
});

describe('aboRundeNummer', () => {
	it('runde 1 ved 0 gennemførte', () => {
		expect(aboRundeNummer(tom)).toBe(1);
	});

	it('runde 1 ved 20 gennemførte', () => {
		expect(aboRundeNummer({ totalGennemforte: 20, feedback: {} })).toBe(1);
	});

	it('runde 2 ved 21 gennemførte', () => {
		expect(aboRundeNummer(slutAfRunde1)).toBe(2);
	});

	it('runde 2 ved 41 gennemførte', () => {
		expect(aboRundeNummer({ totalGennemforte: 41, feedback: {} })).toBe(2);
	});

	it('runde 3 ved 42 gennemførte', () => {
		expect(aboRundeNummer({ totalGennemforte: 42, feedback: {} })).toBe(3);
	});
});

describe('harKlaretAboDagIRunde', () => {
	it('ingen dage klaret i tom fremgang', () => {
		for (let i = 1; i <= ABO_MIKROTRAENING_DAGE; i++) {
			expect(harKlaretAboDagIRunde(tom, i)).toBe(false);
		}
	});

	it('dag 1-7 klaret efter 7 gennemførte', () => {
		expect(harKlaretAboDagIRunde(halvejs, 1)).toBe(true);
		expect(harKlaretAboDagIRunde(halvejs, 7)).toBe(true);
		expect(harKlaretAboDagIRunde(halvejs, 8)).toBe(false);
	});

	it('ingen dage klaret når en runde lige er afsluttet (start runde 2)', () => {
		for (let i = 1; i <= ABO_MIKROTRAENING_DAGE; i++) {
			expect(harKlaretAboDagIRunde(slutAfRunde1, i)).toBe(false);
		}
	});

	it('dag 1-4 klaret midt i runde 2', () => {
		expect(harKlaretAboDagIRunde(midtIRunde2, 1)).toBe(true);
		expect(harKlaretAboDagIRunde(midtIRunde2, 4)).toBe(true);
		expect(harKlaretAboDagIRunde(midtIRunde2, 5)).toBe(false);
	});
});

describe('genemfoerAboDag', () => {
	it('øger total med 1 ved gennemførelse af aktuel dag', () => {
		expect(genemfoerAboDag(tom, 1)).toBe(1);
	});

	it('returnerer uændret hvis brugeren forsøger at springe forud', () => {
		expect(genemfoerAboDag(tom, 5)).toBe(0);
	});

	it('starter ny runde efter dag 21', () => {
		const fremgang: AboMikrotraeningFremgang = { totalGennemforte: 20, feedback: {} };
		expect(genemfoerAboDag(fremgang, 21)).toBe(21);
	});

	it('næste dag i ny runde går fra 21 til 22 (= dag 1 runde 2)', () => {
		expect(genemfoerAboDag(slutAfRunde1, 1)).toBe(22);
	});

	it('respekterer eksplicit antalDage=14 for gammelt basis-program', () => {
		const fremgang: AboMikrotraeningFremgang = { totalGennemforte: 14, feedback: {} };
		// Paa 14-dages program er aktuel dag = (14 % 14) + 1 = 1
		expect(genemfoerAboDag(fremgang, 1, 14)).toBe(15);
		// Forsoeg paa dag 2 fejler (ikke aktuel)
		expect(genemfoerAboDag(fremgang, 2, 14)).toBe(14);
	});
});
