import { describe, it, expect } from 'vitest';
import { vaelgForlobForProdukt, type ForlobKandidat } from './forlobKoeb';

const DAG = 24 * 60 * 60 * 1000;
const NU = Date.UTC(2026, 7, 30);

function hold(over: Partial<ForlobKandidat> = {}): ForlobKandidat {
	return { id: 'hold', navn: 'Hold', aktiv: true, startMs: NU, antalDage: 21, ...over };
}

describe('vaelgForlobForProdukt', () => {
	it('vaelger det aktive hold', () => {
		const svar = vaelgForlobForProdukt([hold({ id: 'august', navn: 'August' })], NU);
		expect(svar.valgt?.id).toBe('august');
	});

	it('siger nej naar intet hold har nummeret', () => {
		const svar = vaelgForlobForProdukt([], NU);
		expect(svar.valgt).toBeNull();
		expect(svar.begrundelse).toContain('intet hold');
	});

	it('siger nej naar holdet ikke er sat som aktivt', () => {
		const svar = vaelgForlobForProdukt([hold({ aktiv: false })], NU);
		expect(svar.valgt).toBeNull();
		expect(svar.begrundelse).toContain('aktivt forloeb');
	});

	it('behandler manglende flueben som ikke aktivt', () => {
		const svar = vaelgForlobForProdukt([hold({ aktiv: undefined })], NU);
		expect(svar.valgt).toBeNull();
	});

	it('tager ikke imod koeb paa et hold der er slut', () => {
		// Startede for 60 dage siden og varede 21. Fluebenet er glemt.
		const svar = vaelgForlobForProdukt([hold({ startMs: NU - 60 * DAG })], NU);
		expect(svar.valgt).toBeNull();
		expect(svar.begrundelse).toContain('slut');
	});

	it('lukker foerst holdet dagen efter sidste dag', () => {
		// Sidste dag paa et 21-dages hold. Skal stadig kunne tage imod.
		const svar = vaelgForlobForProdukt([hold({ startMs: NU - 21 * DAG })], NU);
		expect(svar.valgt).not.toBeNull();
	});

	it('vaelger det nyeste naar to hold er aktive paa samme nummer', () => {
		const svar = vaelgForlobForProdukt(
			[
				hold({ id: 'gammelt', navn: 'Juli', startMs: NU - 10 * DAG }),
				hold({ id: 'nyt', navn: 'August', startMs: NU })
			],
			NU
		);
		expect(svar.valgt?.id).toBe('nyt');
		expect(svar.begrundelse).toContain('2 aktive hold');
	});

	it('springer et sluttet hold over og tager det der koerer', () => {
		const svar = vaelgForlobForProdukt(
			[
				hold({ id: 'sluttet', startMs: NU - 60 * DAG }),
				hold({ id: 'koerende', startMs: NU - 2 * DAG })
			],
			NU
		);
		expect(svar.valgt?.id).toBe('koerende');
	});

	it('accepterer et hold der endnu ikke er startet', () => {
		// Linn aabner holdet og saelger foer det begynder. Det skal virke.
		const svar = vaelgForlobForProdukt([hold({ startMs: NU + 14 * DAG })], NU);
		expect(svar.valgt).not.toBeNull();
	});

	it('spaerrer ikke et hold uden startdato eller laengde', () => {
		const svar = vaelgForlobForProdukt([hold({ startMs: 0, antalDage: 0 })], NU);
		expect(svar.valgt).not.toBeNull();
	});
});
