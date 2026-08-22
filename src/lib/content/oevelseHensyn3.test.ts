import { describe, it, expect } from 'vitest';
import {
	FORSLAG3,
	HENSYN3,
	MIN_OEVELSER3,
	erGyldigtHensyn3,
	filtrerPaaHensyn3,
	hensynFor3,
	nokTilbage3,
	tilbageEfterHensyn3
} from './oevelseHensyn3';

const o = (id: string) => ({ id });
const kort = { a: ['knae'], b: ['ryg'], c: ['knae', 'ryg'], d: [] };
const alle = [o('a'), o('b'), o('c'), o('d'), o('e')];

describe('HENSYN3', () => {
	it('er de seks Linn valgte', () => {
		expect(HENSYN3.map((h) => h.id)).toEqual([
			'knae',
			'ryg',
			'skulder',
			'baekkenbund',
			'gulv',
			'larm'
		]);
	});

	// Tilfoejet 22. august. Den vigtigste for maalgruppen, kvinder fra 40
	// og opefter, og den blev glemt i foerste omgang.
	it('baekkenbund er med', () => {
		expect(HENSYN3.some((h) => h.id === 'baekkenbund')).toBe(true);
	});

	it('har baade et kunde-navn og et admin-navn', () => {
		for (const h of HENSYN3) {
			expect(h.navn.length).toBeGreaterThan(0);
			expect(h.adminNavn.length).toBeGreaterThan(0);
		}
	});
});

describe('hensynFor3', () => {
	it('giver maerkerne paa oevelsen', () => {
		expect(hensynFor3(kort, 'c')).toEqual(['knae', 'ryg']);
	});

	it('giver tom liste for en oevelse uden maerker', () => {
		expect(hensynFor3(kort, 'e')).toEqual([]);
	});

	// Bliver et hensyn fjernet en dag, maa gamle maerker ikke spoege.
	it('springer maerker over som ikke findes', () => {
		expect(hensynFor3({ a: ['knae', 'noget-vi-ikke-kender'] }, 'a')).toEqual(['knae']);
	});
});

describe('filtrerPaaHensyn3', () => {
	it('uden valg kommer alle med', () => {
		expect(filtrerPaaHensyn3(alle, kort, [])).toHaveLength(5);
	});

	it('fjerner dem der er haarde ved knaeene', () => {
		expect(filtrerPaaHensyn3(alle, kort, ['knae']).map((x) => x.id)).toEqual(['b', 'd', 'e']);
	});

	// Beder hun om at skaane baade knae og ryg, skal begge respekteres.
	it('to hensyn paa én gang fjerner begge slags', () => {
		expect(filtrerPaaHensyn3(alle, kort, ['knae', 'ryg']).map((x) => x.id)).toEqual(['d', 'e']);
	});

	// Hellere en oevelse for meget end et program der pludselig er tomt.
	it('en oevelse uden maerker kommer altid med', () => {
		const alleHensyn = HENSYN3.map((h) => h.id);
		expect(filtrerPaaHensyn3(alle, kort, alleHensyn).map((x) => x.id)).toEqual(['d', 'e']);
	});
});

describe('tilbageEfterHensyn3', () => {
	it('taeller hvor mange der er tilbage pr hensyn', () => {
		const r = tilbageEfterHensyn3(alle, kort);
		expect(r.find((x) => x.hensyn.id === 'knae')?.tilbage).toBe(3);
		expect(r.find((x) => x.hensyn.id === 'ryg')?.tilbage).toBe(3);
		expect(r.find((x) => x.hensyn.id === 'skulder')?.tilbage).toBe(5);
	});

	it('svarer paa alle hensyn der findes', () => {
		expect(tilbageEfterHensyn3(alle, kort)).toHaveLength(HENSYN3.length);
	});
});

describe('nokTilbage3', () => {
	it('otte er nok', () => {
		expect(nokTilbage3(MIN_OEVELSER3)).toBe(true);
	});

	it('syv er for faa', () => {
		expect(nokTilbage3(MIN_OEVELSER3 - 1)).toBe(false);
	});
});

describe('FORSLAG3', () => {
	it('bruger kun hensyn der findes', () => {
		for (const [id, maerker] of Object.entries(FORSLAG3)) {
			for (const m of maerker) {
				expect(erGyldigtHensyn3(m), `${id} har ukendt maerke ${m}`).toBe(true);
			}
		}
	});

	// Glute bridge foregaar paa gulvet men er noget af det mest
	// knaevenlige der findes. Den skal IKKE vaere knae-tung.
	it('glute bridge er gulv og ikke knae', () => {
		expect(FORSLAG3.glute_bridge).toEqual(['gulv']);
	});

	it('planken belaster baade skuldre og kraever gulvet', () => {
		expect(FORSLAG3.planke).toEqual(['skulder', 'gulv']);
	});

	// Dybe mavboejninger er den klassiske synder, planken regnes normalt
	// for i orden. Fagligt valg, og Linn kan aendre det.
	it('mavboejninger belaster baekkenbunden, planken goer ikke', () => {
		expect(FORSLAG3.maveboejninger).toContain('baekkenbund');
		expect(FORSLAG3.planke).not.toContain('baekkenbund');
	});

	it('hop baade larmer og belaster baekkenbunden', () => {
		expect(FORSLAG3.mini_hops).toContain('larm');
		expect(FORSLAG3.mini_hops).toContain('baekkenbund');
	});
});
