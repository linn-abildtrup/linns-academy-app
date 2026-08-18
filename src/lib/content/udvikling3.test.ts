import { describe, it, expect } from 'vitest';
import {
	brugbareMaalinger,
	forskelTekst,
	formatTal,
	fraTilListe,
	kurveFor,
	overblikFor,
	holdNavn,
	samletKurve,
	SLIDERE,
	stoersteFremgang,
	tilstandFor,
	type MaalingKilde,
	type SliderId
} from './udvikling3';

function ms(aar: number, maaned: number, dag: number): number {
	return new Date(aar, maaned - 1, dag, 12, 0, 0).getTime();
}

function maaling(
	timestamp: number,
	sliders?: Partial<Record<SliderId, number>> | null
): MaalingKilde {
	return sliders === null ? { timestamp } : { timestamp, sliders };
}

/** Alle fem svaret ens. Bekvemt naar det er tidspunktet der testes. */
function alle(timestamp: number, v: number): MaalingKilde {
	return maaling(timestamp, { energi: v, sovn: v, humor: v, mave: v, cravings: v });
}

describe('SLIDERE', () => {
	it('der er fem, og de staar i den raekkefoelge hun kender', () => {
		expect(SLIDERE.map((s) => s.id)).toEqual(['energi', 'sovn', 'humor', 'mave', 'cravings']);
	});

	// Nemt at laese forkert: paa cravings betyder 1 MANGE og 10 INGEN, saa
	// et hoejt tal er godt paa alle fem. Der er ingen der vender om.
	it('alle fem taeller samme vej, saa der er ingen undtagelse at kode', () => {
		const foer = alle(ms(2026, 1, 1), 3);
		const nu = alle(ms(2026, 6, 1), 8);
		for (const f of fraTilListe([foer, nu])) {
			expect(f.forskel).toBe(5);
		}
	});
});

describe('brugbareMaalinger', () => {
	it('sorterer i tidsraekkefoelge', () => {
		const r = brugbareMaalinger([alle(ms(2026, 6, 1), 5), alle(ms(2026, 1, 1), 3)]);
		expect(r.map((m) => m.timestamp)).toEqual([ms(2026, 1, 1), ms(2026, 6, 1)]);
	});

	// Kunder fra foer maj 2026 har maalinger uden de fem spoergsmaal.
	it('en maaling helt uden svar springes over', () => {
		expect(brugbareMaalinger([maaling(ms(2026, 1, 1), null)])).toEqual([]);
	});

	it('en maaling med tomme sliders springes ogsaa over', () => {
		expect(brugbareMaalinger([maaling(ms(2026, 1, 1), {})])).toEqual([]);
	});

	it('en maaling med bare ét svar kommer med', () => {
		expect(brugbareMaalinger([maaling(ms(2026, 1, 1), { sovn: 4 })])).toHaveLength(1);
	});
});

describe('samletKurve', () => {
	it('gennemsnittet af de fem, med én decimal', () => {
		const k = samletKurve([
			maaling(ms(2026, 1, 1), { energi: 4, sovn: 5, humor: 5, mave: 6, cravings: 7 })
		]);
		expect(k[0].vaerdi).toBe(5.4);
	});

	// Springer hun ét spoergsmaal over, maa det ikke traekke hende ned.
	it('der divideres med antal svar og ikke med fem', () => {
		const k = samletKurve([maaling(ms(2026, 1, 1), { energi: 8, sovn: 8 })]);
		expect(k[0].vaerdi).toBe(8);
	});

	it('punkterne kommer i tidsraekkefoelge', () => {
		const k = samletKurve([alle(ms(2026, 6, 1), 8), alle(ms(2026, 1, 1), 3)]);
		expect(k.map((p) => p.vaerdi)).toEqual([3, 8]);
	});

	it('ingen maalinger giver en tom kurve', () => {
		expect(samletKurve([])).toEqual([]);
	});
});

