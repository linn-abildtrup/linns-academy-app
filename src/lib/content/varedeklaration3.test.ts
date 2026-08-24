import { describe, it, expect } from 'vitest';
import {
	tilTal, fraAiSvar, tilPr100, fibreMangler, nokTilAtGemme,
	vurder, maaDeles3, medFiber, TOM, type Deklaration
} from './varedeklaration3';

const d = (x: Partial<Deklaration>): Deklaration => ({ ...TOM, ...x });

describe('tilTal', () => {
	it('taager tal, strenge og dansk komma', () => {
		expect(tilTal(3.5)).toBe(3.5);
		expect(tilTal('3,5')).toBe(3.5);
		expect(tilTal('12 g')).toBe(12);
		// Danske pakker skriver energi som "201 kJ / 48 kcal". Det er
		// kcal-tallet vi vil have, ikke kJ og slet ikke de to sat sammen.
		expect(tilTal('201 kJ / 48 kcal')).toBe(48);
		expect(tilTal('48 kcal')).toBe(48);
		expect(tilTal('1,6 g fedt')).toBe(1.6);
	});
	it('giver null og aldrig nul naar der ikke er noget', () => {
		expect(tilTal(null)).toBeNull();
		expect(tilTal('')).toBeNull();
		expect(tilTal('-')).toBeNull();
		expect(tilTal({})).toBeNull();
		expect(tilTal(NaN)).toBeNull();
	});
});

describe('fraAiSvar', () => {
	it('laeser et almindeligt svar', () => {
		const l = fraAiSvar({
			navn: 'Cultura Kefir naturel',
			kolonne: 'pr 100 g',
			naering: { kcal: 48, protein: '3,5', kh: 4.8, fedt: 1.6, salt: 0.12 }
		});
		expect(l.navn).toBe('Cultura Kefir naturel');
		expect(l.kolonne).toBe('pr100');
		expect(l.tal.protein).toBe(3.5);
		expect(l.tal.kcal).toBe(48);
	});

	it('FIBRE DER IKKE STOD PAA PAKKEN BLIVER NULL, ALDRIG NUL', () => {
		const l = fraAiSvar({ naering: { protein: 8.5, kcal: 246 } });
		expect(l.tal.fiber).toBeNull();
		expect(l.tal.protein).toBe(8.5);
	});

	it('kender ordet portion i kolonnen', () => {
		expect(fraAiSvar({ kolonne: 'pr. portion (150 g)' }).kolonne).toBe('prPortion');
		expect(fraAiSvar({ kolonne: 'noget andet' }).kolonne).toBe('ukendt');
	});

	it('taaler et tomt eller vaerre svar', () => {
		expect(fraAiSvar(null).tal).toEqual(TOM);
		expect(fraAiSvar('ikke et objekt').tal).toEqual(TOM);
		expect(fraAiSvar({ naering: 'volapyk' }).tal).toEqual(TOM);
	});

	it('taager tallene naar de ligger uden naering-objekt', () => {
		expect(fraAiSvar({ protein: 12 }).tal.protein).toBe(12);
	});
});

describe('tilPr100', () => {
	it('lader pr 100 g staa', () => {
		const l = fraAiSvar({ kolonne: 'pr 100 g', naering: { protein: 10 } });
		expect(tilPr100(l)?.protein).toBe(10);
	});

	it('regner en portion om', () => {
		const l = fraAiSvar({ kolonne: 'pr portion', portionGram: 200, naering: { protein: 10, kcal: 150 } });
		const ud = tilPr100(l)!;
		expect(ud.protein).toBe(5);
		expect(ud.kcal).toBe(75);
	});

	it('KAN IKKE REGNE OM UDEN PORTIONENS VAEGT', () => {
		const l = fraAiSvar({ kolonne: 'pr portion', naering: { protein: 10 } });
		expect(tilPr100(l)).toBeNull();
	});

	it('fibre der manglede bliver ved med at mangle efter omregning', () => {
		const l = fraAiSvar({ kolonne: 'pr portion', portionGram: 50, naering: { protein: 5 } });
		expect(tilPr100(l)!.fiber).toBeNull();
	});
});

