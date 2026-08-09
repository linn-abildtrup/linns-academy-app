import { describe, it, expect } from 'vitest';
import {
	produktHarNulDage,
	nulDatoer,
	passeredeNulDage,
	dagNummerMedNulDage,
	forlobSlutMedNulDage,
	erNulDag
} from './nulDage3';
import { nulDageDatoer } from './forlob';

const MS_PER_DAG = 86_400_000;

function ms(aar: number, maaned: number, dag: number): number {
	return new Date(aar, maaned - 1, dag, 12, 0, 0).getTime();
}

describe('produktHarNulDage', () => {
	it('kun Kropsro har nul-dage', () => {
		expect(produktHarNulDage('premiumforløb')).toBe(true);
	});

	// Linns beslutning 9. august 2026. En Kickstart-kunde maa aldrig faa
	// sit dagnummer forskudt.
	it('Kickstart har ikke nul-dage', () => {
		expect(produktHarNulDage('kickstart')).toBe(false);
	});

	it('taaler tomt og ukendt produkt', () => {
		expect(produktHarNulDage(null)).toBe(false);
		expect(produktHarNulDage(undefined)).toBe(false);
		expect(produktHarNulDage('noget-andet')).toBe(false);
	});
});

describe('nulDatoer', () => {
	it('folder et interval ud til enkeltdage, begge ender med', () => {
		expect(nulDatoer([{ fra: '2026-06-01', til: '2026-06-03' }])).toEqual([
			'2026-06-01',
			'2026-06-02',
			'2026-06-03'
		]);
	});

	it('en enkelt dag giver én dato', () => {
		expect(nulDatoer([{ fra: '2026-06-01', til: '2026-06-01' }])).toEqual(['2026-06-01']);
	});

	it('taeller overlappende intervaller kun én gang', () => {
		const ud = nulDatoer([
			{ fra: '2026-06-01', til: '2026-06-03' },
			{ fra: '2026-06-02', til: '2026-06-04' }
		]);
		expect(ud).toEqual(['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04']);
	});

	it('giver ingen dage naar til ligger foer fra', () => {
		expect(nulDatoer([{ fra: '2026-06-05', til: '2026-06-01' }])).toEqual([]);
	});

	it('springer ubrugelige datoer over i stedet for at gaa i stykker', () => {
		expect(nulDatoer([{ fra: 'noget vaas', til: '2026-06-01' }])).toEqual([]);
	});

	it('taaler tom liste', () => {
		expect(nulDatoer([])).toEqual([]);
	});

	// Det vigtigste af dem alle: de to apps skal aldrig kunne vise hvert
	// sit dagnummer for den samme kunde.
	it('giver praecis det samme som den gamle app', () => {
		const sager = [
			[{ fra: '2026-06-01', til: '2026-06-03' }],
			[{ fra: '2026-06-01', til: '2026-06-01' }],
			[
				{ fra: '2026-06-01', til: '2026-06-03' },
				{ fra: '2026-06-02', til: '2026-06-09' }
			],
			[{ fra: '2026-05-28', til: '2026-06-04' }],
			[]
		];
		for (const s of sager) {
			expect(nulDatoer(s)).toEqual(nulDageDatoer(s));
		}
	});
});

describe('passeredeNulDage', () => {
	const datoer = ['2026-06-01', '2026-06-02', '2026-06-10'];

	it('taeller kun dem der er naaet', () => {
		expect(passeredeNulDage(datoer, ms(2026, 6, 5))).toBe(2);
	});

	it('taeller dagen i dag med', () => {
		expect(passeredeNulDage(datoer, ms(2026, 6, 2))).toBe(2);
	});

	// En ferie i naeste uge maa ikke flytte dagens dagnummer.
	it('taeller ikke fremtidige pause-dage', () => {
		expect(passeredeNulDage(datoer, ms(2026, 5, 31))).toBe(0);
	});

	it('taeller dem alle naar de er passeret', () => {
		expect(passeredeNulDage(datoer, ms(2026, 7, 1))).toBe(3);
	});
});

describe('dagNummerMedNulDage', () => {
	it('trækker de passerede pause-dage fra', () => {
		const datoer = nulDatoer([{ fra: '2026-06-01', til: '2026-06-21' }]);
		expect(dagNummerMedNulDage(63, 84, datoer, ms(2026, 7, 1))).toBe(42);
	});

	it('lader dagnummeret staa naar der ingen pause er', () => {
		expect(dagNummerMedNulDage(30, 84, [], ms(2026, 7, 1))).toBe(30);
	});

	it('gaar aldrig under nul', () => {
		const datoer = nulDatoer([{ fra: '2026-06-01', til: '2026-06-21' }]);
		expect(dagNummerMedNulDage(3, 84, datoer, ms(2026, 7, 1))).toBe(0);
	});

	it('gaar aldrig over forloebets laengde', () => {
		expect(dagNummerMedNulDage(200, 84, [], ms(2026, 7, 1))).toBe(84);
	});

	it('staar stille mens pausen staar paa', () => {
		const datoer = nulDatoer([{ fra: '2026-06-10', til: '2026-06-12' }]);
		// Raa dagnummer vokser med kalenderen, men trækket vokser lige saa
		// hurtigt, saa hun bliver staaende paa samme dag.
		expect(dagNummerMedNulDage(10, 84, datoer, ms(2026, 6, 10))).toBe(9);
		expect(dagNummerMedNulDage(11, 84, datoer, ms(2026, 6, 11))).toBe(9);
		expect(dagNummerMedNulDage(12, 84, datoer, ms(2026, 6, 12))).toBe(9);
		// Dagen efter pausen gaar hun videre.
		expect(dagNummerMedNulDage(13, 84, datoer, ms(2026, 6, 13))).toBe(10);
	});
});

describe('forlobSlutMedNulDage', () => {
	const start = ms(2026, 5, 1);

	it('forlaenger med én dag pr pause-dag', () => {
		const uden = forlobSlutMedNulDage(start, 84, []);
		const med = forlobSlutMedNulDage(start, 84, nulDatoer([{ fra: '2026-06-01', til: '2026-06-21' }]));
		expect(Math.round((med - uden) / MS_PER_DAG)).toBe(21);
	});

	// Kunden skal kunne se hvornaar hun er faerdig, ogsaa naar ferien
	// ligger frem i tiden. Ellers rykker slutdatoen sig under hende.
	it('forlaenger ogsaa for pause-dage der ligger i fremtiden', () => {
		const med = forlobSlutMedNulDage(start, 84, ['2027-01-01', '2027-01-02']);
		const uden = forlobSlutMedNulDage(start, 84, []);
		expect(Math.round((med - uden) / MS_PER_DAG)).toBe(2);
	});

	it('giver nul naar forloebet er ubrugeligt', () => {
		expect(forlobSlutMedNulDage(0, 84, [])).toBe(0);
		expect(forlobSlutMedNulDage(start, 0, [])).toBe(0);
	});
});

describe('erNulDag', () => {
	const sat = new Set(['2026-06-01', '2026-06-02']);

	it('kender en pause-dag', () => {
		expect(erNulDag(sat, '2026-06-01')).toBe(true);
	});

	it('siger nej til en almindelig dag', () => {
		expect(erNulDag(sat, '2026-06-03')).toBe(false);
	});
});
