import { describe, it, expect } from 'vitest';
import type { DayExercise } from './mikrotraening';
import {
	KLAR_SEK,
	SKIFT_SEK,
	faseLaengde3,
	faseTekst3,
	naesteFase3,
	pladsPasser3,
	procentAfTraening3,
	samletSekunder3,
	startStilling3,
	stillingFraPlads3,
	tik3,
	vaerdAtGemme3,
	visesOevelse3,
	type GemtPlads3,
	type Stilling3
} from './afspiller3';

function oev(sets = 3, workSec = 30, restSec = 10): DayExercise {
	return { exerciseId: 'a', sets, workSec, restSec, bonus: false };
}

const TO_OEVELSER = [oev(2, 30, 10), oev(2, 20, 5)];

function stilling(felter: Partial<Stilling3> = {}): Stilling3 {
	return { oevelse: 0, saet: 1, fase: 'arbejd', tilbage: 30, ...felter };
}

describe('startStilling3', () => {
	it('begynder med at goere sig klar', () => {
		expect(startStilling3()).toEqual({
			oevelse: 0,
			saet: 1,
			fase: 'klar',
			tilbage: KLAR_SEK
		});
	});
});

describe('faseLaengde3', () => {
	it('bruger oevelsens egne tal', () => {
		expect(faseLaengde3('arbejd', oev(3, 45, 15))).toBe(45);
		expect(faseLaengde3('hvil', oev(3, 45, 15))).toBe(15);
	});

	it('bruger de faste tal til klar og skift', () => {
		expect(faseLaengde3('klar', undefined)).toBe(KLAR_SEK);
		expect(faseLaengde3('skift', undefined)).toBe(SKIFT_SEK);
	});

	it('falder tilbage paa noget rimeligt uden en oevelse', () => {
		expect(faseLaengde3('arbejd', undefined)).toBe(30);
		expect(faseLaengde3('hvil', undefined)).toBe(10);
	});
});

describe('naesteFase3', () => {
	it('gaar fra klar til arbejd paa foerste oevelse', () => {
		const r = naesteFase3(stilling({ fase: 'klar', tilbage: 0 }), TO_OEVELSER);
		expect(r).toMatchObject({ oevelse: 0, saet: 1, fase: 'arbejd', tilbage: 30 });
	});

	it('gaar fra arbejd til hvil naar der er flere saet', () => {
		const r = naesteFase3(stilling({ saet: 1, fase: 'arbejd' }), TO_OEVELSER);
		expect(r).toMatchObject({ fase: 'hvil', tilbage: 10, saet: 1 });
	});

	it('gaar fra hvil til naeste saet', () => {
		const r = naesteFase3(stilling({ saet: 1, fase: 'hvil' }), TO_OEVELSER);
		expect(r).toMatchObject({ saet: 2, fase: 'arbejd', tilbage: 30 });
	});

	it('gaar til skift naar saettene er brugt og der er en oevelse mere', () => {
		const r = naesteFase3(stilling({ saet: 2, fase: 'arbejd' }), TO_OEVELSER);
		expect(r).toMatchObject({ fase: 'skift', tilbage: SKIFT_SEK, oevelse: 0 });
	});

	it('gaar fra skift til foerste saet paa den naeste oevelse', () => {
		const r = naesteFase3(stilling({ oevelse: 0, saet: 2, fase: 'skift' }), TO_OEVELSER);
		expect(r).toMatchObject({ oevelse: 1, saet: 1, fase: 'arbejd', tilbage: 20 });
	});

	it('er faerdig efter sidste saet paa sidste oevelse', () => {
		const r = naesteFase3(stilling({ oevelse: 1, saet: 2, fase: 'arbejd' }), TO_OEVELSER);
		expect(r.fase).toBe('faerdig');
	});

	it('er faerdig hvis der ikke er nogen naeste oevelse at skifte til', () => {
		const r = naesteFase3(stilling({ oevelse: 1, saet: 2, fase: 'skift' }), TO_OEVELSER);
		expect(r.fase).toBe('faerdig');
	});

	it('er faerdig hvis oevelsen slet ikke findes', () => {
		expect(naesteFase3(stilling({ oevelse: 9 }), TO_OEVELSER).fase).toBe('faerdig');
	});
});

describe('tik3', () => {
	it('taeller ned', () => {
		expect(tik3(stilling({ tilbage: 30 }), TO_OEVELSER).tilbage).toBe(29);
	});

	it('skifter fase paa det sidste sekund', () => {
		expect(tik3(stilling({ tilbage: 1, saet: 1 }), TO_OEVELSER).fase).toBe('hvil');
	});

	it('goer ingenting naar traeningen er faerdig', () => {
		const f = stilling({ fase: 'faerdig', tilbage: 0 });
		expect(tik3(f, TO_OEVELSER)).toBe(f);
	});

	it('koerer en hel traening igennem og ender faerdig', () => {
		let s = startStilling3();
		let sikkerhed = 0;
		while (s.fase !== 'faerdig' && sikkerhed < 10_000) {
			s = tik3(s, TO_OEVELSER);
			sikkerhed++;
		}
		expect(s.fase).toBe('faerdig');
		// 10 klar
		// + oevelse 1: 30 arbejd, 10 hvil, 30 arbejd = 70
		// + 15 skift
		// + oevelse 2: 20 arbejd, 5 hvil, 20 arbejd = 45
		// = 140 sekunder.
		expect(sikkerhed).toBe(140);
	});
});

