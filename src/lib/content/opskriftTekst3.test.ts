import { describe, it, expect } from 'vitest';
import { fremgangsmaade, fremgangsmaadeTrin, tilberedningstid } from './opskriftTekst3';

// Formatet som det faktisk ser ud paa alle 130 opskrifter, maalt 12. august.
const ECHTE = `Rør æggene sammen med et nip salt.
Steg dem blødt på panden ved svag varme.
Server på rugbrød med laks og avocado.

Protein: 32 g | Fiber: 7 g  | Kulhydrater: 30 g | Fedt: 18 g | Kalorier: 420 kcal | Tid: 10 minutter`;

describe('fremgangsmaade', () => {
	it('klipper makro-linjen af', () => {
		const ud = fremgangsmaade(ECHTE);
		expect(ud).not.toContain('Protein:');
		expect(ud).not.toContain('Kalorier:');
		expect(ud).not.toContain('Tid:');
	});

	it('beholder alle madlavnings-trinnene', () => {
		const ud = fremgangsmaade(ECHTE);
		expect(ud).toContain('Rør æggene sammen');
		expect(ud).toContain('Steg dem blødt');
		expect(ud).toContain('Server på rugbrød');
	});

	it('efterlader ikke tomme linjer i bunden', () => {
		expect(fremgangsmaade(ECHTE).endsWith('avocado.')).toBe(true);
	});

	// Den vigtigste. Stod tallene midt i en linje med rigtige instruktioner,
	// ville en for grov regel slette et helt trin. Reglen fejler paa den sikre
	// side: saa bliver linjen staaende, praecis som den goer i dag.
	it('sletter ALDRIG en linje hvor Protein staar midt i en instruktion', () => {
		const t = 'Kog pastaen. Protein: 20 g er nok til én portion.';
		expect(fremgangsmaade(t)).toBe(t);
	});

	it('taaler en tekst helt uden makro-linje', () => {
		expect(fremgangsmaade('Bland det hele.')).toBe('Bland det hele.');
	});

	it('taaler tom og manglende tekst', () => {
		expect(fremgangsmaade('')).toBe('');
		expect(fremgangsmaade(undefined)).toBe('');
	});

	it('klarer flere makro-linjer hvis nogen skulle have tastet to', () => {
		const t = 'Trin et.\nProtein: 10 g | Tid: 5 minutter\nProtein: 20 g | Tid: 9 minutter';
		expect(fremgangsmaade(t)).toBe('Trin et.');
	});
});

