import { describe, it, expect } from 'vitest';
import type { Fodevare } from './kost';
import type { KoblingsOpslag } from './opskriftMakro3';
import {
	tomAendring,
	springForEnhed,
	naesteMaengde,
	saetMaengde,
	nulstilLinje,
	laegTil,
	fjernLagtTil,
	saetLagtTilPortion,
	egenPlads,
	antalAendret,
	antalLagtTil,
	harAendringer,
	aendringsTekst,
	dagbogsTekst,
	regnMedAendringer,
	aftryk,
	tilGemt,
	fraGemt,
	skalSpoerge
} from './opskriftAendring3';

// Foedevarer med tal der er lette at regne i hovedet.
const varer = new Map<string, Fodevare>([
	['kylling', { id: 'kylling', name: 'Kyllingebryst', cat: 'andet', p: 20, f: 0, kh: 0, fedt: 2, kcal: 100 }],
	['avokado', { id: 'avokado', name: 'Avokado', cat: 'andet', p: 2, f: 7, kh: 1, fedt: 20, kcal: 200 }],
	['feta', { id: 'feta', name: 'Feta', cat: 'andet', p: 14, f: 0, kh: 1, fedt: 21, kcal: 260 }]
]);

// Noeglerne er KERNENAVNE og ikke det der staar i opskriften. kerneNavn
// samler avokado, avokadoer og avocadoer til "avocado", se
// ingrediensNavn3. Skriver man noeglen som den staar i opskriften, giver
// linjen nul uden at noget fejler.
const koblinger: Record<string, KoblingsOpslag> = {
	kyllingebryst: { foodId: 'kylling' },
	avocado: { foodId: 'avokado' }
};

const liste = [
	{ navn: 'kyllingebryst', maengde: 100, enhed: 'g' },
	{ navn: 'avokado', maengde: 100, enhed: 'g' }
];

describe('springForEnhed', () => {
	// Et gram ad gangen ville betyde tredive tryk fra 150 til 200, og
	// finere end 5 g kan ingen maale i et koekken alligevel.
	it('springer 5 ad gangen paa gram', () => {
		expect(springForEnhed('g')).toBe(5);
		expect(springForEnhed('G')).toBe(5);
		expect(springForEnhed(' g ')).toBe(5);
	});

	it('springer en halv paa alt der taelles i stykker', () => {
		expect(springForEnhed('stk')).toBe(0.5);
		expect(springForEnhed('spsk')).toBe(0.5);
		expect(springForEnhed('skive')).toBe(0.5);
	});

	it('falder tilbage paa en halv naar enheden ikke kendes', () => {
		expect(springForEnhed('bundt')).toBe(0.5);
		expect(springForEnhed(undefined)).toBe(0.5);
		expect(springForEnhed('')).toBe(0.5);
	});
});

describe('naesteMaengde', () => {
	it('flytter et spring ad gangen', () => {
		expect(naesteMaengde(150, 'g', 1)).toBe(155);
		expect(naesteMaengde(150, 'g', -1)).toBe(145);
		expect(naesteMaengde(0.5, 'stk', 1)).toBe(1);
	});

	// Nul er et gyldigt svar og betyder "jeg tog den ikke i". Negativ mad
	// findes ikke.
	it('stopper ved nul og gaar aldrig under', () => {
		expect(naesteMaengde(5, 'g', -1)).toBe(0);
		expect(naesteMaengde(0, 'g', -1)).toBe(0);
		expect(naesteMaengde(0.5, 'stk', -1)).toBe(0);
	});

	// Uden afrunding staar der 0.30000000000000004 paa skaermen.
	it('runder af, saa der ikke staar en kommatalsfejl paa skaermen', () => {
		expect(naesteMaengde(0.1, 'dl', 1)).toBe(0.6);
		expect(naesteMaengde(1.5, 'spsk', 1)).toBe(2);
	});
});

