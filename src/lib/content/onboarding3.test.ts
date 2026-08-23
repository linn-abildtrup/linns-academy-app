import { describe, it, expect } from 'vitest';
import {
	harVaeretIgennem3,
	skalOnboardes3,
	tekstSkalaFra3,
	taeller3,
	kortNr3,
	rundvisningskort3,
	spoergsmaalTrin3,
	velkomstvideo3,
	velkomsttekst3,
	slutTekst3,
	SPOERGSMAAL_TRIN_3,
	TEKST_SKALAER_3,
	type KundeBillede3
} from './onboarding3';

const FORLOBSKUNDE: KundeBillede3 = {
	harAktivtForlob: true,
	harTraening: true,
	maaSkriveTilLinn: true,
	maaSeKalorier: true
};

const MEDLEM: KundeBillede3 = {
	harAktivtForlob: false,
	harTraening: true,
	maaSkriveTilLinn: false,
	maaSeKalorier: true
};

describe('harVaeretIgennem3', () => {
	it('siger nej naar feltet mangler', () => {
		expect(harVaeretIgennem3(null)).toBe(false);
		expect(harVaeretIgennem3({})).toBe(false);
	});

	it('siger ja naar der staar et tidspunkt', () => {
		expect(harVaeretIgennem3({ onboardet3: 1_700_000_000_000 })).toBe(true);
	});

	// Et nul kunne komme fra et halvt skrevet felt, og saa skal hun hellere
	// tage opstarten end at staa uden udstyrsvalg for altid.
	it('taeller ikke et nul som gennemfoert', () => {
		expect(harVaeretIgennem3({ onboardet3: 0 })).toBe(false);
	});
});

describe('skalOnboardes3', () => {
	it('sender en ny kunde til onboarding', () => {
		expect(skalOnboardes3({}, false)).toBe(true);
	});

	it('lader hende vaere naar hun har vaeret igennem', () => {
		expect(skalOnboardes3({ onboardet3: 1 }, false)).toBe(false);
	});

	// Ellers kunne Linn ikke aabne sit eget vaerktoej uden at tage
	// opstarten forfra, og hun aabner appen oftere end nogen anden.
	it('sender aldrig admin til onboarding', () => {
		expect(skalOnboardes3({}, true)).toBe(false);
	});
});

describe('tekstSkalaFra3', () => {
	it('falder tilbage paa normal naar intet er valgt', () => {
		expect(tekstSkalaFra3(null)).toBe('normal');
		expect(tekstSkalaFra3({})).toBe('normal');
	});

	it('laeser hendes valg', () => {
		expect(tekstSkalaFra3({ tekstSkala3: 'large' })).toBe('large');
		expect(tekstSkalaFra3({ tekstSkala3: 'xlarge' })).toBe('xlarge');
	});

	it('afviser vaerdier den ikke kender', () => {
		expect(tekstSkalaFra3({ tekstSkala3: 'kaempestor' })).toBe('normal');
		expect(tekstSkalaFra3({ tekstSkala3: 42 })).toBe('normal');
	});

	it('de tre trin matcher den gamle apps vaerdier', () => {
		expect(TEKST_SKALAER_3.map((t) => t.vaerdi)).toEqual(['normal', 'large', 'xlarge']);
	});
});

describe('rundvisningskort3', () => {
	it('giver en forloebskunde syv kort', () => {
		expect(rundvisningskort3(FORLOBSKUNDE)).toHaveLength(7);
	});

	it('giver et medlem fem kort', () => {
		expect(rundvisningskort3(MEDLEM)).toHaveLength(5);
	});

	it('viser aldrig forloebs-kortet til et medlem', () => {
		const ids = rundvisningskort3(MEDLEM).map((k) => k.id);
		expect(ids).not.toContain('forlob');
	});

	it('viser aldrig skriv-til-Linn til en der ikke maa', () => {
		const ids = rundvisningskort3(MEDLEM).map((k) => k.id);
		expect(ids).not.toContain('linn');
	});

	// Lover kortet traening til en der ikke har faaet et program, lander
	// hun paa en tom skaerm bagefter.
	it('springer traening over naar hun ikke har faaet et program', () => {
		const ids = rundvisningskort3({ ...FORLOBSKUNDE, harTraening: false }).map((k) => k.id);
		expect(ids).not.toContain('traening');
		expect(ids).toHaveLength(6);
	});

	it('naevner lektioner for en forloebskunde og ikke for et medlem', () => {
		const forlob = rundvisningskort3(FORLOBSKUNDE).find((k) => k.id === 'forside');
		const medlem = rundvisningskort3(MEDLEM).find((k) => k.id === 'forside');
		expect(forlob?.tekst).toContain('lektion');
		expect(medlem?.tekst).not.toContain('lektion');
	});

	it('naevner kun kalorier naar hun maa se dem', () => {
		const med = rundvisningskort3(FORLOBSKUNDE).find((k) => k.id === 'mad');
		const uden = rundvisningskort3({ ...FORLOBSKUNDE, maaSeKalorier: false }).find(
			(k) => k.id === 'mad'
		);
		expect(med?.tekst).toContain('kalorier');
		expect(uden?.tekst).not.toContain('kalorier');
	});

	it('starter altid med bundmenuen og slutter med maalingen', () => {
		for (const kunde of [FORLOBSKUNDE, MEDLEM]) {
			const ids = rundvisningskort3(kunde).map((k) => k.id);
			expect(ids[0]).toBe('rundt');
			expect(ids[ids.length - 1]).toBe('maaling');
		}
	});

	it('hvert kort har en beskrivelse af sit skaermbillede', () => {
		for (const k of rundvisningskort3(FORLOBSKUNDE)) {
			expect(k.billedeBeskrivelse.length).toBeGreaterThan(0);
		}
	});
});

