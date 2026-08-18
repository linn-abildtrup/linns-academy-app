import { describe, it, expect } from 'vitest';
import {
	vurderSpaerring,
	naadeTekst,
	NAADE_DAGE,
	type SpaerringGrundlag,
	vurderTilstand,
	maaSeIBonus,
	bonusBaandTekst,
	type TilstandGrundlag
} from './spaerring3';

const DAG = 86_400_000;
const NU = new Date(2026, 7, 9, 12, 0, 0).getTime();

function g(delvis: Partial<SpaerringGrundlag> = {}): SpaerringGrundlag {
	return { harApp: true, harAktivtForlob: false, aboSlutterAt: null, ...delvis };
}

describe('vurderSpaerring', () => {
	it('lukker ind naar abonnementet loeber', () => {
		const s = vurderSpaerring(g({ aboSlutterAt: NU + 30 * DAG }), NU);
		expect(s.spaerret).toBe(false);
		expect(s.iNaade).toBe(false);
	});

	// Punkt 1. Det vigtigste af dem alle: en kvinde midt i et forloeb maa
	// aldrig laases ude, heller ikke hvis abonnementet udloeber undervejs.
	it('spaerrer aldrig en kunde med et aktivt forloeb', () => {
		const s = vurderSpaerring(
			g({ harAktivtForlob: true, aboSlutterAt: NU - 400 * DAG, harApp: true }),
			NU
		);
		expect(s.spaerret).toBe(false);
	});

	it('spaerrer ikke selv om forloebskunden slet ikke har abo-felter', () => {
		const s = vurderSpaerring(g({ harAktivtForlob: true, harApp: true, aboSlutterAt: null }), NU);
		expect(s.spaerret).toBe(false);
	});

	// Punkt 2. Fri- og manuelle konti. 7 af 178 abonnenter 9. august 2026.
	it('lader adgangen loebe naar der ingen slutdato er', () => {
		const s = vurderSpaerring(g({ aboSlutterAt: null, harApp: true }), NU);
		expect(s.spaerret).toBe(false);
	});

	it('spaerrer den der hverken har abo eller forloeb', () => {
		const s = vurderSpaerring(g({ harApp: false, aboSlutterAt: null }), NU);
		expect(s.spaerret).toBe(true);
	});

	// Punkt 3, naadeperioden. Fornyelsen fra Simplero kan komme forsinket.
	it('lukker ind dagen efter udloeb, paa naade', () => {
		const s = vurderSpaerring(g({ aboSlutterAt: NU - 1 * DAG }), NU);
		expect(s.spaerret).toBe(false);
		expect(s.iNaade).toBe(true);
		expect(s.dageTilbageAfNaade).toBe(2);
	});

	it('lukker ind paa sidste naadedag', () => {
		const s = vurderSpaerring(g({ aboSlutterAt: NU - (NAADE_DAGE * DAG - 1000) }), NU);
		expect(s.spaerret).toBe(false);
		expect(s.iNaade).toBe(true);
		expect(s.dageTilbageAfNaade).toBe(1);
	});

	it('spaerrer naar naaden er brugt op', () => {
		const s = vurderSpaerring(g({ aboSlutterAt: NU - (NAADE_DAGE + 1) * DAG }), NU);
		expect(s.spaerret).toBe(true);
		expect(s.iNaade).toBe(false);
	});

	it('spaerrer en abonnent der er langt over tid', () => {
		const s = vurderSpaerring(g({ aboSlutterAt: NU - 200 * DAG }), NU);
		expect(s.spaerret).toBe(true);
	});

	// Praecis paa slutmillisekundet er hun udloebet, men i naade. Vi vil
	// hellere ramme forkert til kundens fordel end omvendt.
	it('er i naade praecis paa slutdatoen', () => {
		const s = vurderSpaerring(g({ aboSlutterAt: NU }), NU);
		expect(s.spaerret).toBe(false);
		expect(s.iNaade).toBe(true);
	});
});

describe('naadeTekst', () => {
	it('siger dagen ud naar der er én tilbage', () => {
		expect(naadeTekst(1)).toBe('Dit abonnement er udløbet. Du har adgang dagen ud.');
	});

	it('siger antal dage naar der er flere', () => {
		expect(naadeTekst(3)).toBe('Dit abonnement er udløbet. Du har adgang 3 dage endnu.');
	});
});

// ── De tre tilstande. Se SPEC 35 ────────────────────────────

