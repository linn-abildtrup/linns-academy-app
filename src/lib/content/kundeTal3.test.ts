import { describe, it, expect } from 'vitest';
import {
	byggKundeTal,
	byggKundeTalTekst,
	datoNoegle,
	STANDARD_PROTEIN,
	STANDARD_FIBER,
	type Maaltid
} from './kundeTal3';

const NU = new Date('2026-09-01T14:00:00Z').getTime();
const IDAG = datoNoegle(NU);

function m(dato: string, protein: number, fiber: number): Maaltid {
	return { dato, protein, fiber };
}

describe('byggKundeTal', () => {
	it('laegger dagens maaltider sammen', () => {
		const t = byggKundeTal([m(IDAG, 25, 8), m(IDAG, 17, 6)], NU);
		expect(t.iDagProtein).toBe(42);
		expect(t.iDagFiber).toBe(14);
		expect(t.harRegistreretIDag).toBe(true);
	});

	it('ved naar hun ikke har registreret i dag', () => {
		const t = byggKundeTal([m('2026-08-31', 60, 20)], NU);
		expect(t.harRegistreretIDag).toBe(false);
		expect(t.iDagProtein).toBe(0);
	});

	it('REGNER SNITTET PR DAG HUN HAR REGISTRERET, ikke pr dag i ugen', () => {
		// To dage med 60 og 80 giver 70, ikke 20. En uge uden registrering
		// maa ikke traekke hende ned. Linns regel, se 9.26.
		const t = byggKundeTal([m('2026-08-30', 60, 20), m('2026-08-31', 80, 30)], NU);
		expect(t.snitProtein).toBe(70);
		expect(t.dageMed).toBe(2);
	});

	it('bruger standarden naar hun ikke har sat et maal', () => {
		const t = byggKundeTal([], NU);
		expect(t.maalProtein).toBe(STANDARD_PROTEIN);
		expect(t.maalFiber).toBe(STANDARD_FIBER);
	});

	it('bruger hendes eget maal naar det er sat', () => {
		const t = byggKundeTal([], NU, 105, 35);
		expect(t.maalProtein).toBe(105);
		expect(t.maalFiber).toBe(35);
	});

	it('falder tilbage paa standarden ved maalet NUL', () => {
		// Forsiden faldt tilbage paa nul 22. august, saa der stod "56 af 0 g".
		const t = byggKundeTal([], NU, 0, 0);
		expect(t.maalProtein).toBe(STANDARD_PROTEIN);
	});

	it('klarer en linje uden tal uden at braekke', () => {
		const t = byggKundeTal([{ dato: IDAG }], NU);
		expect(t.iDagProtein).toBe(0);
		expect(t.harRegistreretIDag).toBe(true);
	});

	it('klarer at der slet ikke er noget', () => {
		const t = byggKundeTal([], NU);
		expect(t.dageMed).toBe(0);
		expect(t.snitProtein).toBe(0);
	});
});

describe('byggKundeTalTekst', () => {
	it('skriver dagens tal og hendes maal', () => {
		const t = byggKundeTalTekst(byggKundeTal([m(IDAG, 42, 14)], NU));
		expect(t).toContain('42 g protein');
		expect(t).toContain('90 g protein');
	});

	it('SIGER ALDRIG hvor mange dage hun ikke har registreret', () => {
		const t = byggKundeTalTekst(byggKundeTal([m('2026-08-31', 60, 20)], NU));
		expect(t).not.toMatch(/\d+ af \d+ dage/);
		expect(t).not.toContain('mangler');
	});

	it('forbyder at bebrejde hende', () => {
		const t = byggKundeTalTekst(byggKundeTal([m(IDAG, 42, 14)], NU));
		expect(t).toContain('aldrig læse som en bebrejdelse');
	});

	it('siger tydeligt at tallene ikke er en vurdering af hendes helbred', () => {
		const t = byggKundeTalTekst(byggKundeTal([m(IDAG, 42, 14)], NU));
		expect(t).toContain('ikke en vurdering af hendes helbred');
	});

	it('siger til naar der ikke er noget at gaa efter', () => {
		const t = byggKundeTalTekst(byggKundeTal([], NU));
		expect(t).toContain('ingen registreringer');
	});

	it('giver en tom streng naar der ikke er tal overhovedet', () => {
		expect(byggKundeTalTekst(null)).toBe('');
	});
});