describe('visesOevelse3', () => {
	it('viser den hun er i gang med', () => {
		expect(visesOevelse3(stilling({ oevelse: 0 }), TO_OEVELSER)).toBe(TO_OEVELSER[0]);
	});

	it('viser den NAESTE under skift', () => {
		// Under skift skal hun stille sig klar til den der kommer.
		expect(visesOevelse3(stilling({ oevelse: 0, fase: 'skift' }), TO_OEVELSER)).toBe(
			TO_OEVELSER[1]
		);
	});

	it('giver null naar der ikke er nogen', () => {
		expect(visesOevelse3(stilling({ oevelse: 5 }), TO_OEVELSER)).toBeNull();
	});
});

describe('samletSekunder3', () => {
	it('lægger arbejde og hvile sammen uden klar og skift', () => {
		// 2x30 arbejde + 1x10 hvile = 70, plus 2x20 + 1x5 = 45.
		expect(samletSekunder3(TO_OEVELSER)).toBe(115);
	});

	it('giver nul for en tom traening', () => {
		expect(samletSekunder3([])).toBe(0);
	});
});

describe('procentAfTraening3', () => {
	it('er nul ved start', () => {
		expect(procentAfTraening3(startStilling3(), TO_OEVELSER)).toBe(0);
	});

	it('er hundrede naar hun er faerdig', () => {
		expect(procentAfTraening3(stilling({ fase: 'faerdig' }), TO_OEVELSER)).toBe(100);
	});

	it('vokser undervejs', () => {
		const tidligt = procentAfTraening3(stilling({ oevelse: 0, saet: 1, tilbage: 25 }), TO_OEVELSER);
		const senere = procentAfTraening3(stilling({ oevelse: 1, saet: 2, tilbage: 5 }), TO_OEVELSER);
		expect(tidligt).toBeGreaterThan(0);
		expect(senere).toBeGreaterThan(tidligt);
		expect(senere).toBeLessThanOrEqual(100);
	});

	it('gaar aldrig over hundrede eller under nul', () => {
		const r = procentAfTraening3(stilling({ oevelse: 1, saet: 9, tilbage: 0 }), TO_OEVELSER);
		expect(r).toBeGreaterThanOrEqual(0);
		expect(r).toBeLessThanOrEqual(100);
	});

	it('deler ikke med nul', () => {
		expect(procentAfTraening3(startStilling3(), [])).toBe(0);
	});
});

describe('pladsPasser3', () => {
	const plads: GemtPlads3 = {
		programId: 'p1',
		nr: 5,
		oevelse: 1,
		saet: 2,
		fase: 'arbejd',
		tilbage: 12,
		gemtAt: 0
	};

	it('passer paa den rigtige traening', () => {
		expect(pladsPasser3(plads, 'p1', 5, TO_OEVELSER)).toBe(true);
	});

	it('passer ikke paa et andet program', () => {
		expect(pladsPasser3(plads, 'p2', 5, TO_OEVELSER)).toBe(false);
	});

	it('passer ikke paa en anden traening', () => {
		// Ellers ville hun kunne blive markeret faerdig med noget hun ikke har lavet.
		expect(pladsPasser3(plads, 'p1', 6, TO_OEVELSER)).toBe(false);
	});

	it('passer ikke naar oevelsen ikke findes laengere', () => {
		expect(pladsPasser3({ ...plads, oevelse: 9 }, 'p1', 5, TO_OEVELSER)).toBe(false);
	});

	it('passer ikke paa en faerdig eller ukendt fase', () => {
		expect(
			pladsPasser3({ ...plads, fase: 'faerdig' as GemtPlads3['fase'] }, 'p1', 5, TO_OEVELSER)
		).toBe(false);
	});

	it('passer ikke naar der ingen plads er', () => {
		expect(pladsPasser3(null, 'p1', 5, TO_OEVELSER)).toBe(false);
	});
});

describe('stillingFraPlads3', () => {
	it('fortsaetter hvor hun slap', () => {
		const s = stillingFraPlads3(
			{ programId: 'p1', nr: 1, oevelse: 1, saet: 2, fase: 'arbejd', tilbage: 12, gemtAt: 0 },
			TO_OEVELSER
		);
		expect(s).toEqual({ oevelse: 1, saet: 2, fase: 'arbejd', tilbage: 12 });
	});

	it('klipper en for lang nedtaelling ned', () => {
		// Er oevelsen aendret siden, maa nedtaellingen ikke blive laengere
		// end fasen faktisk er.
		const s = stillingFraPlads3(
			{ programId: 'p1', nr: 1, oevelse: 1, saet: 1, fase: 'arbejd', tilbage: 999, gemtAt: 0 },
			TO_OEVELSER
		);
		expect(s.tilbage).toBe(20);
	});
});

describe('vaerdAtGemme3', () => {
	it('er falsk lige efter start', () => {
		expect(vaerdAtGemme3(startStilling3())).toBe(false);
	});

	it('er falsk naar hun er faerdig', () => {
		expect(vaerdAtGemme3(stilling({ fase: 'faerdig' }))).toBe(false);
	});

	it('er sand naar hun er i gang', () => {
		expect(vaerdAtGemme3(stilling({ fase: 'arbejd' }))).toBe(true);
		expect(vaerdAtGemme3(stilling({ oevelse: 1, fase: 'klar' }))).toBe(true);
	});
});

describe('faseTekst3', () => {
	it('skriver faserne paa dansk', () => {
		expect(faseTekst3('klar')).toBe('Gør dig klar');
		expect(faseTekst3('arbejd')).toBe('Arbejd');
		expect(faseTekst3('hvil')).toBe('Hvil');
		expect(faseTekst3('skift')).toBe('Næste øvelse');
	});
});
