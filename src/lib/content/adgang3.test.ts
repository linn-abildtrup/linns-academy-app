import { describe, it, expect } from 'vitest';
import {
	udledAdgange,
	resolverAdgangsbillede,
	adgangsbilledeFor,
	erAktiv,
	samletAdgangstidMs,
	formatMedlemstid,
	gennemfoerteForlob,
	type ForlobKilde,
	type KundeFelter
} from './adgang3';

const DAG = 24 * 60 * 60 * 1000;

// Fast referencepunkt saa testene ikke afhaenger af hvornaar de koeres.
// 1. juni 2026 kl 06:00 lokal tid.
const START = new Date(2026, 5, 1, 6, 0, 0, 0).getTime();

const kickstart: ForlobKilde = {
	id: 'kickstart_juni_2026',
	navn: 'Kickstart juni',
	startMs: START,
	antalDage: 21,
	produkt: 'kickstart'
};

// Kickstart slutter ved start + (21 + 1) dage, jf forlobSlutMs. Kunden faar
// hele sin sidste dag.
const KICKSTART_SLUT = START + 22 * DAG;

describe('udledAdgange', () => {
	it('laver en forloebs-raekke pr forloeb kunden er paa', () => {
		const r = udledAdgange({ forlobIds: [kickstart.id] }, [kickstart]);
		expect(r).toHaveLength(1);
		expect(r[0]).toMatchObject({
			art: 'forlob',
			produkt: 'kickstart',
			forlobId: kickstart.id,
			fra: START,
			til: KICKSTART_SLUT
		});
	});

	it('springer forloeb over som vi ikke har dokumentet for', () => {
		const r = udledAdgange({ forlobIds: ['findes_ikke'] }, [kickstart]);
		expect(r).toHaveLength(0);
	});

	it('laver en abo-raekke af aboProdukt og aboSlutterAt', () => {
		const r = udledAdgange({ aboProdukt: 'basisabo', aboKoebtAt: START, aboSlutterAt: START + 30 * DAG }, []);
		expect(r).toHaveLength(1);
		expect(r[0]).toMatchObject({ art: 'abo', produkt: 'basisabo', fra: START, til: START + 30 * DAG });
	});

	it('giver loebende abo (comp-konto) til=null naar aboSlutterAt mangler', () => {
		const r = udledAdgange({ aboProdukt: 'basisabo', aboKoebtAt: START }, []);
		expect(r[0].til).toBeNull();
	});

	it('falder tilbage paa createdAt naar koebsdatoen mangler', () => {
		const r = udledAdgange({ aboProdukt: 'basisabo', createdAt: START - 100 * DAG }, []);
		expect(r[0].fra).toBe(START - 100 * DAG);
	});

	it('udleder abo af accessSource naar aboProdukt mangler', () => {
		const r = udledAdgange({ accessSource: 'abonnement', activeProduct: 'basisabo' }, []);
		expect(r[0]).toMatchObject({ art: 'abo', produkt: 'basisabo' });
	});

	it('laver ingen abo-raekke for en ren forloebskunde', () => {
		const r = udledAdgange({ forlobIds: [kickstart.id], accessSource: 'forløb', activeProduct: 'kickstart' }, [
			kickstart
		]);
		expect(r.filter((x) => x.art === 'abo')).toHaveLength(0);
	});

	it('laver en bonus-raekke der loeber fra forloebets slut', () => {
		const r = udledAdgange(
			{ forlobIds: [kickstart.id], bonusPeriodEndsAt: KICKSTART_SLUT + 90 * DAG },
			[kickstart]
		);
		const bonus = r.find((x) => x.art === 'bonus');
		expect(bonus).toMatchObject({ fra: KICKSTART_SLUT, til: KICKSTART_SLUT + 90 * DAG });
	});
});

describe('erAktiv', () => {
	const a = { art: 'abo' as const, produkt: 'app', fra: 100, til: 200, kilde: 'udledt' as const };

	it('er falsk foer fra', () => expect(erAktiv(a, 99)).toBe(false));
	it('er sand paa fra', () => expect(erAktiv(a, 100)).toBe(true));
	it('er falsk paa til (halvaabent interval)', () => expect(erAktiv(a, 200)).toBe(false));
	it('er sand uden slutdato', () =>
		expect(erAktiv({ ...a, til: null }, 10 ** 15)).toBe(true));
});

