import { describe, it, expect } from 'vitest';
import {
	calculateSubscales,
	calculateTotal,
	getInterpretation,
	getSubskalaFortolkning,
	MRS_ITEMS,
	kropsroMaalepunkter,
	naesteSoendagEfter,
	naesteSoendagPaaEllerEfter,
	naesteUdfyldelseDato,
	skalUdfyldeNu,
	SUBSCALES,
	validerScores,
	validerSliders,
	type MrsSliders
} from './mrs';

const alleNul: Record<number, number> = Object.fromEntries(
	MRS_ITEMS.map((i) => [i.id, 0])
);
const maxScores: Record<number, number> = Object.fromEntries(
	MRS_ITEMS.map((i) => [i.id, 4])
);

describe('MRS_ITEMS', () => {
	it('har præcis 11 spørgsmål', () => {
		expect(MRS_ITEMS).toHaveLength(11);
	});

	it('har id 1-11 i rækkefølge', () => {
		const ids = MRS_ITEMS.map((i) => i.id);
		expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
	});

	it('dækker alle 11 spørgsmål via subskalaerne', () => {
		const subskalaIds = [
			...SUBSCALES.somatisk.items,
			...SUBSCALES.psykologisk.items,
			...SUBSCALES.urogenital.items
		].sort((a, b) => a - b);
		expect(subskalaIds).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
	});
});

describe('calculateSubscales', () => {
	it('returnerer 0 for alle subskalaer når intet er udfyldt', () => {
		expect(calculateSubscales(alleNul)).toEqual({
			somatisk: 0,
			psykologisk: 0,
			urogenital: 0
		});
	});

	it('returnerer max-værdier ved alle 4', () => {
		expect(calculateSubscales(maxScores)).toEqual({
			somatisk: 16,
			psykologisk: 16,
			urogenital: 12
		});
	});

	it('beregner korrekt for blandet input', () => {
		const scores = { ...alleNul, 1: 2, 4: 3, 8: 1 };
		expect(calculateSubscales(scores)).toEqual({
			somatisk: 2,
			psykologisk: 3,
			urogenital: 1
		});
	});
});

describe('calculateTotal', () => {
	it('returnerer 0 for alle nul', () => {
		expect(calculateTotal(alleNul)).toBe(0);
	});

	it('returnerer 44 for alle max', () => {
		expect(calculateTotal(maxScores)).toBe(44);
	});

	it('summerer korrekt for blandet input', () => {
		const scores = { ...alleNul, 1: 2, 4: 3, 8: 1 };
		expect(calculateTotal(scores)).toBe(6);
	});
});

