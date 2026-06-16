import { describe, it, expect } from 'vitest';
import {
	dagStatus,
	formatDato,
	getCurrentDay,
	lektionSynligNu,
	lektionTidsstatus,
	nyLektion,
	tomForlobDag,
	ugeForDag
} from './forlob';

describe('getCurrentDay', () => {
	it('returnerer 0 på startdagen (baseline)', () => {
		const forlob = { startDato: '2026-05-01', antalDage: 21 };
		const now = new Date(2026, 4, 1, 10, 0);
		expect(getCurrentDay(forlob, now)).toBe(0);
	});

	it('returnerer 1 dagen efter start (første programdag)', () => {
		const forlob = { startDato: '2026-04-26', antalDage: 21 };
		const now = new Date(2026, 3, 27, 10, 0);
		expect(getCurrentDay(forlob, now)).toBe(1);
	});

	it('returnerer 8 dagen efter en uge (dag 8)', () => {
		const forlob = { startDato: '2026-04-26', antalDage: 21 };
		const now = new Date(2026, 4, 4, 10, 0);
		expect(getCurrentDay(forlob, now)).toBe(8);
	});

	it('returnerer 21 på sidste programdag', () => {
		const forlob = { startDato: '2026-04-26', antalDage: 21 };
		const now = new Date(2026, 4, 17, 10, 0);
		expect(getCurrentDay(forlob, now)).toBe(21);
	});

	it('returnerer null hvis startdato er i fremtiden', () => {
		const forlob = { startDato: '2027-01-01', antalDage: 21 };
		const now = new Date(2026, 4, 4, 10, 0);
		expect(getCurrentDay(forlob, now)).toBeNull();
	});

	it('ignorerer klokkeslæt og bruger kun dato', () => {
		const forlob = { startDato: '2026-05-01', antalDage: 21 };
		const morgen = new Date(2026, 4, 1, 5, 0);
		const aften = new Date(2026, 4, 1, 23, 59);
		expect(getCurrentDay(forlob, morgen)).toBe(0);
		expect(getCurrentDay(forlob, aften)).toBe(0);
	});
});

describe('formatDato', () => {
	it('formaterer en mandag i januar', () => {
		const d = new Date(2026, 0, 5);
		expect(formatDato(d)).toBe('Mandag, 5. januar');
	});

	it('formaterer en tirsdag i juni', () => {
		const d = new Date(2026, 5, 2);
		expect(formatDato(d)).toBe('Tirsdag, 2. juni');
	});

	it('formaterer en søndag i december', () => {
		const d = new Date(2026, 11, 27);
		expect(formatDato(d)).toBe('Søndag, 27. december');
	});
});

describe('ugeForDag', () => {
	it('returnerer 0 for dag 0 (baseline)', () => {
		expect(ugeForDag(0)).toBe(0);
		expect(ugeForDag(-1)).toBe(0);
	});

	it('returnerer 1 for dag 1-7', () => {
		expect(ugeForDag(1)).toBe(1);
		expect(ugeForDag(7)).toBe(1);
	});

	it('returnerer 2 for dag 8-14', () => {
		expect(ugeForDag(8)).toBe(2);
		expect(ugeForDag(14)).toBe(2);
	});

	it('returnerer 3 for dag 15-21', () => {
		expect(ugeForDag(15)).toBe(3);
		expect(ugeForDag(21)).toBe(3);
	});
});

describe('dagStatus', () => {
	it('returnerer fremtid hvis aktivDag er null (ikke startet)', () => {
		expect(dagStatus(1, null)).toBe('fremtid');
	});

	it('returnerer aktiv hvis dagNummer matcher aktivDag', () => {
		expect(dagStatus(8, 8)).toBe('aktiv');
	});

	it('returnerer fortid hvis dagen er passeret', () => {
		expect(dagStatus(3, 8)).toBe('fortid');
	});

	it('returnerer fremtid hvis dagen ligger ude i forløbet', () => {
		expect(dagStatus(15, 8)).toBe('fremtid');
	});
});

describe('nyLektion', () => {
	it('returnerer LektionItem med tomt indhold', () => {
		const l = nyLektion();
		expect(l.titel).toBe('');
		expect(l.beskrivelse).toBe('');
		expect(l.varighedMin).toBe(0);
		expect(l.format).toBe('');
		expect(l.url).toBe('');
	});

	it('returnerer unikt id pr kald', () => {
		const a = nyLektion();
		const b = nyLektion();
		expect(a.id).not.toBe(b.id);
	});
});

describe('tomForlobDag', () => {
	it('returnerer tom dag med korrekt uge', () => {
		const d = tomForlobDag(8);
		expect(d.dagNummer).toBe(8);
		expect(d.uge).toBe(2);
		expect(d.lektioner).toEqual([]);
		expect(d.noteFraLinn).toBe('');
	});

	it('returnerer baseline-dag med uge 0', () => {
		const d = tomForlobDag(0);
		expect(d.dagNummer).toBe(0);
		expect(d.uge).toBe(0);
	});
});

describe('lektionSynligNu', () => {
	it('uden tidsbegrænsning er altid synlig', () => {
		expect(lektionSynligNu({}, new Date(2026, 5, 17, 23, 0))).toBe(true);
	});

	it('er synlig på selve sluttidspunktet (kl. 22:00)', () => {
		const l = { skjulEfter: '2026-06-17T22:00' };
		expect(lektionSynligNu(l, new Date(2026, 5, 17, 22, 0, 30))).toBe(true);
	});

	it('er skjult kl. 22:01', () => {
		const l = { skjulEfter: '2026-06-17T22:00' };
		expect(lektionSynligNu(l, new Date(2026, 5, 17, 22, 1, 0))).toBe(false);
	});

	it('er skjult før visFra', () => {
		const l = { visFra: '2026-06-17T08:00' };
		expect(lektionSynligNu(l, new Date(2026, 5, 17, 7, 59))).toBe(false);
	});

	it('er synlig i vinduet mellem visFra og skjulEfter', () => {
		const l = { visFra: '2026-06-17T08:00', skjulEfter: '2026-06-17T22:00' };
		expect(lektionSynligNu(l, new Date(2026, 5, 17, 12, 0))).toBe(true);
	});

	it('ignorerer ugyldige datoer', () => {
		expect(lektionSynligNu({ skjulEfter: 'volapyk' }, new Date(2026, 5, 17))).toBe(true);
	});
});

describe('lektionTidsstatus', () => {
	it('altid uden begrænsning', () => {
		expect(lektionTidsstatus({})).toBe('altid');
	});

	it('foer når vi er før visFra', () => {
		const l = { visFra: '2026-06-17T08:00' };
		expect(lektionTidsstatus(l, new Date(2026, 5, 17, 7, 0))).toBe('foer');
	});

	it('aktiv i vinduet', () => {
		const l = { visFra: '2026-06-17T08:00', skjulEfter: '2026-06-17T22:00' };
		expect(lektionTidsstatus(l, new Date(2026, 5, 17, 12, 0))).toBe('aktiv');
	});

	it('udloebet efter skjulEfter', () => {
		const l = { skjulEfter: '2026-06-17T22:00' };
		expect(lektionTidsstatus(l, new Date(2026, 5, 18, 0, 0))).toBe('udloebet');
	});
});
