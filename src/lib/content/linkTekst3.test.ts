import { describe, it, expect } from 'vitest';
import { delOpILinks, trimHale, tilAdresse, harLink } from './linkTekst3';

describe('tilAdresse', () => {
	it('godtager http og https', () => {
		expect(tilAdresse('https://zoom.us/j/123')).toBe('https://zoom.us/j/123');
		expect(tilAdresse('http://linnsacademy.dk')).toBe('http://linnsacademy.dk');
	});

	it('saetter https foran naar der kun staar www', () => {
		expect(tilAdresse('www.linnsacademy.dk')).toBe('https://www.linnsacademy.dk');
	});

	it('AFVISER javascript, for det er et angreb og ikke et link', () => {
		expect(tilAdresse('javascript:alert(1)')).toBeNull();
		expect(tilAdresse('JavaScript:alert(1)')).toBeNull();
	});

	it('afviser data og fil-adresser', () => {
		expect(tilAdresse('data:text/html,<script>')).toBeNull();
		expect(tilAdresse('file:///etc/passwd')).toBeNull();
	});
});

describe('trimHale', () => {
	it('tager punktummet af enden af en saetning', () => {
		expect(trimHale('https://zoom.us/j/123.')).toEqual({
			url: 'https://zoom.us/j/123',
			hale: '.'
		});
	});

	it('tager flere tegn af', () => {
		expect(trimHale('https://a.dk?').hale).toBe('?');
		expect(trimHale('https://a.dk!,').hale).toBe('!,');
	});

	it('tager en slutparentes af der ikke hoerer til adressen', () => {
		expect(trimHale('https://a.dk)').url).toBe('https://a.dk');
	});

	it('BEHOLDER en parentes der hoerer til adressen', () => {
		expect(trimHale('https://da.wikipedia.org/wiki/Test_(begreb)').url).toBe(
			'https://da.wikipedia.org/wiki/Test_(begreb)'
		);
	});

	it('roerer ikke en adresse uden hale', () => {
		expect(trimHale('https://a.dk/x')).toEqual({ url: 'https://a.dk/x', hale: '' });
	});
});

describe('delOpILinks', () => {
	it('finder linket midt i en saetning', () => {
		const ud = delOpILinks('Vi mødes på Zoom her: https://zoom.us/j/559 og glæder os.');
		const link = ud.find((d) => d.slags === 'link');
		expect(link?.url).toBe('https://zoom.us/j/559');
		expect(ud[0].tekst).toBe('Vi mødes på Zoom her: ');
	});

	it('klarer Linns rigtige Zoom-link med kodeord', () => {
		const raa =
			'Zoom-link: https://us06web.zoom.us/j/5593837229?pwd=bWJsaUBa5ZjbYm6lNTLDsFxhvGNvii.1';
		const link = delOpILinks(raa).find((d) => d.slags === 'link');
		expect(link?.url).toBe(
			'https://us06web.zoom.us/j/5593837229?pwd=bWJsaUBa5ZjbYm6lNTLDsFxhvGNvii.1'
		);
	});

	it('beholder punktummet som tekst efter linket', () => {
		const ud = delOpILinks('Se https://a.dk.');
		expect(ud.map((d) => d.tekst).join('')).toBe('Se https://a.dk.');
		expect(ud.find((d) => d.slags === 'link')?.url).toBe('https://a.dk');
	});

	it('finder flere links i samme tekst', () => {
		const ud = delOpILinks('En https://a.dk og to www.b.dk her');
		expect(ud.filter((d) => d.slags === 'link')).toHaveLength(2);
	});

	it('SAMLER TIL DEN OPRINDELIGE TEKST. Der maa aldrig forsvinde et ord', () => {
		const raa = 'Hej.\n\nSe https://a.dk/x?y=1 (vigtigt) og www.b.dk!\nVi ses.';
		expect(delOpILinks(raa).map((d) => d.tekst).join('')).toBe(raa);
	});

	it('bevarer linjeskift, for boblen viser dem', () => {
		const ud = delOpILinks('Linje 1\nLinje 2');
		expect(ud.map((d) => d.tekst).join('')).toContain('\n');
	});

	it('lader et javascript-forsoeg staa som ren TEKST og ikke som link', () => {
		const ud = delOpILinks('Tryk her: javascript:alert(1)');
		expect(ud.every((d) => d.slags === 'tekst')).toBe(true);
	});

	it('giver hele teksten tilbage naar der ikke er noget link', () => {
		expect(delOpILinks('Ingen links her')).toEqual([
			{ slags: 'tekst', tekst: 'Ingen links her' }
		]);
	});

	it('klarer en tom tekst', () => {
		expect(delOpILinks('')).toEqual([]);
	});
});

describe('harLink', () => {
	it('siger ja og nej', () => {
		expect(harLink('se https://a.dk')).toBe(true);
		expect(harLink('ingenting')).toBe(false);
	});

	it('giver det samme svar to gange i traek', () => {
		// Moensteret er globalt, og et globalt moenster husker hvor det kom
		// til sidst. Uden en nulstilling ville hvert andet kald sige falsk.
		expect(harLink('se https://a.dk')).toBe(true);
		expect(harLink('se https://a.dk')).toBe(true);
	});
});
