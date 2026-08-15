import { describe, it, expect } from 'vitest';
import type { TraeningKategori3 } from './traeningKategori3';
import type { Traeningsprogram3 } from './traeningsprogram3';
import {
	daekning3,
	datoTekst3,
	findesAllerede3,
	huller3,
	kopierTildelinger3,
	maaByggeEget3,
	maaSesMedUdstyr3,
	maalerIDage3,
	modtagerTekst3,
	periodeTekst3,
	programmerForKunde3,
	rammerKunde3,
	sorterTildelinger3,
	tildelingStatus3,
	type KundeKontekst3,
	type Traeningstildeling3
} from './traeningTildeling3';

const IDAG = '2026-08-15';

function tildeling(felter: Partial<Traeningstildeling3> = {}): Traeningstildeling3 {
	return {
		id: 't1',
		type: 'program',
		programId: 'p1',
		modtagerType: 'hold',
		modtagerId: 'kickstart_juni_2026',
		modtagerNavn: 'Kickstart juni 2026',
		fraDag: 0,
		tilDag: null,
		fraDato: null,
		tilDato: null,
		tildeltAt: 0,
		tildeltAf: 'admin',
		...felter
	};
}

function program(felter: Partial<Traeningsprogram3> = {}): Traeningsprogram3 {
	return {
		id: 'p1',
		navn: 'Kickstart 21',
		beskrivelse: '',
		kategoriId: 'kb',
		antalDage: 21,
		starterForfra: true,
		klar: true,
		oprettetAt: 0,
		opdateretAt: 0,
		...felter
	};
}

function kategori(id: string, navn: string, visesAltid = false): TraeningKategori3 {
	return { id, navn, visesAltid, udstyrTag: null, raekkefolge: 0 };
}

const KATEGORIER = [kategori('krop', 'Uden redskaber', true), kategori('kb', 'Med kettlebell')];

function kunde(felter: Partial<KundeKontekst3> = {}): KundeKontekst3 {
	return {
		uid: 'u1',
		forlob: [{ id: 'kickstart_juni_2026', dag: 40 }],
		harAbonnement: false,
		udstyr: ['krop', 'kb'],
		idag: IDAG,
		...felter
	};
}

describe('maalerIDage3', () => {
	it('er sand for hold og falsk for de andre', () => {
		expect(maalerIDage3({ modtagerType: 'hold' })).toBe(true);
		expect(maalerIDage3({ modtagerType: 'kunde' })).toBe(false);
		expect(maalerIDage3({ modtagerType: 'medlemmer' })).toBe(false);
		expect(maalerIDage3({ modtagerType: 'alle' })).toBe(false);
	});
});

describe('datoTekst3', () => {
	it('skriver datoen paa dansk', () => {
		expect(datoTekst3('2026-10-01')).toBe('1. oktober 2026');
		expect(datoTekst3('2026-05-24')).toBe('24. maj 2026');
	});
});

describe('tildelingStatus3, hold', () => {
	it('venter naar holdet ikke er startet', () => {
		expect(tildelingStatus3(tildeling(), { idag: IDAG, holdDag: null })).toBe('venter');
	});

	it('venter naar holdet ikke er naaet til dagen', () => {
		expect(tildelingStatus3(tildeling({ fraDag: 15 }), { idag: IDAG, holdDag: 3 })).toBe('venter');
	});

	it('er aktiv paa selve dagen', () => {
		expect(tildelingStatus3(tildeling({ fraDag: 15 }), { idag: IDAG, holdDag: 15 })).toBe('aktiv');
	});

	it('er aktiv naar holdet er kommet forbi dagen', () => {
		// Tildeler du fra dag 15 til et hold paa dag 40, faar de det med det samme.
		expect(tildelingStatus3(tildeling({ fraDag: 15 }), { idag: IDAG, holdDag: 40 })).toBe('aktiv');
	});

	it('slutter efter tilDag', () => {
		const t = tildeling({ fraDag: 1, tilDag: 21 });
		expect(tildelingStatus3(t, { idag: IDAG, holdDag: 21 })).toBe('aktiv');
		expect(tildelingStatus3(t, { idag: IDAG, holdDag: 22 })).toBe('slut');
	});
});

