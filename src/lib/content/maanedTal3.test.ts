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
import { madOverblik, madTekst, fiberTekst, type MaaltidKilde } from './madMaaned3';
import { jaPaaDagen, skridtOverblik, skridtTal, skridtTekst } from './skridtMaaned3';

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
// Mad
// ============================================================

function m(dato: string, p2: number, f: number): MaaltidKilde {
	return { dato, totalP: p2, totalF: f };
}

describe('madOverblik', () => {
	it('lægger dagens maaltider sammen og tager snittet pr dag', () => {
		const o = madOverblik([m('2026-08-01', 40, 10), m('2026-08-01', 60, 15)], NU);
		expect(o?.protein.denne.vaerdi).toBe(100);
		expect(o?.protein.denne.dage).toBe(1);
		expect(o?.fiber?.denne.vaerdi).toBe(25);
	});

	it('ingen maaltider giver intet overblik', () => {
		expect(madOverblik([], NU)).toBeNull();
	});
});

describe('madTekst', () => {
	it('roser det bedste snit', () => {
		const o = madOverblik([m('2026-08-01', 110, 30), m('2026-07-01', 80, 20)], NU);
		const t = madTekst(o!.protein, 105);
		expect(t).toContain('bedste snit');
		tjekVenlig(t);
	});

	it('siger hvor meget mere protein hun faar', () => {
		const o = madOverblik(
			[m('2026-08-01', 95, 20), m('2026-07-01', 80, 20), m('2026-06-01', 130, 20)],
			NU
		);
		const t = madTekst(o!.protein, 105);
		expect(t).toContain('15 g mere protein');
		tjekVenlig(t);
	});

	// Maalet maa naevnes, men aldrig som en dom. Ligger hun UNDER, staar
	// der ingenting om maalet overhovedet.
	it('naevner aldrig at hun ligger under sit maal', () => {
		const o = madOverblik([m('2026-08-01', 70, 20), m('2026-07-01', 130, 20)], NU);
		const t = madTekst(o!.protein, 105);
		expect(t).not.toContain('105');
		expect(t).toContain('i snit 70 g');
		tjekVenlig(t);
	});

	it('roser hende naar hun er over sit maal', () => {
		const o = madOverblik([m('2026-08-01', 120, 20), m('2026-07-01', 130, 20)], NU);
		expect(madTekst(o!.protein, 105)).toContain('over dine 105 g');
	});

	it('ingen mad inviterer i stedet for at bebrejde', () => {
		const t = madTekst(null, 105);
		expect(t).toContain('Når du har registreret');
		tjekVenlig(t);
	});
});

describe('fiberTekst', () => {
	it('siger fremgangen', () => {
		const o = madOverblik([m('2026-08-01', 100, 30), m('2026-07-01', 100, 22)], NU);
		expect(fiberTekst(o!.fiber)).toContain('8 g mere');
	});

	it('ingen fiber giver ingen linje', () => {
		expect(fiberTekst(null)).toBe('');
	});
});

// ============================================================
// Smaa skridt
// ============================================================

describe('jaPaaDagen', () => {
	it('taeller kun ja', () => {
		expect(jaPaaDagen({ a: 'ja', b: 'nej', c: 'ja' }, ['a', 'b', 'c'])).toBe(2);
	});

	// Har hun fjernet en vane, skal et gammelt ja ikke dukke op igen.
	it('taeller kun de vaner hun har valgt nu', () => {
		expect(jaPaaDagen({ a: 'ja', gammel: 'ja' }, ['a'])).toBe(1);
	});

	it('en dag uden svar er nul', () => {
		expect(jaPaaDagen(undefined, ['a', 'b'])).toBe(0);
	});
});

describe('skridtTal', () => {
	it('bruger dansk komma', () => {
		expect(skridtTal(3.4)).toBe('3,4 små skridt');
	});

	it('ental hedder lille skridt', () => {
		expect(skridtTal(1)).toBe('1 lille skridt');
	});
});

describe('skridtTekst', () => {
	// Det vigtigste af alt: der maa ALDRIG staa "af 5". Det er en
	// karakter, og den gamle side gav den hver eneste dag.
	it('naevner aldrig hvor mange hun kunne have taget', () => {
		const alle = [
			skridtTekst(skridtOverblik([{ dato: '2026-08-01', ja: 3 }], NU)),
			skridtTekst(
				skridtOverblik(
					[
						{ dato: '2026-08-01', ja: 4 },
						{ dato: '2026-07-01', ja: 2 }
					],
					NU
				)
			),
			skridtTekst(
				skridtOverblik(
					[
						{ dato: '2026-08-01', ja: 1 },
						{ dato: '2026-07-01', ja: 5 }
					],
					NU
				)
			),
			skridtTekst(null)
		];
		for (const t of alle) {
			expect(t).not.toMatch(/\baf \d+\b/);
			tjekVenlig(t);
		}
	});

	it('roser det bedste snit', () => {
		const t = skridtTekst(
			skridtOverblik(
				[
					{ dato: '2026-08-01', ja: 5 },
					{ dato: '2026-07-01', ja: 2 }
				],
				NU
			)
		);
		expect(t).toContain('bedste snit');
	});

	it('siger hvor mange flere hun tager', () => {
		const t = skridtTekst(
			skridtOverblik(
				[
					{ dato: '2026-08-01', ja: 4 },
					{ dato: '2026-07-01', ja: 2 },
					{ dato: '2026-06-01', ja: 5 }
				],
				NU
			)
		);
		expect(t).toContain('2 flere om dagen');
	});

	it('ingen svar inviterer i stedet for at bebrejde', () => {
		expect(skridtTekst(null)).toContain('Når du har svaret');
	});
});