describe('at aendre og fortryde', () => {
	it('husker kun de linjer hun har roert', () => {
		let a = tomAendring();
		expect(antalAendret(a)).toBe(0);
		a = saetMaengde(a, 0, 200);
		expect(antalAendret(a)).toBe(1);
		expect(a.maengder[0]).toBe(200);
		expect(a.maengder[1]).toBeUndefined();
	});

	// Nul skal kunne gemmes som et svar. Var det det samme som "ikke
	// roert", kunne hun ikke sige at hun sprang avokadoen over.
	it('skelner mellem nul og ikke roert', () => {
		const a = saetMaengde(tomAendring(), 1, 0);
		expect(antalAendret(a)).toBe(1);
		expect(harAendringer(a)).toBe(true);
		expect(a.maengder[1]).toBe(0);
	});

	it('kan ikke saette en negativ maengde', () => {
		const a = saetMaengde(tomAendring(), 0, -50);
		expect(a.maengder[0]).toBe(0);
	});

	it('fortryder én linje uden at roere de andre', () => {
		let a = saetMaengde(saetMaengde(tomAendring(), 0, 200), 1, 0);
		a = nulstilLinje(a, 0);
		expect(a.maengder[0]).toBeUndefined();
		expect(a.maengder[1]).toBe(0);
	});

	it('laegger til og fjerner igen', () => {
		let a = laegTil(tomAendring(), { foodId: 'feta', navn: 'Feta', portion: 30 });
		expect(antalLagtTil(a)).toBe(1);
		a = fjernLagtTil(a, 0);
		expect(antalLagtTil(a)).toBe(0);
	});

	// Hendes egne linjer er ikke Linns. Linns kan skrues til nul men ikke
	// fjernes, saa hun kan fortryde. Hendes egne kan fjernes helt.
	it('retter maengden paa en hun har lagt til', () => {
		let a = laegTil(tomAendring(), { foodId: 'feta', navn: 'Feta', portion: 30 });
		a = saetLagtTilPortion(a, 0, 50);
		expect(a.lagtTil[0].portion).toBe(50);
		expect(antalLagtTil(a)).toBe(1);
	});

	// Nul paa hendes egen linje fjerner den. Der er ikke noget at
	// fortryde, for den stod der ikke i forvejen.
	it('fjerner hendes egen linje naar den skrues til nul', () => {
		let a = laegTil(tomAendring(), { foodId: 'feta', navn: 'Feta', portion: 30 });
		a = saetLagtTilPortion(a, 0, 0);
		expect(antalLagtTil(a)).toBe(0);
	});

	it('retter kun den ene naar der er flere lagt til', () => {
		let a = tomAendring();
		a = laegTil(a, { foodId: 'feta', navn: 'Feta', portion: 30 });
		a = laegTil(a, { foodId: 'kylling', navn: 'Kylling', portion: 50 });
		a = saetLagtTilPortion(a, 1, 80);
		expect(a.lagtTil[0].portion).toBe(30);
		expect(a.lagtTil[1].portion).toBe(80);
	});

	// DEN HER FANGER FEJLEN FRA 25. august: skaermen viser Linns linjer
	// foerst og hendes egne nedenunder, saa et tryk paa hendes egen
	// ramte en plads der ikke findes i Linns liste, og der skete
	// ingenting.
	it('regner hendes egen plads om fra pladsen paa skaermen', () => {
		// Linns liste har to linjer, saa hendes foerste egne ligger paa 2.
		expect(egenPlads(2, 2)).toBe(0);
		expect(egenPlads(3, 2)).toBe(1);
	});

	it('rammer den rigtige naar der er flere lagt til', () => {
		let a = tomAendring();
		a = laegTil(a, { foodId: 'feta', navn: 'Feta', portion: 30 });
		a = laegTil(a, { foodId: 'kylling', navn: 'Kylling', portion: 50 });
		a = fjernLagtTil(a, 0);
		expect(a.lagtTil).toHaveLength(1);
		expect(a.lagtTil[0].navn).toBe('Kylling');
	});
});

