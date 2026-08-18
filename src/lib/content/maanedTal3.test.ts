import { describe, it, expect } from 'vitest';
import {
	ANTAL_MAANEDER,
	maanedOverblik,
	maanedsNavn,
	soejleBredde,
	stoersteMaaned,
	stortNavn,
	type DagPunkt
} from './maanedTal3';
import {
	erTredveTredve,
	hvadManglede,
	madOverblik,
	madTekst,
	samlDage,
	type MaaltidKilde
} from './madMaaned3';

/** 18. august 2026. Det ur alle testene regner ud fra. */
const NU = new Date(2026, 7, 18, 12, 0, 0).getTime();

function p(dato: string, vaerdi: number): DagPunkt {
	return { dato, vaerdi };
}

/** Ord der aldrig maa staa paa siden. Linns regel 18. august. */
const FORBUDT = ['fejl', 'sprunget', 'desværre', 'burde', 'manglede', 'ikke nok'];

function tjekVenlig(tekst: string) {
	for (const ord of FORBUDT) {
		expect(tekst.toLowerCase()).not.toContain(ord);
	}
}

describe('maanedOverblik', () => {
	it('lægger sammen naar metoden er sum', () => {
		const o = maanedOverblik([p('2026-08-01', 20), p('2026-08-05', 25)], NU, 'sum');
		expect(o?.denne.vaerdi).toBe(45);
	});

	// Flere maalinger samme dag er stadig ÉN dag naar der regnes snit.
	it('samler flere maalinger paa samme dag til én dag', () => {
		const o = maanedOverblik(
			[p('2026-08-01', 30), p('2026-08-01', 40), p('2026-08-02', 70)],
			NU,
			'gennemsnit'
		);
		expect(o?.denne.dage).toBe(2);
		expect(o?.denne.vaerdi).toBe(70);
	});

	// Kernen i hele reglen: en uge uden registrering maa ikke traekke ned.
	it('gennemsnittet regnes pr dag hun HAR registreret', () => {
		const o = maanedOverblik([p('2026-08-01', 100), p('2026-08-02', 100)], NU, 'gennemsnit');
		expect(o?.denne.vaerdi).toBe(100);
		expect(o?.denne.dage).toBe(2);
	});

	it('en maaned uden data bliver ikke til et nul at sammenligne med', () => {
		const o = maanedOverblik([p('2026-08-01', 50)], NU, 'gennemsnit');
		expect(o?.forrige).toBeNull();
		expect(o?.forskel).toBeNull();
	});

	it('finder den bedste maaned', () => {
		const o = maanedOverblik([p('2026-08-01', 90), p('2026-07-01', 40)], NU, 'gennemsnit');
		expect(o?.bedste).toBe(true);
	});

	it('den foerste maaned nogensinde er ikke bedste', () => {
		expect(maanedOverblik([p('2026-08-01', 90)], NU, 'sum')?.bedste).toBe(false);
	});

	it('soejlerne daekker de seneste maaneder, aeldst foerst', () => {
		const o = maanedOverblik([p('2026-08-01', 50)], NU, 'sum');
		expect(o?.maaneder).toHaveLength(ANTAL_MAANEDER);
		expect(o?.maaneder.at(-1)?.noegle).toBe('2026-08');
		expect(o?.maaneder[0].noegle).toBe('2026-03');
	});

	it('ingen punkter giver intet overblik', () => {
		expect(maanedOverblik([], NU, 'sum')).toBeNull();
	});
});

describe('maanedsNavn og stortNavn', () => {
	it('oversaetter til dansk', () => {
		expect(maanedsNavn('2026-08')).toBe('august');
		expect(maanedsNavn('2026-01')).toBe('januar');
	});

	it('stort begyndelsesbogstav til en saetning', () => {
		expect(stortNavn('august')).toBe('August');
	});
});

describe('soejleBredde og stoersteMaaned', () => {
	it('den stoerste fylder det hele', () => {
		expect(soejleBredde(60, 60)).toBe(100);
	});

	it('en meget lille maaned faar en synlig stump', () => {
		expect(soejleBredde(1, 500)).toBe(4);
	});

	it('nul giver ingen soejle', () => {
		expect(soejleBredde(0, 60)).toBe(0);
	});

	it('uden overblik deles der aldrig med nul', () => {
		expect(stoersteMaaned(null)).toBe(1);
	});
});

// ============================================================
// Mad: 30-30-dage
//
// En 30-30-dag er 30 g protein til morgenmad, frokost OG aftensmad,
// plus 30 g fiber over hele dagen. Snacken har intet maal, men taeller
// med i fiberen. Linns valg M1, 18. august.
// ============================================================

