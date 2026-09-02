import { describe, it, expect } from 'vitest';
import { tilGram, rensNavn, tabelStoerrelse, bidragerIkke } from './enhedsvaegt3';

describe('bidragerIkke', () => {
	it('siger ja til salt, peber og vand', () => {
		// De skal HELT ud af admin-listen. Salt fyldte 28 linjer med fem
		// bud paa noget der alligevel ganges med nul gram.
		expect(bidragerIkke('salt')).toBe(true);
		expect(bidragerIkke('Havsalt')).toBe(true);
		expect(bidragerIkke('peber')).toBe(true);
		expect(bidragerIkke('Salt og peber')).toBe(true);
		expect(bidragerIkke('Friskkværnet peber')).toBe(true);
		expect(bidragerIkke('vand')).toBe(true);
	});

	it('siger nej til alt der faktisk vejer noget', () => {
		expect(bidragerIkke('olivenolie')).toBe(false);
		expect(bidragerIkke('kyllingebryst')).toBe(false);
		expect(bidragerIkke('grønne linser, tørre')).toBe(false);
		// Saltet koed er mad, ikke salt.
		expect(bidragerIkke('saltet mandler')).toBe(false);
	});
});

describe('rensNavn', () => {
	it('oversaetter aeoeaa saa opslag virker', () => {
		expect(rensNavn('Rødløg')).toBe('roedloeg');
		expect(rensNavn('Æg')).toBe('aeg');
		expect(rensNavn('Hvidløg')).toBe('hvidloeg');
	});

	it('fjerner det der staar i parentes', () => {
		expect(rensNavn('fed hvidløg (til tzatziki)')).toBe('fed hvidloeg');
		expect(rensNavn('mandler (til topping variant 2)')).toBe('mandler');
	});

	it('skaerer tilberedning af enden', () => {
		expect(rensNavn('olivenolie til stegning')).toBe('olivenolie');
		expect(rensNavn('olivenolie til topping')).toBe('olivenolie');
		expect(rensNavn('rugbrød til')).toBe('rugbroed');
	});

	it('beholder procent, for det skiller varianter ad', () => {
		expect(rensNavn('creme fraiche 18%')).toBe('creme fraiche 18%');
	});
});

describe('linjer der ikke bidrager', () => {
	it('giver nul naar der ikke staar en maengde', () => {
		const r = tilGram('Saft fra 1 citron', 0, 'stk');
		expect(r.gram).toBe(0);
		expect(r.sikkerhed).toBe('ingen');
	});

	it('springer salt og peber over uanset enhed', () => {
		expect(tilGram('salt', 1, 'tsk').gram).toBe(0);
		expect(tilGram('Havsalt', 2, 'stk').gram).toBe(0);
		expect(tilGram('Friskkværnet peber', 1, 'tsk').gram).toBe(0);
		expect(tilGram('Salt og peber', 1, 'stk').gram).toBe(0);
	});

	it('kender de tre enheder der kom til 2. september', () => {
		// Uden dem faldt de ned i styk-grenen og blev gaettet som 100 g.
		expect(tilGram('hakkede tomater', 1, 'dåse').gram).toBe(400);
		expect(tilGram('mandler', 2, 'håndfuld').gram).toBe(60);
		expect(tilGram('persille', 1, 'bundt').gram).toBe(25);
	});

	it('springer knivspids og nip over', () => {
		expect(tilGram('chiliflager', 1, 'knivspids').gram).toBe(0);
		expect(tilGram('chiliflager', 1, 'nip').gram).toBe(0);
	});

	it('men salt uden maengde er stadig nul, ikke en fejl', () => {
		expect(tilGram('Salt og friskkværnet peber', 0, 'stk').gram).toBe(0);
	});
});

