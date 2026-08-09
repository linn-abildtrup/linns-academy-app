import { describe, it, expect } from 'vitest';
import type { Timestamp } from 'firebase/firestore';
import {
	STANDARD_MAAL,
	maalFor,
	byggGitter,
	byggRaekker,
	byggStillingVisning,
	rammerKunde,
	fremdriftTekst,
	pladsTekst,
	erIGang,
	dageTilbage,
	type Challenge3,
	type ChallengeForside,
	type MasterChallenge
} from './challenge3';

const DAG = 24 * 60 * 60 * 1000;

function ts(ms: number): Timestamp {
	return { toMillis: () => ms } as Timestamp;
}

function challenge(delvis: Partial<Challenge3> = {}): Challenge3 {
	return {
		id: 'c1',
		forlobId: 'kropsro_maj_2026',
		navn: 'Planter til tarmmikrobiom',
		beskrivelse: '',
		startDato: ts(0),
		slutDato: ts(6 * DAG),
		aktiv: true,
		fravalgteBrugere: [],
		...delvis
	};
}

function forside(delvis: Partial<ChallengeForside> = {}): ChallengeForside {
	return {
		id: 'c1',
		navn: 'Planter til tarmmikrobiom',
		beskrivelse: '',
		planter: [],
		fravalgteBrugere: [],
		score: 34,
		maal: 50,
		senesteJournal: 'Rødbede',
		plads: null,
		antalDeltagere: 28,
		dageTilbage: 3,
		...delvis
	};
}

describe('maalFor', () => {
	it('bruger 50 naar Linn ikke har sat et maal', () => {
		expect(maalFor(challenge())).toBe(STANDARD_MAAL);
		expect(maalFor(null)).toBe(STANDARD_MAAL);
	});

	it('bruger Linns eget maal naar det er sat', () => {
		expect(maalFor(challenge({ maal: 30 }))).toBe(30);
	});

	it('falder tilbage til 50 ved et ubrugeligt maal', () => {
		expect(maalFor(challenge({ maal: 0 }))).toBe(STANDARD_MAAL);
		expect(maalFor(challenge({ maal: -5 }))).toBe(STANDARD_MAAL);
		expect(maalFor(challenge({ maal: Number.NaN }))).toBe(STANDARD_MAAL);
	});

	it('runder et kommatal ned og lofter et vildt stort maal', () => {
		expect(maalFor(challenge({ maal: 30.9 }))).toBe(30);
		expect(maalFor(challenge({ maal: 5000 }))).toBe(500);
	});
});

describe('byggGitter', () => {
	it('laver et felt pr plante i maalet', () => {
		expect(byggGitter(0, 50)).toHaveLength(50);
	});

	it('fylder praecis saa mange felter som hun har planter', () => {
		const g = byggGitter(34, 50);
		expect(g.filter((f) => f.fyldt)).toHaveLength(34);
		expect(g[33].fyldt).toBe(true);
		expect(g[34].fyldt).toBe(false);
	});

	it('markerer den seneste plante saa hun kan se hvad der er nyt', () => {
		const g = byggGitter(34, 50);
		expect(g.filter((f) => f.nyeste)).toHaveLength(1);
		expect(g[33].nyeste).toBe(true);
	});

	it('markerer ingenting som nyest naar hun ikke er begyndt', () => {
		expect(byggGitter(0, 50).some((f) => f.nyeste)).toBe(false);
	});

	it('lader gitteret vokse naar hun overgaar maalet', () => {
		const g = byggGitter(57, 50);
		expect(g).toHaveLength(57);
		expect(g.every((f) => f.fyldt)).toBe(true);
	});

	it('taaler en negativ score uden at gaa i stykker', () => {
		const g = byggGitter(-3, 50);
		expect(g).toHaveLength(50);
		expect(g.some((f) => f.fyldt)).toBe(false);
	});
});

