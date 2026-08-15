import { describe, it, expect } from 'vitest';
import {
	foedevareTilstand,
	foreslaaKobling,
	foreslaaAlle,
	kandidater,
	sundVare
} from './ingrediensKobling3';
import type { Fodevare } from './kost';

function v(id: string, name: string, ekstra: Partial<Fodevare> = {}): Fodevare {
	return { id, name, cat: 'andet', p: 10, f: 2, kilde: 'frida', ...ekstra } as Fodevare;
}

// Et lille udsnit af den rigtige database, med de poster der har vaeltet
// de tidligere forsoeg.
const DB: Fodevare[] = [
	v('f1', 'Linser, groenne, toerrede, raa', { p: 20.5, kcal: 310 }),
	v('f2', 'Linser, groenne, kogte, konserves', { p: 5.7, kcal: 90 }),
	v('f3', 'Linser, roede, toerrede, raa', { p: 22.5, kcal: 323 }),
	v('f4', 'Kikaerter, toerrede, raa', { p: 18.8, kcal: 337 }),
	v('f5', 'Kikaerter, lyse, kogte, konserves', { p: 6.2, kcal: 113 }),
	v('f6', 'Kikaertemel', { p: 22, kcal: 387 }),
	v('f7', 'Groenne linser, toerrede', { p: 25, kcal: 70, kilde: undefined }),
	v('f8', 'Kikaerter, kogte', { p: 8.5, kcal: 337, kilde: undefined }),
	v('f9', 'Olivenolie', { p: 0, fedt: 100, kcal: 884 }),
	v('f10', 'Rapsolie', { p: 0, fedt: 100, kcal: 884 }),
	v('f11', 'AEg, hoenseaeg, raa', { p: 12.6, kcal: 143 }),
	v('f12', 'Sukkeraerter, raa', { p: 3.3, kcal: 42 }),
	v('f13', 'AErter, groenne, frosne', { p: 5.4, kcal: 81 }),
	v('f14', 'Ris, hvide, kogte', { p: 2.4, kcal: 130 }),
	v('f15', 'Riseddike', { p: 0.3, kcal: 18 }),
	v('f16', 'Gulerod, raa', { p: 0.8, kcal: 36 })
];

describe('foedevareTilstand', () => {
	it('laeser Fridas egne tilstands-ord', () => {
		expect(foedevareTilstand('Linser, groenne, toerrede, raa')).toBe('toer');
		expect(foedevareTilstand('Linser, groenne, kogte, konserves')).toBe('afdryppet');
		expect(foedevareTilstand('Ris, hvide, kogte')).toBe('kogt');
	});

	it('giver ingen tilstand naar varen ikke naevner en', () => {
		expect(foedevareTilstand('Olivenolie')).toBeNull();
	});
});

describe('hele ord, ikke stumper', () => {
	it('aerter rammer IKKE kikaerter', () => {
		// Den her fejl kostede en hel maaling: aerter matchede kikaerter
		// og talte 25 i stedet for 35.
		const k = kandidater('aerter', null, DB);
		expect(k.every((x) => !/kikaert/i.test(x.vare.name))).toBe(true);
	});

	it('ris rammer IKKE riseddike', () => {
		const k = kandidater('ris', null, DB);
		expect(k.every((x) => x.vare.name !== 'Riseddike')).toBe(true);
	});

	it('kikaerter rammer ikke kikaertemel som vinder', () => {
		const r = foreslaaKobling('kikaerter toer', 'toer', DB);
		expect(r.foodId).toBe('f4');
	});
});

describe('tilstanden afgoer', () => {
	it('vaelger de TOERRE groenne linser, ikke de kogte', () => {
		// 20,5 g protein mod 5,7. Den vigtigste enkelt-test i filen.
		const r = foreslaaKobling('groenne linser toer', 'toer', DB);
		expect(r.foodId).toBe('f1');
	});

	it('vaelger de AFDRYPPEDE naar ingrediensen er afdryppet', () => {
		const r = foreslaaKobling('groenne linser afdryppet', 'afdryppet', DB);
		expect(r.foodId).toBe('f2');
	});

	it('vaelger toerre kikaerter til toerre og konserves til afdryppede', () => {
		expect(foreslaaKobling('kikaerter toer', 'toer', DB).foodId).toBe('f4');
		expect(foreslaaKobling('kikaerter afdryppet', 'afdryppet', DB).foodId).toBe('f5');
	});

	it('kobler ALDRIG en toer ingrediens til en kogt vare', () => {
		const r = foreslaaKobling('linser roede toer', 'toer', DB);
		const valgt = DB.find((x) => x.id === r.foodId)!;
		expect(foedevareTilstand(valgt.name)).not.toBe('kogt');
	});
});

