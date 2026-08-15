import { describe, it, expect } from 'vitest';
import {
	regnLinje,
	regnOpskrift,
	afvigelse,
	tilliden,
	afrund,
	visMakro
} from './opskriftMakro3';
import type { Fodevare } from './kost';

function v(id: string, name: string, e: Partial<Fodevare> = {}): Fodevare {
	return { id, name, cat: 'andet', p: 0, f: 0, kilde: 'frida', ...e } as Fodevare;
}

const VARER = new Map<string, Fodevare>([
	['olie', v('olie', 'Olivenolie', { p: 0, f: 0, kh: 0, fedt: 100, kcal: 884 })],
	['aeg', v('aeg', 'Æg, helt', { p: 12.5, f: 0, kh: 0.3, fedt: 9.5, kcal: 137 })],
	['linser', v('linser', 'Linser, grønne, tørrede, rå', { p: 20.5, f: 8, kh: 45, fedt: 1.5, kcal: 310 })],
	['kylling', v('kylling', 'Kyllingebryst', { p: 23, f: 0, kh: 0, fedt: 1.5, kcal: 110 })],
	['utal', v('utal', 'Vare uden kalorier', { p: 10, f: 1 })]
]);

const KOBLINGER = {
	olivenolie: { foodId: 'olie' },
	aeg: { foodId: 'aeg' },
	'groenne linser toer': { foodId: 'linser' },
	kyllingebryst: { foodId: 'kylling' },
	mystisk: { foodId: 'findes-ikke' },
	utalvare: { foodId: 'utal' }
};

describe('regnLinje', () => {
	it('regner 2 spsk olivenolie til 28 g og 248 kcal', () => {
		const l = regnLinje({ navn: 'olivenolie', maengde: 2, enhed: 'spsk' }, KOBLINGER, VARER);
		expect(l.gram).toBe(28);
		expect(Math.round(l.makro.kalorier)).toBe(248);
		expect(Math.round(l.makro.fedt)).toBe(28);
		expect(l.mangel).toBeNull();
	});

	it('regner 3 stk aeg til 165 g', () => {
		const l = regnLinje({ navn: 'æg', maengde: 3, enhed: 'stk' }, KOBLINGER, VARER);
		expect(l.gram).toBe(165);
		expect(Math.round(l.makro.protein)).toBe(21);
	});

	it('bruger de toerre linsers tal, ikke de kogtes', () => {
		const l = regnLinje({ navn: 'grønne linser, tørre', maengde: 60, enhed: 'g' }, KOBLINGER, VARER);
		expect(l.vare?.name).toContain('tørrede');
		expect(Math.round(l.makro.protein * 10) / 10).toBe(12.3);
	});

	it('markerer salt som uden betydning, ikke som en mangel', () => {
		const l = regnLinje({ navn: 'salt', maengde: 1, enhed: 'tsk' }, KOBLINGER, VARER);
		expect(l.uden_betydning).toBe(true);
		expect(l.mangel).toBeNull();
		expect(l.makro.kalorier).toBe(0);
	});

	it('markerer en linje uden maengde som uden betydning', () => {
		const l = regnLinje({ navn: 'Saft fra 1 citron', maengde: 0, enhed: 'stk' }, KOBLINGER, VARER);
		expect(l.uden_betydning).toBe(true);
		expect(l.mangel).toBeNull();
	});

	it('siger til naar der ikke er nogen kobling', () => {
		const l = regnLinje({ navn: 'flankesteak', maengde: 200, enhed: 'g' }, KOBLINGER, VARER);
		expect(l.mangel).toBe('ingen kobling');
		expect(l.makro.protein).toBe(0);
	});

	it('siger til naar koblingen peger paa en vare der er vaek', () => {
		const l = regnLinje({ navn: 'mystisk', maengde: 100, enhed: 'g' }, KOBLINGER, VARER);
		expect(l.mangel).toBe('varen findes ikke');
	});

	it('regner protein med selv om kalorierne mangler, men siger det', () => {
		const l = regnLinje({ navn: 'utalvare', maengde: 100, enhed: 'g' }, KOBLINGER, VARER);
		expect(l.mangel).toBe('varen mangler tal');
		expect(l.makro.protein).toBe(10);
		expect(l.makro.kalorier).toBe(0);
	});
});

