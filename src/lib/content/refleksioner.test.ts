import { describe, it, expect } from 'vitest';
import {
	afgraensSvar,
	byggCsv,
	csvFelt,
	csvFilnavn,
	datoForDag,
	datoTekst,
	grupperPrDag,
	grupperPrKlient,
	isoDato,
	tidspunktTekst,
	type Refleksionssvar
} from './refleksioner';

// Kropsro 24. maj startede 2026-05-24. Bruges som fast anker i testene.
const START = new Date(2026, 4, 24).getTime();

function svar(over: Partial<Refleksionssvar> = {}): Refleksionssvar {
	return {
		uid: 'u1',
		navn: 'Karen Bang',
		email: 'karen@eksempel.dk',
		dagNummer: 1,
		spoergsmaal: 'Hvad er din 1% i dag?',
		svar: 'Jeg gik en tur',
		gemtMs: new Date(2026, 4, 25, 9, 14).getTime(),
		...over
	};
}

describe('datoer', () => {
	it('giver lokal ISO-dato, ikke UTC', () => {
		// Midnat dansk tid er dagen foer i UTC. toISOString ville give 23. maj.
		expect(isoDato(new Date(2026, 4, 24, 0, 1))).toBe('2026-05-24');
	});

	it('regner holdets dato ud fra forloebsdagen', () => {
		expect(datoForDag(START, 0)).toBe('2026-05-24');
		expect(datoForDag(START, 1)).toBe('2026-05-25');
		expect(datoForDag(START, 84)).toBe('2026-08-16');
	});

	it('skriver datoen paa dansk', () => {
		expect(datoTekst('2026-08-16')).toBe('16. august 2026');
	});

	it('skriver tidspunktet kort', () => {
		expect(tidspunktTekst(new Date(2026, 7, 16, 9, 4).getTime())).toBe('16/8 kl. 09.04');
	});

	it('viser intet tidspunkt naar svaret mangler tidsstempel', () => {
		expect(tidspunktTekst(null)).toBe('');
	});
});

describe('afgraensning paa forloebsdag', () => {
	const alle = [svar({ dagNummer: 1 }), svar({ dagNummer: 40 }), svar({ dagNummer: 84 })];

	it('tager fra og til med', () => {
		const r = afgraensSvar(alle, 'dag', '1', '40');
		expect(r.map((s) => s.dagNummer)).toEqual([1, 40]);
	});

	it('lader tom fra betyde ingen nedre graense', () => {
		expect(afgraensSvar(alle, 'dag', '', '40')).toHaveLength(2);
	});

	it('lader tom til betyde ingen oevre graense', () => {
		expect(afgraensSvar(alle, 'dag', '40', '')).toHaveLength(2);
	});

	it('giver alt naar begge er tomme', () => {
		expect(afgraensSvar(alle, 'dag', '', '')).toHaveLength(3);
	});

	it('tager dag 0 med, saa baseline-dagen ikke falder ud', () => {
		const med0 = [svar({ dagNummer: 0 }), ...alle];
		expect(afgraensSvar(med0, 'dag', '0', '1')).toHaveLength(2);
	});

	// Tal-felterne i UI'et giver rigtige TAL tilbage, ikke tekst. Foer 19/8
	// 2026 kaldte vi .trim() direkte, og saa braendte hele siden sammen i det
	// oejeblik admin skrev et dag-nummer. Der skete bare ingenting.
	it('taaler at felterne giver tal i stedet for tekst', () => {
		const r = afgraensSvar(alle, 'dag', 1 as unknown as string, 40 as unknown as string);
		expect(r.map((s) => s.dagNummer)).toEqual([1, 40]);
	});

	it('taaler at et felt er tomt eller slet ikke sat', () => {
		expect(afgraensSvar(alle, 'dag', null, undefined)).toHaveLength(3);
		expect(afgraensSvar(alle, 'dato', null, undefined)).toHaveLength(3);
	});
});

describe('afgraensning paa dato', () => {
	const alle = [
		svar({ dagNummer: 1, gemtMs: new Date(2026, 6, 1, 8, 0).getTime() }),
		svar({ dagNummer: 2, gemtMs: new Date(2026, 6, 15, 8, 0).getTime() }),
		svar({ dagNummer: 3, gemtMs: new Date(2026, 7, 1, 8, 0).getTime() })
	];

	it('tager begge endepunkter med', () => {
		const r = afgraensSvar(alle, 'dato', '2026-07-01', '2026-07-15');
		expect(r.map((s) => s.dagNummer)).toEqual([1, 2]);
	});

	it('lader svar sent paa dagen vaere med paa til-datoen', () => {
		const sent = [svar({ gemtMs: new Date(2026, 6, 15, 23, 59).getTime() })];
		expect(afgraensSvar(sent, 'dato', '2026-07-15', '2026-07-15')).toHaveLength(1);
	});

	it('udelader svar uden tidsstempel, fordi de ikke kan placeres', () => {
		const uden = [svar({ gemtMs: null })];
		expect(afgraensSvar(uden, 'dato', '2026-07-01', '2026-08-01')).toHaveLength(0);
	});

	it('tager svar uden tidsstempel med naar man afgraenser paa dag', () => {
		const uden = [svar({ gemtMs: null, dagNummer: 5 })];
		expect(afgraensSvar(uden, 'dag', '1', '10')).toHaveLength(1);
	});
});

