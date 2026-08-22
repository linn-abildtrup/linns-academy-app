import { describe, expect, it } from 'vitest';
import {
	harRegel3,
	kildeTekst3,
	naeringAdgangFor3,
	type NaeringRegler3
} from './naeringAdgang3';

const TOMT: NaeringRegler3 = {};

describe('naeringAdgangFor3', () => {
	it('alt er aabent naar intet er sat', () => {
		const a = naeringAdgangFor3(null, null, null);
		expect(a).toEqual({ udvidet: true, maaRette: true, kilde: 'standard' });
	});

	it('medlems-linjen gaelder for en uden forloeb', () => {
		const r: NaeringRegler3 = { medlemmer: { udvidet: false, maaRette: true } };
		const a = naeringAdgangFor3(r, null, null);
		expect(a.udvidet).toBe(false);
		expect(a.maaRette).toBe(true);
		expect(a.kilde).toBe('medlemmer');
	});

	it('forloebet vinder over medlems-linjen', () => {
		const r: NaeringRegler3 = {
			medlemmer: { udvidet: true },
			forlob: { kickstart_juni: { udvidet: false } }
		};
		expect(naeringAdgangFor3(r, null, 'kickstart_juni').udvidet).toBe(false);
		expect(naeringAdgangFor3(r, null, 'et_andet_hold').udvidet).toBe(true);
	});

	it('et forloeb der ikke er sat arver medlems-linjen', () => {
		const r: NaeringRegler3 = { medlemmer: { udvidet: false }, forlob: {} };
		expect(naeringAdgangFor3(r, null, 'kickstart_juni').udvidet).toBe(false);
	});

	it('UNDTAGELSEN VINDER OVER FORLOEBET', () => {
		const r: NaeringRegler3 = { forlob: { kickstart_juni: { udvidet: false } } };
		const a = naeringAdgangFor3(r, { udvidet: true }, 'kickstart_juni');
		expect(a.udvidet).toBe(true);
		expect(a.kilde).toBe('undtagelse');
	});

	it('undtagelsen kan ogsaa lukke for en kunde paa et aabent hold', () => {
		const r: NaeringRegler3 = { forlob: { kropsro: { udvidet: true } } };
		expect(naeringAdgangFor3(r, { udvidet: false }, 'kropsro').udvidet).toBe(false);
	});

	it('de to kontakter afgoeres hver for sig', () => {
		const r: NaeringRegler3 = { forlob: { hold: { udvidet: false, maaRette: false } } };
		// Undtagelsen siger kun noget om den ene. Den anden arver videre.
		const a = naeringAdgangFor3(r, { udvidet: true }, 'hold');
		expect(a.udvidet).toBe(true);
		expect(a.maaRette).toBe(false);
	});

	it('en tom undtagelse aendrer ingenting', () => {
		const r: NaeringRegler3 = { forlob: { hold: { udvidet: false } } };
		expect(naeringAdgangFor3(r, {}, 'hold').udvidet).toBe(false);
	});

	it('et tomt skema er det samme som ingen skema', () => {
		expect(naeringAdgangFor3(TOMT, null, 'hold')).toEqual({
			udvidet: true,
			maaRette: true,
			kilde: 'standard'
		});
	});

	it('kilden er den mest specifikke af de to', () => {
		const r: NaeringRegler3 = { medlemmer: { maaRette: false } };
		expect(naeringAdgangFor3(r, { udvidet: false }, null).kilde).toBe('undtagelse');
	});
});

describe('kildeTekst3', () => {
	it('siger hvor svaret kom fra', () => {
		expect(kildeTekst3('undtagelse')).toBe('Sat på kunden');
		expect(kildeTekst3('forlob')).toBe('Fra forløbet');
		expect(kildeTekst3('medlemmer')).toBe('Fra medlemmer');
		expect(kildeTekst3('standard')).toBe('Standard');
	});
});

describe('harRegel3', () => {
	it('kender en tom regel fra en sat', () => {
		expect(harRegel3(null)).toBe(false);
		expect(harRegel3({})).toBe(false);
		expect(harRegel3({ udvidet: false })).toBe(true);
		expect(harRegel3({ maaRette: true })).toBe(true);
	});
});
