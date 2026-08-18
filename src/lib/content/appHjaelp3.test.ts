import { describe, it, expect } from 'vitest';
import {
	byggHjaelpPrompt3,
	hjaelpAfsnitFor3,
	hjaelpQuotaNoegle3,
	HJAELP_AFSNIT_3,
	HJAELP_MAX_PR_DAG_3,
	type HjaelpKunde3
} from './appHjaelp3';

const FORLOBSKUNDE: HjaelpKunde3 = {
	harAktivtForlob: true,
	harGennemfoertForlob: false,
	forlobNavn: 'Kickstart august',
	harTraening: true,
	maaSkriveTilLinn: true,
	maaSeKalorier: true,
	maaByggeEget: false
};

const MEDLEM: HjaelpKunde3 = {
	harAktivtForlob: false,
	harGennemfoertForlob: false,
	harTraening: true,
	maaSkriveTilLinn: false,
	maaSeKalorier: false,
	maaByggeEget: false
};

describe('hjaelpAfsnitFor3', () => {
	it('giver en forloebskunde flere afsnit end et medlem', () => {
		expect(hjaelpAfsnitFor3(FORLOBSKUNDE).length).toBeGreaterThan(hjaelpAfsnitFor3(MEDLEM).length);
	});

	it('fortaeller aldrig et medlem om forloebet', () => {
		const titler = hjaelpAfsnitFor3(MEDLEM).map((a) => a.titel);
		expect(titler).not.toContain('Dit forløb');
	});

	it('fortaeller aldrig et medlem at hun kan skrive til Linn', () => {
		const titler = hjaelpAfsnitFor3(MEDLEM).map((a) => a.titel);
		expect(titler).not.toContain('Send et spørgsmål videre til Linn');
	});

	it('naevner kun kalorier for den der maa se dem', () => {
		expect(hjaelpAfsnitFor3(MEDLEM).map((a) => a.titel)).not.toContain(
			'Kalorier, kulhydrat og fedt'
		);
		expect(hjaelpAfsnitFor3(FORLOBSKUNDE).map((a) => a.titel)).toContain(
			'Kalorier, kulhydrat og fedt'
		);
	});

	it('naevner kun byg eget program naar hun har lov', () => {
		expect(hjaelpAfsnitFor3(FORLOBSKUNDE).map((a) => a.titel)).not.toContain(
			'Byg dit eget træningsprogram'
		);
		expect(hjaelpAfsnitFor3({ ...FORLOBSKUNDE, maaByggeEget: true }).map((a) => a.titel)).toContain(
			'Byg dit eget træningsprogram'
		);
	});

	it('springer traening over naar hun ikke har faaet et program', () => {
		const titler = hjaelpAfsnitFor3({ ...MEDLEM, harTraening: false }).map((a) => a.titel);
		expect(titler).not.toContain('Træning');
	});

	// Bundmenuen og fejlsoegningen skal ALLE have, uanset hvem de er.
	it('giver altid bundmenuen og hjaelp naar noget ikke virker', () => {
		for (const k of [FORLOBSKUNDE, MEDLEM]) {
			const titler = hjaelpAfsnitFor3(k).map((a) => a.titel);
			expect(titler).toContain('Sådan finder du rundt');
			expect(titler).toContain('Hvis appen ikke virker som forventet');
		}
	});
});

describe('byggHjaelpPrompt3', () => {
	it('beskriver 3.0 og ikke den gamle app', () => {
		const p = byggHjaelpPrompt3(FORLOBSKUNDE);
		expect(p).toContain('30-30');
		expect(p).toContain('Beskeder');
		// Moduler-fanen findes ikke i 3.0. Det var netop den fejl der blev
		// fundet 16. august: AI'en forklarede en fane der ikke er der.
		expect(p).not.toMatch(/Moduler-fanen|fanen Moduler/);
	});

	it('siger aldrig premium eller basis', () => {
		for (const k of [FORLOBSKUNDE, MEDLEM]) {
			const p = byggHjaelpPrompt3(k).toLowerCase();
			expect(p).not.toMatch(/\bpremium-bruger\b|\bbasis-app\b|\bpremium-app\b/);
		}
	});

	it('naevner forloebets navn naar hun er paa et', () => {
		expect(byggHjaelpPrompt3(FORLOBSKUNDE)).toContain('Kickstart august');
	});

	it('siger til et medlem at hun ikke er paa et forloeb', () => {
		expect(byggHjaelpPrompt3(MEDLEM)).toContain('uden at være på et forløb');
	});

	it('taaler at forloebet ikke har et navn', () => {
		const p = byggHjaelpPrompt3({ ...FORLOBSKUNDE, forlobNavn: undefined });
		expect(p).toContain('Hun er på et forløb.');
	});
});

describe('kvoten', () => {
	it('er 30 om dagen, adskilt fra Linn AI', () => {
		expect(HJAELP_MAX_PR_DAG_3).toBe(30);
	});

	it('noeglen er datoen', () => {
		expect(hjaelpQuotaNoegle3(new Date(Date.UTC(2026, 7, 16)))).toBe('2026-08-16');
	});
});

describe('videnbasen som helhed', () => {
	it('hvert afsnit har titel og indhold', () => {
		for (const a of HJAELP_AFSNIT_3) {
			expect(a.titel.length).toBeGreaterThan(0);
			expect(a.indhold.length).toBeGreaterThan(20);
		}
	});

	// Sniger ordet Snak sig ind igen, staar der noget i appen der ikke
	// hedder det laengere. Se beskedside3.ts.
	it('bruger ordet Beskeder og ikke Snak om fanen', () => {
		for (const a of HJAELP_AFSNIT_3) {
			expect(a.indhold).not.toMatch(/fanen Snak|Snak i bundmenuen/);
		}
	});
});

// Tilfoejet 18. august 2026 sammen med "Dine lektioner".
describe('Dine lektioner og noterne', () => {
	it('et medlem uden forloebshistorik faar dem ikke naevnt', () => {
		const titler = hjaelpAfsnitFor3(MEDLEM).map((a) => a.titel);
		expect(titler).not.toContain('Dine lektioner');
		expect(titler).not.toContain('Dine noter på lektionerne');
	});

	it('en der har gennemfoert et forloeb faar dem med', () => {
		const titler = hjaelpAfsnitFor3({ ...MEDLEM, harGennemfoertForlob: true }).map((a) => a.titel);
		expect(titler).toContain('Dine lektioner');
		expect(titler).toContain('Dine noter på lektionerne');
	});

	it('en paa et forloeb faar dem ogsaa', () => {
		const titler = hjaelpAfsnitFor3(FORLOBSKUNDE).map((a) => a.titel);
		expect(titler).toContain('Dine lektioner');
	});

	// Hjaelp-afsnittet er nyt 18. august og gaelder alle.
	it('alle faar at vide hvad der ligger under Hjælp', () => {
		expect(hjaelpAfsnitFor3(MEDLEM).map((a) => a.titel)).toContain('Hjælp');
	});
});
