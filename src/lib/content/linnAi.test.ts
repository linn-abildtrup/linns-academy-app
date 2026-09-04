import { describe, it, expect } from 'vitest';
import {
	chunkTekst,
	quotaNoegle,
	byggSystemPrompt,
	byggKontekst,
	parseSikkerhed,
	udenFormateringstegn,
	afrundKlippetSvar,
	boerMindesOmDestillering,
	dageSidenDestillering,
	destilleringAlderTekst,
	type VidenbaseDokument
} from './linnAi';

describe('parseSikkerhed', () => {
	it('udtrækker sikkerhed og fjerner markøren fra svaret', () => {
		const r = parseSikkerhed('Her er mit svar.\n[[SIKKERHED:85]]');
		expect(r.sikkerhed).toBe(85);
		expect(r.svar).toBe('Her er mit svar.');
	});

	it('returnerer null sikkerhed når markøren mangler', () => {
		const r = parseSikkerhed('Bare et svar uden markør.');
		expect(r.sikkerhed).toBeNull();
		expect(r.svar).toBe('Bare et svar uden markør.');
	});

	it('klamper værdier til 0-100', () => {
		expect(parseSikkerhed('x [[SIKKERHED:150]]').sikkerhed).toBe(100);
	});
});

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

describe('de fire faste regler', () => {
	// De skal staa der ogsaa naar Linn har skrevet sin egen persona, for
	// ellers forsvinder de den dag hun retter teksten inde i appen.
	it('staar der baade med og uden egen persona', () => {
		for (const p of [
			byggSystemPrompt('noget viden'),
			byggSystemPrompt('noget viden', 'Du er en bot.')
		]) {
			expect(p).toContain('KUN HENDES EGET FORLØB');
			expect(p).toContain('INGEN PLANER');
			expect(p).toContain('INGEN PREMIUM');
			expect(p).toContain('INGEN NY APP');
		}
	});

	it('holder doeren aaben for Q&A-tidspunkter og for at spoerge Linn', () => {
		const p = byggSystemPrompt('');
		expect(p).toContain('Q&A');
		expect(p).toContain('spørge Linn om');
	});

	it('staar foer sikkerheds-markoeren, saa den stadig er det sidste', () => {
		const p = byggSystemPrompt('');
		expect(p.indexOf('INGEN NY APP')).toBeLessThan(p.indexOf('[[SIKKERHED:N]]'));
	});
});

