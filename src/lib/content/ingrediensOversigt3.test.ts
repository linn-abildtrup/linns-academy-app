import { describe, it, expect } from 'vitest';
import {
	byggOversigt,
	filtrerOversigt,
	opgoerelse,
	kildeTekst,
	type OversigtOpskrift
} from './ingrediensOversigt3';
import type { Fodevare } from './kost';
import type { KoblingsOpslag } from './opskriftMakro3';

function vare(id: string, name: string, ekstra: Partial<Fodevare> = {}): Fodevare {
	return {
		id,
		name,
		cat: 'andet',
		p: 10,
		f: 2,
		kh: 5,
		fedt: 3,
		kcal: 100,
		...ekstra
	} as Fodevare;
}

function opskrift(
	id: string,
	titel: string,
	kategorier: OversigtOpskrift['kategorier'],
	navne: string[]
): OversigtOpskrift {
	return { id, titel, kategorier, ingredienser: navne.map((navn) => ({ navn })) };
}

const varer = new Map<string, Fodevare>([
	['f1', vare('f1', 'Olivenolie', { p: 0, f: 0, kh: 0, fedt: 100, kcal: 884 })],
	['f2', vare('f2', 'Kyllingebryst', { p: 23, f: 0, kh: 0, fedt: 1.5, kcal: 110 })],
	['f3', vare('f3', 'Vare uden kalorier', { kcal: undefined })]
]);

describe('byggOversigt', () => {
	it('samler de skrevne varianter til én raekke pr kernenavn', () => {
		const o = [
			opskrift('o1', 'Ret A', ['frokost'], ['olivenolie', 'Olivenolie']),
			opskrift('o2', 'Ret B', ['aftensmad'], ['olivenolie'])
		];
		const r = byggOversigt(o, { olivenolie: { foodId: 'f1' } }, varer);
		expect(r).toHaveLength(1);
		expect(r[0].kerne).toBe('olivenolie');
		expect(r[0].antalLinjer).toBe(3);
		expect(r[0].antalOpskrifter).toBe(2);
	});

	it('samler madtyperne fra alle de opskrifter der bruger den', () => {
		const o = [
			opskrift('o1', 'Ret A', ['morgenmad'], ['olivenolie']),
			opskrift('o2', 'Ret B', ['aftensmad'], ['olivenolie'])
		];
		const r = byggOversigt(o, { olivenolie: { foodId: 'f1' } }, varer);
		expect(r[0].kategorier.sort()).toEqual(['aftensmad', 'morgenmad']);
	});

	it('tager naeringstallene fra foedevaren', () => {
		const o = [opskrift('o1', 'Ret A', ['frokost'], ['olivenolie'])];
		const r = byggOversigt(o, { olivenolie: { foodId: 'f1' } }, varer);
		expect(r[0].naering).toEqual({ protein: 0, fiber: 0, kh: 0, fedt: 100, kalorier: 884 });
		expect(r[0].fejl).toBeNull();
	});

	it('siger ingen kobling i stedet for at vise nul', () => {
		const o = [opskrift('o1', 'Ret A', ['frokost'], ['jordskok'])];
		const r = byggOversigt(o, {}, varer);
		expect(r[0].naering).toBeNull();
		expect(r[0].fejl).toBe('ingen kobling');
	});

	it('siger til naar den koblede vare ikke findes mere', () => {
		const o = [opskrift('o1', 'Ret A', ['frokost'], ['jordskok'])];
		const r = byggOversigt(o, { jordskok: { foodId: 'findes-ikke' } }, varer);
		expect(r[0].fejl).toBe('varen findes ikke');
	});

	it('markerer manglende kalorietal, men beholder protein og fiber', () => {
		const o = [opskrift('o1', 'Ret A', ['frokost'], ['jordskok'])];
		const r = byggOversigt(o, { jordskok: { foodId: 'f3' } }, varer);
		expect(r[0].fejl).toBe('mangler kalorier');
		expect(r[0].naering?.protein).toBe(10);
		expect(r[0].naering?.kalorier).toBeNull();
	});

	it('lader egne tal vinde over foedevaren', () => {
		const kob: Record<string, KoblingsOpslag> = {
			oerred: {
				foodId: 'f2',
				egenVare: { navn: 'Ørred', p: 20, f: 0, kh: 0, fedt: 6, kcal: 140, kilde: 'USDA 2026' }
			}
		};
		const o = [opskrift('o1', 'Ret A', ['aftensmad'], ['ørred'])];
		const r = byggOversigt(o, kob, varer);
		expect(r[0].egneTal).toBe(true);
		expect(r[0].naering?.protein).toBe(20);
		expect(r[0].kilde).toBe('USDA 2026');
	});

	it('holder toer og kogt adskilt, for tallene er fire gange fra hinanden', () => {
		const o = [
			opskrift('o1', 'A', ['aftensmad'], ['tørrede grønne linser']),
			opskrift('o2', 'B', ['aftensmad'], ['grønne linser, afdryppede'])
		];
		const r = byggOversigt(o, {}, varer);
		expect(r.length).toBeGreaterThan(1);
	});

	it('tager salt og peber helt ud, de er ikke en mangel', () => {
		const o = [opskrift('o1', 'A', ['frokost'], ['salt', 'peber', 'olivenolie'])];
		const r = byggOversigt(o, { olivenolie: { foodId: 'f1' } }, varer);
		expect(r.map((x) => x.kerne)).toEqual(['olivenolie']);
	});

	it('giver hver raekke id paa de opskrifter den bruges i, saa der kan linkes ind', () => {
		const o = [
			opskrift('o1', 'Ret A', ['frokost'], ['olivenolie']),
			opskrift('o2', 'Ret B', ['frokost'], ['olivenolie'])
		];
		const r = byggOversigt(o, { olivenolie: { foodId: 'f1' } }, varer);
		expect(r[0].opskrifter).toEqual([
			{ id: 'o1', titel: 'Ret A' },
			{ id: 'o2', titel: 'Ret B' }
		]);
	});

	it('taeller den samme opskrift én gang, ogsaa naar ingrediensen staar to steder i den', () => {
		const o = [opskrift('o1', 'Ret A', ['frokost'], ['olivenolie', 'olivenolie'])];
		const r = byggOversigt(o, { olivenolie: { foodId: 'f1' } }, varer);
		expect(r[0].antalLinjer).toBe(2);
		expect(r[0].opskrifter).toHaveLength(1);
	});

	it('lister de hyppigste foerst', () => {
		const o = [
			opskrift('o1', 'A', ['frokost'], ['olivenolie', 'kyllingebryst']),
			opskrift('o2', 'B', ['frokost'], ['olivenolie'])
		];
		const r = byggOversigt(o, {}, varer);
		expect(r[0].kerne).toBe('olivenolie');
	});
});