describe('vurderTilstand', () => {
	const DAG = 86_400_000;
	const nu = new Date('2026-08-18T10:00:00').getTime();

	function g(over: Partial<TilstandGrundlag> = {}): TilstandGrundlag {
		return {
			harApp: false,
			harAktivtForlob: false,
			aboSlutterAt: null,
			bonusSlutMs: null,
			...over
		};
	}

	it('giver fuld app naar forloebet koerer', () => {
		expect(vurderTilstand(g({ harAktivtForlob: true }), nu)).toBe('fuld');
	});

	it('giver fuld app naar abonnementet loeber', () => {
		expect(vurderTilstand(g({ harApp: true, aboSlutterAt: nu + 30 * DAG }), nu)).toBe('fuld');
	});

	// Forloebet vinder over alt andet, ogsaa over bonussen.
	it('giver fuld app paa et koerende forloeb selvom bonussen ogsaa loeber', () => {
		const svar = vurderTilstand(g({ harAktivtForlob: true, bonusSlutMs: nu + 40 * DAG }), nu);
		expect(svar).toBe('fuld');
	});

	it('giver fuld app i naadeperioden', () => {
		expect(vurderTilstand(g({ harApp: true, aboSlutterAt: nu - DAG }), nu)).toBe('fuld');
	});

	// DEN VIGTIGE. Foer det her blev hun lukket ude paa dag 1.
	it('giver bonus naar forloebet er slut og de 90 dage loeber', () => {
		expect(vurderTilstand(g({ bonusSlutMs: nu + 62 * DAG }), nu)).toBe('bonus');
	});

	it('giver lukket naar de 90 dage er gaaet', () => {
		expect(vurderTilstand(g({ bonusSlutMs: nu - DAG }), nu)).toBe('lukket');
	});

	it('giver lukket naar hun aldrig har haft et forloeb', () => {
		expect(vurderTilstand(g(), nu)).toBe('lukket');
	});

	it('giver lukket paa selve slut-tidspunktet', () => {
		expect(vurderTilstand(g({ bonusSlutMs: nu }), nu)).toBe('lukket');
	});

	it('giver bonus naar abonnementet er udloebet og naaden er brugt op', () => {
		const svar = vurderTilstand(
			g({ harApp: true, aboSlutterAt: nu - 10 * DAG, bonusSlutMs: nu + 5 * DAG }),
			nu
		);
		expect(svar).toBe('bonus');
	});
});

describe('maaSeIBonus', () => {
	it('lukker hende ind paa hendes egen side og materialet', () => {
		for (const sti of [
			'/ny/profil',
			'/ny/profil/opskrifter',
			'/ny/profil/traening',
			'/ny/lektioner/kropsro_maj_2026',
			'/ny/lektion/12/abc',
			'/ny/udvikling',
			'/ny/traening',
			'/ny/traening/abc/3',
			'/ny/hjaelp/faq'
		]) {
			expect(maaSeIBonus(sti), sti).toBe(true);
		}
	});

	it('holder hende ude af det hun ikke laengere har', () => {
		for (const sti of [
			'/ny',
			'/ny/30-30',
			'/ny/30-30/frokost',
			'/ny/beskeder',
			'/ny/dag/2026-08-18',
			'/ny/maaling',
			'/ny/admin'
		]) {
			expect(maaSeIBonus(sti), sti).toBe(false);
		}
	});

	// Hvidliste og ikke sortliste: en ny side er lukket indtil nogen
	// aktivt aabner den.
	it('lukker en side vi ikke har taget stilling til', () => {
		expect(maaSeIBonus('/ny/noget-nyt')).toBe(false);
	});

	// "/ny/profilering" maa ikke slippe ind fordi den begynder med /ny/profil.
	it('kraever et helt sti-led og ikke bare de samme bogstaver', () => {
		expect(maaSeIBonus('/ny/profilering')).toBe(false);
		expect(maaSeIBonus('/ny/traeningscenter')).toBe(false);
	});
});

describe('bonusBaandTekst', () => {
	const DAG = 86_400_000;
	const nu = new Date('2026-08-18T10:00:00').getTime();

	// Den siger hvad hun HAR og ikke hvad hun har mistet. Hun har lige
	// gennemfoert et forloeb.
	it('siger hvor laenge hun har materialet', () => {
		expect(bonusBaandTekst(nu + 62 * DAG, nu)).toBe(
			'Dit forløb er slut. Du har alt materialet 62 dage endnu.'
		);
	});

	it('siger dagen ud paa den sidste dag', () => {
		expect(bonusBaandTekst(nu + 3600_000, nu)).toBe(
			'Dit forløb er slut. Du har alt materialet dagen ud.'
		);
	});

	it('bebrejder hende ingenting', () => {
		const t = bonusBaandTekst(nu + 10 * DAG, nu);
		expect(t).not.toMatch(/mistet|udløbet|desværre|ikke længere/i);
	});
});
