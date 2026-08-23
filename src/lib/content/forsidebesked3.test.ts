import { describe, expect, it } from 'vitest';
import {
	aktive3,
	beskedTil3,
	gaelderFor3,
	modtagerTekst3,
	slutMsFor3,
	tilbageTekst3,
	type Forsidebesked3
} from './forsidebesked3';

const b = (o: Partial<Forsidebesked3>): Forsidebesked3 => ({
	id: 'a',
	tekst: 'Q&A i aften',
	modtager: { slags: 'alle' },
	slutMs: 9_999_999_999_999,
	oprettetMs: 1_000,
	prik: false,
	...o
});

describe('slutMsFor3', () => {
	// 23. august 2026 klokken 9.00
	const morgen = new Date(2026, 7, 23, 9, 0, 0).getTime();

	it('I DAG BETYDER TIL MIDNAT og ikke om 24 timer', () => {
		const slut = slutMsFor3('idag', morgen);
		const d = new Date(slut);
		expect(d.getDate()).toBe(23);
		expect(d.getHours()).toBe(23);
		// Skriver hun klokken 9 om noget i aften, skal den vaere vaek naar
		// hun staar op i morgen.
		expect(slut - morgen).toBeLessThan(24 * 60 * 60 * 1000);
	});

	it('tre dage og en uge regnes fra midnat', () => {
		expect(new Date(slutMsFor3('tre', morgen)).getDate()).toBe(25);
		expect(new Date(slutMsFor3('uge', morgen)).getDate()).toBe(29);
	});

	it('til jeg fjerner den udloeber aldrig', () => {
		expect(slutMsFor3('altid', morgen)).toBe(Number.MAX_SAFE_INTEGER);
	});
});

describe('gaelderFor3', () => {
	it('alle rammer alle', () => {
		expect(gaelderFor3(b({}), { aktiveForlobIds: [] })).toBe(true);
		expect(gaelderFor3(b({}), { aktiveForlobIds: ['hold'] })).toBe(true);
	});

	it('MEDLEMMER ER DEM UDEN FORLOEB', () => {
		const m = b({ modtager: { slags: 'medlemmer' } });
		expect(gaelderFor3(m, { aktiveForlobIds: [] })).toBe(true);
		expect(gaelderFor3(m, { aktiveForlobIds: ['hold'] })).toBe(false);
	});

	it('et forloeb rammer kun det hold', () => {
		const f = b({ modtager: { slags: 'forlob', forlobId: 'kropsro' } });
		expect(gaelderFor3(f, { aktiveForlobIds: ['kropsro'] })).toBe(true);
		expect(gaelderFor3(f, { aktiveForlobIds: ['kickstart'] })).toBe(false);
		expect(gaelderFor3(f, { aktiveForlobIds: [] })).toBe(false);
	});

	it('en kunde paa to hold rammes af begge', () => {
		const f = b({ modtager: { slags: 'forlob', forlobId: 'kickstart' } });
		expect(gaelderFor3(f, { aktiveForlobIds: ['kropsro', 'kickstart'] })).toBe(true);
	});
});

describe('aktive3', () => {
	const nu = 5_000;

	it('en udloebet besked er vaek', () => {
		expect(aktive3([b({ slutMs: 4_999 })], nu)).toHaveLength(0);
		expect(aktive3([b({ slutMs: 5_000 })], nu)).toHaveLength(1);
	});

	it('en tom tekst staar ikke', () => {
		expect(aktive3([b({ tekst: '   ' })], nu)).toHaveLength(0);
	});
});

describe('beskedTil3', () => {
	const nu = 5_000;

	it('ingenting naar der ikke er nogen', () => {
		expect(beskedTil3([], { aktiveForlobIds: [] }, nu)).toBeNull();
	});

	it('DEN NYESTE VINDER naar to passer', () => {
		const gammel = b({ id: 'gammel', oprettetMs: 1_000 });
		const ny = b({ id: 'ny', oprettetMs: 4_000, modtager: { slags: 'forlob', forlobId: 'h' } });
		const valgt = beskedTil3([gammel, ny], { aktiveForlobIds: ['h'] }, nu);
		expect(valgt?.id).toBe('ny');
	});

	it('en der ikke gaelder for hende vaelges ikke, ogsaa selvom den er nyest', () => {
		const min = b({ id: 'min', oprettetMs: 1_000 });
		const andres = b({
			id: 'andres',
			oprettetMs: 4_000,
			modtager: { slags: 'forlob', forlobId: 'andet' }
		});
		expect(beskedTil3([min, andres], { aktiveForlobIds: ['mit'] }, nu)?.id).toBe('min');
	});

	it('en udloebet vaelges aldrig', () => {
		expect(beskedTil3([b({ slutMs: 1 })], { aktiveForlobIds: [] }, nu)).toBeNull();
	});
});

describe('tilbageTekst3', () => {
	const nu = new Date(2026, 7, 23, 9, 0, 0).getTime();

	it('den der staar til hun fjerner den', () => {
		expect(tilbageTekst3(b({ slutMs: Number.MAX_SAFE_INTEGER }), nu)).toContain('fjerner');
	});

	it('i nat', () => {
		expect(tilbageTekst3(b({ slutMs: slutMsFor3('idag', nu) }), nu)).toBe('Forsvinder i nat');
	});

	it('flere dage', () => {
		expect(tilbageTekst3(b({ slutMs: slutMsFor3('uge', nu) }), nu)).toContain('dage tilbage');
	});
});

describe('modtagerTekst3', () => {
	it('skriver holdets navn ud', () => {
		expect(modtagerTekst3({ slags: 'forlob', forlobId: 'k' }, { k: 'KropsRo 16. aug' })).toBe(
			'KropsRo 16. aug'
		);
	});

	it('et hold vi ikke kender navnet paa faar en pæn reserve', () => {
		expect(modtagerTekst3({ slags: 'forlob', forlobId: 'x' }, {})).toBe('Et forløb');
	});
});
