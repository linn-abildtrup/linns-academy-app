import { describe, it, expect } from 'vitest';
import {
	erApplePhone,
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
	it('iPhone faar Del-knappen i Safari', () => {
		const v = hjemmeskaermVejledning(true);
		expect(v.trin).toHaveLength(3);
		expect(v.trin[0]).toContain('Del-knappen');
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
