import { describe, it, expect } from 'vitest';
import {
	MAKS_TRAEF,
	erHeltOrd,
	hjerterTilSoegning,
	foerstISoegning,
	mineScanninger,
	rang,
	soegFodevarer,
	soegetermer
} from './fodevareSoeg3';
import type { Fodevare } from './kost';

function f(navn: string): Fodevare {
	return { id: navn, name: navn, cat: 'andet', p: 10, f: 0 };
}

describe('erHeltOrd', () => {
	it('finder ordet naar det staar alene', () => {
		expect(erHeltOrd('Æg', 'æg')).toBe(true);
	});

	it('finder ordet midt i et navn', () => {
		expect(erHeltOrd('Pålæg med æg', 'æg')).toBe(true);
	});

	// Det er hele pointen: aeg er IKKE et helt ord i aeggenudler.
	it('siger nej naar ordet er en del af et laengere ord', () => {
		expect(erHeltOrd('Æggenudler', 'æg')).toBe(false);
	});

	it('deler ogsaa ved bindestreg, skraastreg og parentes', () => {
		expect(erHeltOrd('Skyr-vanilje', 'skyr')).toBe(true);
		expect(erHeltOrd('Ost/ris', 'ris')).toBe(true);
		expect(erHeltOrd('Mælk (sødmælk)', 'sødmælk')).toBe(true);
	});

	it('er ligeglad med store bogstaver', () => {
		expect(erHeltOrd('ÆG', 'æg')).toBe(true);
	});

	it('siger nej til et tomt soegeord', () => {
		expect(erHeltOrd('Æg', '')).toBe(false);
	});

	it('rang giver nul til hele ord og ét til resten', () => {
		expect(rang('Æg', 'æg')).toBe(0);
		expect(rang('Æggenudler', 'æg')).toBe(1);
	});
});

describe('soegFodevarer', () => {
	const foods = [
		f('Æggenudler'),
		f('Pålæg med æg'),
		f('Æg'),
		f('Æggeblomme'),
		f('Røræg')
	];

	// DEN VIGTIGSTE TEST. Soeger hun aeg, skal hun ikke laese sig gennem
	// aeggenudler foerst.
	it('saetter hele ord foerst', () => {
		const r = soegFodevarer(foods, 'æg').map((x) => x.name);
		expect(r.slice(0, 2)).toEqual(['Æg', 'Pålæg med æg']);
	});

	// Sorteringen SKJULER ingenting. Det er forskellen paa den her og
	// den gamle apps afkryds.
	it('smider ikke de brede traeffere vaek', () => {
		const r = soegFodevarer(foods, 'æg').map((x) => x.name);
		expect(r).toContain('Æggenudler');
		expect(r).toContain('Røræg');
	});

	it('saetter korteste navn foerst inden for hver gruppe', () => {
		const r = soegFodevarer([f('Skyr med vanilje'), f('Skyr'), f('Skyr drik')], 'skyr');
		expect(r.map((x) => x.name)).toEqual(['Skyr', 'Skyr drik', 'Skyr med vanilje']);
	});

	it('sorterer alfabetisk naar navnene er lige lange', () => {
		const r = soegFodevarer([f('Bost'), f('Aost')], 'ost');
		expect(r.map((x) => x.name)).toEqual(['Aost', 'Bost']);
	});

	it('finder stadig alt der indeholder ordet', () => {
		expect(soegFodevarer(foods, 'æg').length).toBe(5);
	});

	it('giver ingenting paa et tomt soegeord', () => {
		expect(soegFodevarer(foods, '   ')).toEqual([]);
	});

	it('giver ingenting naar intet passer', () => {
		expect(soegFodevarer(foods, 'kylling')).toEqual([]);
	});

	it('viser hoejst otte', () => {
		const mange = Array.from({ length: 20 }, (_, i) => f(`Ost nummer ${i}`));
		expect(soegFodevarer(mange, 'ost').length).toBe(MAKS_TRAEF);
	});

	it('kan bede om et andet antal', () => {
		const mange = Array.from({ length: 20 }, (_, i) => f(`Ost nummer ${i}`));
		expect(soegFodevarer(mange, 'ost', 3).length).toBe(3);
	});
});

describe('flere ord', () => {
	const foods = [
		f('Skyr med vanilje'),
		f('Skyr, naturel'),
		f('Vaniljeis'),
		f('Vanilje skyr drik'),
		f('Kylling og broccoli'),
		f('Broccoli')
	];

	// Foer 12. august gav "skyr vanilje" NUL traeffere, fordi hele
	// strengen blev slaaet op paa én gang. Samme fejl som i
	// opskrift-soegningen, se SPEC 9.5.
	it('finder paa to ord adskilt af mellemrum', () => {
		const r = soegFodevarer(foods, 'skyr vanilje').map((x) => x.name);
		expect(r).toContain('Skyr med vanilje');
		expect(r).toContain('Vanilje skyr drik');
	});

	it('er ligeglad med raekkefoelgen', () => {
		const a = soegFodevarer(foods, 'skyr vanilje').map((x) => x.name);
		const b = soegFodevarer(foods, 'vanilje skyr').map((x) => x.name);
		expect(a).toEqual(b);
	});

	it('kraever at ALLE ord findes', () => {
		const r = soegFodevarer(foods, 'skyr broccoli');
		expect(r).toEqual([]);
	});

	// Den gamle app kraever komma. Her virker begge dele.
	it('virker ogsaa med komma imellem', () => {
		const r = soegFodevarer(foods, 'skyr, vanilje').map((x) => x.name);
		expect(r).toContain('Skyr med vanilje');
	});

	it('taaler flere mellemrum og et komma til sidst', () => {
		const r = soegFodevarer(foods, '  skyr   vanilje , ').map((x) => x.name);
		expect(r).toContain('Skyr med vanilje');
	});

	// Vigtigt: et enkelt ord skal give praecis det samme som foer.
	it('aendrer ikke noget for et enkelt ord', () => {
		const r = soegFodevarer(foods, 'broccoli').map((x) => x.name);
		expect(r).toEqual(['Broccoli', 'Kylling og broccoli']);
	});

	it('saetter dem hvor flest ord staar helt foerst', () => {
		const r = soegFodevarer(foods, 'skyr vanilje').map((x) => x.name);
		// Begge ord staar helt i "Vanilje skyr drik". I "Skyr med vanilje"
		// staar de ogsaa begge helt, saa korteste navn afgoer.
		expect(r[0]).toBe('Skyr med vanilje');
	});

	it('soegetermer deler ved baade mellemrum og komma', () => {
		expect(soegetermer('skyr, vanilje  drik')).toEqual(['skyr', 'vanilje', 'drik']);
		expect(soegetermer('   ')).toEqual([]);
	});
});