// De to opskrifter Linn sendte skaermbilleder af 12. august. De er skrevet
// PAA HVER SIN MAADE, og det er hele grunden til at det her er mere end et
// linjeskift.
describe('fremgangsmaadeTrin', () => {
	// Chiapudding: hvert trin paa sin egen linje, plus en note til sidst.
	const PAA_HVER_SIN_LINJE = `1. Rør chiafrø, hørfrø, mælk og proteinpulver sammen i et glas. Lad det hvile i 5 minutter og rør igen så frøene ikke klumper.
2. Stil i køleskabet i mindst 3 timer eller natten over til puddingen er tyk.
3. Fold skyr ind på toppen og top med hindbær og hakkede mandler.

Kan laves til 2 til 3 dage ad gangen. Vent med at tilføje bær og mandler til lige før du skal spise.

Protein: 30 g | Fiber: 12 g | Kalorier: 400 kcal | Tid: 10 minutter`;

	// Roeraeg: ALLE fire trin i én lang linje.
	const ALT_I_EN_LINJE = `1. Pisk 3 æg let sammen med en smule salt og peber. 2. Smelt en klat smør i en pande ved svag varme. Hæld æggene i og rør langsomt med en spatel, til de er cremede og stadig lidt bløde. 3. Rist en skive rugbrød. 4. Skær avocadoen i skiver. Læg røræggene på rugbrødet, top med røget laks, avocadoskiver, frisk dild og lidt citronzest.

Tip: Hemmeligheden ved cremede røræg er lav varme og tålmodighed. Tilsæt aldrig mælk i æggene.

Protein: 32 g | Fiber: 7 g | Kalorier: 420 kcal | Tid: 15 minutter`;

	it('deler den der staar paa hver sin linje i tre trin plus en note', () => {
		const t = fremgangsmaadeTrin(PAA_HVER_SIN_LINJE);
		expect(t.filter((x) => x.nummereret).length).toBe(3);
		expect(t[0].tekst.startsWith('1. Rør chiafrø')).toBe(true);
		expect(t[1].tekst.startsWith('2. Stil i køleskabet')).toBe(true);
		expect(t[2].tekst.startsWith('3. Fold skyr')).toBe(true);
		expect(t[3].nummereret).toBe(false);
		expect(t[3].tekst.startsWith('Kan laves til')).toBe(true);
	});

	// Den vigtigste. Her hjalp et linjeskift ikke, for der ER ingen.
	it('deler den der staar i én lang linje i fire trin plus en note', () => {
		const t = fremgangsmaadeTrin(ALT_I_EN_LINJE);
		expect(t.filter((x) => x.nummereret).length).toBe(4);
		expect(t[0].tekst.startsWith('1. Pisk 3 æg')).toBe(true);
		expect(t[1].tekst.startsWith('2. Smelt en klat smør')).toBe(true);
		expect(t[2].tekst).toBe('3. Rist en skive rugbrød.');
		expect(t[3].tekst.startsWith('4. Skær avocadoen')).toBe(true);
		expect(t[4].tekst.startsWith('Tip:')).toBe(true);
	});

	it('tager aldrig makro-linjen med som et trin', () => {
		for (const kilde of [PAA_HVER_SIN_LINJE, ALT_I_EN_LINJE]) {
			for (const t of fremgangsmaadeTrin(kilde)) {
				expect(t.tekst).not.toContain('Protein:');
				expect(t.tekst).not.toContain('Tid:');
			}
		}
	});

	// Tal inde i teksten maa ALDRIG aabne et nyt trin. "5 minutter" og
	// "3 timer" staar midt i trin 1 og 2 ovenfor og skal blive der.
	it('deler ikke ved tal der staar midt i en saetning', () => {
		const t = fremgangsmaadeTrin(PAA_HVER_SIN_LINJE);
		expect(t[0].tekst).toContain('5 minutter');
		expect(t[1].tekst).toContain('3 timer');
	});

	// Raekken skal begynde paa 1 og taelle ét op. Ellers er tallet en maengde.
	it('deler ikke naar tallene ikke danner en raekke', () => {
		const t = fremgangsmaadeTrin('Skær kålen i 4. Steg den ved 200 grader.');
		expect(t.length).toBe(1);
		expect(t[0].nummereret).toBe(false);
	});

	it('deler ikke ved ét enkelt tal', () => {
		const t = fremgangsmaadeTrin('1. Bland det hele og server.');
		expect(t.length).toBe(1);
		expect(t[0].nummereret).toBe(false);
	});

	it('klarer en opskrift helt uden numre', () => {
		const t = fremgangsmaadeTrin('Bland det hele.\nServer straks.');
		expect(t.map((x) => x.tekst)).toEqual(['Bland det hele.', 'Server straks.']);
	});

	it('taaler tom og manglende tekst', () => {
		expect(fremgangsmaadeTrin('')).toEqual([]);
		expect(fremgangsmaadeTrin(undefined)).toEqual([]);
	});

	// Sikkerhedsnet: intet maa gaa tabt undervejs. Al tekst fra
	// fremgangsmaade skal kunne findes igen i trinnene.
	it('taber ikke tekst', () => {
		for (const kilde of [PAA_HVER_SIN_LINJE, ALT_I_EN_LINJE]) {
			const samlet = fremgangsmaadeTrin(kilde)
				.map((t) => t.tekst)
				.join(' ')
				.replace(/\s+/g, ' ');
			const original = fremgangsmaade(kilde).replace(/\s+/g, ' ');
			for (const ord of original.split(' ')) {
				if (ord.length > 3) expect(samlet).toContain(ord);
			}
		}
	});
});

describe('tilberedningstid', () => {
	it('finder tiden i makro-linjen', () => {
		expect(tilberedningstid(ECHTE)).toBe('10 minutter');
	});

	it('stopper ved den lodrette streg og tager ikke resten med', () => {
		expect(tilberedningstid('Protein: 5 g | Tid: 35 minutter | noget andet')).toBe('35 minutter');
	});

	// 1 af 130 mangler feltet. Den skal bare ikke vise noget.
	it('giver null naar der ingen tid er', () => {
		expect(tilberedningstid('Protein: 5 g | Fiber: 2 g')).toBeNull();
		expect(tilberedningstid('')).toBeNull();
		expect(tilberedningstid(undefined)).toBeNull();
	});

	it('giver null naar feltet staar tomt', () => {
		expect(tilberedningstid('Protein: 5 g | Tid:   ')).toBeNull();
	});
});
