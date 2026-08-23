import { describe, expect, it } from 'vitest';
import { APP_URL3, emneFor3, mailFor3 } from './mail3';
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
