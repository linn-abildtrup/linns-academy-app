import { describe, it, expect } from 'vitest';
import {
	endnuIkkeStartetTekst,
	hoejesteAabneTraeningsdag,
	maaAabneTraening,
	traeningErStartet,
	traeningsdagFor,
	traeningStartDag
} from './traeningStart';

const KICKSTART = { traeningStartDag: 3 };
const UDEN = {};

describe('traeningStartDag', () => {
	it('falder tilbage paa dag 1 naar forloebet ikke har sat noget', () => {
		// Kropsro og de byggede forloeb er dermed uaendrede: dag N = traening N.
		expect(traeningStartDag(UDEN)).toBe(1);
		expect(traeningStartDag(null)).toBe(1);
	});

	it('bruger forloebets egen vaerdi', () => {
		expect(traeningStartDag(KICKSTART)).toBe(3);
	});

	it('ignorerer noget vaerre end tal, saa et helt hold ikke laases ude', () => {
		expect(traeningStartDag({ traeningStartDag: -4 })).toBe(1);
		expect(traeningStartDag({ traeningStartDag: NaN })).toBe(1);
		expect(traeningStartDag({ traeningStartDag: 2.7 })).toBe(2);
	});
});

describe('Kickstart: intet paa dag 0, 1 og 2', () => {
	it('traeningen er ikke startet de tre foerste dage', () => {
		// Linns krav 29. august: ingen traeningsflise dag nul, ét og to.
		expect(traeningErStartet(0, KICKSTART)).toBe(false);
		expect(traeningErStartet(1, KICKSTART)).toBe(false);
		expect(traeningErStartet(2, KICKSTART)).toBe(false);
	});

	it('og der er intet at linke til', () => {
		expect(traeningsdagFor(0, KICKSTART)).toBeNull();
		expect(traeningsdagFor(2, KICKSTART)).toBeNull();
	});

	it('hun kan heller ikke aabne en traening ad bagvejen', () => {
		expect(maaAabneTraening(1, 2, KICKSTART)).toBe(false);
		expect(maaAabneTraening(1, 0, KICKSTART)).toBe(false);
	});
});

describe('Kickstart: dag 3 giver traening 1', () => {
	it('programmet rykker med i stedet for at springe de to foerste over', () => {
		expect(traeningsdagFor(3, KICKSTART)).toBe(1);
		expect(traeningsdagFor(4, KICKSTART)).toBe(2);
		expect(traeningsdagFor(21, KICKSTART)).toBe(19);
	});

	it('paa dag 3 er kun den foerste traening aaben', () => {
		expect(hoejesteAabneTraeningsdag(3, KICKSTART)).toBe(1);
		expect(maaAabneTraening(1, 3, KICKSTART)).toBe(true);
		expect(maaAabneTraening(2, 3, KICKSTART)).toBe(false);
		expect(maaAabneTraening(3, 3, KICKSTART)).toBe(false);
	});

	it('hun kan altid gaa tilbage til en traening hun har haft', () => {
		expect(maaAabneTraening(1, 10, KICKSTART)).toBe(true);
		expect(maaAabneTraening(8, 10, KICKSTART)).toBe(true);
	});

	it('en traening der ikke findes afvises', () => {
		expect(maaAabneTraening(0, 10, KICKSTART)).toBe(false);
	});
});

describe('forloeb uden indstilling er uaendrede', () => {
	it('dag N giver stadig traening N fra dag 1', () => {
		expect(traeningsdagFor(1, UDEN)).toBe(1);
		expect(traeningsdagFor(40, UDEN)).toBe(40);
	});

	it('men dag 0 peger ikke laengere paa en traening nummer 0', () => {
		// Foer stod kortet der og aabnede en tom side.
		expect(traeningErStartet(0, UDEN)).toBe(false);
		expect(traeningsdagFor(0, UDEN)).toBeNull();
	});
});

describe('endnuIkkeStartetTekst', () => {
	it('siger hvornaar det begynder, ikke bare nej', () => {
		expect(endnuIkkeStartetTekst(KICKSTART, 0)).toContain('om 3 dage');
		expect(endnuIkkeStartetTekst(KICKSTART, 2)).toContain('i morgen');
	});

	it('har en tekst til en dag hun bare ikke er naaet til endnu', () => {
		expect(endnuIkkeStartetTekst(KICKSTART, 5)).toContain('ikke åbnet endnu');
	});
});
