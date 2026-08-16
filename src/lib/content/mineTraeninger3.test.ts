import { describe, it, expect } from 'vitest';
import type { TrainingDay } from './mikrotraening';
import {
	EGET_PRAEFIKS,
	egetProgramTekst3,
	erEgetProgram3,
	fjernTraening3,
	kopiKandidater3,
	nytEgetId3,
	nytEgetProgram3,
	samletMinutter3,
	tilProgram3,
	tilfoejTraening3,
	validerMinTraening3,
	type MinTraening3
} from './mineTraeninger3';

function dag(nr: number, antalOevelser: number): TrainingDay {
	return {
		dagNummer: nr,
		titel: '',
		indledning: '',
		exercises: Array.from({ length: antalOevelser }, (_, i) => ({
			exerciseId: `o${nr}_${i}`,
			sets: 3,
			workSec: 30,
			restSec: 15,
			bonus: false
		}))
	};
}

function mit(dage: TrainingDay[], navn = 'Min morgenrutine'): MinTraening3 {
	return { id: 'egen_abc', navn, dage, oprettetAt: 100, opdateretAt: 200 };
}

describe('erEgetProgram3', () => {
	it('kender hendes egne paa praefikset', () => {
		expect(erEgetProgram3('egen_abc123')).toBe(true);
	});

	it('kender Linns paa at praefikset mangler', () => {
		// Uden det her skulle afspilleren gaette hvilken samling den
		// skal hente fra.
		expect(erEgetProgram3('AbC123xyz')).toBe(false);
	});

	it('bygger et id med praefikset', () => {
		expect(nytEgetId3('abc123')).toBe(`${EGET_PRAEFIKS}abc123`);
		expect(erEgetProgram3(nytEgetId3('abc123'))).toBe(true);
	});
});

describe('validerMinTraening3', () => {
	it('kraever et navn', () => {
		expect(validerMinTraening3('   ', 3)).toBe('Giv dit program et navn.');
	});

	it('afviser for langt navn', () => {
		expect(validerMinTraening3('n'.repeat(61), 3)).toContain('60 tegn');
	});

	it('kraever mindst én traening', () => {
		expect(validerMinTraening3('Min rutine', 0)).toBe('Der skal være mindst én træning.');
		expect(validerMinTraening3('Min rutine', 2.5)).toBe('Der skal være mindst én træning.');
	});

	it('godkender et rigtigt program', () => {
		expect(validerMinTraening3('Min morgenrutine', 7)).toBeNull();
	});

	it('saetter ingen oevre graense', () => {
		// Linns valg 16. august: ingen graenser.
		expect(validerMinTraening3('Stort', 400)).toBeNull();
	});
});

describe('nytEgetProgram3', () => {
	it('laver de tomme traeninger med det samme', () => {
		const p = nytEgetProgram3('egen_a', '  Min rutine  ', 7, 500);
		expect(p.navn).toBe('Min rutine');
		expect(p.dage).toHaveLength(7);
		expect(p.dage[0].dagNummer).toBe(1);
		expect(p.dage[6].exercises).toHaveLength(0);
		expect(p.oprettetAt).toBe(500);
	});

	it('giver altid mindst én traening', () => {
		expect(nytEgetProgram3('egen_a', 'A', 0, 1).dage).toHaveLength(1);
	});
});

describe('tilProgram3', () => {
	it('giver hendes program samme form som Linns', () => {
		const p = tilProgram3(mit([dag(1, 3), dag(2, 0)]));
		expect(p.id).toBe('egen_abc');
		expect(p.navn).toBe('Min morgenrutine');
		expect(p.antalDage).toBe(2);
		expect(p.klar).toBe(true);
		expect(p.tommeDage).toBe(1);
	});

	it('maerker den som hendes egen', () => {
		expect(tilProgram3(mit([dag(1, 3)])).egen).toBe(true);
	});

	it('starter altid forfra', () => {
		// Hendes eget program er noget hun tager igen, ikke noget der slutter.
		expect(tilProgram3(mit([dag(1, 3)])).starterForfra).toBe(true);
	});

	it('har ingen kategori, saa udstyrs-filteret ikke kan skjule den', () => {
		expect(tilProgram3(mit([dag(1, 3)])).kategoriId).toBe('');
	});
});

describe('tilfoejTraening3', () => {
	it('laegger en tom til sidst med naeste nummer', () => {
		const r = tilfoejTraening3([dag(1, 3), dag(2, 3)]);
		expect(r).toHaveLength(3);
		expect(r[2].dagNummer).toBe(3);
		expect(r[2].exercises).toHaveLength(0);
	});

	it('virker paa et tomt program', () => {
		expect(tilfoejTraening3([])[0].dagNummer).toBe(1);
	});
});

describe('fjernTraening3', () => {
	it('fjerner og nummererer om uden huller', () => {
		const r = fjernTraening3([dag(1, 1), dag(2, 2), dag(3, 3)], 2);
		expect(r).toHaveLength(2);
		expect(r.map((d) => d.dagNummer)).toEqual([1, 2]);
		// Den der var nummer 3 skal beholde sit indhold.
		expect(r[1].exercises).toHaveLength(3);
	});

	it('fjerner ikke den sidste', () => {
		// Et program uden traeninger er ikke et program.
		const kun_en = [dag(1, 3)];
		expect(fjernTraening3(kun_en, 1)).toBe(kun_en);
	});

	it('goer ingenting ved et nummer der ikke findes', () => {
		expect(fjernTraening3([dag(1, 1), dag(2, 1)], 9)).toHaveLength(2);
	});
});

describe('samletMinutter3', () => {
	it('lægger traeningerne sammen', () => {
		// 3 oevelser a 3 saet: 3*30 + 2*15 = 120 sek pr oevelse, 360 i alt = 6 min.
		expect(samletMinutter3([dag(1, 3), dag(2, 3)])).toBe(12);
	});

	it('taeller ikke tomme traeninger med', () => {
		expect(samletMinutter3([dag(1, 3), dag(2, 0)])).toBe(6);
	});
});

describe('egetProgramTekst3', () => {
	it('siger hvor mange traeninger', () => {
		expect(egetProgramTekst3(mit([dag(1, 3), dag(2, 3)]))).toBe('2 træninger');
	});

	it('boejer ental rigtigt', () => {
		expect(egetProgramTekst3(mit([dag(1, 3)]))).toBe('1 træning');
	});

	it('siger til naar noget mangler', () => {
		expect(egetProgramTekst3(mit([dag(1, 3), dag(2, 0)]))).toBe('2 træninger · 1 er tom');
		expect(egetProgramTekst3(mit([dag(1, 0), dag(2, 0)]))).toBe(
			'2 træninger · ingen øvelser endnu'
		);
	});
});

describe('kopiKandidater3', () => {
	it('finder dem der er noget at kopiere fra', () => {
		const r = kopiKandidater3([dag(1, 3), dag(2, 0), dag(3, 2)], 2);
		expect(r.map((d) => d.dagNummer)).toEqual([1, 3]);
	});

	it('tager ikke den man staar paa med', () => {
		expect(kopiKandidater3([dag(1, 3), dag(2, 3)], 1).map((d) => d.dagNummer)).toEqual([2]);
	});
});
