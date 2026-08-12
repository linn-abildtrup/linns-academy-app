import { describe, it, expect } from 'vitest';
import {
	START_KATEGORI,
	findesAllerede,
	fraUdkast,
	hvadMangler,
	kalorierNu,
	tilUdkast,
	tomtUdkast,
	udkastDuger,
	underTekst
} from './egneFodevarer3';
import { udregnetKcal } from './tal3';
import type { Fodevare } from './kost';

function fodevare(id: string, name: string, ekstra: Partial<Fodevare> = {}): Fodevare {
	return { id, name, cat: 'mejeri', p: 11, f: 0, ...ekstra };
}

describe('tomtUdkast', () => {
	// Linns beslutning 12. august: feltet skal vaere der, men forvalgt til
	// Andet saa hun kan springe det over.
	it('starter paa Andet', () => {
		expect(tomtUdkast().kategori).toBe('andet');
		expect(START_KATEGORI).toBe('andet');
	});

	// Soeger hun paa noget der ikke findes, foelger ordet med ind i
	// navnefeltet. Det er hele pointen med vejen ind fra soegningen.
	it('tager navnet med fra soegningen', () => {
		expect(tomtUdkast('  skyr protein plus ').navn).toBe('skyr protein plus');
	});

	it('starter med tomme tal og ikke nuller', () => {
		const u = tomtUdkast();
		expect(u.protein).toBe('');
		expect(u.kcal).toBe('');
	});
});

describe('fraUdkast', () => {
	it('laeser de fem tal', () => {
		const u = { ...tomtUdkast('Skyr'), protein: '11', fiber: '0', kh: '4', fedt: '0,2' };
		const f = fraUdkast(u);
		expect(f.p).toBe(11);
		expect(f.kh).toBe(4);
		expect(f.fedt).toBe(0.2);
	});

	it('markerer den som hendes egen', () => {
		expect(fraUdkast(tomtUdkast('Skyr')).kilde).toBe('custom');
	});

	it('trimmer navnet og klemmer mellemrum sammen', () => {
		expect(fraUdkast(tomtUdkast('  Skyr   vanilje ')).name).toBe('Skyr vanilje');
	});

	// Kalorierne regnes af makroerne naar hun ikke selv skriver dem.
	// Samme formel som den gamle app, saa de to aldrig kan give hver sit
	// tal for den samme vare.
	it('regner kalorierne ud naar feltet er tomt', () => {
		const u = { ...tomtUdkast('Skyr'), protein: '11', kh: '4', fedt: '0,2' };
		expect(fraUdkast(u).kcal).toBe(udregnetKcal(11, 4, 0.2));
		expect(fraUdkast(u).kcal).toBe(62);
	});

	it('lader hendes eget kalorietal vinde', () => {
		const u = { ...tomtUdkast('Skyr'), protein: '11', kh: '4', fedt: '0,2', kcal: '63' };
		expect(fraUdkast(u).kcal).toBe(63);
	});

	it('runder kalorier til et helt tal', () => {
		expect(fraUdkast({ ...tomtUdkast('X'), kcal: '62,6' }).kcal).toBe(63);
	});

	it('tager flydende med', () => {
		expect(fraUdkast({ ...tomtUdkast('Mælk'), flydende: true }).liquid).toBe(true);
	});

	it('kan gaa frem og tilbage uden at miste noget', () => {
		const f = fodevare('a', 'Skyr', { p: 11, f: 0, kh: 4, fedt: 0.2, kcal: 63, liquid: true });
		const tilbage = fraUdkast(tilUdkast(f));
		expect(tilbage.name).toBe('Skyr');
		expect(tilbage.p).toBe(11);
		expect(tilbage.kcal).toBe(63);
		expect(tilbage.liquid).toBe(true);
		expect(tilbage.cat).toBe('mejeri');
	});
});

describe('hvad der skal til', () => {
	it('kraever et navn', () => {
		expect(udkastDuger(tomtUdkast('   '))).toBe(false);
		expect(hvadMangler(tomtUdkast(''))).toContain('navn');
	});

	// Salt, kaffe og krydderier har ingen makro. At spaerre for dem ville
	// vaere at bestemme over hendes egen mad.
	it('tillader en vare helt uden naering', () => {
		expect(udkastDuger(tomtUdkast('Salt'))).toBe(true);
		expect(fraUdkast(tomtUdkast('Salt')).p).toBe(0);
	});
});

describe('kalorierNu', () => {
	it('viser det udregnede mens hun taster', () => {
		expect(kalorierNu({ ...tomtUdkast('X'), protein: '10', kh: '10', fedt: '10' })).toBe(170);
	});

	it('viser hendes eget tal naar hun har skrevet et', () => {
		expect(kalorierNu({ ...tomtUdkast('X'), protein: '10', kcal: '99' })).toBe(99);
	});

	it('giver nul naar der ikke er noget endnu', () => {
		expect(kalorierNu(tomtUdkast('X'))).toBe(0);
	});
});

describe('underTekst', () => {
	// Der SKAL staa pr 100 g. Uden det taster hun tallene for hele pakken.
	it('siger altid pr 100 g', () => {
		expect(underTekst(fodevare('a', 'Skyr'))).toBe('11 g protein pr 100 g');
	});

	it('taaler en vare uden protein', () => {
		expect(underTekst({ id: 'a', name: 'Salt', cat: 'andet', p: 0, f: 0 })).toContain('0 g protein');
	});
});

describe('findesAllerede', () => {
	const egne = [fodevare('a', 'Skyr vanilje'), fodevare('b', 'Rugbrød')];

	it('opdager det samme navn uanset store bogstaver', () => {
		expect(findesAllerede(egne, '  skyr VANILJE ')).toBe(true);
	});

	it('siger nej til et nyt navn', () => {
		expect(findesAllerede(egne, 'Havregryn')).toBe(false);
	});

	// Retter hun en vare og beholder navnet, er det ikke en dublet.
	it('regner ikke varen selv som en dublet', () => {
		expect(findesAllerede(egne, 'Skyr vanilje', 'a')).toBe(false);
	});

	it('siger nej til et tomt navn', () => {
		expect(findesAllerede(egne, '   ')).toBe(false);
	});
});
