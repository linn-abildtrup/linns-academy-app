import { describe, it, expect } from 'vitest';
import {
	tilladteMaaltiderForDag,
	validerPeriode,
	validerPerioder,
	type MaaltidsFokusPeriode
} from './maaltidsFokus';

describe('tilladteMaaltiderForDag', () => {
	const perioder: MaaltidsFokusPeriode[] = [
		{ fraDag: 0, tilDag: 6, maaltider: ['morgenmad'] },
		{ fraDag: 7, tilDag: 13, maaltider: ['morgenmad', 'frokost'] }
	];

	it('returnerer null uden perioder (ingen begrænsning)', () => {
		expect(tilladteMaaltiderForDag(undefined, 3)).toBeNull();
		expect(tilladteMaaltiderForDag([], 3)).toBeNull();
	});

	it('begrænser til periodens måltider inden for intervallet (inkl. begge ender)', () => {
		expect(tilladteMaaltiderForDag(perioder, 0)).toEqual(['morgenmad']);
		expect(tilladteMaaltiderForDag(perioder, 6)).toEqual(['morgenmad']);
		expect(tilladteMaaltiderForDag(perioder, 7)).toEqual(['morgenmad', 'frokost']);
		expect(tilladteMaaltiderForDag(perioder, 13)).toEqual(['morgenmad', 'frokost']);
	});

	it('returnerer null for dage uden for enhver periode', () => {
		expect(tilladteMaaltiderForDag(perioder, 14)).toBeNull();
		expect(tilladteMaaltiderForDag(perioder, 99)).toBeNull();
	});
});

describe('validerPeriode', () => {
	it('godkender en gyldig periode', () => {
		expect(validerPeriode({ fraDag: 0, tilDag: 6, maaltider: ['morgenmad'] })).toBeNull();
	});
	it('afviser negativ fra-dag', () => {
		expect(validerPeriode({ fraDag: -1, tilDag: 6, maaltider: ['morgenmad'] })).toBeTruthy();
	});
	it('afviser til-dag før fra-dag', () => {
		expect(validerPeriode({ fraDag: 7, tilDag: 3, maaltider: ['morgenmad'] })).toBeTruthy();
	});
	it('afviser tom måltids-liste', () => {
		expect(validerPeriode({ fraDag: 0, tilDag: 6, maaltider: [] })).toBeTruthy();
	});
});

describe('validerPerioder', () => {
	it('godkender ikke-overlappende perioder', () => {
		expect(
			validerPerioder([
				{ fraDag: 0, tilDag: 6, maaltider: ['morgenmad'] },
				{ fraDag: 7, tilDag: 13, maaltider: ['morgenmad', 'frokost'] }
			])
		).toBeNull();
	});
	it('afviser overlappende perioder', () => {
		expect(
			validerPerioder([
				{ fraDag: 0, tilDag: 7, maaltider: ['morgenmad'] },
				{ fraDag: 7, tilDag: 13, maaltider: ['frokost'] }
			])
		).toBeTruthy();
	});
});