describe('getInterpretation', () => {
	it('0-4 = ingen eller meget få gener', () => {
		expect(getInterpretation(0).label).toMatch(/[Ii]ngen/);
		expect(getInterpretation(4).label).toMatch(/[Ii]ngen/);
	});

	it('5-8 = lette gener', () => {
		expect(getInterpretation(5).label).toMatch(/[Ll]ette/);
		expect(getInterpretation(8).label).toMatch(/[Ll]ette/);
	});

	it('9-16 = mærkbare gener', () => {
		expect(getInterpretation(9).label).toMatch(/[Mm]ærkbare/);
		expect(getInterpretation(16).label).toMatch(/[Mm]ærkbare/);
	});

	it('17-24 = tydelige gener', () => {
		expect(getInterpretation(17).label).toMatch(/[Tt]ydelige/);
		expect(getInterpretation(24).label).toMatch(/[Tt]ydelige/);
	});

	it('25+ = kraftige gener', () => {
		expect(getInterpretation(25).label).toMatch(/[Kk]raftige/);
		expect(getInterpretation(44).label).toMatch(/[Kk]raftige/);
	});

	it('alle returnerer en hex-farve', () => {
		for (let i = 0; i <= 44; i++) {
			expect(getInterpretation(i).color).toMatch(/^#[0-9A-F]{6}$/i);
		}
	});

	it('alle niveauer har en beskrivelse', () => {
		for (const total of [0, 5, 9, 17, 25]) {
			expect(getInterpretation(total).beskrivelse).toBeTruthy();
			expect(getInterpretation(total).beskrivelse.length).toBeGreaterThan(20);
		}
	});
});

describe('getSubskalaFortolkning', () => {
	it('somatisk: 0-2 = ingen, 3-4 = mild, 5-8 = moderat, 9+ = svaer', () => {
		expect(getSubskalaFortolkning('somatisk', 0).niveau).toBe('ingen');
		expect(getSubskalaFortolkning('somatisk', 2).niveau).toBe('ingen');
		expect(getSubskalaFortolkning('somatisk', 3).niveau).toBe('mild');
		expect(getSubskalaFortolkning('somatisk', 4).niveau).toBe('mild');
		expect(getSubskalaFortolkning('somatisk', 5).niveau).toBe('moderat');
		expect(getSubskalaFortolkning('somatisk', 8).niveau).toBe('moderat');
		expect(getSubskalaFortolkning('somatisk', 9).niveau).toBe('svaer');
		expect(getSubskalaFortolkning('somatisk', 16).niveau).toBe('svaer');
	});

	it('psykologisk: 0-1 = ingen, 2-3 = mild, 4-6 = moderat, 7+ = svaer', () => {
		expect(getSubskalaFortolkning('psykologisk', 0).niveau).toBe('ingen');
		expect(getSubskalaFortolkning('psykologisk', 1).niveau).toBe('ingen');
		expect(getSubskalaFortolkning('psykologisk', 2).niveau).toBe('mild');
		expect(getSubskalaFortolkning('psykologisk', 3).niveau).toBe('mild');
		expect(getSubskalaFortolkning('psykologisk', 4).niveau).toBe('moderat');
		expect(getSubskalaFortolkning('psykologisk', 6).niveau).toBe('moderat');
		expect(getSubskalaFortolkning('psykologisk', 7).niveau).toBe('svaer');
		expect(getSubskalaFortolkning('psykologisk', 16).niveau).toBe('svaer');
	});

	it('urogenital: 0 = ingen, 1-2 = mild, 3-5 = moderat, 6+ = svaer', () => {
		expect(getSubskalaFortolkning('urogenital', 0).niveau).toBe('ingen');
		expect(getSubskalaFortolkning('urogenital', 1).niveau).toBe('mild');
		expect(getSubskalaFortolkning('urogenital', 2).niveau).toBe('mild');
		expect(getSubskalaFortolkning('urogenital', 3).niveau).toBe('moderat');
		expect(getSubskalaFortolkning('urogenital', 5).niveau).toBe('moderat');
		expect(getSubskalaFortolkning('urogenital', 6).niveau).toBe('svaer');
		expect(getSubskalaFortolkning('urogenital', 12).niveau).toBe('svaer');
	});

	it('alle returnerer en label', () => {
		for (const sub of ['somatisk', 'psykologisk', 'urogenital'] as const) {
			for (let i = 0; i <= 16; i++) {
				expect(getSubskalaFortolkning(sub, i).label).toBeTruthy();
			}
		}
	});
});

describe('naesteSoendagEfter', () => {
	it('mandag → samme uges søndag', () => {
		const mandag = new Date(2026, 4, 18); // 18. maj 2026 er mandag
		const ud = naesteSoendagEfter(mandag);
		expect(ud.getDay()).toBe(0);
		expect(ud.getDate()).toBe(24);
	});

	it('søndag → næste uges søndag (7 dage frem)', () => {
		const soendag = new Date(2026, 4, 24); // 24. maj 2026 er søndag
		const ud = naesteSoendagEfter(soendag);
		expect(ud.getDay()).toBe(0);
		expect(ud.getDate()).toBe(31);
	});

	it('lørdag → næste dags søndag', () => {
		const loerdag = new Date(2026, 4, 23); // 23. maj 2026 er lørdag
		const ud = naesteSoendagEfter(loerdag);
		expect(ud.getDay()).toBe(0);
		expect(ud.getDate()).toBe(24);
	});
});

describe('naesteSoendagPaaEllerEfter', () => {
	it('søndag → samme søndag (0 dage frem)', () => {
		const soendag = new Date(2026, 4, 24); // 24. maj 2026 er søndag
		const ud = naesteSoendagPaaEllerEfter(soendag);
		expect(ud.getDay()).toBe(0);
		expect(ud.getDate()).toBe(24);
	});

	it('mandag → samme uges søndag', () => {
		const mandag = new Date(2026, 4, 25); // 25. maj 2026 er mandag
		const ud = naesteSoendagPaaEllerEfter(mandag);
		expect(ud.getDay()).toBe(0);
		expect(ud.getDate()).toBe(31);
	});

	it('lørdag → næste dags søndag', () => {
		const loerdag = new Date(2026, 4, 23); // 23. maj 2026 er lørdag
		const ud = naesteSoendagPaaEllerEfter(loerdag);
		expect(ud.getDay()).toBe(0);
		expect(ud.getDate()).toBe(24);
	});
});

describe('naesteUdfyldelseDato', () => {
	it('ingen tidligere → returnerer i dag (sammen med nu)', () => {
		const ud = naesteUdfyldelseDato('abonnement', 'basisabo', null);
		const nu = Date.now();
		expect(Math.abs(ud.getTime() - nu)).toBeLessThan(1000);
	});

	it('app-kunde: sidste på søndag → præcis 4 søndage frem (28 dage)', () => {
		// 3. maj 2026 er søndag → +28 dage = 31. maj 2026 (også søndag)
		const sidste = new Date(2026, 4, 3).getTime();
		const ud = naesteUdfyldelseDato('abonnement', 'basisabo', sidste);
		expect(ud.getDay()).toBe(0);
		expect(ud.getDate()).toBe(31);
		expect(ud.getMonth()).toBe(4);
	});

	it('app-kunde: sidste på fredag → +28 dage rundet op til næste søndag', () => {
		// 1. maj 2026 er fredag → +28 dage = 29. maj 2026 (fredag) → næste søndag = 31. maj
		const sidste = new Date(2026, 4, 1).getTime();
		const ud = naesteUdfyldelseDato('abonnement', 'basisabo', sidste);
		expect(ud.getDay()).toBe(0);
		expect(ud.getDate()).toBe(31);
		expect(ud.getMonth()).toBe(4);
	});

	it('Kickstart-kunde → næste søndag', () => {
		// 1. maj 2026 er fredag
		const sidste = new Date(2026, 4, 1).getTime();
		const ud = naesteUdfyldelseDato('forløb', 'kickstart', sidste);
		expect(ud.getDay()).toBe(0); // søndag
	});

	it('Kropsro: sidste på søndag → præcis 4 søndage frem (28 dage)', () => {
		const sidste = new Date(2026, 4, 3).getTime(); // søndag
		const ud = naesteUdfyldelseDato('forløb', 'premiumforløb', sidste);
		expect(ud.getDay()).toBe(0);
		expect(ud.getDate()).toBe(31);
		expect(ud.getMonth()).toBe(4);
	});

	it('Kropsro: sidste på mandag → +28 rundet op til næste søndag', () => {
		const sidste = new Date(2026, 4, 4).getTime(); // mandag
		const ud = naesteUdfyldelseDato('forløb', 'premiumforløb', sidste);
		expect(ud.getDay()).toBe(0);
		// +28 dage = 1. juni 2026 (mandag) → næste søndag = 7. juni
		expect(ud.getDate()).toBe(7);
		expect(ud.getMonth()).toBe(5);
	});
});

// KropsRo 16. aug 2026, 84 dage. Målepunkterne er 16/8, 13/9, 11/10 og 8/11.
const KROPSRO_AUG = { startMs: new Date(2026, 7, 16).getTime(), antalDage: 84 };

describe('kropsroMaalepunkter', () => {
	it('84-dages forløb giver fire målepunkter med 28 dages mellemrum', () => {
		const p = kropsroMaalepunkter(KROPSRO_AUG);
		expect(p).toHaveLength(4);
		expect(p.map((d) => [d.getDate(), d.getMonth() + 1])).toEqual([
			[16, 8],
			[13, 9],
			[11, 10],
			[8, 11]
		]);
	});

	it('starten er en søndag, så alle målepunkter er søndage', () => {
		for (const d of kropsroMaalepunkter(KROPSRO_AUG)) {
			expect(d.getDay()).toBe(0);
		}
	});

	it('sommertidsskiftet 25/10 flytter ikke det sidste målepunkt', () => {
		const sidste = kropsroMaalepunkter(KROPSRO_AUG)[3];
		expect(sidste.getDate()).toBe(8);
		expect(sidste.getMonth()).toBe(10);
		expect(sidste.getHours()).toBe(0);
	});

	it('målepunkter går aldrig ud over forløbets længde', () => {
		const p = kropsroMaalepunkter({ ...KROPSRO_AUG, antalDage: 21 });
		expect(p).toHaveLength(1);
		expect(p[0].getDate()).toBe(16);
	});
});

describe('naesteUdfyldelseDato med Kropsro-plan', () => {
	it('aldrig udfyldt → forløbets startdag', () => {
		const ud = naesteUdfyldelseDato('forløb', 'premiumforløb', null, false, KROPSRO_AUG);
		expect(ud.getDate()).toBe(16);
		expect(ud.getMonth()).toBe(7);
	});

	it('sidste udfyldelse før forløbsstart → startdagen (Meretes situation)', () => {
		const sidste = new Date(2026, 6, 20).getTime(); // 20/7, på SommerRo
		const ud = naesteUdfyldelseDato('forløb', 'premiumforløb', sidste, false, KROPSRO_AUG);
		expect(ud.getDate()).toBe(16);
		expect(ud.getMonth()).toBe(7);
	});

	it('udfyldt på startdagen → næste er 13/9, ikke 28 dage fra kundens eget ur', () => {
		const sidste = new Date(2026, 7, 16, 7, 30).getTime();
		const ud = naesteUdfyldelseDato('forløb', 'premiumforløb', sidste, false, KROPSRO_AUG);
		expect(ud.getDate()).toBe(13);
		expect(ud.getMonth()).toBe(8);
	});

	it('hele holdet lander på samme dato uanset hvornår på dagen de udfyldte', () => {
		const tidlig = new Date(2026, 7, 16, 6, 5).getTime();
		const sen = new Date(2026, 7, 16, 23, 40).getTime();
		const a = naesteUdfyldelseDato('forløb', 'premiumforløb', tidlig, false, KROPSRO_AUG);
		const b = naesteUdfyldelseDato('forløb', 'premiumforløb', sen, false, KROPSRO_AUG);
		expect(a.getTime()).toBe(b.getTime());
	});

	it('udfyldt en hverdag midt i forløbet → næste er stadig forløbets målepunkt', () => {
		const sidste = new Date(2026, 8, 14).getTime(); // mandag 14/9
		const ud = naesteUdfyldelseDato('forløb', 'premiumforløb', sidste, false, KROPSRO_AUG);
		expect(ud.getDate()).toBe(11);
		expect(ud.getMonth()).toBe(9);
	});

	it('misset målepunkt bliver stående, ikke sprunget over', () => {
		// Udfyldte 16/8, missede 13/9. Det ældste udækkede punkt er 13/9.
		const sidste = new Date(2026, 7, 16).getTime();
		const ud = naesteUdfyldelseDato('forløb', 'premiumforløb', sidste, false, KROPSRO_AUG);
		expect(ud.getDate()).toBe(13);
		expect(ud.getMonth()).toBe(8);
	});

	it('alle målepunkter dækket → falder tilbage til det personlige 4-ugers-ur', () => {
		const sidste = new Date(2026, 10, 9).getTime(); // dagen efter sidste målepunkt
		const ud = naesteUdfyldelseDato('forløb', 'premiumforløb', sidste, false, KROPSRO_AUG);
		expect(ud.getTime()).toBeGreaterThan(sidste);
		expect(ud.getDay()).toBe(0);
	});

	it('uden plan er opførslen uændret (Kickstart og app-kunder)', () => {
		const sidste = new Date(2026, 6, 20).getTime();
		const uden = naesteUdfyldelseDato('forløb', 'premiumforløb', sidste);
		const med = naesteUdfyldelseDato('forløb', 'premiumforløb', sidste, false, KROPSRO_AUG);
		expect(uden.getTime()).not.toBe(med.getTime());
		expect(uden.getDay()).toBe(0);
	});
});

/** Unix-ms for et tidspunkt midt på dagen, N dage fra i dag. */
function dageFraIDag(dage: number): number {
	const d = new Date();
	d.setHours(12, 0, 0, 0);
	d.setDate(d.getDate() + dage);
	return d.getTime();
}

describe('skalUdfyldeNu med Kropsro-plan', () => {
	const planStartetFor = (dage: number) => ({
		startMs: dageFraIDag(-dage),
		antalDage: 84
	});

	it('sidste udfyldelse ligger før forløbsstart → åbent', () => {
		const ud = skalUdfyldeNu(
			'forløb',
			'premiumforløb',
			dageFraIDag(-40),
			false,
			planStartetFor(30)
		);
		expect(ud).toBe(true);
	});

	it('udfyldt efter start, næste målepunkt endnu ikke nået → lukket', () => {
		const ud = skalUdfyldeNu(
			'forløb',
			'premiumforløb',
			dageFraIDag(-9),
			false,
			planStartetFor(10)
		);
		expect(ud).toBe(false);
	});

	it('missede målepunktet på dag 28 → åbent igen', () => {
		const ud = skalUdfyldeNu(
			'forløb',
			'premiumforløb',
			dageFraIDag(-29),
			false,
			planStartetFor(30)
		);
		expect(ud).toBe(true);
	});

	it('forløbet er ikke startet endnu → lukket', () => {
		const ud = skalUdfyldeNu('forløb', 'premiumforløb', null, false, {
			startMs: dageFraIDag(5),
			antalDage: 84
		});
		expect(ud).toBe(false);
	});

	it('aldrig udfyldt og forløbet er i gang → åbent', () => {
		const ud = skalUdfyldeNu('forløb', 'premiumforløb', null, false, planStartetFor(3));
		expect(ud).toBe(true);
	});
});

describe('validerSliders', () => {
	const gyldig: MrsSliders = { energi: 7, mave: 6, cravings: 8, humor: 5, sovn: 7 };

	it('godkender gyldigt sliders-objekt', () => {
		expect(validerSliders(gyldig)).toBeNull();
	});

	it('godkender alle yderpunkter (1 og 10)', () => {
		expect(
			validerSliders({ energi: 1, mave: 10, cravings: 1, humor: 10, sovn: 5 })
		).toBeNull();
	});

	it('afviser manglende svar', () => {
		const u = { ...gyldig } as Partial<MrsSliders>;
		delete u.mave;
		expect(validerSliders(u)).toMatch(/[Mm]angler/);
	});

	it('afviser værdi under 1', () => {
		expect(validerSliders({ ...gyldig, energi: 0 })).toMatch(/[Uu]gyldigt/);
	});

	it('afviser værdi over 10', () => {
		expect(validerSliders({ ...gyldig, sovn: 11 })).toMatch(/[Uu]gyldigt/);
	});

	it('afviser ikke-heltal', () => {
		expect(validerSliders({ ...gyldig, humor: 5.5 })).toMatch(/[Uu]gyldigt/);
	});
});

describe('skalUdfyldeNu', () => {
	it('aldrig udfyldt → true', () => {
		expect(skalUdfyldeNu('abonnement', 'basisabo', null)).toBe(true);
	});

	it('app-kunde udfyldt for 40 dage siden → true (over en 4-ugers cyklus + buffer)', () => {
		const sidste = Date.now() - 40 * 24 * 60 * 60 * 1000;
		expect(skalUdfyldeNu('abonnement', 'basisabo', sidste)).toBe(true);
	});

	it('app-kunde udfyldt i dag → false (næste søndag er minst 28 dage frem)', () => {
		expect(skalUdfyldeNu('abonnement', 'basisabo', Date.now())).toBe(false);
	});

	it('Kropsro udfyldt for 40 dage siden → true', () => {
		const sidste = Date.now() - 40 * 24 * 60 * 60 * 1000;
		expect(skalUdfyldeNu('forløb', 'premiumforløb', sidste)).toBe(true);
	});

	it('Kropsro udfyldt for 7 dage siden → false', () => {
		const sidste = Date.now() - 7 * 24 * 60 * 60 * 1000;
		expect(skalUdfyldeNu('forløb', 'premiumforløb', sidste)).toBe(false);
	});
});

describe('validerScores', () => {
	it('godkender fuldt udfyldt skema', () => {
		expect(validerScores(alleNul)).toBeNull();
		expect(validerScores(maxScores)).toBeNull();
	});

	it('afviser manglende svar', () => {
		const ufuldstaendigt = { ...alleNul };
		delete ufuldstaendigt[5];
		expect(validerScores(ufuldstaendigt)).toMatch(/[Mm]angler svar/);
	});

	it('afviser ugyldig værdi (under 0)', () => {
		expect(validerScores({ ...alleNul, 1: -1 })).toMatch(/[Uu]gyldigt/);
	});

	it('afviser ugyldig værdi (over 4)', () => {
		expect(validerScores({ ...alleNul, 1: 5 })).toMatch(/[Uu]gyldigt/);
	});

	it('afviser ikke-heltal', () => {
		expect(validerScores({ ...alleNul, 1: 2.5 })).toMatch(/[Uu]gyldigt/);
	});
});
