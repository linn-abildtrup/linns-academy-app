import { describe, it, expect } from 'vitest';
import {
	kildeAf, maerkatFor, skalBedesOmScanning, maaSesISoegning,
	tilSoegning, maaDeles, hendesVarer, MAERKAT, FORKLARING, type Vare3
} from './fodevareKilde3';

const v = (x: Partial<Vare3>): Vare3 =>
	({ id: 'x', name: 'X', cat: 'andet', p: 1, f: 1, ...x }) as Vare3;

describe('kildeAf', () => {
	it('DTU-tal er databasen', () => expect(kildeAf(v({ kildeType: 'dtu' }))).toBe('database'));
	it('Linns eget tal staar ogsaa som databasen, for det er vores ansvar', () =>
		expect(kildeAf(v({ kildeType: 'linn' }))).toBe('database'));
	it('en scanning er scannet', () => expect(kildeAf(v({ kildeType: 'scannet' }))).toBe('scannet'));
	it('kundens egen vare er hendes eget tal', () =>
		expect(kildeAf(v({ kilde: 'custom' }))).toBe('eget'));
	it('uden noget som helst er kilden ukendt', () => expect(kildeAf(v({}))).toBe('ukendt'));
	it('taaler null', () => expect(kildeAf(null)).toBe('ukendt'));

	it('RETTER HUN I EN SCANNING, ER DET IKKE LAENGERE PAKKENS TAL', () => {
		expect(kildeAf(v({ kildeType: 'scannet', rettetAfKunde: true }))).toBe('eget');
	});
});

describe('maerkatFor', () => {
	it('bruger Linns ord', () => {
		expect(maerkatFor(v({ kildeType: 'dtu' }))).toBe('Fødevaredatabasen');
		expect(maerkatFor(v({ kildeType: 'scannet' }))).toBe('Scannet');
		expect(maerkatFor(v({ kilde: 'custom' }))).toBe('Dit eget tal');
		expect(maerkatFor(v({}))).toBe('Uden kilde');
	});
	it('der er en forklaring til hvert maerkat', () => {
		for (const k of Object.keys(MAERKAT)) {
			expect(FORKLARING[k as keyof typeof FORKLARING]).toBeTruthy();
		}
	});
});

describe('skalBedesOmScanning', () => {
	it('kun naar tallet er uden kilde', () => {
		expect(skalBedesOmScanning(v({}))).toBe(true);
		expect(skalBedesOmScanning(v({ kildeType: 'dtu' }))).toBe(false);
		expect(skalBedesOmScanning(v({ kildeType: 'scannet' }))).toBe(false);
	});
	it('hendes egen vare beder vi ikke om at faa scannet', () => {
		expect(skalBedesOmScanning(v({ kilde: 'custom' }))).toBe(false);
	});
});

describe('maaSesISoegning', () => {
	const ingen = new Set<string>();

	it('en almindelig foedevare ser alle', () => {
		expect(maaSesISoegning(v({ kildeType: 'dtu' }), ingen)).toBe(true);
	});

	it('DUBLETTER FORSVINDER FOR ALLE, ogsaa dem der bruger dem', () => {
		const dublet = v({ id: 'aeg_stort', pegerPaa: 'aeg' });
		expect(maaSesISoegning(dublet, ingen)).toBe(false);
		expect(maaSesISoegning(dublet, new Set(['aeg_stort']))).toBe(false);
	});

	it('en maerkevare ses kun af den der har brugt den', () => {
		const m = v({ id: 'granola', kunKendte: true });
		expect(maaSesISoegning(m, ingen)).toBe(false);
		expect(maaSesISoegning(m, new Set(['granola']))).toBe(true);
	});

	it('en ret opfoerer sig som en maerkevare', () => {
		const r = v({ id: 'frikadelle', kunKendte: true });
		expect(maaSesISoegning(r, new Set(['hummus']))).toBe(false);
		expect(maaSesISoegning(r, new Set(['frikadelle']))).toBe(true);
	});

	it('en scannet vare ses af alle, ogsaa dem der aldrig har brugt den', () => {
		expect(maaSesISoegning(v({ id: 'ny', kildeType: 'scannet' }), ingen)).toBe(true);
	});
});

describe('tilSoegning', () => {
	const liste = [
		v({ id: 'gulerod', kildeType: 'dtu' }),
		v({ id: 'aeg_stort', pegerPaa: 'aeg' }),
		v({ id: 'granola', kunKendte: true }),
		v({ id: 'frikadelle', kunKendte: true })
	];

	it('en ny kunde ser kun det almindelige', () => {
		expect(tilSoegning(liste, new Set()).map((x) => x.id)).toEqual(['gulerod']);
	});

	it('en kunde der har brugt frikadelle beholder den', () => {
		expect(tilSoegning(liste, new Set(['frikadelle'])).map((x) => x.id)).toEqual([
			'gulerod', 'frikadelle'
		]);
	});

	it('men hun faar ikke dubletten tilbage', () => {
		expect(tilSoegning(liste, new Set(['aeg_stort', 'granola'])).map((x) => x.id)).toEqual([
			'gulerod', 'granola'
		]);
	});
});

describe('maaDeles', () => {
	it('en uroert scanning maa deles', () => {
		expect(maaDeles(v({ kildeType: 'scannet' }), true)).toBe(true);
	});
	it('RETTER HUN ET TAL, MAA DEN IKKE DELES', () => {
		expect(maaDeles(v({ kildeType: 'scannet', rettetAfKunde: true }), true)).toBe(false);
	});
	it('haenger tallene ikke sammen, deles den aldrig', () => {
		expect(maaDeles(v({ kildeType: 'scannet' }), false)).toBe(false);
	});
	it('noget hun har skrevet fra bunden deles aldrig', () => {
		expect(maaDeles(v({ kilde: 'custom' }), true)).toBe(false);
	});
});

describe('hendesVarer', () => {
	it('samler de tre steder hun kan have taget en vare i brug', () => {
		const ud = hendesVarer(['a', 'b'], ['b', 'c'], ['d']);
		expect([...ud].sort()).toEqual(['a', 'b', 'c', 'd']);
	});
	it('taaler tomme lister og tomme id', () => {
		expect(hendesVarer([], [''], []).size).toBe(0);
	});
});
