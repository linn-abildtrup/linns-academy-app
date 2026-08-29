import { describe, it, expect } from 'vitest';
import {
	erApplePhone,
	erSafariPaaIphone,
	hjemmeskaermVejledning,
	HJEMMESKAERM_FRA_MS,
	skalViseHjemmeskaerm,
	type HjemmeskaermVilkaar
} from './hjemmeskaerm';

const NY_KUNDE: HjemmeskaermVilkaar = {
	oprettetAt: HJEMMESKAERM_FRA_MS + 86400000,
	vistAt: undefined,
	erAdmin: false,
	paaHjemmeskaerm: false,
	erMobil: true
};

describe('skalViseHjemmeskaerm', () => {
	it('vises for en ny kunde paa en telefon', () => {
		expect(skalViseHjemmeskaerm(NY_KUNDE)).toBe(true);
	});

	it('vises ALDRIG for en kunde oprettet foer skaermen fandtes', () => {
		// De knap 760 i drift. En ekstra skaerm ved naeste aabning ville
		// ligne at noget var gaaet i stykker.
		const gammel = { ...NY_KUNDE, oprettetAt: HJEMMESKAERM_FRA_MS - 1 };
		expect(skalViseHjemmeskaerm(gammel)).toBe(false);
	});

	it('vises ikke naar createdAt mangler helt', () => {
		// Konti fra foer feltet fandtes er per definition gamle.
		expect(skalViseHjemmeskaerm({ ...NY_KUNDE, oprettetAt: undefined })).toBe(false);
	});

	it('vises kun én gang', () => {
		const svaret = { ...NY_KUNDE, vistAt: Date.now() };
		expect(skalViseHjemmeskaerm(svaret)).toBe(false);
	});

	it('springes over naar appen allerede ligger paa hjemmeskaermen', () => {
		expect(skalViseHjemmeskaerm({ ...NY_KUNDE, paaHjemmeskaerm: true })).toBe(false);
	});

	it('springes over paa computer', () => {
		expect(skalViseHjemmeskaerm({ ...NY_KUNDE, erMobil: false })).toBe(false);
	});

	it('admin gaar udenom', () => {
		// Linn aabner appen oftest af alle og skal ikke standses hver gang.
		expect(skalViseHjemmeskaerm({ ...NY_KUNDE, erAdmin: true })).toBe(false);
	});
});

describe('hjemmeskaermVejledning', () => {
	it('iPhone bliver bedt om at bruge Safari, og faar fire trin', () => {
		const v = hjemmeskaermVejledning(true);
		expect(v.trin).toHaveLength(4);
		expect(v.trin[0]).toContain('Safari');
		expect(v.kraeverSafari).toContain('Safari');
	});

	it('iPhone i en anden browser faar en skarpere besked', () => {
		const iSafari = hjemmeskaermVejledning(true, true).kraeverSafari ?? '';
		const udenfor = hjemmeskaermVejledning(true, false).kraeverSafari ?? '';
		expect(udenfor).not.toBe(iSafari);
		expect(udenfor).toContain('ikke i Safari');
	});

	it('Android faar ingen Safari-linje', () => {
		expect(hjemmeskaermVejledning(false).kraeverSafari).toBeUndefined();
	});

	it('andre telefoner faar de tre prikker', () => {
		const v = hjemmeskaermVejledning(false);
		expect(v.trin[0]).toContain('tre prikker');
	});

	it('begge slutter med den samme note', () => {
		expect(hjemmeskaermVejledning(true).note).toBe(hjemmeskaermVejledning(false).note);
	});
});

describe('erApplePhone', () => {
	it('genkender iPhone og iPad', () => {
		expect(erApplePhone('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe(true);
		expect(erApplePhone('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)')).toBe(true);
	});

	it('genkender ikke Android som Apple', () => {
		expect(erApplePhone('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe(false);
	});
});

describe('erSafariPaaIphone', () => {
	const SAFARI =
		'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

	it('genkender Safari paa iPhone', () => {
		expect(erSafariPaaIphone(SAFARI)).toBe(true);
	});

	it('afviser Chrome paa iPhone', () => {
		// Chrome paa iOS skriver ogsaa "Safari" i sit kendetegn, men CriOS
		// afsloerer den. Den kan ikke laegge noget paa hjemmeskaermen.
		expect(erSafariPaaIphone(SAFARI.replace('Version/18.0', 'CriOS/128.0'))).toBe(false);
	});

	it('afviser browservinduet inde i Facebook', () => {
		expect(erSafariPaaIphone(SAFARI + ' [FBAN/FBIOS;FBAV/470.0]')).toBe(false);
	});

	it('afviser et indbygget vindue helt uden Safari i navnet', () => {
		expect(erSafariPaaIphone('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe(false);
	});

	it('er falsk paa Android, hvor spoergsmaalet ikke giver mening', () => {
		expect(erSafariPaaIphone('Mozilla/5.0 (Linux; Android 14; Pixel 8) Safari/537.36')).toBe(false);
	});
});