// ============================================================
// HJERTET FOERST, Linns beslutning 25. august
// ============================================================

describe('hjerterTilSoegning', () => {
	// 72 % af hjerterne i drift er varer hun selv har oprettet, sat
	// AUTOMATISK af den gamle app. Talte de med, ville hendes soegning
	// fyldes med gamle egne indtastninger.
	it('holder hendes egne foedevarer ude', () => {
		const ud = hjerterTilSoegning(['a', 'egen1', 'b'], new Set(['egen1']));
		expect([...ud].sort()).toEqual(['a', 'b']);
	});

	it('taaler en tom liste', () => {
		expect(hjerterTilSoegning([], new Set()).size).toBe(0);
	});
});

describe('soegFodevarer med hjerter', () => {
	const varer = [
		{ id: 'skyr', name: 'Skyr', cat: 'andet', p: 11, f: 0 },
		{ id: 'vanilje', name: 'Skyr med vanilje', cat: 'andet', p: 9, f: 0 },
		{ id: 'jordbaer', name: 'Skyr med jordbær', cat: 'andet', p: 9, f: 0 }
	] as Fodevare[];

	it('sorterer som foer naar hun ingen hjerter har', () => {
		const ud = soegFodevarer(varer, 'skyr');
		expect(ud[0].id).toBe('skyr');
	});

	// Det almindelige tilfaelde: hun bruger altid vanilje-udgaven, og
	// appen ved det allerede.
	it('saetter den hjertede foerst', () => {
		const ud = soegFodevarer(varer, 'skyr', 8, new Set(['vanilje']));
		expect(ud[0].id).toBe('vanilje');
	});

	// HJERTET VINDER OVER HELE ORD. Reglen om hele ord er et gaet paa
	// hvad hun mon mener. Hjertet er hendes eget valg, og et gaet skal
	// aldrig slaa et svar hun selv har givet.
	it('lader hjertet vinde over reglen om hele ord', () => {
		const aeg = [
			{ id: 'aeg', name: 'Æg', cat: 'andet', p: 13, f: 0 },
			{ id: 'nudler', name: 'Æggenudler', cat: 'andet', p: 12, f: 0 }
		] as Fodevare[];
		expect(soegFodevarer(aeg, 'æg')[0].id).toBe('aeg');
		expect(soegFodevarer(aeg, 'æg', 8, new Set(['nudler']))[0].id).toBe('nudler');
	});

	// Sorteringen skjuler ingenting, praecis som da hele ord blev
	// indfoert. Alle traeffere er der stadig.
	it('skjuler ingenting', () => {
		const ud = soegFodevarer(varer, 'skyr', 8, new Set(['jordbaer']));
		expect(ud).toHaveLength(3);
		expect(ud.map((f) => f.id).sort()).toEqual(['jordbaer', 'skyr', 'vanilje']);
	});

	it('rammer ikke ved siden af naar hjertet ikke er blandt traefferne', () => {
		const ud = soegFodevarer(varer, 'skyr', 8, new Set(['noget-helt-andet']));
		expect(ud[0].id).toBe('skyr');
	});
});

describe('foerstISoegning', () => {
	// Linns oenske 25. august: en vare hun har scannet skal ligge oeverst.
	// Vi loefter den frem UDEN at saette et hjerte, saa hjertet bliver ved
	// med kun at betyde hendes eget valg.
	it('samler hjerter, hendes egne og hendes scanninger', () => {
		const ud = foerstISoegning({
			hjerter: ['h1'],
			egneIds: new Set(['e1']),
			scannedeAfHende: ['s1']
		});
		expect([...ud].sort()).toEqual(['e1', 'h1', 's1']);
	});

	// Et gammelt automatisk hjerte paa hendes egen vare taeller ikke som
	// hjerte, men varen kommer med alligevel fordi den ER hendes egen.
	// Den maa ikke staa der to gange.
	it('taeller ikke hendes egen vare med to gange', () => {
		const ud = foerstISoegning({ hjerter: ['e1'], egneIds: new Set(['e1']) });
		expect([...ud]).toEqual(['e1']);
	});

	it('taaler at hun ikke har scannet noget', () => {
		const ud = foerstISoegning({ hjerter: [], egneIds: new Set() });
		expect(ud.size).toBe(0);
	});
});

describe('mineScanninger', () => {
	const varer = [
		{ id: 'a', scannetAf: 'mig' },
		{ id: 'b', scannetAf: 'en-anden' },
		{ id: 'c' }
	];

	it('finder kun dem hun selv har scannet', () => {
		expect(mineScanninger(varer, 'mig')).toEqual(['a']);
	});

	it('giver ingenting naar hun ikke er logget ind', () => {
		expect(mineScanninger(varer, undefined)).toEqual([]);
	});
});