describe('regnOpskrift', () => {
	const OPSKRIFT = {
		id: 'r1',
		titel: 'Linser med æg',
		defaultPortioner: 1,
		ingredienser: [
			{ navn: 'grønne linser, tørre', maengde: 60, enhed: 'g' },
			{ navn: 'æg', maengde: 2, enhed: 'stk' },
			{ navn: 'olivenolie', maengde: 1, enhed: 'spsk' },
			{ navn: 'salt', maengde: 1, enhed: 'tsk' }
		]
	};

	it('laegger de fire linjer sammen', () => {
		const r = regnOpskrift(OPSKRIFT, KOBLINGER, VARER);
		// 60 g linser 12,3 + 110 g aeg 13,75 = 26,05
		expect(afrund(r.ialt).protein).toBe(26.1);
	});

	it('giver 100 procents daekning naar alt er koblet', () => {
		const r = regnOpskrift(OPSKRIFT, KOBLINGER, VARER);
		expect(r.daekning).toBe(100);
		expect(r.antalMangler).toBe(0);
	});

	it('lader salt vaere uden at det traekker daekningen ned', () => {
		const r = regnOpskrift(OPSKRIFT, KOBLINGER, VARER);
		expect(r.linjer).toHaveLength(4);
		expect(r.gramUden).toBe(0);
	});

	it('regner daekning i GRAM og ikke i antal ingredienser', () => {
		// 3 af 4 ingredienser er koblet, men den manglende er 200 g
		// kylling. I antal ser det ud som 75%, i gram er det 40%.
		const r = regnOpskrift(
			{
				id: 'r2',
				titel: 'Med manglende kylling',
				defaultPortioner: 1,
				ingredienser: [
					{ navn: 'flankesteak', maengde: 200, enhed: 'g' },
					{ navn: 'grønne linser, tørre', maengde: 60, enhed: 'g' },
					{ navn: 'æg', maengde: 1, enhed: 'stk' },
					{ navn: 'olivenolie', maengde: 1, enhed: 'spsk' }
				]
			},
			KOBLINGER,
			VARER
		);
		expect(r.gramUden).toBe(200);
		expect(r.gramMed).toBe(129); // 60 + 55 + 14
		expect(r.daekning).toBe(39);
		expect(r.antalMangler).toBe(1);
	});

	it('deler med det antal portioner listen raekker til', () => {
		const til2 = { ...OPSKRIFT, defaultPortioner: 2 };
		const en = regnOpskrift(OPSKRIFT, KOBLINGER, VARER);
		const to = regnOpskrift(til2, KOBLINGER, VARER);
		expect(to.ialt.protein).toBeCloseTo(en.ialt.protein);
		expect(to.prPortion.protein).toBeCloseTo(en.prPortion.protein / 2);
	});

	it('siger fra naar kalorierne ikke kan bruges', () => {
		// En omelet med 27 g protein kan ikke have 130 kalorier, for
		// proteinet alene er 108. Mangler en vare sit kalorietal,
		// bidrager den med protein og nul kalorier, og summen bliver
		// loegn. Fanget paa rigtige data 13. august.
		const r = regnOpskrift(
			{
				id: 'r3',
				titel: 'Med en vare uden kalorier',
				defaultPortioner: 1,
				ingredienser: [
					{ navn: 'æg', maengde: 2, enhed: 'stk' },
					{ navn: 'utalvare', maengde: 100, enhed: 'g' }
				]
			},
			KOBLINGER,
			VARER
		);
		expect(r.kalorierPaalidelige).toBe(false);
		expect(r.varerUdenTal).toContain('Vare uden kalorier');
		// Proteinet er stadig gyldigt, det er kun kalorierne der ikke er.
		expect(afrund(r.ialt).protein).toBe(23.8);
	});

	it('siger god for naar alle varer har deres tal', () => {
		const r = regnOpskrift(OPSKRIFT, KOBLINGER, VARER);
		expect(r.kalorierPaalidelige).toBe(true);
		expect(r.varerUdenTal).toHaveLength(0);
	});

	it('haandterer en opskrift uden ingredienser uden at braende sammen', () => {
		const r = regnOpskrift(
			{ id: 'tom', titel: 'Tom', defaultPortioner: 1, ingredienser: [] },
			KOBLINGER,
			VARER
		);
		expect(r.daekning).toBe(0);
		expect(r.ialt.protein).toBe(0);
	});
});