function ml(dato: string, type: string, p2: number, f = 0): MaaltidKilde {
	return { dato, type, totalP: p2, totalF: f };
}

/** En hel dag der rammer metoden. */
function godDag(dato: string): MaaltidKilde[] {
	return [ml(dato, 'morgenmad', 32, 10), ml(dato, 'frokost', 34, 12), ml(dato, 'aftensmad', 36, 9)];
}

describe('erTredveTredve', () => {
	it('alle tre maaltider i maal og fiber i maal taeller', () => {
		expect(samlDage(godDag('2026-08-01')).every(erTredveTredve)).toBe(true);
	});

	it('mangler frokosten sine 30 g, taeller dagen ikke', () => {
		const dag = samlDage([
			ml('2026-08-01', 'morgenmad', 32, 10),
			ml('2026-08-01', 'frokost', 18, 12),
			ml('2026-08-01', 'aftensmad', 36, 9)
		]);
		expect(erTredveTredve(dag[0])).toBe(false);
		expect(hvadManglede(dag[0])).toEqual(['frokost']);
	});

	it('mangler fiberen, taeller dagen ikke', () => {
		const dag = samlDage([
			ml('2026-08-01', 'morgenmad', 32, 3),
			ml('2026-08-01', 'frokost', 34, 4),
			ml('2026-08-01', 'aftensmad', 36, 5)
		]);
		expect(erTredveTredve(dag[0])).toBe(false);
		expect(hvadManglede(dag[0])).toEqual(['fiber']);
	});

	// Snacken har med vilje intet maal, se maaltider3 punkt 1.
	it('snacken skal ikke selv ramme 30 g', () => {
		const dag = samlDage([...godDag('2026-08-01'), ml('2026-08-01', 'snack', 4, 2)]);
		expect(erTredveTredve(dag[0])).toBe(true);
	});

	it('men snackens fiber taeller med i dagen', () => {
		const dag = samlDage([
			ml('2026-08-01', 'morgenmad', 32, 9),
			ml('2026-08-01', 'frokost', 34, 9),
			ml('2026-08-01', 'aftensmad', 36, 9),
			ml('2026-08-01', 'snack', 2, 5)
		]);
		expect(dag[0].fiber).toBe(32);
		expect(erTredveTredve(dag[0])).toBe(true);
	});

	// En dag uden registreret frokost ER ikke en dokumenteret 30-30-dag.
	it('et maaltid hun slet ikke har registreret taeller som nul', () => {
		const dag = samlDage([ml('2026-08-01', 'morgenmad', 40, 40)]);
		expect(erTredveTredve(dag[0])).toBe(false);
	});

	it('praecis 30 er nok, det er et maal og ikke en graense', () => {
		const dag = samlDage([
			ml('2026-08-01', 'morgenmad', 30, 10),
			ml('2026-08-01', 'frokost', 30, 10),
			ml('2026-08-01', 'aftensmad', 30, 10)
		]);
		expect(erTredveTredve(dag[0])).toBe(true);
	});
});

describe('samlDage', () => {
	it('laegger flere poster paa samme maaltid sammen', () => {
		const d = samlDage([
			ml('2026-08-01', 'morgenmad', 20, 5),
			ml('2026-08-01', 'morgenmad', 14, 6)
		]);
		expect(d[0].protein.morgenmad).toBe(34);
		expect(d[0].fiber).toBe(11);
	});

	it('sorterer dagene i tid', () => {
		const d = samlDage([ml('2026-08-05', 'morgenmad', 30), ml('2026-08-01', 'morgenmad', 30)]);
		expect(d.map((x) => x.dato)).toEqual(['2026-08-01', '2026-08-05']);
	});
});

describe('madOverblik', () => {
	it('taeller 30-30-dage pr maaned', () => {
		const o = madOverblik([...godDag('2026-08-01'), ...godDag('2026-08-05')], NU);
		expect(o?.denne.vaerdi).toBe(2);
	});

	it('dage der ikke naaede metoden taelles ikke med', () => {
		const o = madOverblik([...godDag('2026-08-01'), ml('2026-08-05', 'morgenmad', 10, 2)], NU);
		expect(o?.denne.vaerdi).toBe(1);
		expect(o?.registrerede).toBe(2);
	});

	// Kortet skal staa der og sige det roligt, ikke forsvinde.
	it('har hun registreret mad men ingen 30-30-dage, er der stadig et overblik', () => {
		const o = madOverblik([ml('2026-08-01', 'morgenmad', 10, 2)], NU);
		expect(o).not.toBeNull();
		expect(o?.denne.vaerdi).toBe(0);
		expect(o?.registrerede).toBe(1);
	});

	it('ingen mad giver intet overblik', () => {
		expect(madOverblik([], NU)).toBeNull();
	});
});

