import { describe, it, expect } from 'vitest';
import { medScannede } from './scannedeVarer3';
import type { Fodevare } from '$lib/content/kost';
import type { Vare3 } from '$lib/content/fodevareKilde3';

const f = (id: string, name = id): Fodevare => ({ id, name, cat: 'andet', p: 1, f: 0 }) as Fodevare;
const s = (id: string, x: Partial<Vare3> = {}): Vare3 =>
	({ id, name: id, cat: 'andet', p: 1, f: 0, kildeType: 'scannet', ...x }) as Vare3;

describe('medScannede', () => {
	it('laegger de scannede oveni den faelles liste', () => {
		expect(medScannede([f('gulerod')], [s('bc_123')]).map((x) => x.id)).toEqual([
			'gulerod', 'bc_123'
		]);
	});

	it('DEN FAELLES LISTE VINDER, saa en scanning ikke kan skygge for en raavare', () => {
		const ud = medScannede([f('gulerod', 'Gulerod')], [s('gulerod', { name: 'Noget andet' })]);
		expect(ud).toHaveLength(1);
		expect(ud[0].name).toBe('Gulerod');
	});

	it('en vare Linn har fjernet kommer ikke med', () => {
		const ud = medScannede([], [s('bc_1'), { ...s('bc_2'), fjernet: true } as Vare3]);
		expect(ud.map((x) => x.id)).toEqual(['bc_1']);
	});

	it('taaler tomme lister', () => {
		expect(medScannede([], [])).toEqual([]);
	});
});
