import { describe, it, expect } from 'vitest';
import {
	aktuelAboDag,
	aktuelAboDagForDato,
	aboRundeNummer,
	dageMellem,
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

describe('genemfoerAboDag (legacy gennemfoersels-mode)', () => {
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

describe('genemfoerAboDag (kalender-mode)', () => {
	const medAnker: AboMikrotraeningFremgang = {
		totalGennemforte: 3,
		feedback: {},
		aboStartDato: '2026-06-01'
	};

	it('inkrementerer altid uanset hvilken dag der gennemføres', () => {
		expect(genemfoerAboDag(medAnker, 7)).toBe(4);
		expect(genemfoerAboDag(medAnker, 1)).toBe(4);
		expect(genemfoerAboDag(medAnker, 21)).toBe(4);
	});

	it('starter på 1 hvis fremgang er null+aboStartDato (kantcase)', () => {
		// Helt frisk fremgang faar gennemfoert sin foerste dag
		const friskMedAnker: AboMikrotraeningFremgang = {
			totalGennemforte: 0,
			feedback: {},
			aboStartDato: '2026-06-07'
		};
		expect(genemfoerAboDag(friskMedAnker, 5)).toBe(1);
	});
});

describe('dageMellem', () => {
	it('returnerer 0 for samme dato', () => {
		expect(dageMellem('2026-06-07', '2026-06-07')).toBe(0);
	});

	it('returnerer positivt naar til er senere', () => {
		expect(dageMellem('2026-06-01', '2026-06-07')).toBe(6);
	});

	it('returnerer negativt naar til er tidligere', () => {
		expect(dageMellem('2026-06-07', '2026-06-01')).toBe(-6);
	});

	it('haandterer maaneds-grænser korrekt', () => {
		expect(dageMellem('2026-05-30', '2026-06-02')).toBe(3);
	});

	it('haandterer aars-grænser korrekt', () => {
		expect(dageMellem('2025-12-30', '2026-01-02')).toBe(3);
	});
});

describe('aktuelAboDagForDato (kalender-mode)', () => {
	const medAnker: AboMikrotraeningFremgang = {
		totalGennemforte: 0,
		feedback: {},
		aboStartDato: '2026-06-01'
	};

	it('returnerer dag 1 paa aboStartDato selv', () => {
		expect(aktuelAboDagForDato(medAnker, '2026-06-01')).toBe(1);
	});

	it('returnerer dag 2 dagen efter start', () => {
		expect(aktuelAboDagForDato(medAnker, '2026-06-02')).toBe(2);
	});

	it('returnerer dag 21 paa 20. dag efter start', () => {
		expect(aktuelAboDagForDato(medAnker, '2026-06-21')).toBe(21);
	});

	it('returnerer dag 1 paa 21. dag efter start (ny runde)', () => {
		expect(aktuelAboDagForDato(medAnker, '2026-06-22')).toBe(1);
	});

	it('cykler baglaens for datoer foer aboStartDato (dag-1 = dag 21)', () => {
		// 2026-05-31 = 1 dag foer 2026-06-01 -> dag 21 (sidste dag i cyklus)
		expect(aktuelAboDagForDato(medAnker, '2026-05-31')).toBe(21);
		// 2026-05-30 = 2 dage foer -> dag 20
		expect(aktuelAboDagForDato(medAnker, '2026-05-30')).toBe(20);
		// 2026-05-11 = 21 dage foer -> dag 1 (en hel runde tilbage)
		expect(aktuelAboDagForDato(medAnker, '2026-05-11')).toBe(1);
	});

	it('falder tilbage til legacy hvis aboStartDato mangler', () => {
		// Uden anker bruger den gennemfoersels-baseret som returnerer
		// (3 % 21) + 1 = 4
		const utenAnker: AboMikrotraeningFremgang = {
			totalGennemforte: 3,
			feedback: {}
		};
		expect(aktuelAboDagForDato(utenAnker, '2026-06-07')).toBe(4);
	});

	it('respekterer eksplicit antalDage (14 for gammelt basis)', () => {
		expect(aktuelAboDagForDato(medAnker, '2026-06-15', 14)).toBe(1);
	});
});
