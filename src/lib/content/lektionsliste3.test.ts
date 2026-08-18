import { describe, it, expect } from 'vitest';
import {
	byggForlobRaekker,
	byggLektionsliste,
	byggNoteliste,
	bonusTekst,
	forlobAdgang,
	formaterAabner,
	gennemfoertTekst,
	lektionerMedNote,
	opgoerSete,
	type AdgangVilkaar,
	type DagKilde,
	type ListeLektion,
	type NoteKilde
} from './lektionsliste3';
import type { LektionItem } from './forlob';
import type { AktivtForlob, GennemfoertForlob } from './adgang3';

const DAG_MS = 86_400_000;

function ms(aar: number, maaned: number, dag: number, time = 12): number {
	return new Date(aar, maaned - 1, dag, time, 0, 0).getTime();
}

/** Lokal ISO-streng som Linn gemmer dem i admin, fx '2026-08-20T09:00'. */
function iso(aar: number, maaned: number, dag: number, time = 9): string {
	const m = `${maaned}`.padStart(2, '0');
	const d = `${dag}`.padStart(2, '0');
	const t = `${time}`.padStart(2, '0');
	return `${aar}-${m}-${d}T${t}:00`;
}

function lektion(id: string, ekstra: Partial<LektionItem> = {}): LektionItem {
	return {
		id,
		titel: `Lektion ${id}`,
		beskrivelse: '',
		varighedMin: 10,
		format: 'video',
		url: 'https://vimeo.com/123',
		...ekstra
	};
}

function dag(dagNummer: number, ...lektioner: LektionItem[]): DagKilde {
	return { dagNummer, lektioner };
}

function aktivt(ekstra: Partial<AktivtForlob> = {}): AktivtForlob {
	return {
		forlobId: 'kropsro_maj_2026',
		navn: 'Kropsro, maj 2026',
		produkt: 'premiumforløb',
		dagNummer: 12,
		antalDage: 21,
		startMs: ms(2026, 5, 1),
		slutMs: ms(2026, 5, 22),
		...ekstra
	};
}

function gennemfoert(ekstra: Partial<GennemfoertForlob> = {}): GennemfoertForlob {
	return {
		forlobId: 'kickstart_marts_2026',
		navn: 'Kickstart, marts 2026',
		aar: 2026,
		slutMs: ms(2026, 3, 21),
		...ekstra
	};
}

// ============================================================
// Raekkerne paa Profil
// ============================================================

describe('byggForlobRaekker', () => {
	it('det aktive forloeb staar oeverst, de gennemfoerte under', () => {
		const r = byggForlobRaekker([aktivt()], [gennemfoert()]);
		expect(r.map((x) => x.forlobId)).toEqual(['kropsro_maj_2026', 'kickstart_marts_2026']);
		expect(r[0].aktiv).toBe(true);
		expect(r[1].aktiv).toBe(false);
	});

	it('det aktive viser hvor langt hun er', () => {
		const r = byggForlobRaekker([aktivt()], []);
		expect(r[0].under).toBe('Dag 12 af 21');
		expect(r[0].fremgang).toBeCloseTo(12 / 21);
	});

	it('det gennemfoerte viser maaned og aar', () => {
		const r = byggForlobRaekker([], [gennemfoert()]);
		expect(r[0].under).toBe('Gennemført marts 2026');
		expect(r[0].fremgang).toBeNull();
	});

	// Et forloeb der ikke er sat faerdigt op maa ikke give division med nul.
	it('et forloeb uden laengde faar hverken ring eller "af N"', () => {
		const r = byggForlobRaekker([aktivt({ antalDage: 0, dagNummer: 3 })], []);
		expect(r[0].under).toBe('Dag 3');
		expect(r[0].fremgang).toBeNull();
	});

	it('fremgangen kan ikke gaa over 1, selvom hun er forbi sidste dag', () => {
		const r = byggForlobRaekker([aktivt({ dagNummer: 30, antalDage: 21 })], []);
		expect(r[0].fremgang).toBe(1);
	});

	it('fremgangen kan ikke gaa under 0 paa baseline-dagen', () => {
		const r = byggForlobRaekker([aktivt({ dagNummer: 0 })], []);
		expect(r[0].fremgang).toBe(0);
	});

	// Staar det samme forloeb begge steder, er den aktive raekke den sande.
	it('samme forloeb staar kun én gang, og som aktivt', () => {
		const r = byggForlobRaekker(
			[aktivt({ forlobId: 'x' })],
			[gennemfoert({ forlobId: 'x', navn: 'Gammelt navn' })]
		);
		expect(r).toHaveLength(1);
		expect(r[0].aktiv).toBe(true);
	});

	it('flere aktive forloeb kommer alle med', () => {
		const r = byggForlobRaekker([aktivt({ forlobId: 'a' }), aktivt({ forlobId: 'b' })], []);
		expect(r.map((x) => x.forlobId)).toEqual(['a', 'b']);
	});

	it('ingen forloeb giver en tom liste', () => {
		expect(byggForlobRaekker([], [])).toEqual([]);
	});
});