describe('resolverAdgangsbillede', () => {
	it('giver app-adgang til en ren app-kunde', () => {
		const b = adgangsbilledeFor(START + DAG, { aboProdukt: 'basisabo', aboKoebtAt: START }, []);
		expect(b.harApp).toBe(true);
		expect(b.aktiveForlob).toHaveLength(0);
	});

	it('giver app-adgang til en forloebskunde UDEN abo', () => {
		// Kernen i SPEC-3.0.md 2.4: forloebet giver ogsaa app-adgang.
		const b = adgangsbilledeFor(START + 5 * DAG, { forlobIds: [kickstart.id] }, [kickstart]);
		expect(b.harApp).toBe(true);
		expect(b.aktiveForlob).toHaveLength(1);
	});

	it('holder BEGGE aktive samtidig, hvor den gamle model kun kunne én', () => {
		// Det er praecis det scenarie der i dag tvinger app-koeb til at blive
		// udskudt til dagen efter forloebets slut.
		const felter: KundeFelter = {
			forlobIds: [kickstart.id],
			aboProdukt: 'basisabo',
			aboKoebtAt: START + 3 * DAG,
			aboSlutterAt: START + 400 * DAG
		};
		const b = adgangsbilledeFor(START + 5 * DAG, felter, [kickstart]);
		expect(b.harApp).toBe(true);
		expect(b.aktiveForlob).toHaveLength(1);
		expect(b.aktiveForlob[0].forlobId).toBe(kickstart.id);
	});

	it('lader forloebet udloebe uden at app-adgangen falder bort', () => {
		const felter: KundeFelter = {
			forlobIds: [kickstart.id],
			aboProdukt: 'basisabo',
			aboKoebtAt: START,
			aboSlutterAt: START + 400 * DAG
		};
		const b = adgangsbilledeFor(KICKSTART_SLUT + DAG, felter, [kickstart]);
		// Dagen et forloeb slutter skal vaere usynlig for kunden. Kun
		// lektionerne stopper.
		expect(b.harApp).toBe(true);
		expect(b.aktiveForlob).toHaveLength(0);
		expect(b.tidligereForlob).toEqual([kickstart.id]);
	});

	it('regner dagnummer 0-baseret fra startdatoen', () => {
		const paaStart = adgangsbilledeFor(START, { forlobIds: [kickstart.id] }, [kickstart]);
		expect(paaStart.aktiveForlob[0].dagNummer).toBe(0);

		const dagFem = adgangsbilledeFor(START + 5 * DAG, { forlobIds: [kickstart.id] }, [kickstart]);
		expect(dagFem.aktiveForlob[0].dagNummer).toBe(5);
	});

	it('lader ikke dagnummer loebe forbi forloebets laengde', () => {
		const b = adgangsbilledeFor(START + 21.5 * DAG, { forlobIds: [kickstart.id] }, [kickstart]);
		expect(b.aktiveForlob[0].dagNummer).toBe(21);
	});

	it('haandterer to forloeb der overlapper uden at vaelge en vinder', () => {
		const kropsro: ForlobKilde = {
			id: 'kropsro_juni_2026',
			navn: 'Kropsro juni',
			startMs: START + 10 * DAG,
			antalDage: 21,
			produkt: 'kropsro'
		};
		const b = adgangsbilledeFor(START + 12 * DAG, { forlobIds: [kickstart.id, kropsro.id] }, [
			kickstart,
			kropsro
		]);
		expect(b.aktiveForlob).toHaveLength(2);
	});

	it('giver bibliotek men IKKE app i bonus-perioden', () => {
		const b = adgangsbilledeFor(
			KICKSTART_SLUT + 10 * DAG,
			{ forlobIds: [kickstart.id], bonusPeriodEndsAt: KICKSTART_SLUT + 90 * DAG },
			[kickstart]
		);
		expect(b.harApp).toBe(false);
		expect(b.harBibliotek).toBe(true);
	});

	it('lukker helt naar baade forloeb, abo og bonus er udloebet', () => {
		const b = adgangsbilledeFor(
			KICKSTART_SLUT + 200 * DAG,
			{ forlobIds: [kickstart.id], bonusPeriodEndsAt: KICKSTART_SLUT + 90 * DAG },
			[kickstart]
		);
		expect(b.harApp).toBe(false);
		expect(b.harBibliotek).toBe(false);
		expect(b.tidligereForlob).toEqual([kickstart.id]);
	});

	it('aabner ikke forloebet foer startdatoen', () => {
		const b = adgangsbilledeFor(START - DAG, { forlobIds: [kickstart.id] }, [kickstart]);
		expect(b.aktiveForlob).toHaveLength(0);
		expect(b.harApp).toBe(false);
	});

	it('resolverer tomme adgange til ingen adgang', () => {
		const b = resolverAdgangsbillede(START, [], []);
		expect(b).toEqual({
			harApp: false,
			aktiveForlob: [],
			tidligereForlob: [],
			harBibliotek: false,
			medlemstidMs: 0,
			gennemfoerte: []
		});
	});
});

