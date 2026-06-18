import { describe, it, expect } from 'vitest';
import { normaliserSoeg, klientSoegeMatch } from './klientSoegning';

const hay = (f: string, e: string, m: string) => `${f} ${e} ${m}`;
const anna = hay('Anna', 'Jensen', 'anna.jensen@gmail.com');
const soren = hay('Søren', 'Østergård', 'soren.o@live.dk');

describe('normaliserSoeg', () => {
	it('folder danske bogstaver og accenter', () => {
		expect(normaliserSoeg('Søren Østergård')).toBe('soren ostergard');
		expect(normaliserSoeg('Ægir Café')).toBe('agir cafe');
	});
});

describe('klientSoegeMatch', () => {
	it('tom søgning matcher alt', () => {
		expect(klientSoegeMatch(anna, '')).toBe(true);
		expect(klientSoegeMatch(anna, '   ')).toBe(true);
	});

	it('delsøgning på navn', () => {
		expect(klientSoegeMatch(anna, 'jen')).toBe(true);
		expect(klientSoegeMatch(anna, 'ann')).toBe(true);
	});

	it('flere ord i vilkårlig rækkefølge', () => {
		expect(klientSoegeMatch(anna, 'jensen anna')).toBe(true);
		expect(klientSoegeMatch(anna, 'anna jensen')).toBe(true);
		expect(klientSoegeMatch(anna, 'an jen')).toBe(true);
	});

	it('matcher også på email', () => {
		expect(klientSoegeMatch(anna, 'gmail')).toBe(true);
		expect(klientSoegeMatch(anna, 'anna.jensen')).toBe(true);
	});

	it('ignorerer danske bogstaver/accenter', () => {
		expect(klientSoegeMatch(soren, 'soren')).toBe(true);
		expect(klientSoegeMatch(soren, 'ostergard')).toBe(true);
		expect(klientSoegeMatch(soren, 'søren østergård')).toBe(true);
	});

	it('tolererer små stavefejl', () => {
		expect(klientSoegeMatch(anna, 'jensn')).toBe(true); // manglende e
		expect(klientSoegeMatch(anna, 'jenssen')).toBe(true); // ekstra s
		expect(klientSoegeMatch(soren, 'sören')).toBe(true);
	});

	it('giver ikke falske træf på korte ord', () => {
		// 3-tegns ord kræver præcis delsøgning (ingen fuzzy)
		expect(klientSoegeMatch(anna, 'xyz')).toBe(false);
		expect(klientSoegeMatch(anna, 'bob')).toBe(false);
	});

	it('alle ord skal matche (AND)', () => {
		expect(klientSoegeMatch(anna, 'anna petersen')).toBe(false);
	});
});
