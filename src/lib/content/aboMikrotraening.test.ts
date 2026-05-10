import { describe, it, expect } from 'vitest';
import {
	aktuelAboDag,
	aboRundeNummer,
	harKlaretAboDagIRunde,
	genemfoerAboDag,
	ABO_MIKROTRAENING_DAGE,
	type AboMikrotraeningFremgang
} from './aboMikrotraening';

const tom: AboMikrotraeningFremgang = { totalGennemforte: 0, feedback: {} };
const halvejs: AboMikrotraeningFremgang = { totalGennemforte: 7, feedback: {} };
const slutAfRunde1: AboMikrotraeningFremgang = { totalGennemforte: 14, feedback: {} };
const midtIRunde2: AboMikrotraeningFremgang = { totalGennemforte: 18, feedback: {} };

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

	it('returnerer 1 efter 14 gennemførte (start runde 2)', () => {
		expect(aktuelAboDag(slutAfRunde1)).toBe(1);
	});

	it('returnerer 5 midt i runde 2 (totalGennemforte=18)', () => {
		expect(aktuelAboDag(midtIRunde2)).toBe(5);
	});
});

describe('aboRundeNummer', () => {
	it('runde 1 ved 0 gennemførte', () => {
		expect(aboRundeNummer(tom)).toBe(1);
	});

	it('runde 1 ved 13 gennemførte', () => {
		expect(aboRundeNummer({ totalGennemforte: 13, feedback: {} })).toBe(1);
	});

	it('runde 2 ved 14 gennemførte', () => {
		expect(aboRundeNummer(slutAfRunde1)).toBe(2);
	});

	it('runde 2 ved 27 gennemførte', () => {
		expect(aboRundeNummer({ totalGennemforte: 27, feedback: {} })).toBe(2);
	});

	it('runde 3 ved 28 gennemførte', () => {
		expect(aboRundeNummer({ totalGennemforte: 28, feedback: {} })).toBe(3);
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

	it('starter ny runde efter dag 14', () => {
		const fremgang: AboMikrotraeningFremgang = { totalGennemforte: 13, feedback: {} };
		expect(genemfoerAboDag(fremgang, 14)).toBe(14);
	});

	it('næste dag i ny runde går fra 14 til 15 (= dag 1 runde 2)', () => {
		expect(genemfoerAboDag(slutAfRunde1, 1)).toBe(15);
	});
});
