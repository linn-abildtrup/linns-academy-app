import { describe, it, expect } from 'vitest';
import {
	maalingerFraMrs,
	formaterKortDato,
	taethedsregler,
	byggKurve,
	kadenceDage,
	maalingStatus,
	type Maaling,
	FLADE_FORSIDE,
	FLADE_UDVIKLING
} from './forside3';
import type { Adgang } from './adgang3';

const DAG = 86400000;
// Onsdag 5. august 2026 kl 09:00 lokal tid.
const NU = new Date(2026, 7, 5, 9, 0, 0, 0).getTime();

const abo = (fra: number, til: number | null): Adgang => ({
	art: 'abo',
	produkt: 'app',
	fra,
	til,
	kilde: 'udledt'
});

const forlob = (fra: number, til: number, id = 'kickstart_1'): Adgang => ({
	art: 'forlob',
	produkt: 'kickstart',
	forlobId: id,
	fra,
	til,
	kilde: 'udledt'
});

const maaling = (dageSiden: number, vaerdi: number): Maaling => ({
	ms: NU - dageSiden * DAG,
	vaerdi
});

describe('maalingerFraMrs', () => {
	it('regner gennemsnittet af de fem skydere', () => {
		const m = maalingerFraMrs([
			{ timestamp: NU, sliders: { energi: 7, mave: 8, cravings: 7, humor: 8, sovn: 7 } }
		]);
		expect(m).toEqual([{ ms: NU, vaerdi: 7.4 }]);
	});

	it('springer udfyldelser uden skydere over', () => {
		expect(maalingerFraMrs([{ timestamp: NU }])).toEqual([]);
	});

	it('sorterer aeldste foerst', () => {
		const m = maalingerFraMrs([
			{ timestamp: NU, sliders: { energi: 8, mave: 8, cravings: 8, humor: 8, sovn: 8 } },
			{ timestamp: NU - 30 * DAG, sliders: { energi: 5, mave: 5, cravings: 5, humor: 5, sovn: 5 } }
		]);
		expect(m.map((x) => x.vaerdi)).toEqual([5, 8]);
	});
});

describe('formaterKortDato', () => {
	it('skriver uden aarstal i indevaerende aar', () =>
		expect(formaterKortDato(NU, NU)).toBe('5. aug'));
	it('skriver aarstal med naar punktet er fra et andet aar', () =>
		expect(formaterKortDato(new Date(2025, 7, 12).getTime(), NU)).toBe('12. aug 2025'));
});

describe('taethedsregler', () => {
	it('viser alt paa alle punkter ved fire maalinger', () => {
		const r = taethedsregler(4);
		expect([0, 1, 2, 3].every((i) => r.prik(i) && r.tal(i) && r.dato(i))).toBe(true);
	});

	it('viser dato paa foerste, midterste og sidste ved otte maalinger', () => {
		const r = taethedsregler(8);
		expect([0, 1, 2, 3, 4, 5, 6, 7].filter((i) => r.dato(i))).toEqual([0, 3, 7]);
		expect([0, 1, 2, 3, 4, 5, 6, 7].every((i) => r.tal(i))).toBe(true);
	});

	it('viser kun tal i enderne ved mange maalinger', () => {
		const r = taethedsregler(30);
		const medTal = Array.from({ length: 30 }, (_, i) => i).filter((i) => r.tal(i));
		expect(medTal).toEqual([0, 29]);
		const medPrik = Array.from({ length: 30 }, (_, i) => i).filter((i) => r.prik(i));
		expect(medPrik.length).toBeLessThanOrEqual(8);
		expect(medPrik).toContain(0);
		expect(medPrik).toContain(29);
	});
});