describe('madTekst', () => {
	it('roser den bedste maaned', () => {
		const o = madOverblik(
			[...godDag('2026-08-01'), ...godDag('2026-08-05'), ...godDag('2026-07-01')],
			NU
		);
		const t = madTekst(o);
		expect(t).toContain('fleste 30-30-dage');
		tjekVenlig(t);
	});

	// Ingen anklage naar det ikke er lykkedes endnu.
	it('nul 30-30-dage bebrejder hende ingenting', () => {
		const t = madTekst(madOverblik([ml('2026-08-01', 'morgenmad', 10, 2)], NU));
		expect(t).toContain('et stykke arbejde');
		tjekVenlig(t);
	});

	// Antallet af registrerede dage staar i sin egen linje under kortet.
	// Staar det ogsaa her, siger skaermen det samme to gange.
	it('naevner ikke hvor mange dage hun har registreret', () => {
		const t = madTekst(madOverblik([ml('2026-08-01', 'morgenmad', 10, 2)], NU));
		expect(t).not.toContain('registreret');
	});

	it('naevner ALDRIG en naevner som "9 af 18"', () => {
		const alle = [
			madTekst(madOverblik([...godDag('2026-08-01')], NU)),
			madTekst(madOverblik([...godDag('2026-08-01'), ...godDag('2026-07-01')], NU)),
			madTekst(madOverblik([ml('2026-08-01', 'morgenmad', 10, 2)], NU)),
			madTekst(null)
		];
		for (const t of alle) {
			expect(t).not.toMatch(/\baf \d+\b/);
			tjekVenlig(t);
		}
	});

	it('ingen mad inviterer i stedet for at bebrejde', () => {
		expect(madTekst(null)).toContain('Når du har registreret');
	});
});

// ============================================================
// Samme tid i maaneden foer.
//
// Fejlen 18. august: traeningskortet sagde "ned 126 min" den 18., fordi
// en halv august blev sammenlignet med en hel juli. Den 1. i hver maaned
// ville det altid se ud som en katastrofe.
// ============================================================

describe('sammenligning med samme tid', () => {
	it('kun maaneden foers foerste dage taeller med', () => {
		// Vi er den 18. Juli har baade tidlige og sene traeninger.
		const o = maanedOverblik(
			[p('2026-08-05', 40), p('2026-07-05', 30), p('2026-07-28', 200)],
			NU,
			'sum'
		);
		// Hele juli er 230, men kun de 30 fra den 5. taeller i forskellen.
		expect(o?.forrige?.vaerdi).toBe(230);
		expect(o?.forrigeSammeTid?.vaerdi).toBe(30);
		expect(o?.forskel).toBe(10);
	});

	it('en halv maaned taber ikke laengere til en hel', () => {
		const o = maanedOverblik(
			[p('2026-08-10', 73), p('2026-07-10', 52), p('2026-07-25', 147)],
			NU,
			'sum'
		);
		// Hele juli er 199 mod august 73. Men paa samme tid stod juli i 52.
		expect(o!.forskel!).toBeGreaterThan(0);
	});

	it('dagen i maaneden foelger med ud, saa teksten kan sige 1.-18.', () => {
		expect(maanedOverblik([p('2026-08-01', 10)], NU, 'sum')?.dagIMaaned).toBe(18);
	});

	it('har hun intet i maaneden foer, er der ikke noget at maale mod', () => {
		const o = maanedOverblik([p('2026-08-01', 40)], NU, 'sum');
		expect(o?.forrigeSammeTid).toBeNull();
		expect(o?.forskel).toBeNull();
	});

	// Traente hun kun sent i juli, er der intet at sammenligne med den
	// 18. august. Vi opfinder ikke et nul, for det ville laese som en sejr
	// hun ikke har vundet.
	it('kun sene dage i maaneden foer giver ingen sammenligning', () => {
		const o = maanedOverblik([p('2026-08-01', 40), p('2026-07-28', 200)], NU, 'sum');
		expect(o?.forrigeSammeTid).toBeNull();
		expect(o?.forskel).toBeNull();
	});

	it('soejlerne viser stadig HELE maaneden foer', () => {
		const o = maanedOverblik([p('2026-08-01', 40), p('2026-07-28', 200)], NU, 'sum');
		expect(o?.maaneder.find((m) => m.noegle === '2026-07')?.vaerdi).toBe(200);
	});
});