describe('kurveFor', () => {
	it('tager kun det ene spoergsmaal', () => {
		const k = kurveFor([maaling(ms(2026, 1, 1), { energi: 4, sovn: 9 })], 'sovn');
		expect(k).toEqual([{ ms: ms(2026, 1, 1), vaerdi: 9 }]);
	});

	it('maalinger uden lige det svar udelades', () => {
		const k = kurveFor(
			[maaling(ms(2026, 1, 1), { energi: 4 }), maaling(ms(2026, 2, 1), { sovn: 7 })],
			'sovn'
		);
		expect(k).toHaveLength(1);
		expect(k[0].vaerdi).toBe(7);
	});
});

describe('fraTilListe', () => {
	const historik = [
		maaling(ms(2026, 1, 1), { energi: 4, sovn: 3, humor: 5, mave: 6, cravings: 4 }),
		maaling(ms(2026, 4, 1), { energi: 6, sovn: 6, humor: 6, mave: 7, cravings: 5 }),
		maaling(ms(2026, 8, 1), { energi: 7, sovn: 8, humor: 7, mave: 8, cravings: 6 })
	];

	// Linns beslutning 18. august: der maales mod den ALLERFOERSTE.
	it('maaler mod den allerfoerste maaling, ikke den forrige', () => {
		const sovn = fraTilListe(historik).find((f) => f.id === 'sovn');
		expect(sovn?.foer).toBe(3);
		expect(sovn?.nu).toBe(8);
		expect(sovn?.forskel).toBe(5);
	});

	it('listen staar i samme raekkefoelge som spoergsmaalene', () => {
		expect(fraTilListe(historik).map((f) => f.id)).toEqual([
			'energi',
			'sovn',
			'humor',
			'mave',
			'cravings'
		]);
	});

	it('et spoergsmaal hun aldrig har svaret paa kommer ikke med', () => {
		const r = fraTilListe([maaling(ms(2026, 1, 1), { sovn: 4 })]);
		expect(r.map((f) => f.id)).toEqual(['sovn']);
	});

	// Én maaling er et udgangspunkt og ikke en fremgang paa nul.
	it('ved kun én maaling kan der ikke sammenlignes', () => {
		const r = fraTilListe([alle(ms(2026, 1, 1), 5)]);
		expect(r[0].kanSammenlignes).toBe(false);
		expect(r[0].forskel).toBe(0);
	});

	it('to maalinger kan sammenlignes', () => {
		const r = fraTilListe([alle(ms(2026, 1, 1), 5), alle(ms(2026, 2, 1), 6)]);
		expect(r[0].kanSammenlignes).toBe(true);
	});

	it('en tilbagegang giver et negativt tal', () => {
		const r = fraTilListe([alle(ms(2026, 1, 1), 8), alle(ms(2026, 2, 1), 5)]);
		expect(r[0].forskel).toBe(-3);
	});

	it('ingen maalinger giver en tom liste', () => {
		expect(fraTilListe([])).toEqual([]);
	});
});

describe('stoersteFremgang', () => {
	it('finder det spoergsmaal der har rykket sig mest', () => {
		const liste = fraTilListe([
			maaling(ms(2026, 1, 1), { energi: 4, sovn: 3 }),
			maaling(ms(2026, 8, 1), { energi: 5, sovn: 8 })
		]);
		expect(stoersteFremgang(liste)?.id).toBe('sovn');
	});

	it('er der kun tilbagegang, peger vi ikke paa noget', () => {
		const liste = fraTilListe([alle(ms(2026, 1, 1), 8), alle(ms(2026, 2, 1), 5)]);
		expect(stoersteFremgang(liste)).toBeNull();
	});

	it('med kun én maaling peger vi ikke paa noget', () => {
		expect(stoersteFremgang(fraTilListe([alle(ms(2026, 1, 1), 5)]))).toBeNull();
	});
});