describe('byggKurve', () => {
	it('giver en tom kurve naar hun aldrig har maalt', () => {
		const k = byggKurve([], [abo(NU - 90 * DAG, null)], NU);
		expect(k.punkter).toEqual([]);
		expect(k.seneste).toBeNull();
		expect(k.aendring).toBe(0);
	});

	it('placerer foerste maaling i venstre kant og nyeste i hoejre', () => {
		const k = byggKurve([maaling(90, 5.1), maaling(30, 6.2), maaling(0, 7.4)], [], NU);
		expect(k.punkter[0].x).toBe(22);
		expect(k.punkter[2].x).toBe(264);
		expect(k.punkter[2].erSidste).toBe(true);
	});

	it('regner aendringen fra foerste til nyeste', () => {
		const k = byggKurve([maaling(90, 5.1), maaling(0, 7.4)], [], NU);
		expect(k.aendring).toBe(2.3);
	});

	it('lader en hoejere vaerdi ligge hoejere paa kortet', () => {
		const k = byggKurve([maaling(60, 4.5), maaling(0, 8)], [], NU);
		expect(k.punkter[1].y).toBeLessThan(k.punkter[0].y);
	});

	it('markerer forloebet som et baand med navn', () => {
		const k = byggKurve(
			[maaling(90, 5), maaling(0, 7)],
			[forlob(NU - 60 * DAG, NU - 39 * DAG)],
			NU,
			new Map([['kickstart_1', 'Kickstart august']])
		);
		expect(k.baand).toHaveLength(1);
		expect(k.baand[0].navn).toBe('Kickstart august');
		expect(k.baand[0].bredde).toBeGreaterThan(0);
	});

	it('giver et kort forloeb en mindstebredde saa det ikke forsvinder', () => {
		// Tre uger inde i to aar ville ellers blive under to pixels bredt.
		const k = byggKurve(
			[maaling(730, 4), maaling(0, 7)],
			[forlob(NU - 700 * DAG, NU - 679 * DAG)],
			NU
		);
		expect(k.baand[0].bredde).toBeGreaterThanOrEqual(12);
	});

	it('holder baandet inden for tegnefladen', () => {
		const k = byggKurve([maaling(30, 5), maaling(0, 7)], [forlob(NU - 2 * DAG, NU + 20 * DAG)], NU);
		expect(k.baand[0].x).toBeGreaterThanOrEqual(14);
		expect(k.baand[0].x + k.baand[0].bredde).toBeLessThanOrEqual(274.01);
	});

	it('bryder linjen og tegner et hul hen over en pause', () => {
		// Hun havde adgang, meldte sig ud i fire maaneder og kom med igen.
		const adgange = [abo(NU - 400 * DAG, NU - 280 * DAG), abo(NU - 150 * DAG, null)];
		const k = byggKurve(
			[maaling(400, 4.8), maaling(300, 5.2), maaling(30, 6.4), maaling(0, 6.6)],
			adgange,
			NU
		);
		expect(k.pauser.length).toBe(1);
		expect(k.huller.length).toBe(1);
		expect(k.stier.length).toBe(2);
	});

	it('tegner én sammenhaengende linje naar der ingen pause er', () => {
		const k = byggKurve(
			[maaling(90, 5), maaling(45, 6), maaling(0, 7)],
			[abo(NU - 200 * DAG, null)],
			NU
		);
		expect(k.pauser).toEqual([]);
		expect(k.stier).toHaveLength(1);
		expect(k.huller).toEqual([]);
	});

	it('klarer en enkelt maaling uden at kollapse', () => {
		const k = byggKurve([maaling(0, 6.2)], [abo(NU - 40 * DAG, null)], NU);
		expect(k.punkter).toHaveLength(1);
		expect(k.stier[0]).toContain('M');
		expect(k.aendring).toBe(0);
	});
});

describe('kadenceDage', () => {
	it('giver Kickstart ugentlig maaling', () => expect(kadenceDage('kickstart')).toBe(7));
	it('giver Kropsro hver fjerde uge', () => expect(kadenceDage('kropsro')).toBe(28));
	it('giver medlem uden forloeb hver fjerde uge', () => expect(kadenceDage(null)).toBe(28));
});

describe('maalingStatus', () => {
	it('er aaben med det samme naar hun aldrig har maalt', () => {
		const s = maalingStatus(null, null, NU);
		expect(s.erAaben).toBe(true);
	});

	it('er lukket dagen efter en maaling', () => {
		const s = maalingStatus(NU - DAG, 'kickstart', NU);
		expect(s.erAaben).toBe(false);
		expect(s.tekst).toContain('Næste måling');
	});

	it('aabner igen efter syv dage paa Kickstart', () => {
		expect(maalingStatus(NU - 7 * DAG, 'kickstart', NU).erAaben).toBe(true);
		expect(maalingStatus(NU - 7 * DAG, 'kropsro', NU).erAaben).toBe(false);
	});

	it('aabner efter otteogtyve dage for alle andre', () => {
		expect(maalingStatus(NU - 28 * DAG, null, NU).erAaben).toBe(true);
	});

	it('lukker baandet igen efter en uge, saa hun ikke bebrejdes hver dag', () => {
		const s = maalingStatus(NU - 40 * DAG, null, NU);
		expect(s.erAaben).toBe(false);
		expect(s.naesteMs).toBeGreaterThan(NU);
	});

	it('skriver ugedag naar maalingen er inden for en uge', () => {
		const s = maalingStatus(NU - 5 * DAG, 'kickstart', NU);
		expect(s.tekst).toMatch(
			/på (mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag)|i morgen|i dag/
		);
	});
});

// ============================================================
// Tegnefladen. Tilfoejet 18. august 2026, da kurven ogsaa kom paa
// Udvikling og de to steder skal have hver sin hoejde.
// ============================================================

