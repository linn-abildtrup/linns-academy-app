import { describe, it, expect } from 'vitest';
import type { Exercise, TrainingDay } from './mikrotraening';
import {
	MAX_RET_DAGE,
	aendredeDage3,
	aendringsliste3,
	dageFraSaetning3,
	forslagTekst3,
	maaSendeMere3,
	numreTekst3,
	rensDag3,
	rensOevelse3,
	rensSvar3,
	udfoldDage3,
	uroerteTekst3,
	validerBesked3,
	type AiBesked3
} from './traeningAi3';

function oev(id: string, aktiv = true): Exercise {
	return {
		id,
		name: `Øvelse ${id}`,
		desc: '',
		how: [],
		cat: 'ben',
		catLabel: 'Ben',
		tags: [],
		videoPath: '',
		treaningsformer: [],
		udstyr: [],
		aktiv
	};
}

const BANK = [oev('a'), oev('b'), oev('c'), oev('slukket', false)];

function dag(nr: number, ids: string[], sets = 3): TrainingDay {
	return {
		dagNummer: nr,
		titel: '',
		indledning: '',
		exercises: ids.map((id) => ({ exerciseId: id, sets, workSec: 30, restSec: 10, bonus: false }))
	};
}

const navnPaa = (id: string) => `Øvelse ${id}`;

describe('rensOevelse3', () => {
	const kort = new Map(BANK.map((e) => [e.id, e]));

	it('smider en opfundet oevelse vaek', () => {
		// Den vigtigste test i filen. En oevelse der ikke findes har ingen
		// video, og saa staar kunden med en tom skaerm midt i en traening.
		expect(rensOevelse3({ exerciseId: 'findes-ikke', sets: 3 }, kort)).toBeNull();
	});

	it('smider en slukket oevelse vaek', () => {
		expect(rensOevelse3({ exerciseId: 'slukket', sets: 3 }, kort)).toBeNull();
	});

	it('tager en rigtig oevelse med', () => {
		expect(rensOevelse3({ exerciseId: 'a', sets: 4, workSec: 45, restSec: 20 }, kort)).toEqual({
			exerciseId: 'a',
			sets: 4,
			workSec: 45,
			restSec: 20,
			bonus: false
		});
	});

	it('klipper tal der ligger uden for graenserne', () => {
		// En model der skriver 25 saet skal ikke vaelte hele forslaget.
		const r = rensOevelse3({ exerciseId: 'a', sets: 25, workSec: 2, restSec: 9000 }, kort);
		expect(r).toMatchObject({ sets: 20, workSec: 5, restSec: 600 });
	});

	it('bruger standarden naar tallet mangler', () => {
		expect(rensOevelse3({ exerciseId: 'a' }, kort)).toMatchObject({
			sets: 3,
			workSec: 30,
			restSec: 10
		});
	});
});

describe('rensDag3', () => {
	const kort = new Map(BANK.map((e) => [e.id, e]));

	it('smider en dag vaek hvor ingen oevelser findes', () => {
		expect(rensDag3({ oevelser: [{ exerciseId: 'nej' }] }, 1, kort, false)).toBeNull();
	});

	it('beholder de rigtige og taber resten', () => {
		const d = rensDag3(
			{ oevelser: [{ exerciseId: 'a' }, { exerciseId: 'nej' }, { exerciseId: 'b' }] },
			1,
			kort,
			false
		);
		expect(d?.exercises.map((o) => o.exerciseId)).toEqual(['a', 'b']);
	});

	it('tager kun titler med naar fluebenet er sat', () => {
		const uden = rensDag3({ titel: 'Ben', oevelser: [{ exerciseId: 'a' }] }, 1, kort, false);
		const med = rensDag3({ titel: 'Ben', oevelser: [{ exerciseId: 'a' }] }, 1, kort, true);
		expect(uden?.titel).toBe('');
		expect(med?.titel).toBe('Ben');
	});
});

