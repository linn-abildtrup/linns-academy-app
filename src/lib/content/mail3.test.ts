import { describe, expect, it } from 'vitest';
import { APP_URL3, emneFor3, generelMail3, mailFor3, svarMail3 } from './mail3';
import { dagNoti3, savnBesked3, svarNoti3, NOTI_STANDARD3 } from './notifikation3';

describe('emneFor3', () => {
	it('et svar siger hvad det er', () => {
		expect(emneFor3(svarNoti3('noget'))).toBe('Linn har svaret dig');
	});

	it('EMNET SIGER ALTID HVAD DET HANDLER OM', () => {
		// Hun skimmer en indbakke. En emnelinje uden indhold bliver ikke
		// aabnet.
		for (const n of [svarNoti3('x'), dagNoti3(4, 1, false), savnBesked3(true, NOTI_STANDARD3)]) {
			expect(emneFor3(n).length).toBeGreaterThan(8);
			expect(emneFor3(n).toLowerCase()).not.toContain('ny besked');
		}
	});
});

describe('mailFor3', () => {
	it('et svar har INGEN afmelde-linje', () => {
		// Det er noget hun har bedt om.
		const m = mailFor3(svarNoti3('Prøv at spise mere protein'));
		expect(m.medAfmeld).toBe(false);
		expect(m.tekst.toLowerCase()).not.toContain('slå dem fra');
		expect(m.html.toLowerCase()).not.toContain('slå dem fra');
	});

	it('ET SAVN HAR ALTID EN VEJ UD', () => {
		const m = mailFor3(savnBesked3(false, NOTI_STANDARD3));
		expect(m.medAfmeld).toBe(true);
		expect(m.tekst).toContain('slå dem fra');
		expect(m.html).toContain('slå dem fra');
	});

	it('linket peger ind i appen det rigtige sted', () => {
		const m = mailFor3(svarNoti3('noget'));
		expect(m.tekst).toContain(`${APP_URL3}/ny/beskeder?fane=linn`);
		expect(m.html).toContain(`${APP_URL3}/ny/beskeder?fane=linn`);
	});

	it('der er altid en ren tekst-udgave, ogsaa uden layout', () => {
		const m = mailFor3(dagNoti3(12, 2, true));
		expect(m.tekst).toContain('Dag 12 er klar');
		expect(m.tekst).toContain('2 lektioner og din træning venter');
		expect(m.tekst).not.toContain('<');
	});

	it('knappen hedder noget forskelligt alt efter hvad det er', () => {
		expect(mailFor3(svarNoti3('x')).html).toContain('Læs svaret');
		expect(mailFor3(dagNoti3(3, 1, false)).html).toContain('Åbn appen');
	});
});

describe('svarMail3', () => {
	const langt =
		'Det er helt normalt de første uger. Prøv at flytte lidt af dit protein til morgenmaden, så holder energien længere hen på eftermiddagen.';

	it('HENDES EGET SPOERGSMAAL STAAR MED, saa hun husker sammenhaengen', () => {
		const m = svarMail3({
			spoergsmaal: 'Jeg er så træt om eftermiddagen. Er det normalt?',
			svar: langt,
			sendtMs: new Date(2026, 7, 18).getTime()
		});
		expect(m.tekst).toContain('Jeg er så træt om eftermiddagen');
		expect(m.html).toContain('Jeg er så træt om eftermiddagen');
		expect(m.tekst).toContain('18. august');
	});

	it('ET KORT SVAR FAAR SAMME FORM. Linns fravalg 23. august', () => {
		// Der var foerst en kortere udgave uden ramme. Et svar paa to
		// linjer uden ramme laeser som om der ikke blev taget tid til
		// hende.
		const m = svarMail3({ spoergsmaal: 'Må jeg bytte kyllingen ud?', svar: 'Ja, det må du gerne.' });
		expect(m.html).toContain('Du skrev');
		expect(m.html).toContain('Skriv tilbage');
		expect(m.tekst).not.toContain('Sig endelig til');
	});

	it('lige meget hvor kort svaret er', () => {
		for (const svar of ['Ja.', 'x'.repeat(20), 'x'.repeat(500)]) {
			expect(svarMail3({ spoergsmaal: 'Et spørgsmål', svar }).html).toContain('Du skrev');
		}
	});

	it('skrev Linn foerst, falder den oeverste boble vaek, men resten staar', () => {
		const m = svarMail3({ svar: langt });
		expect(m.emne).toBe('Linn har skrevet til dig');
		expect(m.html).not.toContain('Du skrev');
		expect(m.html).toContain('Linn skrev til dig');
		expect(m.html).toContain('Skriv tilbage');
	});

	it('EMNET NAEVNER HENDES EGNE ORD og ikke bare at der er svaret', () => {
		const m = svarMail3({ spoergsmaal: 'Jeg er så træt om eftermiddagen', svar: langt });
		expect(m.emne).toContain('træt');
		expect(m.emne).not.toBe('Linn har svaret dig');
	});

	it('et langt spoergsmaal klippes i emnet', () => {
		const m = svarMail3({ spoergsmaal: 'x'.repeat(200), svar: langt });
		expect(m.emne.length).toBeLessThan(60);
		expect(m.emne.endsWith('…')).toBe(true);
	});

	it('et svar har aldrig en afmelding', () => {
		expect(svarMail3({ svar: langt, spoergsmaal: 'noget' }).medAfmeld).toBe(false);
	});
});

describe('generelMail3', () => {
	it('opslaget har maerket og en afmelding', () => {
		const m = generelMail3({ form: 'opslag', tekst: 'Vi ses i aften.', overskrift: 'Live Q&A' });
		expect(m.medAfmeld).toBe(true);
		expect(m.html).toContain('Academy');
		expect(m.tekst).toContain('færre mails');
	});

	it('INVITATIONEN SAETTER TIDSPUNKTET FOERST, ogsaa i emnet', () => {
		const m = generelMail3({
			form: 'invitation',
			tekst: 'En time hvor du kan spørge om alt.',
			overskrift: 'Søvn, og hvorfor den bliver dårligere',
			hvornaar: 'I aften kl. 19.00'
		});
		expect(m.emne.startsWith('I aften kl. 19.00')).toBe(true);
		expect(m.html).toContain('I aften kl. 19.00');
	});

	it('uden overskrift bliver emnet den foerste saetning', () => {
		const m = generelMail3({ form: 'opslag', tekst: 'Nye opskrifter er lagt op. Kig forbi.' });
		expect(m.emne).toBe('Nye opskrifter er lagt op');
	});

	it('begge former kan afmeldes', () => {
		for (const form of ['opslag', 'invitation'] as const) {
			expect(generelMail3({ form, tekst: 'noget' }).medAfmeld).toBe(true);
		}
	});
});
