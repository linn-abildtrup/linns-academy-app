import { describe, it, expect } from 'vitest';
import {
	mineFavoritter,
	tilHylden,
	fjernOrd,
	fjernTitel,
	fjernForklaring,
	favoritLinje,
	handlingFor,
	FLISER_PAA_HYLDEN,
	type FavoritRaekke
} from './mineFavoritter3';
import type { Fodevare } from './kost';
import type { Vare3 } from './fodevareKilde3';

function f(id: string, name: string, ekstra: Partial<Vare3> = {}): Fodevare {
	return { id, name, cat: 'andet', p: 10, f: 0, ...ekstra } as Fodevare;
}

function kort(...varer: Fodevare[]): Map<string, Fodevare> {
	return new Map(varer.map((v) => [v.id, v]));
}

describe('mineFavoritter', () => {
	it('samler de tre grupper til én liste, sorteret paa navn', () => {
		const egen = f('e1', 'Mors rugbrød', { kilde: 'custom' });
		const scan = f('s1', 'Groft Knækbrød', { kildeType: 'scannet' });
		const hjertet = f('h1', 'Kefir, naturel', { kildeType: 'dtu' });
		const r = mineFavoritter({
			hjerter: ['h1'],
			egne: [egen],
			scannedeAfHende: ['s1'],
			foods: kort(egen, scan, hjertet)
		});
		expect(r.map((x) => x.vare.name)).toEqual(['Groft Knækbrød', 'Kefir, naturel', 'Mors rugbrød']);
		expect(r.map((x) => x.grund)).toEqual(['scanning', 'hjerte', 'egen']);
	});

	it('sorterer med dansk alfabet, saa aa oe og aa kommer sidst', () => {
		const varer = [f('1', 'Ærter'), f('2', 'Agurk'), f('3', 'Øl'), f('4', 'Ål'), f('5', 'Blomkål')];
		const r = mineFavoritter({ hjerter: [], egne: varer, foods: kort(...varer) });
		expect(r.map((x) => x.vare.name)).toEqual(['Agurk', 'Blomkål', 'Ærter', 'Øl', 'Ål']);
	});

	// Reglen fra hjerteFodevare3 og fodevareSoeg3. De tre skal blive ved
	// med at vaere enige, ellers staar hendes egne varer to gange.
	it('holder hendes egne UDE af hjerte-gruppen, saa de ikke staar to gange', () => {
		const egen = f('e1', 'Mors rugbrød', { kilde: 'custom' });
		const r = mineFavoritter({
			// Den gamle app satte hjertet automatisk paa hendes egne varer.
			hjerter: ['e1'],
			egne: [egen],
			foods: kort(egen)
		});
		expect(r).toHaveLength(1);
		expect(r[0].grund).toBe('egen');
	});

	it('kilden staar paa hver raekke', () => {
		const a = f('1', 'Kefir', { kildeType: 'dtu' });
		const b = f('2', 'Knækbrød', { kildeType: 'scannet' });
		const c = f('3', 'Mors rugbrød', { kilde: 'custom' });
		const r = mineFavoritter({ hjerter: ['1'], egne: [c], scannedeAfHende: ['2'], foods: kort(a, b, c) });
		expect(r.map((x) => x.kilde)).toEqual(['database', 'scannet', 'eget']);
	});

	it('springer en vare over der ikke findes laengere', () => {
		const a = f('1', 'Kefir');
		const r = mineFavoritter({ hjerter: ['1', 'findes-ikke'], egne: [], foods: kort(a) });
		expect(r).toHaveLength(1);
	});

	it('taaler tomt hele vejen igennem', () => {
		expect(mineFavoritter({ hjerter: [], egne: [], foods: new Map() })).toEqual([]);
		expect(mineFavoritter({ hjerter: [], egne: [], scannedeAfHende: [], foods: new Map() })).toEqual([]);
	});

	it('viser ikke den samme vare to gange, ogsaa hvis den staar begge steder', () => {
		const scan = f('s1', 'Knækbrød', { kildeType: 'scannet' });
		const r = mineFavoritter({
			// Hun har baade scannet den OG trykket hjerte paa den.
			hjerter: ['s1'],
			egne: [],
			scannedeAfHende: ['s1'],
			foods: kort(scan)
		});
		expect(r).toHaveLength(1);
		expect(r[0].grund).toBe('scanning');
	});
});

describe('handlingFor', () => {
	// TRE svar, ikke to. Et hjerte slaas fra og varen bliver for alle.
	// Hendes egen slettes, for den findes ikke andre steder. En scanning
	// er DELT, saa den maa hverken slettes eller skjules.
	it('giver fjern paa hjertet, slet paa hendes egen og ingen paa en scanning', () => {
		expect(handlingFor('hjerte')).toBe('fjern');
		expect(handlingFor('egen')).toBe('slet');
		expect(handlingFor('scanning')).toBe('ingen');
	});

	it('staar rigtigt paa raekkerne i en rigtig liste', () => {
		const h = f('h', 'Kefir');
		const e = f('e', 'Mors rugbrød', { kilde: 'custom' });
		const s = f('s', 'Knækbrød', { kildeType: 'scannet' });
		const r = mineFavoritter({ hjerter: ['h'], egne: [e], scannedeAfHende: ['s'], foods: kort(h, e, s) });
		const ved = (navn: string) => r.find((x) => x.vare.name === navn)!;
		expect(ved('Kefir').handling).toBe('fjern');
		expect(ved('Mors rugbrød').handling).toBe('slet');
		expect(ved('Knækbrød').handling).toBe('ingen');
	});
});

