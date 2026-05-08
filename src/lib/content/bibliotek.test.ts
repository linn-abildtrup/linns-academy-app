import { describe, it, expect } from 'vitest';
import {
	sorterKategorier,
	sorterItems,
	kunUdgivne,
	grupperEfterKategori,
	naesteOrden
} from './bibliotek';

describe('sorterKategorier', () => {
	it('sorterer efter orden først', () => {
		const ud = sorterKategorier([
			{ navn: 'B', orden: 2 },
			{ navn: 'A', orden: 1 },
			{ navn: 'C', orden: 3 }
		]);
		expect(ud.map((k) => k.navn)).toEqual(['A', 'B', 'C']);
	});

	it('falder tilbage til alfabetisk dansk sortering ved samme orden', () => {
		const ud = sorterKategorier([
			{ navn: 'Æbler', orden: 0 },
			{ navn: 'Agurker', orden: 0 },
			{ navn: 'Bananer', orden: 0 }
		]);
		expect(ud.map((k) => k.navn)).toEqual(['Agurker', 'Bananer', 'Æbler']);
	});

	it('muterer ikke input-arrayet', () => {
		const input = [
			{ navn: 'B', orden: 2 },
			{ navn: 'A', orden: 1 }
		];
		sorterKategorier(input);
		expect(input.map((k) => k.navn)).toEqual(['B', 'A']);
	});
});

describe('sorterItems', () => {
	it('sorterer efter orden', () => {
		const ud = sorterItems([{ orden: 3 }, { orden: 1 }, { orden: 2 }]);
		expect(ud.map((i) => i.orden)).toEqual([1, 2, 3]);
	});

	it('bevarer rækkefølge ved samme orden (stabil)', () => {
		const ud = sorterItems([
			{ orden: 1, id: 'a' },
			{ orden: 1, id: 'b' },
			{ orden: 1, id: 'c' }
		]);
		expect(ud.map((i) => i.id)).toEqual(['a', 'b', 'c']);
	});
});

describe('kunUdgivne', () => {
	it('filtrerer kladder fra', () => {
		const ud = kunUdgivne([
			{ id: 1, udgivet: true },
			{ id: 2, udgivet: false },
			{ id: 3, udgivet: true }
		]);
		expect(ud.map((i) => i.id)).toEqual([1, 3]);
	});

	it('returnerer tom liste hvis intet er udgivet', () => {
		expect(kunUdgivne([{ udgivet: false }, { udgivet: false }])).toEqual([]);
	});
});

describe('grupperEfterKategori', () => {
	it('grupperer items efter kategoriId', () => {
		const ud = grupperEfterKategori([
			{ id: 1, kategoriId: 'a' },
			{ id: 2, kategoriId: 'b' },
			{ id: 3, kategoriId: 'a' }
		]);
		expect(ud).toEqual({
			a: [
				{ id: 1, kategoriId: 'a' },
				{ id: 3, kategoriId: 'a' }
			],
			b: [{ id: 2, kategoriId: 'b' }]
		});
	});

	it('returnerer tomt objekt for tom liste', () => {
		expect(grupperEfterKategori([])).toEqual({});
	});
});

describe('naesteOrden', () => {
	it('returnerer 0 for tom liste', () => {
		expect(naesteOrden([])).toBe(0);
	});

	it('returnerer max+1', () => {
		expect(naesteOrden([{ orden: 0 }, { orden: 5 }, { orden: 2 }])).toBe(6);
	});
});