describe('kun Frida kobles automatisk', () => {
	it('vaelger ikke posten uden kilde selv om navnet passer bedre', () => {
		// "Groenne linser, toerrede" uden kilde har 70 kcal, hvilket er
		// umuligt for toerrede linser. Den maa aldrig vinde automatisk.
		const r = foreslaaKobling('groenne linser toer', 'toer', DB);
		expect(r.foodId).not.toBe('f7');
		expect(r.sikker).toBe(true);
	});

	it('markerer til godkendelse hvis bedste bud ikke er fra Frida', () => {
		const kunUdenKilde = [v('x1', 'Hjemmelavet groensagsblanding', { kilde: undefined })];
		const r = foreslaaKobling('groensagsblanding', null, kunUdenKilde);
		expect(r.sikker).toBe(false);
		expect(r.hvorfor).toContain('Frida');
	});
});

describe('daarlige poster skal ligge nederst, ikke oeverst', () => {
	// Foer 13. august vandt en oedelagt post over den rigtige, fordi
	// navnet passede praecist. Advarslen stod der, men forslaget laa
	// alligevel foerst, og det er bagvendt.
	const SALT = [
		// Den oedelagte: salt har nul kalorier, ikke 100.
		v('s1', 'Salt', { p: 0, f: 0, kh: 0, fedt: 2.6, kcal: 100, kilde: undefined }),
		// Den rigtige fra Frida.
		v('s2', 'Salt, bordsalt (jodberiget)', { p: 0, f: 0, kh: 0, fedt: 0, kcal: 0 })
	];

	it('saetter den rigtige salt-post oeverst', () => {
		const k = kandidater('salt', null, SALT);
		expect(k[0].vare.id).toBe('s2');
	});

	it('begrunder hvorfor den daarlige er nedprioriteret', () => {
		const k = kandidater('salt', null, SALT);
		const daarlig = k.find((x) => x.vare.id === 's1')!;
		expect(daarlig.hvorfor).toContain('haenger ikke sammen');
	});

	it('kobler ikke den oedelagte post automatisk', () => {
		const r = foreslaaKobling('salt', null, SALT);
		expect(r.foodId).not.toBe('s1');
	});
});

describe('sundVare', () => {
	it('godkender en vare hvor kalorierne passer med makroen', () => {
		expect(sundVare(v('a', 'Linser', { p: 20.5, f: 8, kh: 45, fedt: 1.5, kcal: 310 }))).toBe(true);
	});

	it('afviser toerrede linser med 70 kalorier', () => {
		// Fundet i databasen 13. august. Toerrede linser har omkring 340.
		expect(sundVare(v('b', 'Grønne linser, tørrede', { p: 25, f: 11, kh: 7, fedt: 0.7, kcal: 70 }))).toBe(false);
	});

	it('afviser afdryppede kikaerter med toervaegtens kalorier', () => {
		expect(sundVare(v('c', 'Kikærter, kogte', { p: 8.5, f: 6, kh: 27, fedt: 2.6, kcal: 337 }))).toBe(false);
	});

	it('afviser en vare der mangler tallene', () => {
		expect(sundVare(v('d', 'Noget', { p: 5, f: 1 }))).toBe(false);
	});

	it('godkender noget der er naesten nul i begge ender', () => {
		expect(sundVare(v('e', 'Bordsalt', { p: 0, f: 0, kh: 0, fedt: 0, kcal: 0 }))).toBe(true);
	});
});

describe('hellere ingen kobling end en forkert', () => {
	it('giver ingen sikker kobling naar to bud ligger taet', () => {
		const to = [v('a', 'Persille, frisk'), v('b', 'Persille, toerret')];
		const r = foreslaaKobling('persille', null, to);
		expect(r.sikker).toBe(false);
	});

	it('siger fra naar intet ligner', () => {
		const r = foreslaaKobling('drageblod', null, DB);
		expect(r.foodId).toBeNull();
		expect(r.sikker).toBe(false);
		expect(r.forslag).toHaveLength(0);
	});

	it('foreslaar stadig noget til admin selv naar det ikke er sikkert', () => {
		const r = foreslaaKobling('olie', null, DB);
		expect(r.forslag.length).toBeGreaterThan(0);
	});
});

describe('foreslaaAlle', () => {
	it('samler pr kernenavn og ikke pr linje', () => {
		const navne = ['olivenolie', 'Olivenolie', 'olivenolie til stegning', 'gulerod'];
		const r = foreslaaAlle(navne, DB);
		expect(r.koblinger).toHaveLength(2);
	});

	it('holder toerre og afdryppede linser som to opgaver', () => {
		const r = foreslaaAlle(['grønne linser, tørre', 'grønne linser, afdryppede'], DB);
		expect(r.koblinger).toHaveLength(2);
		const ids = r.koblinger.map((k) => k.foodId);
		expect(new Set(ids).size).toBe(2);
	});

	it('taeller sikre og dem der skal godkendes', () => {
		const r = foreslaaAlle(['grønne linser, tørre', 'drageblod'], DB);
		expect(r.sikre + r.tilGodkendelse).toBe(r.koblinger.length);
	});

	it('sorterer de hyppigste foerst, saa admin tager det vigtigste', () => {
		const navne = ['gulerod', 'olivenolie', 'olivenolie', 'olivenolie'];
		const r = foreslaaAlle(navne, DB);
		expect(r.koblinger[0].kerne).toBe('olivenolie');
	});
});