describe('byggSystemPrompt', () => {
	it('inkluderer videnbase-kontekst', () => {
		const p = byggSystemPrompt('Linns notater her');
		expect(p).toContain('Linns notater her');
	});

	it('giver fallback når der intet videns-grundlag er', () => {
		const p = byggSystemPrompt('');
		expect(p).toContain('Intet videns-grundlag endnu');
	});

	it('inkluderer Linns tidligere svar når de gives', () => {
		const svarTekst = '--- Eksempel 1 ---\nKlient spurgte: Hvordan?\nLinn svarede: Sådan her.';
		const p = byggSystemPrompt('', undefined, svarTekst);
		expect(p).toContain('LINNS TIDLIGERE SVAR');
		expect(p).toContain('Sådan her');
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
		const docs = [mkDoc('1', 'A', 'random tekst'), mkDoc('2', 'B', 'protein protein protein')];
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

describe('dageSidenDestillering', () => {
	const NU = new Date('2026-08-30T12:00:00Z').getTime();
	const dageSiden = (n: number) => new Date(NU - n * 24 * 60 * 60 * 1000).toISOString();

	it('regner dage ud fra det nyeste destillerede dokument', () => {
		const docs = [
			{ id: 'destil_1_0', opdateretAt: dageSiden(30) },
			{ id: 'destil_1_1', opdateretAt: dageSiden(3) }
		] as unknown as VidenbaseDokument[];
		expect(dageSidenDestillering(docs, NU)).toBe(3);
	});

	it('tæller ikke manuelt uploadede dokumenter med', () => {
		const docs = [
			{ id: 'destil_1_0', opdateretAt: dageSiden(20) },
			{ id: 'min-pdf', opdateretAt: dageSiden(1) }
		] as unknown as VidenbaseDokument[];
		expect(dageSidenDestillering(docs, NU)).toBe(20);
	});

	it('læser både Firestore-tidsstempler og datotekst', () => {
		const docs = [
			{ id: 'destil_1_0', opdateretAt: { toMillis: () => NU - 5 * 24 * 60 * 60 * 1000 } }
		] as unknown as VidenbaseDokument[];
		expect(dageSidenDestillering(docs, NU)).toBe(5);
	});

	it('giver null når destilleringen aldrig har kørt', () => {
		expect(dageSidenDestillering([], NU)).toBeNull();
		expect(
			dageSidenDestillering(
				[{ id: 'min-pdf', opdateretAt: dageSiden(1) }] as unknown as VidenbaseDokument[],
				NU
			)
		).toBeNull();
	});
});

describe('boerMindesOmDestillering', () => {
	it('minder om det efter en uge, og når den aldrig har kørt', () => {
		expect(boerMindesOmDestillering(null)).toBe(true);
		expect(boerMindesOmDestillering(7)).toBe(true);
		expect(boerMindesOmDestillering(40)).toBe(true);
	});

	it('tier stille når den er frisk', () => {
		expect(boerMindesOmDestillering(0)).toBe(false);
		expect(boerMindesOmDestillering(6)).toBe(false);
	});
});

describe('destilleringAlderTekst', () => {
	it('skriver alderen på almindeligt dansk', () => {
		expect(destilleringAlderTekst(null)).toBe('Den har aldrig kørt');
		expect(destilleringAlderTekst(0)).toBe('Sidst opdateret i dag');
		expect(destilleringAlderTekst(1)).toBe('Sidst opdateret i går');
		expect(destilleringAlderTekst(9)).toBe('Sidst opdateret for 9 dage siden');
	});
});

describe('udenFormateringstegn', () => {
	it('fjerner fed, kursiv og tre-stjerner', () => {
		expect(udenFormateringstegn('Det ideelle er at **kombinere** det')).toBe(
			'Det ideelle er at kombinere det'
		);
		expect(udenFormateringstegn('Hundeturen er ***ikke*** styrketræning')).toBe(
			'Hundeturen er ikke styrketræning'
		);
		expect(udenFormateringstegn('Det er *vigtigt* for dig.')).toBe('Det er vigtigt for dig.');
		expect(udenFormateringstegn('Det er _vigtigt_ for dig.')).toBe('Det er vigtigt for dig.');
	});

	it('fjerner overskrifter og gør stjerne-punkter til streger', () => {
		expect(udenFormateringstegn('## Sådan gør du\n* Drik vand\n* Sov')).toBe(
			'Sådan gør du\n- Drik vand\n- Sov'
		);
	});

	it('rører ikke gangetegn eller almindelige bindestreger', () => {
		expect(udenFormateringstegn('3 sæt af 2*3 gentagelser')).toBe('3 sæt af 2*3 gentagelser');
		expect(udenFormateringstegn('- Drik vand')).toBe('- Drik vand');
	});
});

describe('afrundKlippetSvar', () => {
	it('klipper tilbage til sidste hele sætning og siger det', () => {
		const ud = afrundKlippetSvar('Spis mere protein. Prøv fx skyr til morgen. Du kan også ta');
		expect(ud).toContain('Prøv fx skyr til morgen.');
		expect(ud).not.toContain('Du kan også ta');
		expect(ud).toContain('afbrudt');
	});

	it('giver kun beskeden når der ikke er en hel sætning', () => {
		expect(afrundKlippetSvar('Det kommer helt an på hvor meget du')).toBe(
			'Jeg blev afbrudt her — spørg endelig videre, så tager jeg den derfra 🌸'
		);
	});
});