describe('gruppering pr dag', () => {
	const alle = [
		svar({ uid: 'b', navn: 'Birthe Lund', dagNummer: 2 }),
		svar({ uid: 'a', navn: 'Anna Dahl', dagNummer: 2 }),
		svar({ uid: 'a', navn: 'Anna Dahl', dagNummer: 1 })
	];

	it('sorterer dagene stigende', () => {
		expect(grupperPrDag(alle, START).map((g) => g.dagNummer)).toEqual([1, 2]);
	});

	it('sorterer klienterne alfabetisk inde i dagen', () => {
		const dag2 = grupperPrDag(alle, START).find((g) => g.dagNummer === 2);
		expect(dag2?.svar.map((s) => s.navn)).toEqual(['Anna Dahl', 'Birthe Lund']);
	});

	it('saetter holdets dato paa dagen', () => {
		const dag1 = grupperPrDag(alle, START).find((g) => g.dagNummer === 1);
		expect(dag1?.dato).toBe('2026-05-25');
	});

	it('finder spoergsmaalet selv om foerste svar mangler det', () => {
		const blandet = [
			svar({ dagNummer: 7, spoergsmaal: '' }),
			svar({ uid: 'b', dagNummer: 7, spoergsmaal: 'Hvad mærkede du?' })
		];
		expect(grupperPrDag(blandet, START)[0].spoergsmaal).toBe('Hvad mærkede du?');
	});
});

describe('gruppering pr klient', () => {
	const alle = [
		svar({ uid: 'a', navn: 'Anna Dahl', dagNummer: 3 }),
		svar({ uid: 'a', navn: 'Anna Dahl', dagNummer: 1 }),
		svar({ uid: 'b', navn: 'Birthe Lund', dagNummer: 1 })
	];

	it('samler hver klient for sig', () => {
		expect(grupperPrKlient(alle)).toHaveLength(2);
	});

	it('viser den flittigste klient foerst', () => {
		expect(grupperPrKlient(alle)[0].navn).toBe('Anna Dahl');
	});

	it('stiller klientens egne svar i dag-orden', () => {
		expect(grupperPrKlient(alle)[0].svar.map((s) => s.dagNummer)).toEqual([1, 3]);
	});
});

describe('CSV', () => {
	it('pakker felter med semikolon, citationstegn eller linjeskift ind', () => {
		expect(csvFelt('almindelig')).toBe('almindelig');
		expect(csvFelt('med;semikolon')).toBe('"med;semikolon"');
		expect(csvFelt('linje\nskift')).toBe('"linje\nskift"');
		expect(csvFelt('hun sagde "ja"')).toBe('"hun sagde ""ja"""');
	});

	it('starter med BOM saa Excel viser ae, oe og aa rigtigt', () => {
		expect(byggCsv([svar()], 'Kropsro', START).startsWith('﻿')).toBe(true);
	});

	it('har en overskriftslinje og en linje pr svar', () => {
		const csv = byggCsv([svar(), svar({ dagNummer: 2 })], 'Kropsro', START);
		expect(csv.split('\r\n')).toHaveLength(3);
	});

	it('bruger klientens egen gemt-dato, ikke holdets', () => {
		// Klient med pause: hendes dag 1 blev skrevet 1. juli, ikke 25. maj.
		const csv = byggCsv(
			[svar({ dagNummer: 1, gemtMs: new Date(2026, 6, 1, 8, 0).getTime() })],
			'Kropsro',
			START
		);
		expect(csv).toContain('2026-07-01');
		expect(csv).not.toContain('2026-05-25');
	});

	it('falder tilbage til holdets dato naar svaret mangler tidsstempel', () => {
		const csv = byggCsv([svar({ dagNummer: 1, gemtMs: null })], 'Kropsro', START);
		expect(csv).toContain('2026-05-25');
	});

	it('holder et svar med linjeskift paa samme raekke', () => {
		const csv = byggCsv([svar({ svar: 'Første linje\nAnden linje' })], 'Kropsro', START);
		// Overskrift + én indpakket raekke = ét linjeskift mellem raekker.
		expect(csv.split('\r\n')).toHaveLength(2);
	});
});

describe('filnavn', () => {
	it('bygger et navn med forloeb og dato', () => {
		expect(csvFilnavn('KropsRo 16. aug', new Date(2026, 7, 19))).toBe(
			'refleksioner-kropsro-16-aug-20260819.csv'
		);
	});

	it('oversaetter ae, oe og aa i stedet for at smide dem vaek', () => {
		expect(csvFilnavn('Forløb Æblegrød', new Date(2026, 0, 5))).toBe(
			'refleksioner-forloeb-aeblegroed-20260105.csv'
		);
	});

	it('klarer et navn helt uden brugbare tegn', () => {
		expect(csvFilnavn('!!!', new Date(2026, 0, 5))).toBe('refleksioner-forloeb-20260105.csv');
	});
});