describe('byggRaekker', () => {
	it('deler maalet op i raekker af ti', () => {
		const r = byggRaekker(34, 50);
		expect(r).toHaveLength(5);
		expect(r.map((x) => x.indtil)).toEqual([10, 20, 30, 40, 50]);
		expect(r.every((x) => x.felter.length === 10)).toBe(true);
	});

	it('giver den sidste raekke det tal den faktisk naar', () => {
		const r = byggRaekker(0, 35);
		expect(r.map((x) => x.indtil)).toEqual([10, 20, 30, 35]);
		expect(r[3].felter).toHaveLength(5);
	});

	it('foelger med naar hun gaar forbi maalet', () => {
		const r = byggRaekker(57, 50);
		expect(r.map((x) => x.indtil)).toEqual([10, 20, 30, 40, 50, 57]);
	});
});

describe('fremdriftTekst', () => {
	it('inviterer hende til at begynde', () => {
		expect(fremdriftTekst(forside({ score: 0 }))).toBe('Tilføj den første plante du har spist.');
	});

	it('siger hvor mange der mangler', () => {
		expect(fremdriftTekst(forside({ score: 34, maal: 50 }))).toBe('16 planter til de 50.');
	});

	it('boejer ordet korrekt ved én tilbage', () => {
		expect(fremdriftTekst(forside({ score: 49, maal: 50 }))).toBe('1 plante til de 50.');
	});

	it('fejrer det naar hun er i maal', () => {
		expect(fremdriftTekst(forside({ score: 50, maal: 50 }))).toBe(
			'Du er i mål. 50 forskellige planter.'
		);
	});

	it('bliver ved med at fejre naar hun gaar forbi maalet', () => {
		expect(fremdriftTekst(forside({ score: 57, maal: 50 }))).toContain('Du er i mål');
	});
});

describe('pladsTekst', () => {
	// Hun skal ikke mindes om at hun er sidst, hver gang hun aabner appen.
	it('siger ingenting naar hun ikke er i den oeverste tredjedel', () => {
		expect(pladsTekst(forside({ plads: 26, antalDeltagere: 28 }))).toBeNull();
		expect(pladsTekst(forside({ plads: 15, antalDeltagere: 28 }))).toBeNull();
	});

	it('naevner pladsen naar hun er godt med', () => {
		expect(pladsTekst(forside({ plads: 4, antalDeltagere: 28 }))).toBe('Du er nr. 4');
	});

	it('siger at hun foerer i stedet for nr. 1', () => {
		expect(pladsTekst(forside({ plads: 1, antalDeltagere: 28 }))).toBe('Du fører');
	});

	it('siger ingenting naar stillingen ikke er hentet', () => {
		expect(pladsTekst(forside({ plads: null }))).toBeNull();
	});

	it('siger ingenting naar der er for faa med til at det giver mening', () => {
		expect(pladsTekst(forside({ plads: 1, antalDeltagere: 2 }))).toBeNull();
	});
});

function master(delvis: Partial<MasterChallenge> = {}): MasterChallenge {
	return {
		id: 'm1',
		navn: 'Planter til tarmmikrobiom',
		beskrivelse: '',
		startDato: ts(0),
		slutDato: ts(6 * DAG),
		aktiv: true,
		fravalgteBrugere: [],
		modtagere: [],
		...delvis
	};
}

const KUNDE = { uid: 'u1', forlobIds: ['kickstart_juni_2026'], erAppBruger: true };