describe('tildelingStatus3, datoer', () => {
	const person = { modtagerType: 'kunde' as const, modtagerId: 'u1', modtagerNavn: 'Mette' };

	it('er aktiv uden datoer', () => {
		expect(tildelingStatus3(tildeling(person), { idag: IDAG })).toBe('aktiv');
	});

	it('venter foer startdatoen', () => {
		const t = tildeling({ ...person, fraDato: '2026-10-01' });
		expect(tildelingStatus3(t, { idag: IDAG })).toBe('venter');
	});

	it('er aktiv paa selve startdatoen', () => {
		const t = tildeling({ ...person, fraDato: IDAG });
		expect(tildelingStatus3(t, { idag: IDAG })).toBe('aktiv');
	});

	it('er aktiv paa selve slutdatoen og slut dagen efter', () => {
		expect(tildelingStatus3(tildeling({ ...person, tilDato: IDAG }), { idag: IDAG })).toBe('aktiv');
		expect(
			tildelingStatus3(tildeling({ ...person, tilDato: '2026-08-14' }), { idag: IDAG })
		).toBe('slut');
	});
});

describe('periodeTekst3', () => {
	it('skriver holdets periode i dage', () => {
		expect(periodeTekst3(tildeling())).toBe('Fra første dag');
		expect(periodeTekst3(tildeling({ fraDag: 15 }))).toBe('Fra dag 15');
		expect(periodeTekst3(tildeling({ fraDag: 15, tilDag: 21 }))).toBe('Dag 15 til 21');
	});

	it('skriver de andres periode i datoer', () => {
		const p = { modtagerType: 'alle' as const, modtagerId: '' };
		expect(periodeTekst3(tildeling(p))).toBe('Med det samme');
		expect(periodeTekst3(tildeling({ ...p, fraDato: '2026-10-01' }))).toBe('Fra 1. oktober 2026');
		expect(periodeTekst3(tildeling({ ...p, tilDato: '2026-10-01' }))).toBe('Indtil 1. oktober 2026');
		expect(
			periodeTekst3(tildeling({ ...p, fraDato: '2026-06-01', tilDato: '2026-06-30' }))
		).toBe('1. juni 2026 til 30. juni 2026');
	});
});

describe('modtagerTekst3', () => {
	it('skriver de faste navne for medlemmer og alle', () => {
		expect(modtagerTekst3(tildeling({ modtagerType: 'medlemmer', modtagerNavn: '' }))).toBe(
			'Alle med et abonnement'
		);
		expect(modtagerTekst3(tildeling({ modtagerType: 'alle', modtagerNavn: '' }))).toBe(
			'Alle med appen'
		);
	});

	it('bruger det gemte navn for hold og person', () => {
		expect(modtagerTekst3(tildeling())).toBe('Kickstart juni 2026');
	});
});

describe('rammerKunde3', () => {
	it('rammer alle', () => {
		expect(rammerKunde3(tildeling({ modtagerType: 'alle' }), kunde())).toBe(true);
	});

	it('rammer kun medlemmer med abonnement', () => {
		const t = tildeling({ modtagerType: 'medlemmer' });
		expect(rammerKunde3(t, kunde({ harAbonnement: true }))).toBe(true);
		expect(rammerKunde3(t, kunde({ harAbonnement: false }))).toBe(false);
	});

	it('rammer én person paa uid', () => {
		const t = tildeling({ modtagerType: 'kunde', modtagerId: 'u1' });
		expect(rammerKunde3(t, kunde())).toBe(true);
		expect(rammerKunde3(t, kunde({ uid: 'u2' }))).toBe(false);
	});

	it('rammer kun det hold hun er paa', () => {
		expect(rammerKunde3(tildeling(), kunde())).toBe(true);
		expect(rammerKunde3(tildeling({ modtagerId: 'kickstart_sep_2026' }), kunde())).toBe(false);
	});

	it('rammer en forloebskunde ogsaa naar hun har abonnement', () => {
		// Linns definition 15. august: medlem betyder aktivt abonnement,
		// uanset om hun samtidig er paa et forloeb.
		const t = tildeling({ modtagerType: 'medlemmer' });
		expect(rammerKunde3(t, kunde({ harAbonnement: true }))).toBe(true);
	});
});

describe('maaSesMedUdstyr3', () => {
	it('siger ja til alt naar hun ikke har valgt endnu', () => {
		expect(maaSesMedUdstyr3(program(), KATEGORIER, [])).toBe(true);
	});

	it('siger ja til hendes egen kategori', () => {
		expect(maaSesMedUdstyr3(program({ kategoriId: 'kb' }), KATEGORIER, ['kb'])).toBe(true);
	});

	it('siger nej til en kategori hun ikke har valgt', () => {
		expect(maaSesMedUdstyr3(program({ kategoriId: 'kb' }), KATEGORIER, ['krop'])).toBe(false);
	});

	it('siger altid ja til kropsvaegt', () => {
		// Hun har altid sin egen krop med.
		expect(maaSesMedUdstyr3(program({ kategoriId: 'krop' }), KATEGORIER, ['kb'])).toBe(true);
	});
});

