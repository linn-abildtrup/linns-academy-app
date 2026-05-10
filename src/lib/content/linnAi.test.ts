import { describe, it, expect } from 'vitest';
import {
	chunkTekst,
	quotaNoegle,
	byggSystemPrompt,
	byggKontekst,
	type VidenbaseDokument
} from './linnAi';

describe('chunkTekst', () => {
	it('returnerer enkelt chunk hvis tekst er under maks', () => {
		expect(chunkTekst('kort tekst', 100)).toEqual(['kort tekst']);
	});

	it('splitter på paragraf-grænser', () => {
		const tekst = 'A'.repeat(60) + '\n\n' + 'B'.repeat(60);
		const r = chunkTekst(tekst, 80);
		expect(r.length).toBe(2);
	});

	it('split langt enkelt-paragraf med hård cut', () => {
		const tekst = 'A'.repeat(200);
		const r = chunkTekst(tekst, 80);
		expect(r.length).toBe(3);
		expect(r[0].length).toBe(80);
	});
});

describe('quotaNoegle', () => {
	it('formaterer dato som YYYY-MM-DD', () => {
		expect(quotaNoegle(new Date(2026, 4, 10))).toBe('2026-05-10');
	});

	it('giver to-cifret måned og dag', () => {
		expect(quotaNoegle(new Date(2026, 0, 5))).toBe('2026-01-05');
	});
});

describe('byggSystemPrompt', () => {
	it('inkluderer videnbase-kontekst', () => {
		const p = byggSystemPrompt('Linns notater her');
		expect(p).toContain('Linns notater her');
	});

	it('giver fallback når videnbase er tom', () => {
		const p = byggSystemPrompt('');
		expect(p).toContain('Videnbasen er endnu tom');
	});

	it('inkluderer scope og disclaimer', () => {
		const p = byggSystemPrompt('test');
		expect(p).toContain('overgangsalder');
		expect(p).toContain('læge');
	});
});

describe('byggKontekst', () => {
	const mkDoc = (id: string, navn: string, tekst: string): VidenbaseDokument => ({
		id,
		navn,
		kilde: 'pdf',
		tekst
	});

	it('returnerer tom string for tomme dokumenter', () => {
		expect(byggKontekst([], 'noget')).toBe('');
	});

	it('inkluderer dokument-tekst med kilde-label', () => {
		const docs = [mkDoc('1', 'Test', 'Indhold her')];
		const k = byggKontekst(docs, 'spørgsmål');
		expect(k).toContain('Test');
		expect(k).toContain('Indhold her');
		expect(k).toContain('PDF');
	});

	it('sorterer dokumenter med flere keyword-match først', () => {
		const docs = [
			mkDoc('1', 'A', 'random tekst'),
			mkDoc('2', 'B', 'protein protein protein')
		];
		const k = byggKontekst(docs, 'protein');
		expect(k.indexOf('protein protein protein')).toBeLessThan(k.indexOf('random tekst'));
	});

	it('respekterer max-tegn-grænsen', () => {
		const stor = 'A'.repeat(500);
		const docs = [mkDoc('1', 'X', stor), mkDoc('2', 'Y', stor)];
		const k = byggKontekst(docs, '', 600);
		// Kun ét dokument får plads (500 + format-overhead)
		expect(k.length).toBeLessThan(700);
	});
});