describe('filtrerOversigt', () => {
	const o = [
		opskrift('o1', 'Ret A', ['morgenmad'], ['havregryn']),
		opskrift('o2', 'Ret B', ['aftensmad'], ['kyllingefilet'])
	];
	const r = byggOversigt(o, { kyllingefilet: { foodId: 'f2' } }, varer);

	it('viser alt naar der ikke er valgt noget', () => {
		expect(filtrerOversigt(r, '', [])).toHaveLength(2);
	});

	it('filtrerer paa madtype', () => {
		const ud = filtrerOversigt(r, '', ['morgenmad']);
		expect(ud).toHaveLength(1);
		// Bemaerk 'toer'. Tilstanden staar PAA kernenavnet, se ingrediensNavn3.
		// Toerre havregryn og kogte er to forskellige varer med tal der ligger
		// langt fra hinanden, saa de maa aldrig samles til én raekke.
		expect(ud[0].kerne).toBe('havregryn toer');
	});

	it('soeger ogsaa i madvarens navn og ikke kun i ingrediensens', () => {
		const ud = filtrerOversigt(r, 'kyllingebryst', []);
		expect(ud).toHaveLength(1);
		expect(ud[0].kerne).toBe('kyllingefilet');
	});

	it('kan soeges uden danske bogstaver', () => {
		const med = byggOversigt([opskrift('o1', 'A', ['frokost'], ['ærter'])], {}, varer);
		expect(filtrerOversigt(med, 'aerter', [])).toHaveLength(1);
	});

	it('flere ord skal alle findes, uanset raekkefoelge', () => {
		expect(filtrerOversigt(r, 'havregryn toer', [])).toHaveLength(1);
		expect(filtrerOversigt(r, 'toer havregryn', [])).toHaveLength(1);
		expect(filtrerOversigt(r, 'havregryn kylling', [])).toHaveLength(0);
	});

	it('kan vise kun dem der mangler noget', () => {
		const ud = filtrerOversigt(r, '', [], true);
		expect(ud.every((x) => x.fejl !== null)).toBe(true);
		expect(ud.map((x) => x.kerne)).toContain('havregryn toer');
	});

	it('madtype og soegning virker sammen', () => {
		expect(filtrerOversigt(r, 'havregryn', ['aftensmad'])).toHaveLength(0);
		expect(filtrerOversigt(r, 'havregryn', ['morgenmad'])).toHaveLength(1);
	});
});

describe('opgoerelse', () => {
	it('taeller de fire tilstande', () => {
		const o = [opskrift('o1', 'A', ['frokost'], ['olivenolie', 'jordskok'])];
		const r = byggOversigt(o, { olivenolie: { foodId: 'f1' } }, varer);
		const t = opgoerelse(r);
		expect(t.ialt).toBe(2);
		expect(t.medTal).toBe(1);
		expect(t.udenKobling).toBe(1);
	});
});

describe('kildeTekst', () => {
	it('siger DTU naar tallet kommer derfra', () => {
		expect(kildeTekst({ ...vare('f1', 'X'), kildeType: 'dtu' }, false)).toContain('DTU');
	});

	it('bruger den skrevne kilde naar tallet er sat i haanden', () => {
		expect(kildeTekst(null, true, 'USDA 2026')).toBe('USDA 2026');
	});

	it('siger noget naar en egen kilde er tom, i stedet for ingenting', () => {
		expect(kildeTekst(null, true, '  ')).toBe('Sat i hånden');
	});
});