describe('taeller3', () => {
	it('en forloebskunde taeller til 11', () => {
		const antal = rundvisningskort3(FORLOBSKUNDE).length;
		expect(taeller3(1, antal).ialt).toBe(11);
	});

	it('et medlem taeller til 9', () => {
		const antal = rundvisningskort3(MEDLEM).length;
		expect(taeller3(1, antal).ialt).toBe(9);
	});

	it('de fire spoergsmaal ligger foerst', () => {
		expect(SPOERGSMAAL_TRIN_3).toHaveLength(4);
	});

	it('regner andelen ud til bjaelken', () => {
		expect(taeller3(4, 4).andel).toBe(0.5);
	});

	it('kan ikke komme under 1 eller over det samlede antal', () => {
		expect(taeller3(0, 7).nu).toBe(1);
		expect(taeller3(99, 7).nu).toBe(11);
	});

	// "Gennemgå appen" under Profil springer de fire spoergsmaal over. Sagde
	// taelleren stadig "5 af 11", ville hun lede efter de fire foerste.
	it('taeller kun kortene naar spoergsmaalene springes over', () => {
		expect(taeller3(1, 7, false)).toEqual({ nu: 1, ialt: 7, andel: 1 / 7 });
	});
});

describe('kortNr3', () => {
	it('peger paa foerste kort naar de fire spoergsmaal er taget', () => {
		expect(kortNr3(5)).toBe(0);
		expect(kortNr3(11)).toBe(6);
	});

	it('er negativ mens vi stadig er i spoergsmaalene', () => {
		expect(kortNr3(1)).toBeLessThan(0);
		expect(kortNr3(4)).toBeLessThan(0);
	});

	it('starter paa foerste kort med det samme uden spoergsmaal', () => {
		expect(kortNr3(1, false)).toBe(0);
		expect(kortNr3(7, false)).toBe(6);
	});
});

describe('velkomsten', () => {
	// De fire optages senere. Indtil da springer skaermen afspilleren over
	// og viser kun hilsenen, saa onboarding virker fuldt ud i mellemtiden.
	it('har ingen video endnu, og det er med vilje', () => {
		expect(velkomstvideo3('kickstart')).toBe('');
		expect(velkomstvideo3('app')).toBe('');
	});

	it('taaler at kundetypen er ukendt', () => {
		expect(velkomstvideo3(null)).toBe('');
	});

	it('siger noget forskelligt til hver kundetype', () => {
		expect(velkomsttekst3('kickstart')).toContain('21 dage');
		expect(velkomsttekst3('app')).toContain('selv tempoet');
		expect(velkomsttekst3('kropsro')).not.toBe(velkomsttekst3('kickstart'));
	});

	it('slutter forskelligt for en forloebskunde og et medlem', () => {
		expect(slutTekst3(true).tekst).toContain('måling');
		expect(slutTekst3(false).tekst).toContain('spist');
	});
});

describe('spoergsmaalTrin3', () => {
	it('tre trin naar appen allerede ligger paa hjemmeskaermen og hun er spurgt', () => {
		expect(spoergsmaalTrin3({ paaHjemmeskaerm: true, kanSpoergeOmBeskeder: false })).toEqual([
			'velkommen',
			'tekst',
			'udstyr'
		]);
	});

	it('vejledningen kommer med naar appen ikke ligger der', () => {
		const t = spoergsmaalTrin3({ paaHjemmeskaerm: false, kanSpoergeOmBeskeder: false });
		expect(t).toContain('hjemmeskaerm');
		expect(t).not.toContain('beskeder');
	});

	it('BESKEDERNE KOMMER FOERST NAAR APPEN LIGGER DER', () => {
		// Paa iPhone kan de kun slaas til inde i appen. Er den ikke lagt paa
		// plads, ville et ja alligevel ikke virke.
		const t = spoergsmaalTrin3({ paaHjemmeskaerm: true, kanSpoergeOmBeskeder: true });
		expect(t).toEqual(['velkommen', 'tekst', 'udstyr', 'beskeder']);
	});

	it('begge kan staa samtidig, og vejledningen kommer foerst', () => {
		const t = spoergsmaalTrin3({ paaHjemmeskaerm: false, kanSpoergeOmBeskeder: true });
		expect(t.indexOf('hjemmeskaerm')).toBeLessThan(t.indexOf('beskeder'));
	});

	it('taelleren foelger med naar der er faerre trin', () => {
		const trin = spoergsmaalTrin3({ paaHjemmeskaerm: true, kanSpoergeOmBeskeder: false });
		expect(taeller3(1, 5, true, trin.length).ialt).toBe(8);
		expect(kortNr3(4, true, trin.length)).toBe(0);
	});
});
