import { describe, it, expect } from 'vitest';
import { kategoriListeTekst3 } from './traeningKategori3';

describe('kategoriListeTekst3', () => {
	it('skriver ét navn som det er, med lille', () => {
		expect(kategoriListeTekst3(['Kettlebells'])).toBe('kettlebells');
	});

	it('binder to sammen med eller', () => {
		expect(kategoriListeTekst3(['Kettlebells', 'Elastikker'])).toBe('kettlebells eller elastikker');
	});

	it('bruger komma og eller ved tre', () => {
		expect(kategoriListeTekst3(['Kettlebells', 'Elastikker', 'Bolde'])).toBe(
			'kettlebells, elastikker eller bolde'
		);
	});

	it('giver tom tekst naar der ingen er', () => {
		expect(kategoriListeTekst3([])).toBe('');
	});

	it('springer tomme navne over', () => {
		expect(kategoriListeTekst3(['Kettlebells', '', '   '])).toBe('kettlebells');
	});
});
