import { describe, it, expect } from 'vitest';
import { fliseTitel3 } from './lektionFlise3';

describe('fliseTitel3', () => {
	// De rigtige titler fra Kickstart August.
	it('fjerner dagnummeret fra Linns egne titler', () => {
		expect(fliseTitel3('Dag 5, Få øje på dine #wins')).toBe('Få øje på dine #wins');
		expect(fliseTitel3('Dag 11, Cravings')).toBe('Cravings');
		expect(fliseTitel3('Dag 14, Det du ikke kunne se i uge 1')).toBe(
			'Det du ikke kunne se i uge 1'
		);
	});

	it('taaler de andre skilletegn hun kunne finde paa', () => {
		expect(fliseTitel3('Dag 3: Protein')).toBe('Protein');
		expect(fliseTitel3('Dag 3 - Protein')).toBe('Protein');
		expect(fliseTitel3('Dag 3 – Protein')).toBe('Protein');
		expect(fliseTitel3('Dag 3. Protein')).toBe('Protein');
	});

	it('er ligeglad med store og smaa bogstaver og ekstra mellemrum', () => {
		expect(fliseTitel3('DAG 7,  Fiber')).toBe('Fiber');
		expect(fliseTitel3('dag 7 ,Fiber')).toBe('Fiber');
	});

	it('lader titler uden dagnummer vaere', () => {
		expect(fliseTitel3('Fibertilskud')).toBe('Fibertilskud');
		expect(fliseTitel3('Sådan får du appen på din hjemmeskærm')).toBe(
			'Sådan får du appen på din hjemmeskærm'
		);
	});

	// Ordet "dag" i en rigtig titel maa ikke aede noget.
	it('rammer ikke ord der bare begynder med dag', () => {
		expect(fliseTitel3('Dagens vaner')).toBe('Dagens vaner');
		expect(fliseTitel3('Dagbogen din ven')).toBe('Dagbogen din ven');
	});

	it('giver den fulde titel hvis der ikke bliver noget tilbage', () => {
		expect(fliseTitel3('Dag 5,')).toBe('Dag 5,');
		expect(fliseTitel3('Dag 12 -')).toBe('Dag 12 -');
	});

	it('taaler tom tekst', () => {
		expect(fliseTitel3('')).toBe('');
		expect(fliseTitel3('   ')).toBe('');
	});
});
