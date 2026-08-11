import { describe, it, expect } from 'vitest';
import { opstartsBillede, maaAabnePaaKopi3, NY_APP_FLAG, type OpstartsKilde } from './hurtigStart3';
import type { ForlobKilde } from './adgang3';
import type { UserDoc } from '$lib/types';

const DAG = 86_400_000;
const NU = new Date(2026, 7, 11, 12, 0, 0).getTime();

function kunde(delvis: Partial<UserDoc> = {}): UserDoc {
	return {
		accessLevel: 'basis',
		accessSource: 'abonnement',
		activeSubscription: true,
		aboSlutterAt: NU + 90 * DAG,
		testerFeatures: [NY_APP_FLAG],
		...delvis
	} as UserDoc;
}

const FORLOB_ID = 'kropsro_maj_2026';

/** Et Kropsro-forloeb der koerer lige nu. */
function kropsroIGang(): ForlobKilde {
	return {
		id: FORLOB_ID,
		navn: 'Kropsro maj 2026',
		startMs: NU - 20 * DAG,
		antalDage: 84,
		produkt: 'premiumforløb'
	};
}

// En forloebs-raekke kraever BEGGE ben: forlobIds paa kunden OG selve
// forloebs-dokumentet, se udledAdgange i adgang3.ts. Det er praecis derfor
// den hurtige opstart skal hente hele billedet fra kopien og ikke bare
// bruger-dokumentet.
function paaForlob(delvis: Partial<UserDoc> = {}): UserDoc {
	return kunde({ forlobIds: [FORLOB_ID], ...delvis });
}

function kilde(delvis: Partial<OpstartsKilde> = {}): OpstartsKilde {
	return { userDoc: kunde(), forlob: [], nulDage: {}, erAdmin: false, ...delvis };
}

describe('maaAabnePaaKopi3', () => {
	it('lukker den almindelige tester ind paa kopien', () => {
		expect(maaAabnePaaKopi3(kilde(), NU)).toBe(true);
	});

	// Uden kopi er der bogstavelig talt ingenting at vise.
	it('aabner ikke naar der ingen kopi er', () => {
		expect(maaAabnePaaKopi3(kilde({ userDoc: null }), NU)).toBe(false);
	});

	// Foerste lukkede doer. Den skal bekraeftes af serveren, aldrig af en kopi.
	it('aabner ikke paa en kopi uden ny-app-flaget', () => {
		const k = kilde({ userDoc: kunde({ testerFeatures: [] }) });
		expect(maaAabnePaaKopi3(k, NU)).toBe(false);
	});

	it('behandler et manglende testerFeatures-felt som ingen adgang', () => {
		const k = kilde({ userDoc: kunde({ testerFeatures: undefined }) });
		expect(maaAabnePaaKopi3(k, NU)).toBe(false);
	});

	// Anden lukkede doer. Hun kan lige have fornyet, saa serveren skal svare
	// foer vi viser hende "Din adgang er udloebet".
	it('aabner ikke paa en kopi der ville vise adgang udloebet', () => {
		const k = kilde({
			userDoc: kunde({
				accessLevel: 'none',
				activeSubscription: false,
				aboSlutterAt: NU - 60 * DAG
			})
		});
		expect(maaAabnePaaKopi3(k, NU)).toBe(false);
	});

	// Admin spaerres aldrig, praecis som i skallen.
	it('lukker admin ind selv paa en kopi med udloebet abonnement', () => {
		const k = kilde({
			userDoc: kunde({
				accessLevel: 'none',
				activeSubscription: false,
				aboSlutterAt: NU - 60 * DAG,
				testerFeatures: []
			}),
			erAdmin: true
		});
		expect(maaAabnePaaKopi3(k, NU)).toBe(true);
	});
});

// DEN VIGTIGSTE GRUPPE. Det er her /ny adskiller sig fra den gamle app.
// Spaerringen hviler paa regel 1 i spaerring3: et aktivt forloeb vinder over
// alt. Hentede vi kun bruger-dokumentet fra kopien og ikke forloebene, ville
// en Kropsro-kunde med udloebet abonnement se ud som om hun slet ikke havde
// noget forloeb, og saa ville hun faa "Din adgang er udloebet" midt i sit
// forloeb. Derfor hentes hele billedet, og derfor staar testene her.
describe('faelden: forloebskunden med udloebet abonnement', () => {
	const udloebetAbo = paaForlob({
		accessLevel: 'premium',
		accessSource: 'forløb',
		activeSubscription: false,
		aboSlutterAt: NU - 60 * DAG
	});

	it('spaerrer hende IKKE naar forloebet er med i kopien', () => {
		const k = kilde({ userDoc: udloebetAbo, forlob: [kropsroIGang()] });
		expect(opstartsBillede(k, NU).erSpaerret).toBe(false);
		expect(maaAabnePaaKopi3(k, NU)).toBe(true);
	});

	// Bagsiden af samme mont. Manglede forloebene, ville hun blive spaerret,
	// og saa naegter reglen at aabne paa kopien i stedet for at vise hende den
	// forkerte skaerm. Begge veje ender altsaa rigtigt.
	it('naegter at aabne hvis forloebene mangler i kopien', () => {
		const k = kilde({ userDoc: udloebetAbo, forlob: [] });
		expect(opstartsBillede(k, NU).erSpaerret).toBe(true);
		expect(maaAabnePaaKopi3(k, NU)).toBe(false);
	});

	it('spaerrer hende naar forloebet er loebet ud OG abonnementet er udloebet', () => {
		const faerdigt: ForlobKilde = { ...kropsroIGang(), startMs: NU - 300 * DAG };
		const k = kilde({ userDoc: udloebetAbo, forlob: [faerdigt] });
		expect(opstartsBillede(k, NU).erSpaerret).toBe(true);
		expect(maaAabnePaaKopi3(k, NU)).toBe(false);
	});
});

describe('opstartsBillede', () => {
	it('giver det samme svar for de samme data, uanset hvem der spoerger', () => {
		// Selve pointen med at have ét kald: skallen og den hurtige opstart kan
		// ikke naa frem til hver sit svar.
		const k = kilde({ userDoc: paaForlob(), forlob: [kropsroIGang()] });
		const a = opstartsBillede(k, NU);
		const b = opstartsBillede(k, NU);
		expect(a.erSpaerret).toBe(b.erSpaerret);
		expect(a.maaSeNyApp).toBe(b.maaSeNyApp);
		expect(a.adgang.harApp).toBe(b.adgang.harApp);
		expect(a.adgang.aktiveForlob.length).toBe(b.adgang.aktiveForlob.length);
	});

	it('finder det aktive forloeb', () => {
		const k = kilde({ userDoc: paaForlob(), forlob: [kropsroIGang()] });
		expect(opstartsBillede(k, NU).adgang.aktiveForlob.length).toBe(1);
	});

	// Bekraefter at begge ben skal vaere der. Har kunden forlobIds, men er
	// forloebs-dokumentet ikke i kopien, findes raekken ikke.
	it('finder ingen forloeb naar kun det ene ben er der', () => {
		expect(opstartsBillede(kilde({ userDoc: paaForlob() }), NU).adgang.aktiveForlob.length).toBe(0);
		expect(opstartsBillede(kilde({ forlob: [kropsroIGang()] }), NU).adgang.aktiveForlob.length).toBe(
			0
		);
	});

	it('taaler et tomt billede uden at kaste', () => {
		const k = kilde({ userDoc: null });
		const b = opstartsBillede(k, NU);
		expect(b.maaSeNyApp).toBe(false);
		expect(b.adgang.aktiveForlob.length).toBe(0);
	});
});
