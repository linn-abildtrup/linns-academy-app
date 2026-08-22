import { describe, expect, it } from 'vitest';
import {
	MAKS_SKRIDT3,
	MAKS_TEGN3,
	egetSkridtFejl3,
	erValgt3,
	fjernSkridt3,
	grupperForslag3,
	kanVaelgeFlere3,
	opsummering3,
	skiftForslag3,
	tilbageTekst3,
	tilfoejEget3,
	type Forslag3,
	type ValgtSkridt3
} from './vaelgSkridt3';

const f = (id: string, label: string, kategori: string): Forslag3 => ({ id, label, kategori });
const v = (id: string, label: string, kilde: 'kurateret' | 'egen' = 'kurateret'): ValgtSkridt3 => ({
	id,
	label,
	kilde
});

describe('grupperForslag3', () => {
	it('samler forslag under deres kategori', () => {
		const g = grupperForslag3([f('a', 'A', 'Mad'), f('b', 'B', 'Ro'), f('c', 'C', 'Mad')]);
		expect(g.map((k) => k.navn)).toEqual(['Mad', 'Ro']);
		expect(g[0].forslag.map((x) => x.id)).toEqual(['a', 'c']);
	});

	it('bevarer Linns raekkefoelge, ikke alfabetisk', () => {
		const g = grupperForslag3([f('a', 'A', 'Soevn'), f('b', 'B', 'Bevaegelse')]);
		expect(g.map((k) => k.navn)).toEqual(['Soevn', 'Bevaegelse']);
	});

	it('et forslag uden kategori havner i Andet, og Andet ligger sidst', () => {
		const g = grupperForslag3([f('a', 'A', ''), f('b', 'B', 'Mad')]);
		expect(g.map((k) => k.navn)).toEqual(['Mad', 'Andet']);
		expect(g[1].forslag.map((x) => x.id)).toEqual(['a']);
	});

	it('tom liste giver ingen kategorier', () => {
		expect(grupperForslag3([])).toEqual([]);
	});
});

describe('kanVaelgeFlere3', () => {
	it('der er plads under graensen', () => {
		expect(kanVaelgeFlere3([v('a', 'A'), v('b', 'B')])).toBe(true);
	});

	it('der er ikke plads ved graensen', () => {
		expect(kanVaelgeFlere3([v('a', 'A'), v('b', 'B'), v('c', 'C')])).toBe(false);
	});
});

describe('skiftForslag3', () => {
	it('vaelger et forslag der ikke var valgt', () => {
		const ud = skiftForslag3([], f('a', 'Protein', 'Mad'));
		expect(ud).toEqual([{ id: 'a', label: 'Protein', kilde: 'kurateret' }]);
	});

	it('fravaelger et der var valgt', () => {
		expect(skiftForslag3([v('a', 'Protein')], f('a', 'Protein', 'Mad'))).toEqual([]);
	});

	it('goer ingenting naar der allerede er tre', () => {
		const tre = [v('a', 'A'), v('b', 'B'), v('c', 'C')];
		expect(skiftForslag3(tre, f('d', 'D', 'Mad'))).toBe(tre);
	});

	it('et valgt skridt kan altid fravaelges, ogsaa naar der er tre', () => {
		const tre = [v('a', 'A'), v('b', 'B'), v('c', 'C')];
		expect(skiftForslag3(tre, f('b', 'B', 'Mad')).map((x) => x.id)).toEqual(['a', 'c']);
	});

	it('skubber aldrig et andet skridt ud for at goere plads', () => {
		const tre = [v('a', 'A'), v('b', 'B'), v('c', 'C')];
		expect(skiftForslag3(tre, f('d', 'D', 'Mad')).length).toBe(MAKS_SKRIDT3);
	});
});

describe('erValgt3 og fjernSkridt3', () => {
	it('kender et valgt forslag', () => {
		expect(erValgt3([v('a', 'A')], 'a')).toBe(true);
		expect(erValgt3([v('a', 'A')], 'b')).toBe(false);
	});

	it('fjerner baade Linns og hendes eget', () => {
		const to = [v('a', 'A'), v('eg-1', 'Mit', 'egen')];
		expect(fjernSkridt3(to, 'eg-1').map((x) => x.id)).toEqual(['a']);
	});
});

describe('egetSkridtFejl3', () => {
	it('tom tekst er en fejl', () => {
		expect(egetSkridtFejl3('   ', [])).toBeTruthy();
	});

	it('for lang tekst er en fejl', () => {
		expect(egetSkridtFejl3('x'.repeat(MAKS_TEGN3 + 1), [])).toBeTruthy();
	});

	it('praecis paa graensen er i orden', () => {
		expect(egetSkridtFejl3('x'.repeat(MAKS_TEGN3), [])).toBeNull();
	});

	it('samme tekst to gange er en fejl, ogsaa med andre store bogstaver', () => {
		expect(egetSkridtFejl3('  drik VAND  ', [v('a', 'Drik vand', 'egen')])).toBeTruthy();
	});

	it('fejler naar der allerede er tre', () => {
		expect(egetSkridtFejl3('Noget nyt', [v('a', 'A'), v('b', 'B'), v('c', 'C')])).toBeTruthy();
	});

	it('en almindelig ny tekst er i orden', () => {
		expect(egetSkridtFejl3('Drik vand før kaffe', [v('a', 'A')])).toBeNull();
	});
});

describe('tilfoejEget3', () => {
	it('laegger skridtet til med hendes eget id og trimmet tekst', () => {
		expect(tilfoejEget3([], 'eg-1', '  Drik vand  ')).toEqual([
			{ id: 'eg-1', label: 'Drik vand', kilde: 'egen' }
		]);
	});

	it('goer ingenting naar teksten ikke kan bruges', () => {
		const foer: ValgtSkridt3[] = [];
		expect(tilfoejEget3(foer, 'eg-1', '   ')).toBe(foer);
	});
});

describe('opsummering3', () => {
	it('uden valg opfordrer den til at vaelge', () => {
		expect(opsummering3([]).titel).toBe('Vælg op til tre');
	});

	it('skriver antallet med ord og listen med tekst', () => {
		const o = opsummering3([v('a', 'Protein'), v('b', 'Gå en tur')]);
		expect(o.titel).toBe('To valgt');
		expect(o.under).toBe('Protein, Gå en tur');
	});

	it('tre valgte hedder Tre', () => {
		expect(opsummering3([v('a', 'A'), v('b', 'B'), v('c', 'C')]).titel).toBe('Tre valgt');
	});
});

describe('tilbageTekst3', () => {
	it('siger ingenting naar der er plads', () => {
		expect(tilbageTekst3([v('a', 'A')])).toBe('');
	});

	it('forklarer sig naar der er tre', () => {
		expect(tilbageTekst3([v('a', 'A'), v('b', 'B'), v('c', 'C')])).toContain('fjern et først');
	});
});
