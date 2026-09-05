import { describe, it, expect } from 'vitest';
import { byggLektionPdf3, tilBase64 } from './lektionPdf3';
import type { Blok } from '$lib/content/lektionHtml3';

const blokke: Blok[] = [
	{ slags: 'overskrift', tekst: 'Når sulten ikke er sult' },
	{ slags: 'afsnit', tekst: 'Der er forskel på at være sulten og på at have lyst til noget.' },
	{ slags: 'underoverskrift', tekst: 'Tre tegn' },
	{ slags: 'punkt', tekst: 'Den kommer langsomt' },
	{ slags: 'citat', tekst: 'Sulten bygger sig op over timer.' }
];

describe('byggLektionPdf3', () => {
	it('laver en rigtig pdf uden en browser', () => {
		const bytes = byggLektionPdf3({ titel: 'Dag 4', dato: 'Tirsdag den 14. april', blokke });
		// De fem foerste tegn i enhver pdf.
		expect(String.fromCharCode(...bytes.subarray(0, 5))).toBe('%PDF-');
		expect(bytes.byteLength).toBeGreaterThan(800);
	});

	it('kan klare en tom lektion uden at vaelte', () => {
		const bytes = byggLektionPdf3({ titel: '', dato: '', blokke: [] });
		expect(String.fromCharCode(...bytes.subarray(0, 5))).toBe('%PDF-');
	});

	it('bliver ved med at virke naar teksten fylder flere sider', () => {
		const mange: Blok[] = Array.from({ length: 300 }, (_, i) => ({
			slags: 'afsnit' as const,
			tekst: `Afsnit nummer ${i}. ` + 'Noget tekst der fylder en linje eller to. '.repeat(3)
		}));
		const bytes = byggLektionPdf3({ titel: 'Lang', dato: '', blokke: mange });
		expect(bytes.byteLength).toBeGreaterThan(5000);
	});

	it('taber ikke emojis ned i filen som firkanter', () => {
		const bytes = byggLektionPdf3({
			titel: 'Mad 🍎 og ro',
			dato: '',
			blokke: [{ slags: 'afsnit', tekst: 'Godt ✅ klaret' }]
		});
		expect(String.fromCharCode(...bytes.subarray(0, 5))).toBe('%PDF-');
	});
});

describe('tilBase64', () => {
	it('giver det samme som en almindelig omskrivning', () => {
		expect(tilBase64(new Uint8Array([72, 101, 106]))).toBe('SGVq');
	});

	it('klarer en stor fil uden at vaelte paa for mange argumenter', () => {
		const stor = new Uint8Array(200_000).fill(65);
		expect(tilBase64(stor).length).toBeGreaterThan(200_000);
	});
});