describe('udfoldDage3', () => {
	it('fordeler en uge ud over de dage hun bad om', () => {
		const ud = udfoldDage3([dag(1, ['a']), dag(2, ['b']), dag(3, ['c'])], 7);
		expect(ud).toHaveLength(7);
		expect(ud.map((d) => d.dagNummer)).toEqual([1, 2, 3, 4, 5, 6, 7]);
	});

	it('forskyder saa anden runde ikke er en kopi af den foerste', () => {
		const ud = udfoldDage3([dag(1, ['a']), dag(2, ['b']), dag(3, ['c'])], 6);
		const foerste = ud.slice(0, 3).map((d) => d.exercises[0].exerciseId);
		const anden = ud.slice(3, 6).map((d) => d.exercises[0].exerciseId);
		expect(foerste).toEqual(['a', 'b', 'c']);
		expect(anden).not.toEqual(foerste);
	});

	it('finder aldrig paa en oevelse der ikke stod i skabelonen', () => {
		const ud = udfoldDage3([dag(1, ['a']), dag(2, ['b'])], 20);
		const brugte = new Set(ud.flatMap((d) => d.exercises.map((o) => o.exerciseId)));
		expect([...brugte].sort()).toEqual(['a', 'b']);
	});

	it('giver ingenting naar skabelonen er tom', () => {
		expect(udfoldDage3([], 7)).toEqual([]);
	});
});

describe('rensSvar3', () => {
	it('giver intet forslag naar ingen oevelser kunne bruges', () => {
		// Et halvt forslag er vaerre end intet forslag, for saa tror hun
		// at det er faerdigt.
		const r = rensSvar3(
			{ svar: 'Her er et forslag', dage: [{ oevelser: [{ exerciseId: 'nej' }] }] },
			BANK,
			false,
			7
		);
		expect(r.forslag).toBeNull();
		expect(r.svar).toBe('Her er et forslag');
	});

	it('bygger forslaget og fordeler det', () => {
		const r = rensSvar3(
			{
				svar: 'Se her',
				navn: 'Rolig genstart',
				antalDage: 14,
				dage: [{ oevelser: [{ exerciseId: 'a' }] }, { oevelser: [{ exerciseId: 'b' }] }]
			},
			BANK,
			false,
			14
		);
		expect(r.forslag?.navn).toBe('Rolig genstart');
		expect(r.forslag?.dage).toHaveLength(14);
	});

	it('bruger et navn selv naar AI glemmer det', () => {
		const r = rensSvar3({ dage: [{ oevelser: [{ exerciseId: 'a' }] }] }, BANK, false, 3);
		expect(r.forslag?.navn).toBe('Nyt program');
	});

	it('nummererer dagene om naar en falder ud midt i', () => {
		const r = rensSvar3(
			{
				dage: [
					{ oevelser: [{ exerciseId: 'a' }] },
					{ oevelser: [{ exerciseId: 'nej' }] },
					{ oevelser: [{ exerciseId: 'b' }] }
				],
				antalDage: 2
			},
			BANK,
			false,
			2
		);
		expect(r.forslag?.dage.map((d) => d.dagNummer)).toEqual([1, 2]);
	});
});

describe('dageFraSaetning3', () => {
	it('oversaetter uge 3 til dag 15 til 21', () => {
		expect(dageFraSaetning3('Uge 3 er for hård. Gør den lettere.', 84)).toEqual([
			15, 16, 17, 18, 19, 20, 21
		]);
	});

	it('tager et spaend af uger', () => {
		expect(dageFraSaetning3('uge 2 til 3', 84)).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);
	});

	it('forstaar dag 5', () => {
		expect(dageFraSaetning3('dag 5 er kedelig', 84)).toEqual([5]);
	});

	it('forstaar dag 15 til 21', () => {
		expect(dageFraSaetning3('ret dag 15 til 21', 84)).toEqual([15, 16, 17, 18, 19, 20, 21]);
	});

	it('forstaar de foerste to uger', () => {
		expect(dageFraSaetning3('de første to uger er for hårde', 84)).toHaveLength(14);
	});

	it('forstaar de sidste tre dage', () => {
		expect(dageFraSaetning3('de sidste tre dage', 84)).toEqual([82, 83, 84]);
	});

	it('sender hele programmet med naar det er kort nok', () => {
		expect(dageFraSaetning3('hele programmet er for hårdt', 10)).toHaveLength(10);
	});

	it('spoerger i stedet naar hele programmet er for langt', () => {
		// 84 dage kan ikke sendes afsted paa én gang, hverken i tid eller
		// i penge. Saa spoerger AI'en hvilken del hun mener.
		expect(dageFraSaetning3('hele programmet er for hårdt', 84)).toBeNull();
	});

	it('siger ved ikke i stedet for at gaette', () => {
		// Et gaet der rammer forkert retter dage hun ikke bad om.
		expect(dageFraSaetning3('gør det lidt lettere', 84)).toBeNull();
	});

	it('klipper til programmets laengde', () => {
		expect(dageFraSaetning3('uge 3', 16)).toEqual([15, 16]);
	});

	it('giver en tom liste naar dagene ligger helt uden for', () => {
		expect(dageFraSaetning3('uge 20', 14)).toEqual([]);
	});

	it('kan ogsaa laese uge som ord', () => {
		expect(dageFraSaetning3('uge to', 84)).toEqual([8, 9, 10, 11, 12, 13, 14]);
	});
});