describe('afvigelse', () => {
	it('regner forskellen i procent', () => {
		expect(afvigelse(32, 32)).toBe(0);
		expect(afvigelse(28, 32)).toBe(-12); // 4 af 32 er 12,5 og rundes til 12
		expect(afvigelse(24, 32)).toBe(-25);
		expect(afvigelse(40, 32)).toBe(25);
	});

	it('siger ingenting naar der ikke er noget at sammenligne med', () => {
		expect(afvigelse(28, null)).toBeNull();
		expect(afvigelse(28, 0)).toBeNull();
	});
});

describe('visMakro', () => {
	const SKREVET = { protein: 30, fiber: 8, kh: 40, fedt: 15, kalorier: 410 };
	const BEREGNET = {
		r1: { protein: 46.3, fiber: 12.1, kh: 55, fedt: 20, kalorier: 649, daekning: 100, kalorierPaalidelige: true },
		lav: { protein: 20, fiber: 5, kh: 30, fedt: 10, kalorier: 300, daekning: 73, kalorierPaalidelige: true },
		udenKcal: { protein: 40, fiber: 9, kh: 45, fedt: 12, kalorier: 130, daekning: 98, kalorierPaalidelige: false }
	};

	it('bruger det beregnede tal naar daekningen er god', () => {
		const m = visMakro('r1', '', BEREGNET, SKREVET);
		expect(m.protein).toBe(46.3);
		expect(m.kalorier).toBe(649);
		expect(m.beregnet).toBe(true);
	});

	it('falder tilbage paa det skrevne naar daekningen er for lav', () => {
		const m = visMakro('lav', '', BEREGNET, SKREVET);
		expect(m.protein).toBe(30);
		expect(m.kalorier).toBe(410);
		expect(m.beregnet).toBe(false);
	});

	it('falder tilbage naar opskriften slet ikke er beregnet', () => {
		const m = visMakro('findes-ikke', '', BEREGNET, SKREVET);
		expect(m.protein).toBe(30);
		expect(m.beregnet).toBe(false);
	});

	it('beholder beregnet protein men skrevne kalorier naar en vare mangler tal', () => {
		// En ret med 40 g protein kan ikke have 130 kalorier. Proteinet er
		// gyldigt, kalorierne er ikke.
		const m = visMakro('udenKcal', '', BEREGNET, SKREVET);
		expect(m.protein).toBe(40);
		expect(m.kalorier).toBe(410);
		expect(m.beregnet).toBe(true);
	});

	it('kan faa graensen sat op', () => {
		const m = visMakro('udenKcal', '', BEREGNET, SKREVET, 99);
		expect(m.beregnet).toBe(false);
	});
});

describe('tilliden', () => {
	it('kraever 90 procent foer tallet kaldes godt', () => {
		expect(tilliden(100)).toBe('god');
		expect(tilliden(90)).toBe('god');
		expect(tilliden(89)).toBe('delvis');
		expect(tilliden(70)).toBe('delvis');
		expect(tilliden(69)).toBe('for lidt');
	});
});