describe('fibreMangler og nokTilAtGemme', () => {
	it('null er mangler, nul er ikke', () => {
		expect(fibreMangler(d({ fiber: null }))).toBe(true);
		expect(fibreMangler(d({ fiber: 0 }))).toBe(false);
	});
	it('uden protein kan varen ikke gemmes', () => {
		expect(nokTilAtGemme(d({ protein: null }))).toBe(false);
		expect(nokTilAtGemme(d({ protein: 0 }))).toBe(true);
	});
});

describe('vurder', () => {
	it('en hel og rigtig deklaration er i orden', () => {
		const v = vurder(d({ kcal: 48, protein: 3.5, fiber: 0, kh: 4.8, fedt: 1.6 }));
		expect(v.ok).toBe(true);
		expect(v.advarsler).toEqual([]);
	});

	it('MANGLENDE FIBRE ER IKKE EN FEJL, MEN DET SKAL SIGES', () => {
		const v = vurder(d({ kcal: 246, protein: 8.5, kh: 45, fedt: 4 }));
		expect(v.fibreMangler).toBe(true);
		expect(v.ok).toBe(false);
		expect(v.advarsler).toEqual([]);
	});

	it('kalorier der ikke passer giver en advarsel', () => {
		const v = vurder(d({ kcal: 78, protein: 17.1, fiber: 0, kh: 22, fedt: 0.4 }));
		expect(v.advarsler.length).toBeGreaterThan(0);
	});

	it('GAETTER PAA FORKERT KOLONNE, for det er den hyppigste forklaring', () => {
		const v = vurder(d({ kcal: 78, protein: 17.1, fiber: 0, kh: 22, fedt: 0.4 }), 'prPortion');
		expect(v.maaskeForkertKolonne).toBe(true);
	});

	it('men ikke naar kolonnen allerede er pr 100 g', () => {
		const v = vurder(d({ kcal: 78, protein: 17.1, fiber: 0, kh: 22, fedt: 0.4 }), 'pr100');
		expect(v.maaskeForkertKolonne).toBe(false);
	});

	// MAALT PAA BELLWELL 24. august. Et rent fiberprodukt med 76 g fiber og
	// 360 kalorier faar en advarsel om at kalorierne ikke passer, og det er
	// en falsk alarm. Regnestykket kan ikke vide at fiber i netop den slags
	// produkter bidrager mere end de 2 kcal pr gram vi regner med.
	//
	// Vi lever med den, for hun kan gemme alligevel. Alternativet var at
	// slaekke kalorie-tjekket for alle, og saa fanger det heller ikke den
	// forkerte kolonne, som er den fejl der goer skade.
	it('et rent fiberprodukt faar en falsk alarm, og den lever vi med', () => {
		const v = vurder(d({ kcal: 360, protein: 0, fiber: 76.1, kh: 5, fedt: 2 }));
		expect(v.advarsler.length).toBe(1);
		// Men den maa stadig gemmes, og hun bliver ikke spaerret.
		expect(v.fibreMangler).toBe(false);
	});
});

describe('maaDeles3', () => {
	const god = vurder(d({ kcal: 48, protein: 3.5, fiber: 0, kh: 4.8, fedt: 1.6 }));
	const skaev = vurder(d({ kcal: 78, protein: 17.1, fiber: 0, kh: 22, fedt: 0.4 }));

	it('en uroert og troværdig scanning deles', () => expect(maaDeles3(god, false)).toBe(true));
	it('HAR HUN RETTET, DELES DEN IKKE', () => expect(maaDeles3(god, true)).toBe(false));
	it('haenger tallene ikke sammen, deles den ikke', () => expect(maaDeles3(skaev, false)).toBe(false));

	it('MANGLENDE FIBRE FORHINDRER IKKE DELING', () => {
		const udenFiber = vurder(d({ kcal: 246, protein: 8.5, kh: 45, fedt: 4 }));
		expect(maaDeles3(udenFiber, false)).toBe(true);
	});
});

describe('medFiber', () => {
	const uden = d({ protein: 8.5, fiber: null });
	it('lader dem staa tomme', () => expect(medFiber(uden, 'tom', 5).fiber).toBeNull());
	it('saetter hendes eget tal', () => expect(medFiber(uden, 'egen', 5.9).fiber).toBe(5.9));
	it('laaner fra en raavare', () => expect(medFiber(uden, 'laant', 5.9).fiber).toBe(5.9));
	it('afviser volapyk og negative tal', () => {
		expect(medFiber(uden, 'egen', null).fiber).toBeNull();
		expect(medFiber(uden, 'egen', -2).fiber).toBeNull();
	});
});