describe('aendringsliste3', () => {
	it('finder den dag der er aendret og lader resten vaere', () => {
		const foer = [dag(1, ['a']), dag(2, ['b']), dag(3, ['c'])];
		const efter = [dag(1, ['a']), dag(2, ['c']), dag(3, ['c'])];
		const liste = aendringsliste3(foer, efter, navnPaa);
		expect(aendredeDage3(liste)).toEqual([2]);
		expect(liste[1].linjer).toEqual(['Øvelse b, 3 sæt → Øvelse c, 3 sæt']);
	});

	it('ser en aendring i antal saet', () => {
		const liste = aendringsliste3([dag(1, ['a'], 4)], [dag(1, ['a'], 3)], navnPaa);
		expect(liste[0].linjer).toEqual(['Øvelse a, 4 sæt → Øvelse a, 3 sæt']);
	});

	it('siger til naar der kommer en oevelse til eller ryger ud', () => {
		const tilfoejet = aendringsliste3([dag(1, ['a'])], [dag(1, ['a', 'b'])], navnPaa);
		expect(tilfoejet[0].linjer).toEqual(['Ny: Øvelse b, 3 sæt']);
		const fjernet = aendringsliste3([dag(1, ['a', 'b'])], [dag(1, ['a'])], navnPaa);
		expect(fjernet[0].linjer).toEqual(['Ud: Øvelse b, 3 sæt']);
	});

	it('regner en dag der ikke blev sendt med som uroert', () => {
		const liste = aendringsliste3([dag(1, ['a']), dag(2, ['b'])], [dag(1, ['a'])], navnPaa);
		expect(liste[1].art).toBe('uroert');
	});
});

describe('numreTekst3', () => {
	it('slaar sammenhaengende numre sammen', () => {
		expect(numreTekst3([1, 2, 3, 7])).toBe('1 til 3 og 7');
	});

	it('klarer to spaend', () => {
		expect(numreTekst3([1, 2, 22, 23, 24])).toBe('1 til 2 og 22 til 24');
	});

	it('klarer ét tal', () => {
		expect(numreTekst3([5])).toBe('5');
	});

	it('giver tom streng ved ingenting', () => {
		expect(numreTekst3([])).toBe('');
	});
});

describe('uroerteTekst3', () => {
	it('siger praecis hvad der ikke bliver roert', () => {
		// Linjen er lige saa vigtig som listen over det der aendres.
		expect(uroerteTekst3([15, 16, 17, 18, 19, 20, 21], 84)).toBe(
			'Dag 1 til 14 og 22 til 84 er urørte.'
		);
	});

	it('siger til naar alt bliver aendret', () => {
		expect(uroerteTekst3([1, 2, 3], 3)).toBe('Alle dage i programmet bliver ændret.');
	});

	it('siger til naar ingenting bliver aendret', () => {
		expect(uroerteTekst3([], 14)).toBe('Ingen dage bliver ændret.');
	});
});

describe('samtalen', () => {
	const besked = (i: number): AiBesked3 => ({ rolle: 'bruger', tekst: `nr ${i}` });

	it('bremser foerst efter mange beskeder', () => {
		expect(maaSendeMere3([besked(1), besked(2)])).toBe(true);
		expect(maaSendeMere3(Array.from({ length: 40 }, (_, i) => besked(i)))).toBe(false);
	});

	it('kraever noget i beskeden', () => {
		expect(validerBesked3('   ')).toBe('Skriv hvad du vil have.');
		expect(validerBesked3('n'.repeat(1001))).toContain('1000 tegn');
		expect(validerBesked3('Lav et program til begyndere')).toBeNull();
	});
});

describe('forslagTekst3', () => {
	it('samler kategori og antal', () => {
		const forslag = { navn: 'A', beskrivelse: '', antalDage: 14, dage: [] };
		expect(forslagTekst3(forslag, 'Med håndvægte')).toBe('Med håndvægte · 14 træninger');
	});

	it('boejer ental rigtigt', () => {
		expect(forslagTekst3({ navn: 'A', beskrivelse: '', antalDage: 1, dage: [] }, '')).toBe(
			'1 træning'
		);
	});
});

describe('graenser', () => {
	it('sender hoejst fjorten dage afsted ad gangen', () => {
		expect(MAX_RET_DAGE).toBe(14);
	});
});