// ============================================================
// Adgang: de 90 dages bibliotek-bonus
// ============================================================

function vilkaar(ekstra: Partial<AdgangVilkaar> = {}): AdgangVilkaar {
	return { harApp: false, bonusSlutMs: null, nu: ms(2026, 8, 18), ...ekstra };
}

describe('forlobAdgang', () => {
	// Samme regel som spaerring3 punkt 1. Hun har betalt for forloebet.
	it('et forloeb der koerer er altid aabent, ogsaa uden abonnement', () => {
		expect(forlobAdgang(true, vilkaar())).toBe('aaben');
	});

	it('har hun app-adgang, er de gamle forloeb aabne', () => {
		expect(forlobAdgang(false, vilkaar({ harApp: true }))).toBe('aaben');
	});

	it('uden app-adgang men inden for de 90 dage er den paa bonus', () => {
		expect(forlobAdgang(false, vilkaar({ bonusSlutMs: ms(2026, 10, 1) }))).toBe('bonus');
	});

	it('efter de 90 dage er den lukket', () => {
		expect(forlobAdgang(false, vilkaar({ bonusSlutMs: ms(2026, 7, 1) }))).toBe('lukket');
	});

	it('har hun aldrig haft en bonus, er den lukket', () => {
		expect(forlobAdgang(false, vilkaar())).toBe('lukket');
	});

	// App-adgang slaar bonussen. Saa er der ingen nedtaelling at vise.
	it('app-adgang vinder over en udloebet bonus', () => {
		expect(forlobAdgang(false, vilkaar({ harApp: true, bonusSlutMs: ms(2026, 1, 1) }))).toBe(
			'aaben'
		);
	});
});

describe('bonusTekst', () => {
	const nu = ms(2026, 8, 18);

	it('taeller dagene', () => {
		expect(bonusTekst(ms(2026, 8, 28), nu)).toBe('Åben 10 dage endnu');
	});

	it('sidste dag hedder dagen ud', () => {
		expect(bonusTekst(ms(2026, 8, 18, 23), nu)).toBe('Åben dagen ud');
	});

	it('en dato der allerede er passeret hedder ogsaa dagen ud', () => {
		expect(bonusTekst(ms(2026, 8, 1), nu)).toBe('Åben dagen ud');
	});
});

describe('byggForlobRaekker med adgang', () => {
	it('uden vilkaar er alt aabent', () => {
		const r = byggForlobRaekker([], [gennemfoert()]);
		expect(r[0].adgang).toBe('aaben');
		expect(r[0].under).toBe('Gennemført marts 2026');
	});

	it('et forloeb paa bonus viser nedtaellingen i stedet for datoen', () => {
		const r = byggForlobRaekker([], [gennemfoert()], vilkaar({ bonusSlutMs: ms(2026, 8, 28) }));
		expect(r[0].adgang).toBe('bonus');
		expect(r[0].under).toBe('Åben 10 dage endnu');
	});

	it('et lukket forloeb siger at kun noterne er tilbage', () => {
		const r = byggForlobRaekker([], [gennemfoert()], vilkaar());
		expect(r[0].adgang).toBe('lukket');
		expect(r[0].under).toBe('Kun dine noter');
	});

	it('det aktive forloeb er aabent uanset vilkaarene', () => {
		const r = byggForlobRaekker([aktivt()], [], vilkaar());
		expect(r[0].adgang).toBe('aaben');
		expect(r[0].under).toBe('Dag 12 af 21');
	});
});

describe('gennemfoertTekst', () => {
	it('skriver maaneden med ord', () => {
		expect(gennemfoertTekst(ms(2025, 9, 30))).toBe('Gennemført september 2025');
	});
});

// ============================================================
// Listen inde paa ét forloeb
// ============================================================

