import { describe, it, expect } from 'vitest';
import { vurderSpaerring, naadeTekst, NAADE_DAGE, type SpaerringGrundlag } from './spaerring3';

const DAG = 86_400_000;
const NU = new Date(2026, 7, 9, 12, 0, 0).getTime();

function g(delvis: Partial<SpaerringGrundlag> = {}): SpaerringGrundlag {
	return { harApp: true, harAktivtForlob: false, aboSlutterAt: null, ...delvis };
}

describe('vurderSpaerring', () => {
	it('lukker ind naar abonnementet loeber', () => {
		const s = vurderSpaerring(g({ aboSlutterAt: NU + 30 * DAG }), NU);
		expect(s.spaerret).toBe(false);
		expect(s.iNaade).toBe(false);
	});

	// Punkt 1. Det vigtigste af dem alle: en kvinde midt i et forloeb maa
	// aldrig laases ude, heller ikke hvis abonnementet udloeber undervejs.
	it('spaerrer aldrig en kunde med et aktivt forloeb', () => {
		const s = vurderSpaerring(
			g({ harAktivtForlob: true, aboSlutterAt: NU - 400 * DAG, harApp: true }),
			NU
		);
		expect(s.spaerret).toBe(false);
	});

	it('spaerrer ikke selv om forloebskunden slet ikke har abo-felter', () => {
		const s = vurderSpaerring(g({ harAktivtForlob: true, harApp: true, aboSlutterAt: null }), NU);
		expect(s.spaerret).toBe(false);
	});

	// Punkt 2. Fri- og manuelle konti. 7 af 178 abonnenter 9. august 2026.
	it('lader adgangen loebe naar der ingen slutdato er', () => {
		const s = vurderSpaerring(g({ aboSlutterAt: null, harApp: true }), NU);
		expect(s.spaerret).toBe(false);
	});

	it('spaerrer den der hverken har abo eller forloeb', () => {
		const s = vurderSpaerring(g({ harApp: false, aboSlutterAt: null }), NU);
		expect(s.spaerret).toBe(true);
	});

	// Punkt 3, naadeperioden. Fornyelsen fra Simplero kan komme forsinket.
	it('lukker ind dagen efter udloeb, paa naade', () => {
		const s = vurderSpaerring(g({ aboSlutterAt: NU - 1 * DAG }), NU);
		expect(s.spaerret).toBe(false);
		expect(s.iNaade).toBe(true);
		expect(s.dageTilbageAfNaade).toBe(2);
	});

	it('lukker ind paa sidste naadedag', () => {
		const s = vurderSpaerring(g({ aboSlutterAt: NU - (NAADE_DAGE * DAG - 1000) }), NU);
		expect(s.spaerret).toBe(false);
		expect(s.iNaade).toBe(true);
		expect(s.dageTilbageAfNaade).toBe(1);
	});

	it('spaerrer naar naaden er brugt op', () => {
		const s = vurderSpaerring(g({ aboSlutterAt: NU - (NAADE_DAGE + 1) * DAG }), NU);
		expect(s.spaerret).toBe(true);
		expect(s.iNaade).toBe(false);
	});

	it('spaerrer en abonnent der er langt over tid', () => {
		const s = vurderSpaerring(g({ aboSlutterAt: NU - 200 * DAG }), NU);
		expect(s.spaerret).toBe(true);
	});

	// Praecis paa slutmillisekundet er hun udloebet, men i naade. Vi vil
	// hellere ramme forkert til kundens fordel end omvendt.
	it('er i naade praecis paa slutdatoen', () => {
		const s = vurderSpaerring(g({ aboSlutterAt: NU }), NU);
		expect(s.spaerret).toBe(false);
		expect(s.iNaade).toBe(true);
	});
});

describe('naadeTekst', () => {
	it('siger dagen ud naar der er én tilbage', () => {
		expect(naadeTekst(1)).toBe('Dit abonnement er udløbet. Du har adgang dagen ud.');
	});

	it('siger antal dage naar der er flere', () => {
		expect(naadeTekst(3)).toBe('Dit abonnement er udløbet. Du har adgang 3 dage endnu.');
	});
});