describe('enheder der allerede er vaegt', () => {
	it('lader gram staa', () => {
		expect(tilGram('kyllingebryst', 150, 'g').gram).toBe(150);
	});

	it('regner dl som vand', () => {
		expect(tilGram('kefir', 2, 'dl').gram).toBe(200);
	});

	it('regner IKKE toerre varer som vand', () => {
		// 2 dl havregryn blev regnet som 200 g og gav 732 kalorier i
		// Winnis morgengroed. De rigtige 70 g giver 256. Den ene linje
		// stod for hele afvigelsen paa 146 procent. Fundet 13. august.
		expect(tilGram('havregryn', 2, 'dl').gram).toBe(70);
		expect(tilGram('havregryn', 1, 'dl').gram).toBe(35);
		expect(tilGram('fuldkornsmel', 1, 'dl').gram).toBe(55);
		expect(tilGram('quinoa', 1, 'dl').gram).toBe(85);
	});

	it('regner stadig vaeske som vand', () => {
		expect(tilGram('kefir', 2, 'dl').gram).toBe(200);
		expect(tilGram('mælk', 1.5, 'dl').gram).toBe(150);
		expect(tilGram('bouillon', 3, 'dl').gram).toBe(300);
	});

	it('regner baer lettere end vand', () => {
		expect(tilGram('blåbær', 0.5, 'dl').gram).toBe(30);
	});

	it('regner kilo og liter om', () => {
		expect(tilGram('kartofler', 1, 'kg').gram).toBe(1000);
		expect(tilGram('vand', 1, 'l').gram).toBe(0); // vand bidrager ikke
		expect(tilGram('bouillon', 1, 'l').gram).toBe(1000);
	});
});

describe('spiseskefulde', () => {
	it('olivenolie er 14 g, ikke 15', () => {
		// Olie har massefylde 0,92, saa 15 ml vejer 13,8 g.
		expect(tilGram('olivenolie', 1, 'spsk').gram).toBe(14);
		expect(tilGram('olivenolie', 2, 'spsk').gram).toBe(28);
	});

	it('ganger med halve skefulde', () => {
		expect(tilGram('olivenolie', 0.5, 'spsk').gram).toBe(7);
	});

	it('taeller stavefejlen olievenolie med', () => {
		expect(tilGram('olievenolie', 1, 'spsk').gram).toBe(14);
	});

	it('friske urter vejer meget mindre end vaeske', () => {
		expect(tilGram('persille', 1, 'spsk').gram).toBe(4);
		expect(tilGram('hakket frisk dild', 2, 'spsk').gram).toBe(8);
	});

	it('noeddesmoer er tungere end vaeske', () => {
		expect(tilGram('tahini', 1, 'spsk').gram).toBe(16);
		expect(tilGram('peanutbutter uden tilsat sukker', 1, 'spsk').gram).toBe(16);
	});

	it('honning er det tungeste i skeen', () => {
		expect(tilGram('honning', 1, 'spsk').gram).toBe(21);
	});
});

describe('teskefulde', () => {
	it('er cirka en tredjedel af en spiseskefuld', () => {
		expect(tilGram('olivenolie', 1, 'tsk').gram).toBe(5);
	});

	it('toerrede urter er lettere end stoedte krydderier', () => {
		expect(tilGram('oregano', 1, 'tsk').gram).toBe(1);
		expect(tilGram('spidskommen', 1, 'tsk').gram).toBe(2);
	});

	it('haandterer kvarte teskefulde', () => {
		expect(tilGram('chiliflager', 0.25, 'tsk').gram).toBe(0.375);
	});
});

