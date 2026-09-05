import { describe, it, expect } from 'vitest';
import {
	afkodTegn,
	blokkeFraHtml,
	harNokIndhold,
	titelFraHtml,
	udenDobbeltTitel,
	MINDST_TEGN
} from './lektionHtml3';

describe('afkodTegn', () => {
	it('skriver de danske tegn tilbage', () => {
		expect(afkodTegn('m&aring;ltid, &oslash;l og &aelig;bler')).toBe('måltid, øl og æbler');
	});

	it('tager baade tal og hex', () => {
		expect(afkodTegn('&#229;bn &#xE5;bn')).toBe('åbn åbn');
	});

	it('lader et ukendt navn staa i stedet for at slette det', () => {
		expect(afkodTegn('&sputnik; her')).toBe('&sputnik; her');
	});
});

describe('blokkeFraHtml', () => {
	const side = `<!doctype html><html><head><title>Sидe</title>
		<style>p { color: red }</style></head><body>
		<nav><a href="/">Forside</a></nav>
		<h1>N&aring;r sulten ikke er sult</h1>
		<p>Der er forskel p&aring; at v&aelig;re sulten og p&aring; at have lyst.</p>
		<h2>Tre tegn</h2>
		<ul><li>Den kommer langsomt</li><li>Den peger ikke p&aring; noget bestemt</li></ul>
		<blockquote>Sulten bygger sig op over timer.</blockquote>
		<script>alert('nej')</script>
		<footer>Copyright</footer></body></html>`;

	it('finder overskrifter, afsnit, punkter og citat i raekkefoelge', () => {
		const b = blokkeFraHtml(side);
		expect(b.map((x) => x.slags)).toEqual([
			'overskrift',
			'afsnit',
			'underoverskrift',
			'punkt',
			'punkt',
			'citat'
		]);
		expect(b[0].tekst).toBe('Når sulten ikke er sult');
	});

	it('tager ikke typografi, kode, menu eller sidefod med', () => {
		const samlet = blokkeFraHtml(side)
			.map((b) => b.tekst)
			.join(' ');
		expect(samlet).not.toContain('color');
		expect(samlet).not.toContain('alert');
		expect(samlet).not.toContain('Forside');
		expect(samlet).not.toContain('Copyright');
	});

	it('klistrer ikke to ord sammen ved et linjeskift', () => {
		expect(blokkeFraHtml('<p>et<br>to</p>')[0].tekst).toBe('et to');
	});

	it('springer tomme og alt for korte blokke over', () => {
		expect(blokkeFraHtml('<p></p><p> </p><p>x</p>')).toEqual([]);
	});

	it('skriver ikke den samme tekst to gange', () => {
		const b = blokkeFraHtml('<blockquote><p>Det samme</p></blockquote>');
		expect(b).toHaveLength(1);
	});

	it('giver en tom liste for tom indtastning', () => {
		expect(blokkeFraHtml('')).toEqual([]);
	});
});

describe('titelFraHtml', () => {
	it('tager titlen fra hovedet', () => {
		expect(titelFraHtml('<html><head><title>Dag 4</title></head></html>')).toBe('Dag 4');
	});

	it('giver tom streng naar der ingen er', () => {
		expect(titelFraHtml('<p>ingen titel</p>')).toBe('');
	});
});

describe('harNokIndhold', () => {
	it('siger nej til en side der kun er en overskrift', () => {
		expect(harNokIndhold([{ slags: 'overskrift', tekst: 'Dag 4' }])).toBe(false);
	});

	it('siger ja naar der er tekst nok til en pdf', () => {
		expect(harNokIndhold([{ slags: 'afsnit', tekst: 'a'.repeat(MINDST_TEGN) }])).toBe(true);
	});
});

describe('udenDobbeltTitel', () => {
	const titel = 'Når sulten ikke er sult';

	it('fjerner sidens egen overskrift naar den gentager titlen', () => {
		const b = udenDobbeltTitel(
			[
				{ slags: 'overskrift', tekst: 'Når sulten ikke er sult' },
				{ slags: 'afsnit', tekst: 'Der er forskel.' }
			],
			titel
		);
		expect(b).toHaveLength(1);
		expect(b[0].slags).toBe('afsnit');
	});

	it('gaar ikke op i tegn og store bogstaver', () => {
		expect(
			udenDobbeltTitel([{ slags: 'overskrift', tekst: 'NÅR SULTEN, IKKE ER SULT!' }], titel)
		).toHaveLength(0);
	});

	it('lader en anden overskrift staa', () => {
		expect(udenDobbeltTitel([{ slags: 'overskrift', tekst: 'Tre tegn' }], titel)).toHaveLength(1);
	});

	it('roerer ikke en overskrift laengere nede i teksten', () => {
		const b = udenDobbeltTitel(
			[
				{ slags: 'afsnit', tekst: 'Indledning' },
				{ slags: 'overskrift', tekst: titel }
			],
			titel
		);
		expect(b).toHaveLength(2);
	});

	it('klarer en tom liste og en tom titel', () => {
		expect(udenDobbeltTitel([], titel)).toEqual([]);
		expect(udenDobbeltTitel([{ slags: 'overskrift', tekst: 'Noget' }], '')).toHaveLength(1);
	});
});