describe('programmerForKunde3', () => {
	const p = program();

	it('viser et tildelt program og siger hvor det kommer fra', () => {
		const r = programmerForKunde3([p], [tildeling()], KATEGORIER, kunde())[0];
		expect(r.vises).toBe(true);
		expect(r.forklaring).toContain('Kickstart juni 2026');
	});

	it('skjuler en kladde', () => {
		const r = programmerForKunde3([program({ klar: false })], [tildeling()], KATEGORIER, kunde())[0];
		expect(r.vises).toBe(false);
		expect(r.afvisning).toBe('kladde');
	});

	it('siger ikke-tildelt naar ingen tildeling rammer hende', () => {
		const r = programmerForKunde3([p], [], KATEGORIER, kunde())[0];
		expect(r.afvisning).toBe('ikke-tildelt');
		expect(r.forklaring).toBe('Ikke tildelt hende');
	});

	it('siger hvornaar den starter', () => {
		const r = programmerForKunde3([p], [tildeling({ fraDag: 50 })], KATEGORIER, kunde())[0];
		expect(r.afvisning).toBe('venter');
		expect(r.forklaring).toBe('Starter først på dag 50');
	});

	it('siger hvornaar den sluttede', () => {
		const r = programmerForKunde3(
			[p],
			[tildeling({ fraDag: 1, tilDag: 30 })],
			KATEGORIER,
			kunde()
		)[0];
		expect(r.afvisning).toBe('sluttet');
		expect(r.forklaring).toBe('Sluttede på dag 30');
	});

	it('siger hvilken kategori hun mangler', () => {
		const r = programmerForKunde3([p], [tildeling()], KATEGORIER, kunde({ udstyr: ['krop'] }))[0];
		expect(r.afvisning).toBe('udstyr');
		expect(r.forklaring).toBe('Hun har ikke valgt Med kettlebell');
	});

	it('viser programmet én gang naar hun faar det to veje', () => {
		const fraHold = tildeling({ id: 'a' });
		const tilHende = tildeling({ id: 'b', modtagerType: 'kunde', modtagerId: 'u1' });
		const r = programmerForKunde3([p], [fraHold, tilHende], KATEGORIER, kunde());
		expect(r).toHaveLength(1);
		expect(r[0].vises).toBe(true);
	});

	it('lader en aktiv tildeling vinde over en der venter', () => {
		const venter = tildeling({ id: 'a', fraDag: 90 });
		const aktiv = tildeling({ id: 'b', modtagerType: 'alle', modtagerId: '' });
		const r = programmerForKunde3([p], [venter, aktiv], KATEGORIER, kunde())[0];
		expect(r.vises).toBe(true);
	});

	it('foretraekker at sige venter frem for slut', () => {
		const sluttet = tildeling({ id: 'a', fraDag: 1, tilDag: 5 });
		const venter = tildeling({ id: 'b', modtagerType: 'kunde', modtagerId: 'u1', fraDato: '2026-12-01' });
		const r = programmerForKunde3([p], [sluttet, venter], KATEGORIER, kunde())[0];
		expect(r.afvisning).toBe('venter');
	});

	it('taeller dagen i det forloeb tildelingen gaelder', () => {
		const paaToForlob = kunde({
			forlob: [
				{ id: 'kickstart_juni_2026', dag: 3 },
				{ id: 'kropsro_maj_2026', dag: 108 }
			]
		});
		const kickstart = tildeling({ fraDag: 15 });
		const kropsro = tildeling({ modtagerId: 'kropsro_maj_2026', fraDag: 15 });
		expect(programmerForKunde3([p], [kickstart], KATEGORIER, paaToForlob)[0].vises).toBe(false);
		expect(programmerForKunde3([p], [kropsro], KATEGORIER, paaToForlob)[0].vises).toBe(true);
	});
});

describe('maaByggeEget3', () => {
	const byg = tildeling({ type: 'byg-eget', programId: '', fraDag: 21 });

	it('er sand naar tildelingen er aktiv', () => {
		expect(maaByggeEget3([byg], kunde())).toBe(true);
	});

	it('er falsk foer dagen er naaet', () => {
		expect(maaByggeEget3([byg], kunde({ forlob: [{ id: 'kickstart_juni_2026', dag: 3 }] }))).toBe(
			false
		);
	});

	it('taeller ikke en almindelig program-tildeling med', () => {
		expect(maaByggeEget3([tildeling()], kunde())).toBe(false);
	});
});