describe('byggLektionsliste', () => {
	const nu = ms(2026, 5, 13);

	it('samler lektionerne fra alle dage i dagsraekkefoelge', () => {
		const liste = byggLektionsliste([dag(3, lektion('c')), dag(1, lektion('a'), lektion('b'))], {
			aktivDagNummer: 12,
			nu
		});
		expect(liste.map((p) => p.lektion.id)).toEqual(['a', 'b', 'c']);
		expect(liste.map((p) => p.dagNummer)).toEqual([1, 1, 3]);
	});

	it('dage uden lektioner falder ud', () => {
		const liste = byggLektionsliste([dag(1), dag(2, lektion('a'))], { aktivDagNummer: 12, nu });
		expect(liste).toHaveLength(1);
	});

	it('lektioner paa dage hun har naaet er aabne', () => {
		const liste = byggLektionsliste([dag(12, lektion('a'))], { aktivDagNummer: 12, nu });
		expect(liste[0].aaben).toBe(true);
		expect(liste[0].aabnerTekst).toBe('');
	});

	// Linns beslutning 18. august: de skal SES, ikke skjules.
	it('lektioner laengere fremme staar med paa listen, men laast', () => {
		const liste = byggLektionsliste([dag(14, lektion('a'))], { aktivDagNummer: 12, nu });
		expect(liste).toHaveLength(1);
		expect(liste[0].aaben).toBe(false);
	});

	// Vi regner fra i dag og ikke fra startdatoen, fordi dagNummer allerede
	// har kundens pauser med.
	it('den laaste dato regnes fra i dag plus de dage der mangler', () => {
		const liste = byggLektionsliste([dag(14, lektion('a'))], { aktivDagNummer: 12, nu });
		expect(liste[0].aabnerTekst).toBe('Åbner 15. maj');
	});

	it('naeste dag hedder i morgen', () => {
		const liste = byggLektionsliste([dag(13, lektion('a'))], { aktivDagNummer: 12, nu });
		expect(liste[0].aabnerTekst).toBe('Åbner i morgen');
	});

	it('et gennemfoert forloeb har alle dage aabne', () => {
		const liste = byggLektionsliste([dag(1, lektion('a')), dag(21, lektion('b'))], {
			aktivDagNummer: null,
			nu
		});
		expect(liste.every((p) => p.aaben)).toBe(true);
	});

	it('baseline-dagen er aaben fra start', () => {
		const liste = byggLektionsliste([dag(0, lektion('a'))], { aktivDagNummer: 0, nu });
		expect(liste[0].aaben).toBe(true);
	});

	// ── Linns eget synlighedsvindue ───────────────────────────

	it('en lektion med visFra i fremtiden er laast, selvom dagen er aaben', () => {
		const liste = byggLektionsliste([dag(2, lektion('a', { visFra: iso(2026, 5, 20) }))], {
			aktivDagNummer: 12,
			nu
		});
		expect(liste[0].aaben).toBe(false);
		expect(liste[0].aabnerTekst).toBe('Åbner 20. maj');
	});

	it('en lektion med visFra i fortiden er aaben', () => {
		const liste = byggLektionsliste([dag(2, lektion('a', { visFra: iso(2026, 5, 1) }))], {
			aktivDagNummer: 12,
			nu
		});
		expect(liste[0].aaben).toBe(true);
	});

	it('visFra laaser ogsaa i et gennemfoert forloeb', () => {
		const liste = byggLektionsliste([dag(2, lektion('a', { visFra: iso(2026, 6, 1) }))], {
			aktivDagNummer: null,
			nu
		});
		expect(liste[0].aaben).toBe(false);
	});

	// Er baade dagen og vinduet i vejen, er det den sidste af dem der gaelder.
	it('er begge laase i spil, vinder den der aabner sidst', () => {
		const liste = byggLektionsliste([dag(14, lektion('a', { visFra: iso(2026, 5, 25) }))], {
			aktivDagNummer: 12,
			nu
		});
		expect(liste[0].aabnerTekst).toBe('Åbner 25. maj');
	});

	it('og omvendt naar dagen ligger senest', () => {
		const liste = byggLektionsliste([dag(20, lektion('a', { visFra: iso(2026, 5, 14) }))], {
			aktivDagNummer: 12,
			nu
		});
		expect(liste[0].aabnerTekst).toBe('Åbner 21. maj');
	});

	// ── Taget ned af Linn ─────────────────────────────────────

	it('en lektion hun har taget ned ryger helt af listen', () => {
		const liste = byggLektionsliste([dag(2, lektion('a', { skjulEfter: iso(2026, 5, 1) }))], {
			aktivDagNummer: 12,
			nu
		});
		expect(liste).toEqual([]);
	});

	it('en lektion hvis vindue stadig loeber bliver staaende', () => {
		const liste = byggLektionsliste([dag(2, lektion('a', { skjulEfter: iso(2026, 5, 30) }))], {
			aktivDagNummer: 12,
			nu
		});
		expect(liste).toHaveLength(1);
		expect(liste[0].aaben).toBe(true);
	});

	it('en ugyldig dato ignoreres i stedet for at laase lektionen', () => {
		const liste = byggLektionsliste([dag(2, lektion('a', { visFra: 'ikke en dato' }))], {
			aktivDagNummer: 12,
			nu
		});
		expect(liste[0].aaben).toBe(true);
	});

	it('en tom liste dage giver en tom liste lektioner', () => {
		expect(byggLektionsliste([], { aktivDagNummer: 12, nu })).toEqual([]);
	});
});