describe('samletAdgangstidMs', () => {
	const raekke = (fra: number, til: number | null, art: 'abo' | 'forlob' | 'bonus' = 'abo') => ({
		art,
		produkt: 'app',
		fra,
		til,
		kilde: 'udledt' as const
	});

	it('taeller en loebende raekke frem til nu, ikke laengere', () => {
		const ms = samletAdgangstidMs([raekke(START, null)], START + 30 * DAG);
		expect(ms).toBe(30 * DAG);
	});

	it('taeller overlap mellem abo og forloeb kun én gang', () => {
		// Praecis det den gamle model ikke kunne rumme: begge dele samtidig.
		const ms = samletAdgangstidMs(
			[raekke(START, START + 60 * DAG, 'abo'), raekke(START + 10 * DAG, START + 30 * DAG, 'forlob')],
			START + 60 * DAG
		);
		expect(ms).toBe(60 * DAG);
	});

	it('springer pausen over naar hun melder sig ud og kommer med igen', () => {
		const ms = samletAdgangstidMs(
			[raekke(START, START + 30 * DAG), raekke(START + 120 * DAG, START + 150 * DAG)],
			START + 200 * DAG
		);
		expect(ms).toBe(60 * DAG);
	});

	it('slaar perioder sammen naar de stoeder direkte op til hinanden', () => {
		const ms = samletAdgangstidMs(
			[raekke(START, START + 30 * DAG), raekke(START + 30 * DAG, START + 45 * DAG)],
			START + 45 * DAG
		);
		expect(ms).toBe(45 * DAG);
	});

	it('taeller ikke bonus-perioden med', () => {
		const ms = samletAdgangstidMs([raekke(START, START + 90 * DAG, 'bonus')], START + 90 * DAG);
		expect(ms).toBe(0);
	});

	it('giver nul for en raekke der foerst begynder i fremtiden', () => {
		expect(samletAdgangstidMs([raekke(START + 10 * DAG, null)], START)).toBe(0);
	});
});

describe('formatMedlemstid', () => {
	const MAANED = DAG * 30.44;
	it('siger ingenting den foerste maaned', () => expect(formatMedlemstid(20 * DAG)).toBe(''));
	it('boejer én maaned i ental', () => expect(formatMedlemstid(MAANED)).toBe('1 måned'));
	it('skriver maaneder under et aar', () => expect(formatMedlemstid(5 * MAANED)).toBe('5 måneder'));
	it('skriver rundt aar uden maaneder', () => expect(formatMedlemstid(12 * MAANED)).toBe('1 år'));
	it('skriver aar og maaneder det foerste aar', () =>
		expect(formatMedlemstid(15 * MAANED)).toBe('1 år og 3 måneder'));
	it('skriver kun hele aar fra to aar', () =>
		expect(formatMedlemstid(29 * MAANED)).toBe('2 år'));
});

describe('gennemfoerteForlob', () => {
	const kropsro: ForlobKilde = {
		id: 'kropsro_2025',
		navn: 'Kropsro',
		startMs: START - 400 * DAG,
		antalDage: 56,
		produkt: 'kropsro'
	};

	it('tager kun forloeb der er slut', () => {
		const g = gennemfoerteForlob(
			udledAdgange({ forlobIds: [kickstart.id] }, [kickstart]),
			[kickstart],
			START + 5 * DAG
		);
		expect(g).toHaveLength(0);
	});

	it('giver navn og aarstal fra forloebets slutdato', () => {
		const g = gennemfoerteForlob(
			udledAdgange({ forlobIds: [kickstart.id] }, [kickstart]),
			[kickstart],
			KICKSTART_SLUT + DAG
		);
		expect(g).toEqual([
			{
				forlobId: kickstart.id,
				navn: 'Kickstart juni',
				aar: 2026,
				slutMs: KICKSTART_SLUT
			}
		]);
	});

	it('sorterer nyeste foerst', () => {
		const g = gennemfoerteForlob(
			udledAdgange({ forlobIds: [kropsro.id, kickstart.id] }, [kropsro, kickstart]),
			[kropsro, kickstart],
			KICKSTART_SLUT + DAG
		);
		expect(g.map((x) => x.forlobId)).toEqual([kickstart.id, kropsro.id]);
	});
});