describe('tilstandFor', () => {
	it('ingen maalinger', () => {
		expect(tilstandFor([])).toBe('ingen');
	});

	it('maalinger uden svar taeller ikke med', () => {
		expect(tilstandFor([maaling(ms(2026, 1, 1), null)])).toBe('ingen');
	});

	it('én maaling er et udgangspunkt', () => {
		expect(tilstandFor([alle(ms(2026, 1, 1), 5)])).toBe('foerste');
	});

	it('to maalinger er en historie', () => {
		expect(tilstandFor([alle(ms(2026, 1, 1), 5), alle(ms(2026, 2, 1), 6)])).toBe('flere');
	});
});

describe('overblikFor', () => {
	it('viser foerste, seneste og hvor meget det har rykket sig', () => {
		const o = overblikFor([alle(ms(2026, 1, 1), 4.8), alle(ms(2026, 8, 1), 7.4)]);
		expect(o).toEqual({ foer: 4.8, nu: 7.4, forskel: 2.6 });
	});

	// Det foerste tal skal ogsaa vaere der, for raekken "Samlet" i listen
	// viser fra-til paa samme maade som de fem andre.
	it('med én maaling staar foer og nu ens, og der er ingen forskel', () => {
		expect(overblikFor([alle(ms(2026, 1, 1), 4.8)])).toEqual({
			foer: 4.8,
			nu: 4.8,
			forskel: null
		});
	});

	it('uden maalinger er der intet overblik', () => {
		expect(overblikFor([])).toBeNull();
	});
});

describe('forskelTekst', () => {
	it('fremgang faar en pil op', () => {
		expect(forskelTekst(2.6)).toBe('↑ 2,6 siden start');
	});

	it('tilbagegang faar en pil ned og intet minus', () => {
		expect(forskelTekst(-1.5)).toBe('↓ 1,5 siden start');
	});

	it('staar det stille, siger vi ingenting', () => {
		expect(forskelTekst(0)).toBe('');
	});

	it('er der ikke noget at sammenligne, siger vi ingenting', () => {
		expect(forskelTekst(null)).toBe('');
	});
});

describe('formatTal', () => {
	it('bruger dansk komma', () => {
		expect(formatTal(7.4)).toBe('7,4');
	});

	it('hele tal staar uden decimal', () => {
		expect(formatTal(8)).toBe('8');
	});

	it('afrunder til én decimal', () => {
		expect(formatTal(5.44)).toBe('5,4');
	});
});

describe('holdNavn', () => {
	it('klipper dato og aar af', () => {
		expect(holdNavn('Kropsro 24. Maj 2026')).toBe('Kropsro');
	});

	it('klipper ogsaa naar maaneden staar uden dato', () => {
		expect(holdNavn('Kickstart maj 2026')).toBe('Kickstart');
	});

	it('de to slags navne ender ens', () => {
		expect(holdNavn('Kickstart 1. juni 2026')).toBe(holdNavn('Kickstart juni 2026'));
	});

	it('et komma klipper ogsaa', () => {
		expect(holdNavn('Kropsro, maj 2026')).toBe('Kropsro');
	});

	it('et navn uden dato staar som det er', () => {
		expect(holdNavn('SommerRo')).toBe('SommerRo');
	});

	it('et navn med flere ord beholder dem', () => {
		expect(holdNavn('Kropsro Intensiv 2026')).toBe('Kropsro Intensiv');
	});

	// Bliver der ingenting tilbage, er det oprindelige navn bedre end
	// et tomt baand. Et navn der KUN er en dato er ikke et rigtigt
	// holdnavn, men det maa stadig ikke give en tom streg.
	it('klipper aldrig det hele vaek', () => {
		expect(holdNavn('2026')).toBe('2026');
		expect(holdNavn('  ')).toBe('');
	});

	it('giver aldrig noget laengere end det den fik', () => {
		for (const n of ['Kropsro 24. Maj 2026', 'Kickstart maj 2026', 'SommerRo', '2026']) {
			expect(holdNavn(n).length).toBeLessThanOrEqual(n.length);
		}
	});
});