describe('ordene paa krydset', () => {
	const raekke = (kanFjernes: boolean): FavoritRaekke => ({
		vare: f('1', 'Kefir') as Vare3,
		grund: kanFjernes ? 'hjerte' : 'egen',
		kilde: 'database',
		handling: kanFjernes ? 'fjern' : 'slet'
	});

	it('siger Fjern paa et hjerte og Slet paa hendes egen', () => {
		expect(fjernOrd(raekke(true))).toBe('Fjern');
		expect(fjernOrd(raekke(false))).toBe('Slet');
	});

	it('spoergsmaalet naevner varens navn', () => {
		expect(fjernTitel(raekke(true))).toBe('Fjern Kefir fra dine favoritter?');
		expect(fjernTitel(raekke(false))).toBe('Slet Kefir?');
	});

	// Det er dét hun er bange for, og det er sandt: makroen fryses ind i
	// maaltidet naar hun gemmer.
	it('begge forklaringer lover at det registrerede bliver staaende', () => {
		expect(fjernForklaring(raekke(true))).toContain('bliver stående');
		expect(fjernForklaring(raekke(false))).toContain('bliver stående');
	});

	it('kun hendes egen siger at varen forsvinder helt', () => {
		expect(fjernForklaring(raekke(false))).toContain('forsvinder helt');
		expect(fjernForklaring(raekke(true))).not.toContain('forsvinder helt');
	});
});

describe('tilHylden', () => {
	const mange = (n: number) =>
		mineFavoritter({
			hjerter: [],
			egne: Array.from({ length: n }, (_, i) => f(`${i}`, `Vare ${String(i).padStart(2, '0')}`)),
			foods: new Map()
		});

	it('viser fire som standard', () => {
		expect(tilHylden(mange(20))).toHaveLength(FLISER_PAA_HYLDEN);
		expect(FLISER_PAA_HYLDEN).toBe(4);
	});

	it('viser dem der er, naar der er faerre end fire', () => {
		expect(tilHylden(mange(2))).toHaveLength(2);
		expect(tilHylden(mange(0))).toHaveLength(0);
	});

	it('tager de foerste i listens egen raekkefoelge', () => {
		expect(tilHylden(mange(10)).map((r) => r.vare.name)).toEqual([
			'Vare 00',
			'Vare 01',
			'Vare 02',
			'Vare 03'
		]);
	});
});

describe('favoritLinje', () => {
	it('inviterer naar varen ikke ligger der', () => {
		expect(favoritLinje({ erFavorit: false, altidPaaListen: false })).toEqual({
			tekst: 'Gem i dine favoritter',
			kanTrykkes: true
		});
	});

	it('bekraefter naar hun har trykket', () => {
		expect(favoritLinje({ erFavorit: true, altidPaaListen: false })).toEqual({
			tekst: 'Gemt i dine favoritter',
			kanTrykkes: true
		});
	});

	// Hendes egne og hendes scanninger ligger der altid, saa linjen er
	// ikke en knap. Der er ikke noget at slaa fra.
	it('er ikke en knap paa hendes egne og hendes scanninger', () => {
		expect(favoritLinje({ erFavorit: true, altidPaaListen: true })).toEqual({
			tekst: 'Ligger i dine favoritter',
			kanTrykkes: false
		});
		expect(favoritLinje({ erFavorit: false, altidPaaListen: true }).kanTrykkes).toBe(false);
	});
});

// ============================================================
// Den vigtigste test i filen. Se kommentaren i toppen af
// mineFavoritter3.ts om hvorfor listen aldrig maa skrives.
// ============================================================
describe('listen regnes ud og skrives ALDRIG', () => {
	it('roerer ikke hjerte-listen naar hendes egne og scanninger kommer med', () => {
		const hjerter = ['h1'];
		const egen = f('e1', 'Mors rugbrød', { kilde: 'custom' });
		const scan = f('s1', 'Knækbrød', { kildeType: 'scannet' });
		const hjertet = f('h1', 'Kefir');

		const r = mineFavoritter({
			hjerter,
			egne: [egen],
			scannedeAfHende: ['s1'],
			foods: kort(egen, scan, hjertet)
		});

		// Tre raekker paa skaermen, men KUN ét hjerte i hendes data.
		expect(r).toHaveLength(3);
		expect(hjerter).toEqual(['h1']);
	});

	it('giver det samme svar hver gang, saa den kan kaldes frit', () => {
		const egen = f('e1', 'Mors rugbrød', { kilde: 'custom' });
		const args = { hjerter: ['h1'], egne: [egen], foods: kort(egen, f('h1', 'Kefir')) };
		expect(mineFavoritter(args)).toEqual(mineFavoritter(args));
	});
});
