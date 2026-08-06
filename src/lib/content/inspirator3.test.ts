import { describe, it, expect } from 'vitest';
import { vurderInspirator, type Grundlag } from './inspirator3';

const DAG = 86400000;
const NU = new Date(2026, 7, 6, 9, 0, 0, 0).getTime();

const maaling = (dageSiden: number, vaerdi: number) => ({ ms: NU - dageSiden * DAG, vaerdi });

const grundlag = (aendringer: Partial<Grundlag> = {}): Grundlag => ({
	dageSidenAktiv: 0,
	maalinger: [maaling(60, 5), maaling(30, 6), maaling(2, 7)],
	smaaSkridt: ['Drik et glas vand før morgenmad'],
	forlobNavn: null,
	dagNummer: null,
	harGjortNogetIDag: false,
	afvistDato: null,
	iDag: '2026-08-06',
	...aendringer
});

describe('vurderInspirator', () => {
	it('siger ingenting naar hun var her i gaar', () => {
		expect(vurderInspirator(grundlag({ dageSidenAktiv: 1 }))).toBeNull();
	});

	it('siger ingenting naar hun allerede har gjort noget i dag', () => {
		// Hun er jo i gang. Saa skal vi ikke puffe til hende.
		expect(vurderInspirator(grundlag({ dageSidenAktiv: 30, harGjortNogetIDag: true }))).toBeNull();
	});

	it('tier resten af dagen naar hun har sagt ikke nu', () => {
		expect(
			vurderInspirator(grundlag({ dageSidenAktiv: 10, afvistDato: '2026-08-06' }))
		).toBeNull();
	});

	it('melder sig igen dagen efter et ikke nu', () => {
		const f = vurderInspirator(grundlag({ dageSidenAktiv: 10, afvistDato: '2026-08-05' }));
		expect(f?.situation).toBe('vaek-laenge');
	});

	it('kender de tre trin af fravaer', () => {
		expect(vurderInspirator(grundlag({ dageSidenAktiv: 3 }))?.situation).toBe('vaek-kort');
		expect(vurderInspirator(grundlag({ dageSidenAktiv: 6 }))?.situation).toBe('vaek-kort');
		expect(vurderInspirator(grundlag({ dageSidenAktiv: 7 }))?.situation).toBe('vaek-laenge');
		expect(vurderInspirator(grundlag({ dageSidenAktiv: 20 }))?.situation).toBe('vaek-laenge');
		expect(vurderInspirator(grundlag({ dageSidenAktiv: 21 }))?.situation).toBe('vaek-meget');
	});

	it('fanger et fald i overskud hos en der er aktiv', () => {
		const f = vurderInspirator(
			grundlag({
				dageSidenAktiv: 0,
				maalinger: [maaling(60, 7.2), maaling(30, 6.5), maaling(2, 5.8)]
			})
		);
		expect(f?.situation).toBe('overskud-falder');
		expect(f?.fald).toBe(1.4);
	});

	it('kraever tre maalinger nedad, ikke to', () => {
		const f = vurderInspirator(
			grundlag({ maalinger: [maaling(60, 6), maaling(30, 7), maaling(2, 6.5)] })
		);
		expect(f).toBeNull();
	});

	it('lader fravaer vinde over fald, naar hun har vaeret vaek', () => {
		// Er hun vaek, ved vi ikke om faldet stadig gaelder. Saa handler
		// kortet om at komme tilbage, ikke om tallet.
		const f = vurderInspirator(
			grundlag({
				dageSidenAktiv: 12,
				maalinger: [maaling(60, 7.2), maaling(40, 6.5), maaling(20, 5.8)]
			})
		);
		expect(f?.situation).toBe('vaek-laenge');
	});

	it('giver AI en hendes egne smaa skridt med', () => {
		const f = vurderInspirator(
			grundlag({ dageSidenAktiv: 9, smaaSkridt: ['10 minutters gåtur', 'Protein til hvert måltid'] })
		);
		expect(f?.smaaSkridt).toEqual(['10 minutters gåtur', 'Protein til hvert måltid']);
	});

	it('klarer en kunde der aldrig har maalt', () => {
		const f = vurderInspirator(grundlag({ dageSidenAktiv: 8, maalinger: [] }));
		expect(f?.situation).toBe('vaek-laenge');
		expect(f?.overskudNu).toBeNull();
		expect(f?.overskudStart).toBeNull();
	});

	it('sender forloebets navn og dagnummer med', () => {
		const f = vurderInspirator(
			grundlag({ dageSidenAktiv: 5, forlobNavn: 'Kropsro', dagNummer: 40 })
		);
		expect(f?.forlobNavn).toBe('Kropsro');
		expect(f?.dagNummer).toBe(40);
	});
});