describe('tegnefladen', () => {
	it('uden et femte argument tegnes der paa forsidens flade', () => {
		const k = byggKurve([maaling(90, 5.1), maaling(0, 7.4)], [], NU);
		expect(k.flade).toBe(FLADE_FORSIDE);
	});

	it('fladen foelger med ud, saa komponenten kan laese viewBox af den', () => {
		const k = byggKurve([maaling(0, 6)], [], NU, new Map(), FLADE_UDVIKLING);
		expect(k.flade.hoejde).toBe(FLADE_UDVIKLING.hoejde);
	});

	// Uden det ville en tom kurve ikke kunne tegne en viewBox.
	it('ogsaa naar der slet ikke er maalinger', () => {
		expect(byggKurve([], [], NU, new Map(), FLADE_UDVIKLING).flade).toBe(FLADE_UDVIKLING);
	});

	it('Udviklings flade er hoejere end forsidens', () => {
		expect(FLADE_UDVIKLING.hoejde).toBeGreaterThan(FLADE_FORSIDE.hoejde);
		expect(FLADE_UDVIKLING.yBund - FLADE_UDVIKLING.yTop).toBeGreaterThan(
			FLADE_FORSIDE.yBund - FLADE_FORSIDE.yTop
		);
	});

	it('Udviklings kurve gaar taettere paa kanterne', () => {
		expect(FLADE_UDVIKLING.xVenstre).toBeLessThan(FLADE_FORSIDE.xVenstre);
		expect(FLADE_UDVIKLING.xHoejre).toBeGreaterThan(FLADE_FORSIDE.xHoejre);
	});

	it('punkterne laegger sig paa den flade der er bedt om', () => {
		const k = byggKurve([maaling(90, 4), maaling(0, 8)], [], NU, new Map(), FLADE_UDVIKLING);
		expect(k.punkter[0].x).toBe(FLADE_UDVIKLING.xVenstre);
		expect(k.punkter[1].x).toBe(FLADE_UDVIKLING.xHoejre);
		// Hoejeste vaerdi ligger oeverst, altsaa lavest y.
		expect(k.punkter[1].y).toBeLessThan(k.punkter[0].y);
	});

	// Alt skal kunne vaere inden for viewBox'en, ellers klipper browseren.
	for (const [navn, flade] of [
		['forsiden', FLADE_FORSIDE],
		['Udvikling', FLADE_UDVIKLING]
	] as const) {
		it(`${navn}s maal haenger sammen`, () => {
			expect(flade.yTop).toBeLessThan(flade.yBund);
			expect(flade.yBund).toBeLessThanOrEqual(flade.hoejde);
			expect(flade.baandTop + flade.baandHoejde).toBeLessThanOrEqual(flade.baandStregY);
			expect(flade.baandStregY + flade.baandStregHoejde).toBeLessThanOrEqual(flade.hoejde);
			expect(flade.datoY).toBeLessThanOrEqual(flade.hoejde);
			expect(flade.xVenstre).toBeLessThan(flade.xHoejre);
			expect(flade.xHoejre).toBeLessThanOrEqual(flade.bredde);
			expect(flade.baandKantHoejre).toBeLessThanOrEqual(flade.bredde);
		});
	}
});

describe('fyldet under kurven', () => {
	it('lukker ned mod kurvens bund, saa det kan farves', () => {
		const k = byggKurve([maaling(90, 4), maaling(0, 8)], [], NU);
		expect(k.fyld).toHaveLength(1);
		expect(k.fyld[0]).toContain(`,${FLADE_FORSIDE.yBund}`);
		expect(k.fyld[0].endsWith('Z')).toBe(true);
	});

	// En lodret streg under ét punkt ville se ud som en fejl.
	it('ét punkt giver ingen flade', () => {
		expect(byggKurve([maaling(0, 6)], [], NU).fyld).toEqual([]);
	});

	it('ingen maalinger giver ingen flade', () => {
		expect(byggKurve([], [], NU).fyld).toEqual([]);
	});

	// Er linjen brudt af en pause, skal fladen brydes samme sted.
	it('der er lige saa mange stykker flade som linje', () => {
		const adgange = [abo(NU - 400 * DAG, NU - 200 * DAG), abo(NU - 60 * DAG, null)];
		const k = byggKurve(
			[maaling(390, 4.8), maaling(300, 5.2), maaling(50, 6.4), maaling(0, 7)],
			adgange,
			NU
		);
		expect(k.fyld).toHaveLength(k.stier.length);
	});

	it('fladen foelger den flade der tegnes paa', () => {
		const k = byggKurve([maaling(90, 4), maaling(0, 8)], [], NU, new Map(), FLADE_UDVIKLING);
		expect(k.fyld[0]).toContain(`,${FLADE_UDVIKLING.yBund}`);
	});
});