describe('formaterAabner', () => {
	const nu = ms(2026, 5, 13, 12);

	it('noget der aabner senere i dag hedder i dag', () => {
		expect(formaterAabner(ms(2026, 5, 13, 23), nu)).toBe('Åbner i dag');
	});

	it('en dato der allerede er passeret hedder ogsaa i dag', () => {
		expect(formaterAabner(nu - DAG_MS, nu)).toBe('Åbner i dag');
	});

	// Kl. 23 i dag til kl. 01 i nat er to timer, men én kalenderdag.
	it('faa timer over midnat hedder i morgen', () => {
		expect(formaterAabner(ms(2026, 5, 14, 1), ms(2026, 5, 13, 23))).toBe('Åbner i morgen');
	});

	it('laengere ude skrives datoen ud', () => {
		expect(formaterAabner(ms(2026, 6, 2), nu)).toBe('Åbner 2. juni');
	});
});

// ============================================================
// Hendes noter
// ============================================================

function note(lektionId: string, tekst = 'En note', opdateret = ms(2026, 5, 10)): NoteKilde {
	return { lektionId, tekst, opdateret };
}

describe('lektionerMedNote', () => {
	it('samler de lektioner der har en note', () => {
		expect(lektionerMedNote([note('a'), note('c')])).toEqual(new Set(['a', 'c']));
	});

	// gemLektionNote sletter tomme noter, men et gammelt dokument kan
	// stadig ligge med mellemrum i. Det skal ikke give en blyant.
	it('en note der kun er mellemrum taeller ikke', () => {
		expect(lektionerMedNote([note('a', '   ')])).toEqual(new Set());
	});

	it('ingen noter giver et tomt saet', () => {
		expect(lektionerMedNote([])).toEqual(new Set());
	});
});

describe('byggNoteliste', () => {
	const liste: ListeLektion[] = [
		{ dagNummer: 9, lektion: lektion('c'), aaben: true, aabnerTekst: '' },
		{ dagNummer: 2, lektion: lektion('a'), aaben: true, aabnerTekst: '' },
		{ dagNummer: 14, lektion: lektion('d'), aaben: false, aabnerTekst: 'Åbner i morgen' }
	];

	it('noterne staar i forloebets raekkefoelge, ikke i den de blev skrevet', () => {
		const r = byggNoteliste(liste, [note('c'), note('a')]);
		expect(r.map((n) => n.lektionId)).toEqual(['a', 'c']);
		expect(r.map((n) => n.dagNummer)).toEqual([2, 9]);
	});

	it('noten faar lektionens titel med', () => {
		const r = byggNoteliste(liste, [note('a')]);
		expect(r[0].titel).toBe('Lektion a');
	});

	it('en note paa en laast lektion er ikke aaben', () => {
		const r = byggNoteliste(liste, [note('d')]);
		expect(r[0].aaben).toBe(false);
	});

	it('lektioner uden note kommer ikke med', () => {
		expect(byggNoteliste(liste, [])).toEqual([]);
	});

	it('en tom note kommer ikke med', () => {
		expect(byggNoteliste(liste, [note('a', '  ')])).toEqual([]);
	});

	// Linns beslutning 18. august: hendes egne ord bliver staaende, ogsaa
	// naar lektionen bag dem er taget ned.
	it('en note overlever sin lektion og havner nederst', () => {
		const r = byggNoteliste(liste, [note('vaek'), note('a')]);
		expect(r.map((n) => n.lektionId)).toEqual(['a', 'vaek']);
		expect(r[1].dagNummer).toBeNull();
		expect(r[1].aaben).toBe(false);
		expect(r[1].titel).toBe('En lektion der ikke ligger her længere');
	});

	it('flere forladte noter staar nyeste foerst', () => {
		const r = byggNoteliste(liste, [
			note('x', 'gammel', ms(2026, 1, 1)),
			note('y', 'ny', ms(2026, 4, 1))
		]);
		expect(r.map((n) => n.tekst)).toEqual(['ny', 'gammel']);
	});

	it('en helt tom liste giver ingen noter', () => {
		expect(byggNoteliste([], [])).toEqual([]);
	});
});

describe('opgoerSete', () => {
	const liste: ListeLektion[] = [
		{ dagNummer: 1, lektion: lektion('a'), aaben: true, aabnerTekst: '' },
		{ dagNummer: 2, lektion: lektion('b'), aaben: true, aabnerTekst: '' },
		{ dagNummer: 9, lektion: lektion('c'), aaben: false, aabnerTekst: 'Åbner i morgen' }
	];

	it('taeller sete, aabne og alle', () => {
		expect(opgoerSete(liste, new Set(['a']))).toEqual({ sete: 1, aabne: 2, ialt: 3 });
	});

	it('en tom liste giver nuller', () => {
		expect(opgoerSete([], new Set())).toEqual({ sete: 0, aabne: 0, ialt: 0 });
	});
});
