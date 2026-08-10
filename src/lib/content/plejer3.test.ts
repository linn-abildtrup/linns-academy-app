import { describe, it, expect } from 'vitest';
import { plejerFor, harEgenHistorik, NOK_HISTORIK, type HistorikMaaltid } from './plejer3';

const NAVNE: Record<string, string> = {
	skyr: 'Skyr Skovbær',
	havre: 'Havregryn',
	baer: 'Blåbær',
	kylling: 'Kylling',
	mandler: 'Mandler'
};
const slaaOp = (id: string) => NAVNE[id];

function m(type: HistorikMaaltid['type'], ...items: HistorikMaaltid['items']): HistorikMaaltid {
	return { type, items };
}

describe('plejerFor', () => {
	const historik: HistorikMaaltid[] = [
		m('morgenmad', { foodId: 'skyr', portion: 150, enhedId: 'g' }),
		m('morgenmad', { foodId: 'skyr', portion: 150, enhedId: 'g' }),
		m('morgenmad', { foodId: 'skyr', portion: 100, enhedId: 'g' }),
		m('morgenmad', { foodId: 'havre', portion: 40, enhedId: 'g' }),
		m('morgenmad', { foodId: 'havre', portion: 40, enhedId: 'g' }),
		m('morgenmad', { foodId: 'baer', portion: 50, enhedId: 'g' }),
		m('frokost', { foodId: 'kylling', portion: 150, enhedId: 'g' })
	];

	it('taeller kun det maaltid der spoerges om', () => {
		const p = plejerFor(historik, 'frokost', slaaOp);
		expect(p.map((x) => x.foodId)).toEqual(['kylling']);
	});

	// En generel top-liste ville foreslaa kylling til morgenmad.
	it('holder morgenmad og frokost adskilt', () => {
		const p = plejerFor(historik, 'morgenmad', slaaOp);
		expect(p.map((x) => x.foodId)).not.toContain('kylling');
	});

	it('saetter den hyppigste foerst', () => {
		const p = plejerFor(historik, 'morgenmad', slaaOp);
		expect(p[0].foodId).toBe('skyr');
		expect(p[0].antal).toBe(3);
		expect(p[1].foodId).toBe('havre');
	});

	// Maengden skal huskes, ellers er det ikke ét tryk.
	it('husker den maengde hun oftest bruger', () => {
		const p = plejerFor(historik, 'morgenmad', slaaOp);
		expect(p[0].portion).toBe(150);
		expect(p[0].enhedId).toBe('g');
	});

	it('tager den mindste ved uafgjort, saa vi hellere giver for lidt', () => {
		const h = [
			m('morgenmad', { foodId: 'havre', portion: 60, enhedId: 'g' }),
			m('morgenmad', { foodId: 'havre', portion: 40, enhedId: 'g' })
		];
		expect(plejerFor(h, 'morgenmad', slaaOp)[0].portion).toBe(40);
	});

	it('giver hoejst fire fliser', () => {
		const h = Object.keys(NAVNE).map((id) => m('morgenmad', { foodId: id, portion: 10 }));
		expect(plejerFor(h, 'morgenmad', slaaOp)).toHaveLength(4);
	});

	// Manuelt indtastede poster kan ikke tilfoejes igen med ét tryk.
	it('springer poster uden madvare over', () => {
		const h = [m('morgenmad', { manuel: { navn: 'Noget jeg skrev selv' }, portion: 1 })];
		expect(plejerFor(h, 'morgenmad', slaaOp)).toEqual([]);
	});

	it('springer madvarer over der ikke findes laengere', () => {
		const h = [m('morgenmad', { foodId: 'findes-ikke', portion: 50 })];
		expect(plejerFor(h, 'morgenmad', slaaOp)).toEqual([]);
	});

	it('taaler tom historik', () => {
		expect(plejerFor([], 'morgenmad', slaaOp)).toEqual([]);
	});

	it('bruger hundrede gram naar der aldrig er sat en maengde', () => {
		const h = [m('morgenmad', { foodId: 'havre' })];
		expect(plejerFor(h, 'morgenmad', slaaOp)[0].portion).toBe(100);
	});
});

describe('harEgenHistorik', () => {
	// Den nye kunde skal ikke moede fire tomme felter.
	it('er falsk naar hun lige er begyndt', () => {
		expect(harEgenHistorik([])).toBe(false);
		expect(
			harEgenHistorik([{ foodId: 'a', navn: 'A', portion: 1, antal: 1 }])
		).toBe(false);
	});

	it('er sand naar der er nok', () => {
		const poster = Array.from({ length: NOK_HISTORIK }, (_, i) => ({
			foodId: `f${i}`,
			navn: `F${i}`,
			portion: 1,
			antal: 1
		}));
		expect(harEgenHistorik(poster)).toBe(true);
	});
});