describe('teksterne', () => {
	it('siger ingenting naar hun ikke har roert noget', () => {
		expect(aendringsTekst(tomAendring())).toBe('');
		expect(dagbogsTekst(tomAendring())).toBe('');
	});

	it('boejer ental og flertal rigtigt', () => {
		expect(aendringsTekst(saetMaengde(tomAendring(), 0, 200))).toBe('Du har ændret 1 ingrediens.');
		let to = saetMaengde(saetMaengde(tomAendring(), 0, 200), 1, 0);
		expect(aendringsTekst(to)).toBe('Du har ændret 2 ingredienser.');
	});

	it('siger begge dele naar hun baade har rettet og lagt til', () => {
		let a = saetMaengde(saetMaengde(tomAendring(), 0, 200), 1, 0);
		a = laegTil(a, { foodId: 'feta', navn: 'Feta', portion: 30 });
		expect(aendringsTekst(a)).toBe('Du har ændret 2 og lagt 1 til.');
	});

	it('siger kun det hun har lagt til, naar hun ikke har rettet noget', () => {
		const a = laegTil(tomAendring(), { foodId: 'feta', navn: 'Feta', portion: 30 });
		expect(aendringsTekst(a)).toBe('Du har lagt 1 ingrediens til.');
	});

	// Linns valg 25. august. Uden linjen kan hverken hun eller Linn se at
	// hun spiste noget andet end det der staar.
	it('skriver Dine maengder i dagbogen', () => {
		let a = saetMaengde(saetMaengde(tomAendring(), 0, 200), 1, 0);
		expect(dagbogsTekst(a)).toBe('Dine mængder · 2 rettet');
		a = laegTil(a, { foodId: 'feta', navn: 'Feta', portion: 30 });
		expect(dagbogsTekst(a)).toBe('Dine mængder · 2 rettet, 1 lagt til');
	});
});

describe('regnMedAendringer', () => {
	it('giver opskriftens eget tal naar hun ikke har roert noget', () => {
		const b = regnMedAendringer(liste, tomAendring(), koblinger, varer);
		// 100 g kylling: 20 p. 100 g avokado: 2 p og 7 fiber.
		expect(b.makro.protein).toBe(22);
		expect(b.makro.fiber).toBe(7);
		expect(b.linjer.every((l) => !l.aendret && !l.egen)).toBe(true);
	});

	it('regner den nye maengde med', () => {
		const a = saetMaengde(tomAendring(), 0, 200);
		const b = regnMedAendringer(liste, a, koblinger, varer);
		expect(b.makro.protein).toBe(42);
		expect(b.linjer[0].maengde).toBe(200);
		expect(b.linjer[0].foer).toBe(100);
		expect(b.linjer[0].aendret).toBe(true);
	});

	// Den linje hun har taget ud skal blive staaende paa skaermen, saa
	// hun kan fortryde, men den maa ikke bidrage med noget.
	it('lader en linje paa nul blive staaende uden at taelle med', () => {
		const a = saetMaengde(tomAendring(), 1, 0);
		const b = regnMedAendringer(liste, a, koblinger, varer);
		expect(b.makro.protein).toBe(20);
		expect(b.makro.fiber).toBe(0);
		expect(b.linjer).toHaveLength(2);
		expect(b.linjer[1].maengde).toBe(0);
		expect(b.linjer[1].makro.protein).toBe(0);
	});

	it('regner det hun har lagt til med', () => {
		const a = laegTil(tomAendring(), { foodId: 'feta', navn: 'Feta', portion: 100 });
		const b = regnMedAendringer(liste, a, koblinger, varer);
		expect(b.makro.protein).toBe(36);
		expect(b.linjer).toHaveLength(3);
		expect(b.linjer[2].egen).toBe(true);
		expect(b.linjer[2].navn).toBe('Feta');
	});

	// Det byttet i praksis er: skru det ene til nul, laeg det andet til.
	it('kan bytte en ingrediens ud ved at nulstille og laegge til', () => {
		let a = saetMaengde(tomAendring(), 1, 0);
		a = laegTil(a, { foodId: 'feta', navn: 'Feta', portion: 100 });
		const b = regnMedAendringer(liste, a, koblinger, varer);
		// Kylling 20 + feta 14, avokadoen er ude.
		expect(b.makro.protein).toBe(34);
		expect(b.makro.fiber).toBe(0);
	});

	// Punkt 1 i toppen af filen. Der deles ALDRIG med portionstallet
	// bagefter, for listen der kommer ind er allerede skaleret.
	it('deler ikke med noget, saa det hun laegger til ikke skrumper', () => {
		const halv = [{ navn: 'kyllingebryst', maengde: 50, enhed: 'g' }];
		const a = laegTil(tomAendring(), { foodId: 'feta', navn: 'Feta', portion: 100 });
		const b = regnMedAendringer(halv, a, koblinger, varer);
		expect(b.makro.protein).toBe(24);
	});

	it('taeller en linje uden kobling som nul uden at vaelte', () => {
		const medUkendt = [...liste, { navn: 'noget der ikke findes', maengde: 50, enhed: 'g' }];
		const b = regnMedAendringer(medUkendt, tomAendring(), koblinger, varer);
		expect(b.makro.protein).toBe(22);
		expect(b.linjer).toHaveLength(3);
	});

	it('vaelter ikke naar den tilfoejede vare er forsvundet fra databasen', () => {
		const a = laegTil(tomAendring(), { foodId: 'findes-ikke', navn: 'Vaek', portion: 100 });
		const b = regnMedAendringer(liste, a, koblinger, varer);
		expect(b.makro.protein).toBe(22);
		expect(b.linjer[2].makro.protein).toBe(0);
	});
});

