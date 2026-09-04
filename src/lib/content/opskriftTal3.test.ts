import { describe, it, expect } from 'vitest';
import { delInstruktioner, byggeItemsFraBeregning, nyMakroLinje } from './opskriftTal3';
import type { Fodevare } from './kost';
import type { Opskrift } from './opskrifter';
import type { KoblingsOpslag } from './opskriftMakro3';

describe('delInstruktioner', () => {
	it('tager makro-linjen ud og giver tiden for sig', () => {
		const t =
			'1. Rør det hele sammen.\n\nTip: smager bedst kold.\n\nProtein: 29,4 g | Fiber: 10,8 g | Kulhydrater: 24,7 g | Fedt: 31,8 g | Kalorier: 572 kcal | Tid: 10 minutter';
		const r = delInstruktioner(t);
		expect(r.broedtekst).toBe('1. Rør det hele sammen.\n\nTip: smager bedst kold.');
		expect(r.tid).toBe('10 minutter');
	});

	it('klarer en linje uden tid', () => {
		const t = 'Bland det.\n\nProtein: 5 g | Fiber: 2 g | Kulhydrater: 7 g | Fedt: 4 g | Kalorier: 97 kcal';
		const r = delInstruktioner(t);
		expect(r.broedtekst).toBe('Bland det.');
		expect(r.tid).toBe('');
	});

	it('lader teksten staa naar der ingen makro-linje er', () => {
		const r = delInstruktioner('Bare en fremgangsmaade.');
		expect(r.broedtekst).toBe('Bare en fremgangsmaade.');
		expect(r.tid).toBe('');
	});
});

describe('byggeItemsFraBeregning', () => {
	const olie: Fodevare = {
		id: 'olivenolie',
		name: 'Olivenolie',
		cat: 'andet',
		p: 0,
		f: 0,
		kh: 0,
		fedt: 100,
		kcal: 900,
		units: [{ u: 'spsk', label: 'spsk', g: 14 }]
	};
	const tomat: Fodevare = { id: 'tomat', name: 'Tomat', cat: 'gront', p: 0.9, f: 1.2, kcal: 21 };
	const varer = new Map<string, Fodevare>([
		[olie.id, olie],
		[tomat.id, tomat]
	]);
	const koblinger: Record<string, KoblingsOpslag> = {
		olivenolie: { foodId: 'olivenolie' },
		tomat: { foodId: 'tomat' }
	};
	const opskrift = {
		id: 'o1',
		titel: 'Test',
		defaultPortioner: 1,
		ingredienser: [
			{ navn: 'olivenolie', maengde: 1, enhed: 'spsk' },
			{ navn: 'Tomater', maengde: 200, enhed: 'g' },
			{ navn: 'noget vi ikke kender', maengde: 50, enhed: 'g' }
		]
	} as unknown as Opskrift;

	it('beholder enheden naar varen kender den', () => {
		const { items } = byggeItemsFraBeregning(opskrift, koblinger, varer, 1);
		const olieItem = items.find((i) => i.foodId === 'olivenolie');
		expect(olieItem?.enhedId).toBe('spsk');
		expect(olieItem?.portion).toBe(1);
	});

	it('bruger gram naar enheden er gram', () => {
		const { items } = byggeItemsFraBeregning(opskrift, koblinger, varer, 1);
		const t = items.find((i) => i.foodId === 'tomat');
		expect(t?.enhedId).toBeUndefined();
		expect(t?.portion).toBe(200);
	});

	it('taber ikke en ingrediens der ikke kunne kobles', () => {
		const { items, ikkeKoblede } = byggeItemsFraBeregning(opskrift, koblinger, varer, 1);
		expect(items.length).toBe(3);
		expect(ikkeKoblede).toContain('noget vi ikke kender');
	});

	it('falder tilbage paa gram naar varens enhed vejer noget andet end 3.0 regner med', () => {
		// 3.0's tabel siger 55 g pr aeg, varen selv siger 58. Beholdt vi
		// enheden, ville byg-maaltid vise et andet tal end opskriften.
		const aeg: Fodevare = {
			id: 'aeg',
			name: 'Æg',
			cat: 'mejeri',
			p: 12.3,
			f: 0,
			kcal: 138,
			units: [{ u: 'stk', label: 'stk', g: 58 }]
		};
		const o = {
			id: 'o2',
			titel: 'Test',
			defaultPortioner: 1,
			ingredienser: [{ navn: 'æg', maengde: 2, enhed: 'stk' }]
		} as unknown as Opskrift;
		const { items } = byggeItemsFraBeregning(
			o,
			{ aeg: { foodId: 'aeg' } },
			new Map([['aeg', aeg]]),
			1
		);
		expect(items[0].enhedId).toBeUndefined();
		expect(items[0].portion).toBe(110);
	});

	it('skalerer med antal portioner', () => {
		const { items } = byggeItemsFraBeregning(opskrift, koblinger, varer, 2);
		expect(items.find((i) => i.foodId === 'tomat')?.portion).toBe(400);
		expect(items.find((i) => i.foodId === 'olivenolie')?.portion).toBe(2);
	});
});

describe('nyMakroLinje', () => {
	const b = { protein: 28.6, fiber: 11.7, kh: 29.2, fedt: 35.5, kalorier: 573 };

	it('skriver de fem tal om og lader tiden staa', () => {
		const t =
			'Bland det.\n\nProtein: 29,4 g | Fiber: 10,8 g | Kulhydrater: 24,7 g | Fedt: 31,8 g | Kalorier: 572 kcal | Tid: 10 minutter';
		expect(nyMakroLinje(t, b)).toBe(
			'Bland det.\n\nProtein: 28,6 g | Fiber: 11,7 g | Kulhydrater: 29,2 g | Fedt: 35,5 g | Kalorier: 573 kcal | Tid: 10 minutter'
		);
	});

	it('bruger dansk komma', () => {
		const t = 'X\n\nProtein: 1 g | Fiber: 1 g | Kulhydrater: 1 g | Fedt: 1 g | Kalorier: 1 kcal';
		expect(nyMakroLinje(t, b)).toContain('Protein: 28,6 g');
	});

	it('returnerer null naar linjen allerede er rigtig', () => {
		const t = 'X\n\nProtein: 28,6 g | Fiber: 11,7 g | Kulhydrater: 29,2 g | Fedt: 35,5 g | Kalorier: 573 kcal';
		expect(nyMakroLinje(t, b)).toBeNull();
	});

	it('returnerer null naar der ingen makro-linje er at skrive om', () => {
		expect(nyMakroLinje('Bare en fremgangsmaade.', b)).toBeNull();
	});
});
