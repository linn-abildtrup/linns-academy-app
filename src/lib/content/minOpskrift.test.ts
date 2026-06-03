import { describe, expect, it } from 'vitest';
import {
	omberegnMakroForNytAntalPortioner,
	skalerMakro,
	type MinOpskriftMakro
} from './minOpskrift';

const BASE: MinOpskriftMakro = {
	protein: 2.5,
	fiber: 2.8,
	kh: 3.2,
	fedt: 10.5,
	kcal: 115
};

describe('omberegnMakroForNytAntalPortioner', () => {
	it('halverer antal portioner -> fordobler makro pr portion paa alle felter', () => {
		const ud = omberegnMakroForNytAntalPortioner(BASE, 4, 2);
		expect(ud.protein).toBe(5);
		expect(ud.fiber).toBe(5.6);
		expect(ud.kh).toBe(6.4);
		expect(ud.fedt).toBe(21);
		expect(ud.kcal).toBe(230);
	});

	it('fordobler antal portioner -> halverer makro pr portion paa alle felter', () => {
		const ud = omberegnMakroForNytAntalPortioner(BASE, 4, 8);
		expect(ud.protein).toBe(1.3); // 2.5 / 2 = 1.25 -> rundes til 1.3 (10x then round)
		expect(ud.fiber).toBe(1.4);
		expect(ud.kh).toBe(1.6);
		expect(ud.fedt).toBe(5.3); // 10.5 / 2 = 5.25 -> 5.3
		expect(ud.kcal).toBe(58); // 115 / 2 = 57.5 -> 58 (kcal som heltal)
	});

	it('returnerer samme vaerdier naar antal portioner ikke aendres', () => {
		const ud = omberegnMakroForNytAntalPortioner(BASE, 4, 4);
		expect(ud).toEqual(BASE);
	});

	it('haandterer 1->4 portioner: kvartet makro pr portion', () => {
		const enkelt: MinOpskriftMakro = { protein: 20, fiber: 10, kh: 50, fedt: 8, kcal: 400 };
		const ud = omberegnMakroForNytAntalPortioner(enkelt, 1, 4);
		expect(ud.protein).toBe(5);
		expect(ud.fiber).toBe(2.5);
		expect(ud.kh).toBe(12.5);
		expect(ud.fedt).toBe(2);
		expect(ud.kcal).toBe(100);
	});

	it('haandterer 4->1 portioner: firdobler makro pr portion', () => {
		const ud = omberegnMakroForNytAntalPortioner(BASE, 4, 1);
		expect(ud.protein).toBe(10);
		expect(ud.fiber).toBe(11.2);
		expect(ud.kh).toBe(12.8);
		expect(ud.fedt).toBe(42);
		expect(ud.kcal).toBe(460);
	});

	it('bevarer total-makro ved skift (round-trip-kontrol paa alle felter)', () => {
		const orig: MinOpskriftMakro = {
			protein: 12.5,
			fiber: 7.3,
			kh: 45.2,
			fedt: 18.9,
			kcal: 520
		};
		const totalProt = orig.protein * 4;
		const totalFib = orig.fiber * 4;
		const totalKh = orig.kh * 4;
		const totalFedt = orig.fedt * 4;
		const totalKcal = orig.kcal * 4;
		const efter = omberegnMakroForNytAntalPortioner(orig, 4, 2);
		// 2 portioner * pr-portion-vaerdi skal vaere ca total (med afrundings-margin)
		expect(efter.protein * 2).toBeCloseTo(totalProt, 0);
		expect(efter.fiber * 2).toBeCloseTo(totalFib, 0);
		expect(efter.kh * 2).toBeCloseTo(totalKh, 0);
		expect(efter.fedt * 2).toBeCloseTo(totalFedt, 0);
		expect(efter.kcal * 2).toBeCloseTo(totalKcal, -1); // kcal heltal -> mere slip
	});

	it('haandterer decimal-portioner (4->3)', () => {
		const ud = omberegnMakroForNytAntalPortioner(BASE, 4, 3);
		// faktor = 4/3 = 1.3333
		expect(ud.protein).toBe(3.3); // 2.5 * 1.333 = 3.333 -> 3.3
		expect(ud.fiber).toBe(3.7); // 2.8 * 1.333 = 3.733 -> 3.7
		expect(ud.kh).toBe(4.3); // 3.2 * 1.333 = 4.267 -> 4.3
		expect(ud.fedt).toBe(14); // 10.5 * 1.333 = 14.0
		expect(ud.kcal).toBe(153); // 115 * 1.333 = 153.33 -> 153
	});

	it('haandterer nul-makro (alle felter 0)', () => {
		const nul: MinOpskriftMakro = { protein: 0, fiber: 0, kh: 0, fedt: 0, kcal: 0 };
		const ud = omberegnMakroForNytAntalPortioner(nul, 4, 2);
		expect(ud).toEqual(nul);
	});

	it('returnerer kopi af original ved ugyldigt nyt antal (0)', () => {
		const ud = omberegnMakroForNytAntalPortioner(BASE, 4, 0);
		expect(ud).toEqual(BASE);
		// skal vaere kopi, ikke samme reference
		expect(ud).not.toBe(BASE);
	});

	it('returnerer kopi af original ved negativt nyt antal', () => {
		const ud = omberegnMakroForNytAntalPortioner(BASE, 4, -2);
		expect(ud).toEqual(BASE);
	});

	it('returnerer kopi af original ved NaN som nyt antal', () => {
		const ud = omberegnMakroForNytAntalPortioner(BASE, 4, NaN);
		expect(ud).toEqual(BASE);
	});

	it('returnerer kopi af original ved Infinity', () => {
		const ud = omberegnMakroForNytAntalPortioner(BASE, 4, Infinity);
		expect(ud).toEqual(BASE);
	});

	it('returnerer kopi af original ved ugyldigt original-antal (0)', () => {
		const ud = omberegnMakroForNytAntalPortioner(BASE, 0, 4);
		expect(ud).toEqual(BASE);
	});

	it('rund-trip: aendr fra 4 til 2, og tilbage til 4 — restorer original makro', () => {
		const efter = omberegnMakroForNytAntalPortioner(BASE, 4, 2);
		// simuler at kunden retter tilbage — vi henter ALTID fra original-snapshot
		const tilbage = omberegnMakroForNytAntalPortioner(BASE, 4, 4);
		expect(tilbage).toEqual(BASE);
		// verificer at efter er ikke samme som BASE (forskellige vaerdier)
		expect(efter).not.toEqual(BASE);
	});

	it('foretrekker 1-decimal afrunding for protein/fiber/kh/fedt og heltal for kcal', () => {
		const finkornet: MinOpskriftMakro = {
			protein: 2.55,
			fiber: 2.85,
			kh: 3.25,
			fedt: 10.55,
			kcal: 115.5
		};
		const ud = omberegnMakroForNytAntalPortioner(finkornet, 4, 4);
		// Math.round(x * 10) / 10 — 2.55 * 10 = 25.5 -> 26 -> 2.6
		expect(ud.protein).toBe(2.6);
		expect(ud.fiber).toBe(2.9);
		expect(ud.kh).toBe(3.3);
		expect(ud.fedt).toBe(10.6);
		expect(ud.kcal).toBe(116); // heltal
	});
});

describe('skalerMakro (eksisterende funktion — sanity-check)', () => {
	it('skalerer alle felter med antal portioner', () => {
		const ud = skalerMakro(BASE, 2);
		expect(ud.protein).toBe(5);
		expect(ud.fiber).toBe(5.6);
		expect(ud.kh).toBe(6.4);
		expect(ud.fedt).toBe(21);
		expect(ud.kcal).toBe(230);
	});
});
