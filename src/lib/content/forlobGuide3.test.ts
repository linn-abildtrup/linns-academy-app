import { describe, it, expect } from 'vitest';
import {
	TRIN,
	TOMT_SVAR,
	idAf,
	validerOprettelse,
	forlobFelter,
	tjekTrin,
	spaerringer,
	bemaerkninger,
	manglendeDage,
	kanUdgives,
	fremdrift,
	harTraening,
	type GuideForlob,
	type Verden
} from './forlobGuide3';

const FORLOB: GuideForlob = {
	id: 'kickstart-oktober-2026',
	navn: 'Kickstart oktober 2026',
	startMs: new Date('2099-10-01T00:01:00').getTime(),
	antalDage: 21,
	aktiv: false,
	bygget: false,
	traeningStartDag: 3,
	simpleroProduktId: '12345'
};

/** Et hold hvor alt er paa plads. */
const KLAR: Verden = {
	forlob: FORLOB,
	antalTraeningstildelinger: 2,
	antalProgrammerPaaHoldet: 0,
	dageMedLektion: Array.from({ length: 21 }, (_, i) => i + 1),
	antalSmaaSkridt: 6,
	antalFaq: 8,
	antalKunder: 30,
	andreAktivePaaSammeProdukt: []
};

describe('trinnene', () => {
	it('er ni og nummereret i raekkefoelge', () => {
		expect(TRIN).toHaveLength(9);
		expect(TRIN.map((t) => t.nr)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
	});

	it('slutter med udgivelsen', () => {
		expect(TRIN[TRIN.length - 1].id).toBe('udgiv');
	});
});

describe('idAf', () => {
	it('laver et id af et navn med ae, oe og aa', () => {
		// Bemaerk at aa bliver til a og ikke aa. Bogstavets ring bliver
		// pillet af foer erstatningen naar. Det er saadan de eksisterende
		// holds id'er er lavet, saa det staar her som en beskrivelse og
		// ikke som et oenske.
		expect(idAf('Kickstart på Ø og Æbler')).toBe('kickstart_pa_oe_og_aebler');
	});

	it('efterlader ikke understreger i enderne', () => {
		expect(idAf('  Kropsro!  ')).toBe('kropsro');
	});

	it('BRUGER UNDERSTREG SOM DE EKSISTERENDE HOLD. Id kan ikke aendres bagefter', () => {
		expect(idAf('Kickstart oktober 2026')).toBe('kickstart_oktober_2026');
	});
});

describe('validerOprettelse', () => {
	const ok = { ...TOMT_SVAR, navn: 'Kickstart oktober', startDato: '2026-10-01' };

	it('siger ja naar alt er udfyldt', () => {
		expect(validerOprettelse(ok, [])).toBe('');
	});

	it('kraever navn og dato', () => {
		expect(validerOprettelse({ ...ok, navn: ' ' }, [])).toContain('navn');
		expect(validerOprettelse({ ...ok, startDato: '' }, [])).toContain('startdato');
	});

	it('afviser en laengde ingen kan bruge', () => {
		expect(validerOprettelse({ ...ok, antalDage: 0 }, [])).toContain('mellem 1 og 365');
		expect(validerOprettelse({ ...ok, antalDage: 400 }, [])).toContain('mellem 1 og 365');
	});

	it('AFVISER ET ID DER ER I BRUG. Ellers skrives et hold i drift over', () => {
		expect(validerOprettelse(ok, ['kickstart_oktober'])).toContain('findes allerede');
	});
});

describe('forlobFelter', () => {
	const svar = { ...TOMT_SVAR, navn: 'Kickstart oktober', startDato: '2026-10-01' };

	it('LADER HOLDET VAERE LUKKET SOM UDGANGSPUNKT', () => {
		// Guiden bruger TOMT_SVAR og saetter foerst aktivt paa sidste trin,
		// naar intet spaerrer.
		expect(forlobFelter(svar).aktiv).toBe(false);
		expect(forlobFelter({ ...svar, bygget: true }).aktiv).toBe(false);
	});

	it('men kan aabne med det samme naar der bliver bedt om det', () => {
		// Forloebs-listen er den hurtige vej for et hold man kender.
		expect(forlobFelter({ ...svar, aktiv: true }).aktiv).toBe(true);
	});

	it('saetter datoen til kl 00:01 paa den valgte dag', () => {
		const d = new Date(forlobFelter(svar).startMs);
		expect(d.getDate()).toBe(1);
		expect(d.getMonth()).toBe(9);
		expect(d.getMinutes()).toBe(1);
	});

	it('giver et bygget forloeb sit eget dataspor', () => {
		const f = forlobFelter({ ...svar, bygget: true, id: 'mit-forlob' });
		expect(f.byggetForlob).toBe(true);
		expect(f.produktNoegle).toBe('mit-forlob');
		expect(f.adgangsNiveau).toBe('basis');
	});

	it('giver et Kickstart-hold en type og ingen produktnoegle', () => {
		const f = forlobFelter(svar);
		expect(f.type).toBe('kickstart');
		expect(f.produktNoegle).toBeUndefined();
		expect(f.byggetForlob).toBeUndefined();
	});

	it('saetter kun premium naar der er sagt premium', () => {
		expect(forlobFelter(svar).adgangsNiveau).toBeUndefined();
		expect(forlobFelter({ ...svar, premium: true }).adgangsNiveau).toBe('premium');
	});
});

describe('harTraening', () => {
	it('Kickstart og Kropsro har altid traening', () => {
		expect(harTraening(FORLOB)).toBe(true);
	});

	it('et bygget forloeb har det kun naar det er valgt til', () => {
		expect(harTraening({ ...FORLOB, bygget: true })).toBe(false);
		expect(harTraening({ ...FORLOB, bygget: true, harTraening: true })).toBe(true);
	});
});

describe('spaerringer', () => {
	it('siger ingenting naar holdet er klar', () => {
		expect(spaerringer(KLAR)).toEqual([]);
		expect(kanUdgives(KLAR)).toBe(true);
	});

	it('SPAERRER NAAR HOLDET IKKE HAR FAAET TRAENING. Hele grunden til guiden', () => {
		const s = spaerringer({ ...KLAR, antalTraeningstildelinger: 0 });
		expect(s.some((x) => x.includes('Din træning er på vej'))).toBe(true);
		expect(kanUdgives({ ...KLAR, antalTraeningstildelinger: 0 })).toBe(false);
	});

	it('SPAERRER IKKE NAAR PROGRAMMERNE LIGGER PAA SELVE HOLDET', () => {
		// Kickstart og Kropsro tildeler ikke, de har programmerne liggende
		// paa holdet. Opdaget paa Kickstart August 4. september.
		const v = { ...KLAR, antalTraeningstildelinger: 0, antalProgrammerPaaHoldet: 2 };
		expect(spaerringer(v)).toEqual([]);
		expect(tjekTrin(v).find((x) => x.id === 'traening')?.status).toBe('klar');
	});

	it('spaerrer foerst naar der ikke er traening nogen af de to steder', () => {
		const v = { ...KLAR, antalTraeningstildelinger: 0, antalProgrammerPaaHoldet: 0 };
		expect(spaerringer(v).some((x) => x.includes('Din træning er på vej'))).toBe(true);
	});

	it('naevner ikke traening paa et hold der ikke har den', () => {
		const v = {
			...KLAR,
			forlob: { ...FORLOB, bygget: true, harTraening: false },
			antalTraeningstildelinger: 0
		};
		expect(spaerringer(v)).toEqual([]);
	});

	it('opdager at traeningen starter efter forloebet er slut', () => {
		const s = spaerringer({ ...KLAR, forlob: { ...FORLOB, traeningStartDag: 30 } });
		expect(s.some((x) => x.includes('starter den aldrig'))).toBe(true);
	});

	it('spaerrer naar der ikke er en eneste lektion', () => {
		expect(spaerringer({ ...KLAR, dageMedLektion: [] }).some((x) => x.includes('tom fra dag 1'))).toBe(
			true
		);
	});

	it('spaerrer naar der ikke er nogen smaa skridt', () => {
		expect(spaerringer({ ...KLAR, antalSmaaSkridt: 0 })).toHaveLength(1);
	});

	it('spaerrer naar Facebook-gruppen er slaaet til uden et link', () => {
		const s = spaerringer({ ...KLAR, forlob: { ...FORLOB, harFacebookGruppe: true } });
		expect(s.some((x) => x.includes('link'))).toBe(true);
	});

	it('accepterer Facebook naar linket er der', () => {
		const v = {
			...KLAR,
			forlob: { ...FORLOB, harFacebookGruppe: true, facebookUrl: 'https://facebook.com/g/1' }
		};
		expect(spaerringer(v)).toEqual([]);
	});

	it('SPAERRER NAAR TO AKTIVE HOLD DELER SIMPLERO-NUMMER. Så lander købet tilfældigt', () => {
		const s = spaerringer({ ...KLAR, andreAktivePaaSammeProdukt: ['Kickstart august 2026'] });
		expect(s.some((x) => x.includes('forkerte hold'))).toBe(true);
	});

	it('siger fra naar forloebet slet ikke er oprettet', () => {
		expect(spaerringer({ ...KLAR, forlob: null })).toHaveLength(1);
		expect(kanUdgives({ ...KLAR, forlob: null })).toBe(false);
	});
});

describe('bemaerkninger', () => {
	it('er tomme naar alt er i orden', () => {
		expect(bemaerkninger(KLAR)).toEqual([]);
	});

	it('NAEVNER MANGLENDE FAQ UDEN AT SPAERRE. Holdet kan godt køre uden', () => {
		const uden = { ...KLAR, antalFaq: 0 };
		expect(bemaerkninger(uden).some((x) => x.includes('FAQ'))).toBe(true);
		expect(spaerringer(uden)).toEqual([]);
	});

	it('naevner huller i dagene', () => {
		const v = { ...KLAR, dageMedLektion: [1, 2, 3] };
		expect(bemaerkninger(v).some((x) => x.includes('18 dage'))).toBe(true);
	});

	it('naevner en startdato der allerede er passeret', () => {
		const v = { ...KLAR, forlob: { ...FORLOB, startMs: new Date('2020-01-01').getTime() } };
		expect(bemaerkninger(v).some((x) => x.includes('passeret'))).toBe(true);
	});

	it('naevner et hold uden kunder og uden Simplero-kobling', () => {
		const v = { ...KLAR, forlob: { ...FORLOB, simpleroProduktId: undefined }, antalKunder: 0 };
		expect(bemaerkninger(v).some((x) => x.includes('Simplero'))).toBe(true);
	});
});

describe('manglendeDage', () => {
	it('taeller kun dagene i forloebet, ikke baseline', () => {
		const v = { ...KLAR, forlob: { ...FORLOB, antalDage: 5 }, dageMedLektion: [0, 1, 2] };
		expect(manglendeDage(v)).toEqual([3, 4, 5]);
	});
});

describe('tjekTrin', () => {
	it('melder alle trin klar naar holdet er klar', () => {
		const t = tjekTrin(KLAR).filter((x) => x.id !== 'udgiv');
		expect(t.every((x) => x.status === 'klar')).toBe(true);
	});

	it('SPRINGER TRAENINGS-TRINNET OVER paa et hold uden traening', () => {
		const v = { ...KLAR, forlob: { ...FORLOB, bygget: true, harTraening: false } };
		const t = tjekTrin(v).find((x) => x.id === 'traening');
		expect(t?.status).toBe('ikke-relevant');
	});

	it('siger hvor mange dage der har indhold', () => {
		const v = { ...KLAR, dageMedLektion: [1, 2] };
		expect(tjekTrin(v).find((x) => x.id === 'lektioner')?.resume).toBe('2 af 21 dage har indhold');
	});

	it('venter paa navn og dato foer forloebet er oprettet', () => {
		const t = tjekTrin({ ...KLAR, forlob: null });
		expect(t[0].status).toBe('mangler');
		expect(t[1].status).toBe('ikke-relevant');
	});

	it('siger paa sidste trin hvor mange ting der spaerrer', () => {
		const v = { ...KLAR, antalTraeningstildelinger: 0, antalSmaaSkridt: 0 };
		expect(tjekTrin(v).find((x) => x.id === 'udgiv')?.resume).toBe('2 ting spærrer');
	});

	it('siger at holdet er aabent naar det er udgivet', () => {
		const v = { ...KLAR, forlob: { ...FORLOB, aktiv: true } };
		expect(tjekTrin(v).find((x) => x.id === 'udgiv')?.resume).toBe('Holdet er åbent');
	});
});

describe('fremdrift', () => {
	it('taeller ikke udgivelses-trinnet med', () => {
		expect(fremdrift(KLAR)).toEqual({ klar: 8, ialt: 8 });
	});

	it('taeller et trin der ikke er relevant som klaret', () => {
		const v = {
			...KLAR,
			forlob: { ...FORLOB, bygget: true, harTraening: false },
			antalTraeningstildelinger: 0
		};
		expect(fremdrift(v).klar).toBe(8);
	});
});