describe('styk', () => {
	it('et aeg er 55 g spiseligt, ikke 58 med skal', () => {
		expect(tilGram('æg', 1, 'stk').gram).toBe(55);
		expect(tilGram('æg', 3, 'stk').gram).toBe(165);
	});

	it('et fed hvidloeg er 4 g, ikke et helt loeg', () => {
		// Det her er den vigtigste af de laengste-traef-vinder-regler.
		expect(tilGram('fed hvidløg', 1, 'stk').gram).toBe(4);
		expect(tilGram('hvidløg', 2, 'stk').gram).toBe(8);
		expect(tilGram('hvidløg', 2, 'fed').gram).toBe(8);
	});

	it('avocado og avokado vejer det samme', () => {
		// De to stavemaader daekker 23 linjer og skal ikke give to tal.
		// 145 g er DTU's mellem-stoerrelse netto, altsaa uden sten og skal.
		expect(tilGram('avocado', 1, 'stk').gram).toBe(145);
		expect(tilGram('avokado', 1, 'stk').gram).toBe(145);
		expect(tilGram('moden avokado', 0.5, 'stk').gram).toBe(72.5);
	});

	it('et lille loeg vejer mindre end et almindeligt', () => {
		// DTU: loeg 55/60 lille, 100/110 mellem. Vi bruger netto.
		expect(tilGram('løg', 1, 'stk').gram).toBe(100);
		expect(tilGram('lille løg', 1, 'stk').gram).toBe(55);
	});

	it('roedloeg er tungere end almindeligt loeg', () => {
		// DTU skelner: loeg 100 netto, roedloeg 135. Foer 13. august
		// stod de begge til 110, altsaa mit eget gaet.
		expect(tilGram('rødløg', 1, 'stk').gram).toBe(135);
	});

	it('cherrytomat er ikke det samme som tomat', () => {
		// DTU: tomat 75 g mellem, cherrytomat 15 g. Foer 13. august
		// stod tomaten til 120, som var mit eget skoen og for hoejt.
		expect(tilGram('tomat', 1, 'stk').gram).toBe(75);
		expect(tilGram('cherrytomater', 8, 'stk').gram).toBe(120);
	});

	it('en skive rugbroed er 45 g', () => {
		// DTU: rugbroedsskive 25 lille, 45 mellem, 70 stor.
		expect(tilGram('rugbrød', 2, 'skive').gram).toBe(90);
		expect(tilGram('rugbrød til', 1, 'skive').gram).toBe(45);
	});

	it('bruger DTU-tabellens mellem-stoerrelse paa frugt og groent', () => {
		expect(tilGram('citron', 1, 'stk').gram).toBe(65);
		expect(tilGram('agurk', 1, 'stk').gram).toBe(285);
		expect(tilGram('peberfrugt', 1, 'stk').gram).toBe(180);
		expect(tilGram('gulerod', 1, 'stk').gram).toBe(65);
		expect(tilGram('æble', 1, 'stk').gram).toBe(110);
		expect(tilGram('kyllingebryst', 1, 'stk').gram).toBe(110);
	});
});

describe('ukendte varer', () => {
	it('gaetter ud fra varetypen og siger det er et gaet', () => {
		const r = tilGram('sjælden krydderiblanding', 1, 'tsk');
		expect(r.sikkerhed).toBe('gruppe');
		expect(r.gram).toBe(2.5);
	});

	it('kender olie paa navnet selv om varen er ukendt', () => {
		const r = tilGram('græskarkerneolie', 1, 'spsk');
		expect(r.sikkerhed).toBe('gruppe');
		expect(r.gram).toBe(14);
	});

	it('kender vaeske paa navnet', () => {
		const r = tilGram('hyldeblomstsirup', 1, 'spsk');
		expect(r.gram).toBe(15);
	});

	it('markerer ukendte styk som noget der skal bekraeftes', () => {
		const r = tilGram('sjælden grøntsag', 1, 'stk');
		expect(r.sikkerhed).toBe('gruppe');
		expect(r.forklaring).toContain('bekraeftes');
	});
});

describe('tabellen selv', () => {
	it('daekker de enheder vi har maalt i opskrifterne', () => {
		const t = tabelStoerrelse();
		expect(t.spsk).toBeGreaterThan(60);
		expect(t.tsk).toBeGreaterThan(30);
		expect(t.stk).toBeGreaterThan(50);
	});
});