describe('at huske til naeste gang', () => {
	it('genkender den samme liste', () => {
		expect(aftryk(liste)).toBe(aftryk([...liste]));
	});

	// Skruer Linn 150 g op til 180, er det stadig den samme ret, og
	// hendes "jeg tog ikke avokado i" skal overleve.
	it('bliver ved med at passe naar Linn kun aendrer en maengde', () => {
		const rettet = [
			{ navn: 'kyllingebryst', maengde: 180, enhed: 'g' },
			{ navn: 'avokado', maengde: 100, enhed: 'g' }
		];
		expect(aftryk(rettet)).toBe(aftryk(liste));
	});

	// RETTER LINN OPSKRIFTEN, SKAL HENDES GEMTE MAENGDER FALDE BORT.
	// Ellers sidder hun med 200 g kylling i en ret der er lavet om til fisk.
	it('passer ikke naar Linn har skiftet en ingrediens ud', () => {
		const anden = [
			{ navn: 'torsk', maengde: 100, enhed: 'g' },
			{ navn: 'avokado', maengde: 100, enhed: 'g' }
		];
		expect(aftryk(anden)).not.toBe(aftryk(liste));
	});

	it('passer ikke naar Linn har lagt en ingrediens til', () => {
		expect(aftryk([...liste, { navn: 'feta', maengde: 30, enhed: 'g' }])).not.toBe(aftryk(liste));
	});

	it('laeser det gemte tilbage naar opskriften er den samme', () => {
		const a = saetMaengde(tomAendring(), 0, 200);
		const gemt = tilGemt(a, liste);
		const tilbage = fraGemt(gemt, liste);
		expect(tilbage.maengder[0]).toBe(200);
	});

	it('kaster det gemte vaek naar opskriften er rettet siden', () => {
		const gemt = tilGemt(saetMaengde(tomAendring(), 0, 200), liste);
		const anden = [{ navn: 'torsk', maengde: 100, enhed: 'g' }];
		expect(harAendringer(fraGemt(gemt, anden))).toBe(false);
	});

	it('giver en tom aendring naar der ikke er gemt noget', () => {
		expect(harAendringer(fraGemt(undefined, liste))).toBe(false);
	});
});

describe('skalSpoerge', () => {
	it('spoerger ikke naar hun ikke har roert noget', () => {
		expect(skalSpoerge(tomAendring(), false)).toBe(false);
	});

	it('spoerger naar hun har rettet noget og ikke er spurgt foer', () => {
		expect(skalSpoerge(saetMaengde(tomAendring(), 0, 200), false)).toBe(true);
	});

	// Der spoerges kun én gang pr opskrift. Ellers bliver det en pop-up
	// der aldrig holder op.
	it('spoerger ikke igen naar hun allerede har svaret', () => {
		expect(skalSpoerge(saetMaengde(tomAendring(), 0, 200), true)).toBe(false);
	});
});
