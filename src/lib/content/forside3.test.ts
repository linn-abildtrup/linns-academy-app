import { describe, it, expect } from 'vitest';
import {
	maalingerFraMrs,
	formaterKortDato,
	taethedsregler,
	byggKurve,
	kadenceDage,
	maalingStatus,
	type Maaling,
	beregnAkse,
	GRAENSER_OVERSKUD,
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
		expect(k.punkter[0].x).toBe(FLADE_FORSIDE.xVenstre);
		expect(k.punkter[2].x).toBe(FLADE_FORSIDE.xHoejre);
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
		expect(k.baand[0].x).toBeGreaterThanOrEqual(FLADE_FORSIDE.baandKantVenstre);
		expect(k.baand[0].x + k.baand[0].bredde).toBeLessThanOrEqual(
			FLADE_FORSIDE.baandKantHoejre + 0.01
		);
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

	// Siden 18. august har forsiden den samme behandling som Udvikling,
	// bare paa et lavere kort og paa den moerke plomme-flade. Linns oenske.
	it('begge har en akse, og der er sat plads af til dens tal', () => {
		for (const f of [FLADE_FORSIDE, FLADE_UDVIKLING]) {
			expect(f.akse).toBe(true);
			expect(f.akseBredde).toBeGreaterThan(0);
			expect(f.xVenstre).toBeGreaterThanOrEqual(f.akseBredde);
		}
	});

	// Forsiden er et kort blandt mange, Udvikling er hele siden.
	it('Udviklings kurve er hoejere end forsidens', () => {
		expect(FLADE_UDVIKLING.yBund - FLADE_UDVIKLING.yTop).toBeGreaterThan(
			FLADE_FORSIDE.yBund - FLADE_FORSIDE.yTop
		);
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
			expect(flade.baandTekstY).toBeLessThanOrEqual(flade.hoejde);
			// Holdnavnet og datoen maa ALDRIG dele linje. Gjorde de det,
			// laa "Kickstart" oven i "26. apr". Set paa forsiden 18. august.
			expect(flade.baandTekstY).not.toBe(flade.datoY);
			expect(Math.abs(flade.baandTekstY - flade.datoY)).toBeGreaterThanOrEqual(8);
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

// ============================================================
// Y-aksen. Linns beslutning 18. august: den skal daekke hendes EGNE
// tal og ikke hele skalaen fra 1 til 10, og der skal staa tal paa den.
// ============================================================

describe('beregnAkse', () => {
	it('runder ud til hele tal, og midten bliver ogsaa et', () => {
		// Hannes rigtige tal.
		expect(beregnAkse([4.2, 4.8, 6.2, 7.2, 7.6], true)).toEqual({ lav: 4, hoej: 8, midt: 6 });
	});

	it('hele tal ind giver hele tal ud', () => {
		expect(beregnAkse([3, 6, 9], true)).toEqual({ lav: 3, hoej: 9, midt: 6 });
	});

	// Et ulige spaend ville give en midte paa 5,5, og det maa der ikke staa.
	it('et ulige spaend udvides saa midten bliver hel', () => {
		const a = beregnAkse([4, 7], true);
		expect((a.hoej - a.lav) % 2).toBe(0);
		expect(Number.isInteger(a.midt)).toBe(true);
	});

	// En helt flad kurve ville ellers faa hoejde nul og forsvinde.
	it('en flad kurve faar stadig en hoejde', () => {
		const a = beregnAkse([5, 5, 5], true);
		expect(a.hoej - a.lav).toBeGreaterThanOrEqual(2);
		expect(a.lav).toBeLessThanOrEqual(5);
		expect(a.hoej).toBeGreaterThanOrEqual(5);
	});

	it('gaar aldrig under 1 eller over 10', () => {
		for (const v of [
			[1, 1],
			[10, 10],
			[1, 10],
			[1.2, 9.8]
		]) {
			const a = beregnAkse(v, true);
			expect(a.lav).toBeGreaterThanOrEqual(1);
			expect(a.hoej).toBeLessThanOrEqual(10);
		}
	});

	it('rummer altid de tal den fik', () => {
		for (const v of [
			[4.2, 7.6],
			[2, 3],
			[8.9, 9.1],
			[1, 4]
		]) {
			const a = beregnAkse(v, true);
			expect(a.lav).toBeLessThanOrEqual(Math.min(...v));
			expect(a.hoej).toBeGreaterThanOrEqual(Math.max(...v));
		}
	});

	// Forsiden har ingen akse og skal opfoere sig som den altid har.
	it('uden hele tal er der ingen midte at skrive', () => {
		expect(beregnAkse([5.1, 6.0], false).midt).toBeNull();
	});

	it('uden hele tal laegger aksen sig taet om tallene', () => {
		const a = beregnAkse([5.1, 6.0], false);
		expect(a.lav).toBeLessThan(5.1);
		expect(a.hoej).toBeGreaterThan(6.0);
		expect(a.hoej - a.lav).toBeLessThan(3);
	});

	it('ingen tal giver en akse man kan tegne paa alligevel', () => {
		const a = beregnAkse([], true);
		expect(a.hoej).toBeGreaterThan(a.lav);
	});
});

describe('kurven kender sin akse', () => {
	it('Udvikling faar hele tal', () => {
		const k = byggKurve([maaling(90, 4.2), maaling(0, 7.6)], [], NU, new Map(), FLADE_UDVIKLING);
		expect(k.akse).toEqual({ lav: 4, hoej: 8, midt: 6 });
	});

	it('forsiden faar den samme akse som Udvikling', () => {
		expect(byggKurve([maaling(90, 4.2), maaling(0, 7.6)], [], NU).akse).toEqual({
			lav: 4,
			hoej: 8,
			midt: 6
		});
	});

	// Punkterne skal ligge inden for aksen, ellers stikker de ud af flisen.
	it('punkterne holder sig inden for kurvens top og bund', () => {
		const k = byggKurve(
			[maaling(90, 4.2), maaling(45, 6.2), maaling(0, 7.6)],
			[],
			NU,
			new Map(),
			FLADE_UDVIKLING
		);
		for (const p of k.punkter) {
			expect(p.y).toBeGreaterThanOrEqual(FLADE_UDVIKLING.yTop);
			expect(p.y).toBeLessThanOrEqual(FLADE_UDVIKLING.yBund);
		}
	});
});

// ============================================================
// Aksen paa ANDRE skalaer end 1 til 10.
//
// Fejlen 18. august: beregnAkse laaste til 1 og 10, fordi den var
// skrevet til overskuddet. Symptomerne gaar 0 til 44, saa en total paa
// 24 blev klippet vaek og kurven blev tegnet uden for feltet. Aksen
// stod paa 8, 9, 10 og kortet var tomt.
// ============================================================

const SYMPTOM = { min: 0, max: 44 };

describe('beregnAkse paa symptom-skalaen', () => {
	it('rummer tal langt over ti', () => {
		const a = beregnAkse([11, 12, 15, 20, 24], true, SYMPTOM);
		expect(a.lav).toBeLessThanOrEqual(11);
		expect(a.hoej).toBeGreaterThanOrEqual(24);
	});

	it('midten er stadig et helt tal', () => {
		const a = beregnAkse([11, 24], true, SYMPTOM);
		expect(Number.isInteger(a.midt)).toBe(true);
		expect((a.hoej - a.lav) % 2).toBe(0);
	});

	it('nul gener er gyldigt og maa ikke skubbes op til 1', () => {
		expect(beregnAkse([0, 4], true, SYMPTOM).lav).toBe(0);
	});

	it('gaar aldrig over 44', () => {
		expect(beregnAkse([42, 44], true, SYMPTOM).hoej).toBeLessThanOrEqual(44);
	});

	it('uden graenser opfoerer den sig som foer, altsaa 1 til 10', () => {
		const a = beregnAkse([4.2, 7.6], true);
		expect(a).toEqual({ lav: 4, hoej: 8, midt: 6 });
		expect(GRAENSER_OVERSKUD).toEqual({ min: 1, max: 10 });
	});
});

describe('kurven paa symptom-skalaen', () => {
	// Det her er selve fejlen: punkterne laa uden for feltet og blev
	// klippet vaek af browseren, saa der stod en tom flise.
	it('alle punkter ligger inden for kurvens top og bund', () => {
		const k = byggKurve(
			[maaling(120, 24), maaling(80, 20), maaling(40, 15), maaling(0, 11)],
			[],
			NU,
			new Map(),
			FLADE_UDVIKLING,
			SYMPTOM
		);
		for (const p of k.punkter) {
			expect(p.y).toBeGreaterThanOrEqual(FLADE_UDVIKLING.yTop);
			expect(p.y).toBeLessThanOrEqual(FLADE_UDVIKLING.yBund);
		}
	});

	it('aksen daekker hendes tal og ikke 8 til 10', () => {
		const k = byggKurve(
			[maaling(120, 24), maaling(0, 11)],
			[],
			NU,
			new Map(),
			FLADE_UDVIKLING,
			SYMPTOM
		);
		expect(k.akse.hoej).toBeGreaterThanOrEqual(24);
	});

	// En faldende kurve er sejren for symptomer. Foerste maaling er
	// hoejest, altsaa oeverst, altsaa lavest y.
	it('en faldende symptom-kurve peger nedad paa skaermen', () => {
		const k = byggKurve(
			[maaling(120, 24), maaling(0, 11)],
			[],
			NU,
			new Map(),
			FLADE_UDVIKLING,
			SYMPTOM
		);
		expect(k.punkter[1].y).toBeGreaterThan(k.punkter[0].y);
	});
});
