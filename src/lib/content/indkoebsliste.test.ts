import { describe, it, expect } from 'vitest';
import type { Opskrift } from './opskrifter';
import {
	byggIndkoebsliste,
	formaterMaengde,
	gaetGruppe,
	grupperIndkoebsliste,
	ingrediensKey,
	skaler,
	teksteksport,
	tilfoejManuel,
	type ValgteOpskrifter
} from './indkoebsliste';

function lavOpskrift(overrides: Partial<Opskrift>): Opskrift {
	return {
		id: 'r1',
		titel: 'Test',
		beskrivelse: '',
		billedeUrl: null,
		kategorier: ['morgenmad'],
		dietTags: [],
		defaultPortioner: 4,
		ingredienser: [],
		instruktioner: '',
		aktiv: true,
		...overrides
	};
}

describe('skaler', () => {
	it('skalerer mængde proportionalt med portioner', () => {
		expect(skaler(100, 4, 2)).toBe(50);
		expect(skaler(100, 4, 8)).toBe(200);
		expect(skaler(100, 4, 4)).toBe(100);
	});

	it('returnerer base-mængde hvis basePortioner er 0', () => {
		expect(skaler(100, 0, 2)).toBe(100);
	});
});

describe('formaterMaengde', () => {
	it('returnerer heltal uden decimaler', () => {
		expect(formaterMaengde(100)).toBe('100');
		expect(formaterMaengde(0)).toBe('0');
	});

	it('returnerer maks 2 decimaler', () => {
		expect(formaterMaengde(2.5)).toBe('2.5');
		expect(formaterMaengde(1.333333)).toBe('1.33');
	});
});

describe('ingrediensKey', () => {
	it('giver samme nøgle for navne der kun adskiller sig i case og whitespace', () => {
		expect(ingrediensKey('Kylling', 'g')).toBe(ingrediensKey('  kylling ', 'g'));
	});

	it('skelner mellem forskellige enheder', () => {
		expect(ingrediensKey('mælk', 'dl')).not.toBe(ingrediensKey('mælk', 'l'));
	});
});

describe('gaetGruppe', () => {
	it('placerer kød-typer i kød-gruppen', () => {
		expect(gaetGruppe('kyllingebryst')).toBe('kød');
		expect(gaetGruppe('hakket oksekød')).toBe('kød');
		expect(gaetGruppe('laksefilet')).toBe('kød');
	});

	it('placerer grøntsager og frugt i grønt-gruppen', () => {
		expect(gaetGruppe('tomat')).toBe('grønt');
		expect(gaetGruppe('avocado')).toBe('grønt');
		expect(gaetGruppe('frisk persille')).toBe('grønt');
	});

	it('placerer mejeri i mejeri-gruppen', () => {
		expect(gaetGruppe('skyr')).toBe('mejeri');
		expect(gaetGruppe('feta')).toBe('mejeri');
		expect(gaetGruppe('æg')).toBe('mejeri');
	});

	it('placerer kornprodukter og olier i kolonial-gruppen', () => {
		expect(gaetGruppe('havregryn')).toBe('kolonial');
		expect(gaetGruppe('olivenolie')).toBe('kolonial');
		expect(gaetGruppe('mandler')).toBe('kolonial');
	});

	it('placerer forarbejdede grøntsagsprodukter i kolonial, ikke grønt', () => {
		expect(gaetGruppe('tomatpuré')).toBe('kolonial');
		expect(gaetGruppe('hakkede tomater')).toBe('kolonial');
		expect(gaetGruppe('løgpulver')).toBe('kolonial');
	});

	it('placerer frosne varer i frost-gruppen', () => {
		expect(gaetGruppe('frosne bær')).toBe('frost');
		expect(gaetGruppe('frosne grøntsager')).toBe('frost');
	});

	it('returnerer "andet" for ukendte navne', () => {
		expect(gaetGruppe('mystisk vare')).toBe('andet');
	});
});