describe('rammerKunde', () => {
	it('rammer ingen naar der ikke er tildelt noget', () => {
		expect(rammerKunde(master(), KUNDE)).toBe(false);
	});

	it('rammer hende personligt', () => {
		const c = master({ modtagere: [{ type: 'kunde', id: 'u1' }] });
		expect(rammerKunde(c, KUNDE)).toBe(true);
		expect(rammerKunde(c, { ...KUNDE, uid: 'anden' })).toBe(false);
	});

	it('rammer hele holdet hun er paa', () => {
		const c = master({ modtagere: [{ type: 'forlob', id: 'kickstart_juni_2026' }] });
		expect(rammerKunde(c, KUNDE)).toBe(true);
		expect(rammerKunde(c, { ...KUNDE, forlobIds: ['kropsro_maj_2026'] })).toBe(false);
	});

	it('rammer medlemmer der bare har appen', () => {
		const c = master({ modtagere: [{ type: 'alle-app', id: '' }] });
		expect(rammerKunde(c, { uid: 'u9', forlobIds: [], erAppBruger: true })).toBe(true);
		expect(rammerKunde(c, { uid: 'u9', forlobIds: [], erAppBruger: false })).toBe(false);
	});

	// En kvinde paa Kickstart er ogsaa app-bruger. En challenge til alle
	// skal ikke gaa uden om hende, bare fordi hun er paa et hold.
	it('rammer ogsaa forloebskunder naar den er givet til alle', () => {
		const c = master({ modtagere: [{ type: 'alle-app', id: '' }] });
		expect(rammerKunde(c, KUNDE)).toBe(true);
	});

	it('kan gaa til flere hold paa én gang', () => {
		const c = master({
			modtagere: [
				{ type: 'forlob', id: 'kickstart_juni_2026' },
				{ type: 'forlob', id: 'kropsro_maj_2026' }
			]
		});
		expect(rammerKunde(c, KUNDE)).toBe(true);
		expect(rammerKunde(c, { ...KUNDE, forlobIds: ['kropsro_maj_2026'] })).toBe(true);
		expect(rammerKunde(c, { ...KUNDE, forlobIds: ['andet_hold'] })).toBe(false);
	});
});

describe('byggStillingVisning', () => {
	function raekker(antal: number, migPlads: number) {
		return Array.from({ length: antal }, (_, i) => ({
			uid: `u${i + 1}`,
			displayNavn: `Deltager ${i + 1}`,
			score: antal - i,
			erMig: i + 1 === migPlads
		}));
	}

	it('viser hoejst ti i toppen', () => {
		const v = byggStillingVisning(raekker(700, 400));
		expect(v.top).toHaveLength(10);
		expect(v.antal).toBe(700);
	});

	it('giver alle en plads der foelger raekkefoelgen', () => {
		const v = byggStillingVisning(raekker(28, 4));
		expect(v.top.map((r) => r.plads)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
	});

	it('viser hendes egen linje naar hun er langt nede', () => {
		const v = byggStillingVisning(raekker(700, 400));
		expect(v.mig?.plads).toBe(400);
		expect(v.mig?.erMig).toBe(true);
	});

	it('gentager hende ikke naar hun allerede staar i toppen', () => {
		const v = byggStillingVisning(raekker(28, 4));
		expect(v.mig).toBeNull();
		expect(v.top.filter((r) => r.erMig)).toHaveLength(1);
	});

	it('taaler en stilling hun slet ikke er med i', () => {
		const v = byggStillingVisning(raekker(28, 0));
		expect(v.mig).toBeNull();
	});

	it('taaler en tom stilling', () => {
		const v = byggStillingVisning([]);
		expect(v.top).toEqual([]);
		expect(v.mig).toBeNull();
		expect(v.antal).toBe(0);
	});
});

describe('erIGang', () => {
	it('er i gang midt i perioden', () => {
		expect(erIGang(challenge(), 3 * DAG)).toBe(true);
	});

	it('taeller slutdagen med, helt til midnat', () => {
		expect(erIGang(challenge(), 6 * DAG + DAG - 1)).toBe(true);
		expect(erIGang(challenge(), 7 * DAG)).toBe(false);
	});

	it('er ikke i gang foer start', () => {
		expect(erIGang(challenge({ startDato: ts(2 * DAG) }), DAG)).toBe(false);
	});

	it('er ikke i gang naar Linn har slaaet den fra', () => {
		expect(erIGang(challenge({ aktiv: false }), 3 * DAG)).toBe(false);
	});
});

describe('dageTilbage', () => {
	it('giver 0 paa sidste dag', () => {
		expect(dageTilbage(challenge(), 6 * DAG)).toBe(0);
	});

	it('taeller hele dage', () => {
		expect(dageTilbage(challenge(), 3 * DAG)).toBe(3);
	});

	it('giver 0 naar perioden er forbi', () => {
		expect(dageTilbage(challenge(), 30 * DAG)).toBe(0);
	});
});