describe('daekning3 og huller3', () => {
	const programmer = [
		program({ id: 'p1', navn: 'Med kettlebell', kategoriId: 'kb' }),
		program({ id: 'p2', navn: 'Uden redskaber', kategoriId: 'krop' }),
		program({ id: 'p3', navn: 'Kladde', kategoriId: 'krop', klar: false })
	];
	const modtager = { type: 'hold' as const, id: 'kickstart_juni_2026' };

	it('samler programmerne pr kategori', () => {
		const d = daekning3(programmer, [tildeling({ programId: 'p1' })], KATEGORIER, modtager);
		expect(d.find((x) => x.kategori.id === 'kb')?.programNavne).toEqual(['Med kettlebell']);
		expect(d.find((x) => x.kategori.id === 'krop')?.programNavne).toEqual([]);
	});

	it('taeller ikke en kladde med', () => {
		const d = daekning3(programmer, [tildeling({ programId: 'p3' })], KATEGORIER, modtager);
		expect(huller3(d).map((k) => k.id)).toContain('krop');
	});

	it('taeller ikke et andet holds tildeling med', () => {
		const andet = tildeling({ programId: 'p1', modtagerId: 'kropsro_maj_2026' });
		expect(huller3(daekning3(programmer, [andet], KATEGORIER, modtager))).toHaveLength(2);
	});

	it('finder hullerne', () => {
		const d = daekning3(programmer, [tildeling({ programId: 'p1' })], KATEGORIER, modtager);
		expect(huller3(d).map((k) => k.navn)).toEqual(['Uden redskaber']);
	});
});

describe('findesAllerede3', () => {
	it('kender en dublet', () => {
		const kandidat = {
			type: 'program' as const,
			programId: 'p1',
			modtagerType: 'hold' as const,
			modtagerId: 'kickstart_juni_2026'
		};
		expect(findesAllerede3([tildeling()], kandidat)).toBe(true);
		expect(findesAllerede3([], kandidat)).toBe(false);
	});

	it('skelner mellem program og byg-eget', () => {
		const byg = tildeling({ type: 'byg-eget', programId: '' });
		expect(
			findesAllerede3([byg], {
				type: 'program',
				programId: '',
				modtagerType: 'hold',
				modtagerId: 'kickstart_juni_2026'
			})
		).toBe(false);
	});
});

describe('kopierTildelinger3', () => {
	const juni = 'kickstart_juni_2026';
	const til = { forlobId: 'kickstart_sep_2026', navn: 'Kickstart september 2026' };
	const alle = [
		tildeling({ id: 'a', programId: 'p1', fraDag: 0 }),
		tildeling({ id: 'b', programId: 'p2', fraDag: 15, tilDag: 20 }),
		tildeling({ id: 'c', type: 'byg-eget', programId: '', fraDag: 21 })
	];

	it('kopierer programmer og dage med over', () => {
		const nye = kopierTildelinger3(alle, juni, til, 123, 'admin');
		expect(nye).toHaveLength(3);
		expect(nye[1].fraDag).toBe(15);
		expect(nye[1].tilDag).toBe(20);
		expect(nye[0].modtagerId).toBe('kickstart_sep_2026');
		expect(nye[0].modtagerNavn).toBe('Kickstart september 2026');
	});

	it('tager byg-eget med', () => {
		const nye = kopierTildelinger3(alle, juni, til, 123, 'admin');
		expect(nye.some((n) => n.type === 'byg-eget')).toBe(true);
	});

	it('springer det over som det nye hold allerede har', () => {
		const medEn = [...alle, tildeling({ id: 'd', programId: 'p1', modtagerId: til.forlobId })];
		const nye = kopierTildelinger3(medEn, juni, til, 123, 'admin');
		expect(nye.map((n) => n.programId)).toEqual(['p2', '']);
	});

	it('giver ingenting naar kilde-holdet er tomt', () => {
		expect(kopierTildelinger3(alle, 'findes_ikke', til, 123, 'admin')).toEqual([]);
	});

	it('roerer ikke datoerne, for et hold maales i dage', () => {
		const nye = kopierTildelinger3(alle, juni, til, 123, 'admin');
		expect(nye[0].fraDato).toBeNull();
		expect(nye[0].tilDato).toBeNull();
	});
});

describe('sorterTildelinger3', () => {
	it('laegger aktive foerst og slut sidst', () => {
		const a = tildeling({ id: 'a', modtagerNavn: 'B-hold' });
		const b = tildeling({ id: 'b', modtagerNavn: 'A-hold' });
		const c = tildeling({ id: 'c', modtagerNavn: 'C-hold' });
		const status = (t: Traeningstildeling3) =>
			t.id === 'a' ? ('slut' as const) : t.id === 'b' ? ('venter' as const) : ('aktiv' as const);
		expect(sorterTildelinger3([a, b, c], status).map((t) => t.id)).toEqual(['c', 'b', 'a']);
	});
});
