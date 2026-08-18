import { describe, it, expect } from 'vitest';
import {
	ANTAL_MAANEDER,
	enhedFor,
	soejleBredde,
	traeningOverblik,
	traeningTal,
	traeningTekst,
	type TraeningKilde
} from './traeningMaaned3';

/** 18. august 2026. Det ur alle testene regner ud fra. */
const NU = new Date(2026, 7, 18, 12, 0, 0).getTime();

function t(dato: string, minutter?: number): TraeningKilde {
	return minutter === undefined ? { dato } : { dato, minutter };
}

describe('enhedFor', () => {
	it('har alle minutter, taeller vi minutter', () => {
		expect(enhedFor([t('2026-08-01', 20), t('2026-08-03', 15)])).toBe('minutter');
	});

	// Mangler bare én, ville en maaned med minutter se ud som en kaempe
	// fremgang mod en maaned uden. Saa hellere taelle traeninger.
	it('mangler bare én, taeller vi traeninger', () => {
		expect(enhedFor([t('2026-08-01', 20), t('2026-07-03')])).toBe('traeninger');
	});

	it('nul minutter taeller som at det mangler', () => {
		expect(enhedFor([t('2026-08-01', 0)])).toBe('traeninger');
	});

	it('ingen traeninger giver traeninger', () => {
		expect(enhedFor([])).toBe('traeninger');
	});
});

describe('traeningOverblik', () => {
	it('taeller minutter pr maaned', () => {
		const o = traeningOverblik([t('2026-08-01', 20), t('2026-08-05', 25), t('2026-07-10', 30)], NU);
		expect(o?.enhed).toBe('minutter');
		expect(o?.denne.vaerdi).toBe(45);
		expect(o?.forrige?.vaerdi).toBe(30);
		expect(o?.forskel).toBe(15);
	});

	it('taeller traeninger naar minutterne mangler', () => {
		const o = traeningOverblik([t('2026-08-01'), t('2026-08-05'), t('2026-07-10')], NU);
		expect(o?.enhed).toBe('traeninger');
		expect(o?.denne.vaerdi).toBe(2);
		expect(o?.forskel).toBe(1);
	});

	it('maanederne hedder noget paa dansk', () => {
		expect(traeningOverblik([t('2026-08-01', 20)], NU)?.denne.navn).toBe('august');
	});

	// "0 → 40" ville laese som om hun havde svigtet i juli. Havde hun slet
	// ikke traenet dengang, er der bare ikke noget at sammenligne med.
	it('en maaned uden traening bliver ikke til et nul at sammenligne med', () => {
		const o = traeningOverblik([t('2026-08-01', 20)], NU);
		expect(o?.forrige).toBeNull();
		expect(o?.forskel).toBeNull();
	});

	it('siger til naar det er hendes bedste maaned', () => {
		const o = traeningOverblik([t('2026-08-01', 60), t('2026-07-10', 30)], NU);
		expect(o?.bedste).toBe(true);
	});

	it('den foerste maaned nogensinde er ikke "bedste"', () => {
		expect(traeningOverblik([t('2026-08-01', 60)], NU)?.bedste).toBe(false);
	});

	it('en maaned uden traening er ikke bedste, heller ikke naar alt er nul', () => {
		expect(traeningOverblik([t('2026-03-01', 20)], NU)?.bedste).toBe(false);
	});

	it('soejlerne daekker de seneste maaneder, aeldst foerst', () => {
		const o = traeningOverblik([t('2026-08-01', 20)], NU);
		expect(o?.maaneder).toHaveLength(ANTAL_MAANEDER);
		expect(o?.maaneder.at(-1)?.noegle).toBe('2026-08');
		expect(o?.maaneder[0].noegle).toBe('2026-03');
	});

	it('en maaned uden traening staar som nul i soejlerne', () => {
		const o = traeningOverblik([t('2026-08-01', 20)], NU);
		expect(o?.maaneder.find((m) => m.noegle === '2026-07')?.vaerdi).toBe(0);
	});

	it('ingen traeninger giver intet overblik', () => {
		expect(traeningOverblik([], NU)).toBeNull();
	});
});

describe('traeningTal', () => {
	it('boejer minutter rigtigt', () => {
		expect(traeningTal(1, 'minutter')).toBe('1 minut');
		expect(traeningTal(40, 'minutter')).toBe('40 minutter');
	});

	it('boejer traeninger rigtigt', () => {
		expect(traeningTal(1, 'traeninger')).toBe('1 træning');
		expect(traeningTal(3, 'traeninger')).toBe('3 træninger');
	});
});

describe('traeningTekst', () => {
	/** Ord der aldrig maa staa paa siden. Linns regel 18. august. */
	const FORBUDT = ['fejl', 'sprunget', 'kun', 'desværre', 'burde', 'mangler', 'af 30'];

	function tjekVenlig(tekst: string) {
		for (const ord of FORBUDT) {
			expect(tekst.toLowerCase()).not.toContain(ord);
		}
	}

	it('roser den bedste maaned', () => {
		const t1 = traeningTekst(traeningOverblik([t('2026-08-01', 60), t('2026-07-01', 30)], NU));
		expect(t1).toContain('bedste måned');
		tjekVenlig(t1);
	});

	it('siger hvor meget mere hun har traenet', () => {
		const t1 = traeningTekst(
			traeningOverblik([t('2026-08-01', 45), t('2026-07-01', 30), t('2026-06-01', 90)], NU)
		);
		expect(t1).toContain('15 minutter mere');
		tjekVenlig(t1);
	});

	// Det vigtigste: gaar det tilbage, maa der ikke staa noget der
	// bebrejder hende. Maaneden er ikke slut endnu.
	it('bebrejder hende ingenting naar maaneden er svagere', () => {
		const t1 = traeningTekst(traeningOverblik([t('2026-08-01', 20), t('2026-07-01', 90)], NU));
		expect(t1).toContain('stadig dage tilbage');
		tjekVenlig(t1);
	});

	it('en maaned uden traening laeses som at den lige er begyndt', () => {
		const t1 = traeningTekst(traeningOverblik([t('2026-07-01', 90)], NU));
		expect(t1).toContain('lige begyndt');
		tjekVenlig(t1);
	});

	it('ingen traeninger inviterer i stedet for at bebrejde', () => {
		const t1 = traeningTekst(null);
		expect(t1).toContain('Når du har trænet');
		tjekVenlig(t1);
	});

	it('naevner aldrig et maal hun kan ramme ved siden af', () => {
		const alle = [
			traeningTekst(traeningOverblik([t('2026-08-01', 60), t('2026-07-01', 30)], NU)),
			traeningTekst(traeningOverblik([t('2026-08-01', 20), t('2026-07-01', 90)], NU)),
			traeningTekst(traeningOverblik([t('2026-07-01', 90)], NU))
		];
		for (const tekst of alle) {
			expect(tekst).not.toMatch(/\baf \d+\b/);
		}
	});
});

describe('soejleBredde', () => {
	it('den laengste maaned fylder det hele', () => {
		expect(soejleBredde(60, 60)).toBe(100);
	});

	it('halvdelen fylder halvdelen', () => {
		expect(soejleBredde(30, 60)).toBe(50);
	});

	// En maaned med to minutter skal stadig kunne ses.
	it('en meget lille maaned faar en synlig stump', () => {
		expect(soejleBredde(1, 500)).toBe(4);
	});

	it('nul giver ingen soejle', () => {
		expect(soejleBredde(0, 60)).toBe(0);
	});

	it('ingen har traenet endnu giver ingen soejle', () => {
		expect(soejleBredde(0, 0)).toBe(0);
	});
});