describe('byggIndkoebsliste', () => {
	const opskrift1 = lavOpskrift({
		id: 'a',
		defaultPortioner: 4,
		ingredienser: [
			{ navn: 'Kylling', maengde: 400, enhed: 'g' },
			{ navn: 'Tomat', maengde: 2, enhed: 'stk' }
		]
	});

	const opskrift2 = lavOpskrift({
		id: 'b',
		defaultPortioner: 2,
		ingredienser: [
			{ navn: 'Kylling', maengde: 200, enhed: 'g' },
			{ navn: 'Salat', maengde: 1, enhed: 'stk' }
		]
	});

	it('bygger liste med ingredienser fra én opskrift med default-portioner', () => {
		const valgte: ValgteOpskrifter = new Map([['a', 4]]);
		const liste = byggIndkoebsliste([opskrift1], valgte);
		expect(liste).toHaveLength(2);
		expect(liste.find((i) => i.navn === 'Kylling')?.maengde).toBe(400);
		expect(liste.find((i) => i.navn === 'Tomat')?.maengde).toBe(2);
	});

	it('skalerer mængder ved valgte portioner', () => {
		const valgte: ValgteOpskrifter = new Map([['a', 2]]);
		const liste = byggIndkoebsliste([opskrift1], valgte);
		expect(liste.find((i) => i.navn === 'Kylling')?.maengde).toBe(200);
		expect(liste.find((i) => i.navn === 'Tomat')?.maengde).toBe(1);
	});

	it('summerer identiske ingredienser fra flere opskrifter (samme enhed)', () => {
		const valgte: ValgteOpskrifter = new Map([
			['a', 4],
			['b', 2]
		]);
		const liste = byggIndkoebsliste([opskrift1, opskrift2], valgte);
		const kylling = liste.find((i) => i.navn === 'Kylling');
		expect(kylling?.maengde).toBe(600);
		expect(kylling?.fraOpskrifter).toEqual(['a', 'b']);
	});

	it('holder ingredienser med forskellige enheder adskilt', () => {
		const opskriftMaelk1 = lavOpskrift({
			id: 'm1',
			defaultPortioner: 2,
			ingredienser: [{ navn: 'Mælk', maengde: 2, enhed: 'dl' }]
		});
		const opskriftMaelk2 = lavOpskrift({
			id: 'm2',
			defaultPortioner: 2,
			ingredienser: [{ navn: 'Mælk', maengde: 1, enhed: 'l' }]
		});
		const valgte: ValgteOpskrifter = new Map([
			['m1', 2],
			['m2', 2]
		]);
		const liste = byggIndkoebsliste([opskriftMaelk1, opskriftMaelk2], valgte);
		expect(liste).toHaveLength(2);
	});

	it('bevarer manuelle varer fra tidligere liste', () => {
		const valgte: ValgteOpskrifter = new Map([['a', 4]]);
		const tidligere = [
			{
				id: 'x',
				navn: 'Toiletpapir',
				maengde: 1,
				enhed: 'pakke',
				gruppe: 'andet' as const,
				tjekket: false,
				manuel: true,
				fraOpskrifter: []
			}
		];
		const liste = byggIndkoebsliste([opskrift1], valgte, tidligere);
		expect(liste.some((i) => i.navn === 'Toiletpapir')).toBe(true);
	});
});

describe('grupperIndkoebsliste', () => {
	it('placerer items i rette butiksgrupper', () => {
		const items = [
			{ id: '1', navn: 'Kylling', maengde: 400, enhed: 'g', gruppe: 'kød' as const, tjekket: false, manuel: false, fraOpskrifter: [] },
			{ id: '2', navn: 'Tomat', maengde: 2, enhed: 'stk', gruppe: 'grønt' as const, tjekket: false, manuel: false, fraOpskrifter: [] }
		];
		const grupper = grupperIndkoebsliste(items);
		expect(grupper.kød).toHaveLength(1);
		expect(grupper.grønt).toHaveLength(1);
		expect(grupper.mejeri).toHaveLength(0);
	});
});

describe('tilfoejManuel', () => {
	it('tilføjer ny manuel vare', () => {
		const liste = tilfoejManuel([], 'Toiletpapir', 1, 'pakke');
		expect(liste).toHaveLength(1);
		expect(liste[0].manuel).toBe(true);
	});

	it('summerer ind i eksisterende ikke-manuel vare med samme navn+enhed', () => {
		const eksisterende = [
			{
				id: '1',
				navn: 'Mælk',
				maengde: 2,
				enhed: 'dl',
				gruppe: 'mejeri' as const,
				tjekket: false,
				manuel: false,
				fraOpskrifter: ['a']
			}
		];
		const liste = tilfoejManuel(eksisterende, 'mælk', 1, 'dl');
		expect(liste).toHaveLength(1);
		expect(liste[0].maengde).toBe(3);
	});

	it('ignorer tomt navn', () => {
		const liste = tilfoejManuel([], '   ', 1, 'stk');
		expect(liste).toHaveLength(0);
	});
});

describe('teksteksport', () => {
	it('genererer formateret tekst med gruppe-overskrifter', () => {
		const items = [
			{ id: '1', navn: 'Kylling', maengde: 400, enhed: 'g', gruppe: 'kød' as const, tjekket: false, manuel: false, fraOpskrifter: [] },
			{ id: '2', navn: 'Tomat', maengde: 2, enhed: 'stk', gruppe: 'grønt' as const, tjekket: false, manuel: false, fraOpskrifter: [] }
		];
		const tekst = teksteksport(items);
		expect(tekst).toContain('INDKØBSLISTE');
		expect(tekst).toContain('GRØNT');
		expect(tekst).toContain('KØD & FISK');
		expect(tekst).toContain('• 400 g Kylling');
		expect(tekst).toContain('• 2 stk Tomat');
	});

	it('udelukker tjekkede varer', () => {
		const items = [
			{ id: '1', navn: 'Kylling', maengde: 400, enhed: 'g', gruppe: 'kød' as const, tjekket: true, manuel: false, fraOpskrifter: [] }
		];
		const tekst = teksteksport(items);
		expect(tekst).not.toContain('Kylling');
	});
});
