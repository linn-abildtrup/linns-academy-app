import { describe, it, expect } from 'vitest';
import { TEMPOER3, nuvaerendeTempo3, saetTempo3, tempoTal3 } from './traeningTempo3';

const o = (workSec: number, restSec: number, sets = 1) => ({ workSec, restSec, sets });

describe('TEMPOER3', () => {
	it('er tre, fra roligst til haardest', () => {
		expect(TEMPOER3.map((t) => t.navn)).toEqual(['Roligt', 'Almindeligt', 'Hårdt']);
	});

	it('arbejdet stiger og pausen falder', () => {
		for (let i = 1; i < TEMPOER3.length; i++) {
			expect(TEMPOER3[i].workSec).toBeGreaterThan(TEMPOER3[i - 1].workSec);
			expect(TEMPOER3[i].restSec).toBeLessThan(TEMPOER3[i - 1].restSec);
		}
	});

	// BEMAERK at de tre IKKE tager lige lang tid. Roligt er 50 sekunder pr
	// oevelse, de to andre er 60. Det er Linns tal, og det er bevidst
	// noteret her saa ingen "retter" det uden at spoerge.
	it('roligt er kortere pr oevelse end de to andre', () => {
		const [roligt, alm, haardt] = TEMPOER3;
		expect(roligt.workSec + roligt.restSec).toBe(50);
		expect(alm.workSec + alm.restSec).toBe(60);
		expect(haardt.workSec + haardt.restSec).toBe(60);
	});
});

describe('tempoTal3', () => {
	it('skriver arbejde skraastreg pause', () => {
		expect(tempoTal3(TEMPOER3[1])).toBe('45/15');
	});
});

describe('nuvaerendeTempo3', () => {
	it('finder tempoet naar alle oevelser koerer det samme', () => {
		expect(nuvaerendeTempo3([o(45, 15), o(45, 15)])?.navn).toBe('Almindeligt');
	});

	// Har hun rettet en enkelt, maa ingen knap staa valgt. Ellers ser det
	// ud som om hele traeningen koerer noget den ikke goer.
	it('giver null naar oevelserne koerer forskelligt', () => {
		expect(nuvaerendeTempo3([o(45, 15), o(30, 20)])).toBeNull();
	});

	it('giver null naar tallene ikke svarer til et af de tre', () => {
		expect(nuvaerendeTempo3([o(37, 23)])).toBeNull();
	});

	it('giver null uden oevelser', () => {
		expect(nuvaerendeTempo3([])).toBeNull();
	});
});

describe('saetTempo3', () => {
	it('saetter tempoet paa alle oevelser', () => {
		const ud = saetTempo3([o(30, 20), o(50, 10)], TEMPOER3[1]);
		expect(ud.every((x) => x.workSec === 45 && x.restSec === 15)).toBe(true);
	});

	// Saet er hendes eget valg pr oevelse og maa ikke nulstilles af et
	// tryk paa en tempo-knap.
	it('roerer ikke saet', () => {
		expect(saetTempo3([o(30, 20, 3)], TEMPOER3[2])[0].sets).toBe(3);
	});

	it('giver en ny liste og aendrer ikke den gamle', () => {
		const foer = [o(30, 20)];
		saetTempo3(foer, TEMPOER3[2]);
		expect(foer[0].workSec).toBe(30);
	});
});
