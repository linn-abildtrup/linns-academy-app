import { describe, it, expect } from 'vitest';
import {
	fletHjaelp,
	hjaelpKilder,
	visKildeNavn,
	type HjaelpKilde,
	type KildeIndhold
} from './hjaelp3';
import type { AdgangVilkaar } from './lektionsliste3';
import type { AktivtForlob, GennemfoertForlob } from './adgang3';

function ms(aar: number, maaned: number, dag: number): number {
	return new Date(aar, maaned - 1, dag, 12, 0, 0).getTime();
}

function vilkaar(ekstra: Partial<AdgangVilkaar> = {}): AdgangVilkaar {
	return { harApp: false, bonusSlutMs: null, nu: ms(2026, 8, 18), ...ekstra };
}

function aktivt(id: string, navn: string): AktivtForlob {
	return {
		forlobId: id,
		navn,
		produkt: 'premiumforløb',
		dagNummer: 5,
		antalDage: 21,
		startMs: ms(2026, 8, 1),
		slutMs: ms(2026, 8, 22)
	};
}

function gennemfoert(id: string, navn: string): GennemfoertForlob {
	return { forlobId: id, navn, aar: 2026, slutMs: ms(2026, 3, 21) };
}

describe('hjaelpKilder', () => {
	it('aktive forloeb kommer altid med', () => {
		const k = hjaelpKilder([aktivt('a', 'Kropsro')], [], vilkaar());
		expect(k).toEqual([{ forlobId: 'a', navn: 'Kropsro' }]);
	});

	it('med app-adgang kommer de gennemfoerte ogsaa med', () => {
		const k = hjaelpKilder([], [gennemfoert('b', 'Kickstart')], vilkaar({ harApp: true }));
		expect(k.map((x) => x.forlobId)).toEqual(['b']);
	});

	it('i bonus-perioden kommer de gennemfoerte med', () => {
		const k = hjaelpKilder(
			[],
			[gennemfoert('b', 'Kickstart')],
			vilkaar({ bonusSlutMs: ms(2026, 10, 1) })
		);
		expect(k).toHaveLength(1);
	});

	// Er de 90 dage gaaet, er Linns materiale lukket. Det gaelder ogsaa
	// spoergsmaalene, ikke kun lektionerne.
	it('et forloeb hvor de 90 dage er gaaet kommer ikke med', () => {
		const k = hjaelpKilder([], [gennemfoert('b', 'Kickstart')], vilkaar());
		expect(k).toEqual([]);
	});

	it('det aktive staar foer det gennemfoerte', () => {
		const k = hjaelpKilder(
			[aktivt('a', 'Kropsro')],
			[gennemfoert('b', 'Kickstart')],
			vilkaar({ harApp: true })
		);
		expect(k.map((x) => x.forlobId)).toEqual(['a', 'b']);
	});

	it('samme forloeb staar kun én gang', () => {
		const k = hjaelpKilder(
			[aktivt('a', 'Kropsro')],
			[gennemfoert('a', 'Kropsro gammelt navn')],
			vilkaar({ harApp: true })
		);
		expect(k).toHaveLength(1);
		expect(k[0].navn).toBe('Kropsro');
	});

	it('en kunde uden forloeb har ingen kilder', () => {
		expect(hjaelpKilder([], [], vilkaar({ harApp: true }))).toEqual([]);
	});
});

describe('visKildeNavn', () => {
	it('ét forloeb har ikke brug for et navn', () => {
		expect(visKildeNavn([{ forlobId: 'a', navn: 'Kropsro' }])).toBe(false);
	});

	it('to forloeb skal kunne skelnes', () => {
		expect(
			visKildeNavn([
				{ forlobId: 'a', navn: 'Kropsro' },
				{ forlobId: 'b', navn: 'Kickstart' }
			])
		).toBe(true);
	});

	it('ingen forloeb, intet navn', () => {
		expect(visKildeNavn([])).toBe(false);
	});
});

describe('fletHjaelp', () => {
	interface Post {
		id: string;
		kategoriId: string;
	}

	const kropsro: HjaelpKilde = { forlobId: 'a', navn: 'Kropsro' };
	const kickstart: HjaelpKilde = { forlobId: 'b', navn: 'Kickstart' };

	function indhold(
		kilde: HjaelpKilde,
		kategorier: { id: string; navn: string }[],
		poster: Post[]
	): KildeIndhold<Post> {
		return { kilde, kategorier, poster };
	}

	it('grupperer posterne under deres kategori', () => {
		const g = fletHjaelp(
			[
				indhold(
					kropsro,
					[{ id: 'k1', navn: 'Kost' }],
					[
						{ id: 'p1', kategoriId: 'k1' },
						{ id: 'p2', kategoriId: 'k1' }
					]
				)
			],
			false
		);
		expect(g).toHaveLength(1);
		expect(g[0].kategoriNavn).toBe('Kost');
		expect(g[0].poster.map((p) => p.id)).toEqual(['p1', 'p2']);
	});

	it('en tom kategori kommer ikke med', () => {
		const g = fletHjaelp(
			[
				indhold(
					kropsro,
					[
						{ id: 'k1', navn: 'Kost' },
						{ id: 'k2', navn: 'Tom' }
					],
					[{ id: 'p1', kategoriId: 'k1' }]
				)
			],
			false
		);
		expect(g.map((x) => x.kategoriNavn)).toEqual(['Kost']);
	});

	it('forloebenes raekkefoelge holdes', () => {
		const g = fletHjaelp(
			[
				indhold(kropsro, [{ id: 'k1', navn: 'Kost' }], [{ id: 'p1', kategoriId: 'k1' }]),
				indhold(kickstart, [{ id: 'k1', navn: 'Kost' }], [{ id: 'p2', kategoriId: 'k1' }])
			],
			true
		);
		expect(g.map((x) => x.kildeNavn)).toEqual(['Kropsro', 'Kickstart']);
	});

	// To hold kan have en kategori med samme id. Noeglen skal stadig
	// vaere unik, ellers taber Sveltes each-blok den ene.
	it('to hold med samme kategori-id faar hver sin noegle', () => {
		const g = fletHjaelp(
			[
				indhold(kropsro, [{ id: 'k1', navn: 'Kost' }], [{ id: 'p1', kategoriId: 'k1' }]),
				indhold(kickstart, [{ id: 'k1', navn: 'Kost' }], [{ id: 'p2', kategoriId: 'k1' }])
			],
			true
		);
		expect(new Set(g.map((x) => x.noegle)).size).toBe(2);
	});

	it('holdets navn udelades naar der kun er ét', () => {
		const g = fletHjaelp(
			[indhold(kropsro, [{ id: 'k1', navn: 'Kost' }], [{ id: 'p1', kategoriId: 'k1' }])],
			false
		);
		expect(g[0].kildeNavn).toBe('');
	});

	it('ingen kilder giver ingen grupper', () => {
		expect(fletHjaelp<Post>([], false)).toEqual([]);
	});
});
