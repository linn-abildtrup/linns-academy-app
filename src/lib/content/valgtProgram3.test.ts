import { describe, it, expect } from 'vitest';
import {
	klaretIProgramIDag3,
	sammeDag3,
	skalBekraefteSkift3,
	vaelgProgram3
} from './valgtProgram3';

const p = (id: string) => ({ program: { id } });
const a = p('a');
const b = p('b');
const c = p('c');

describe('vaelgProgram3', () => {
	it('det gemte valg vinder', () => {
		expect(vaelgProgram3([a, b], 'b', a)).toBe(b);
	});

	// Hele pointen med at gemme valget: hun skal kunne skifte til noget
	// hun ikke har traenet i endnu.
	it('det gemte valg vinder ogsaa naar hun ikke har traenet i det', () => {
		expect(vaelgProgram3([a, b], 'b', null)).toBe(b);
	});

	// Bliver et program taget fra hende, maa appen ikke blive ved med at
	// pege paa noget hun ikke har.
	it('et gemt valg hun ikke har laengere springes over', () => {
		expect(vaelgProgram3([a, b], 'z', a)).toBe(a);
	});

	it('uden et valg bruges den hun er i gang med', () => {
		expect(vaelgProgram3([a, b], null, b)).toBe(b);
	});

	// De kunder der traenede foer valget fandtes skal ikke maerke noget.
	it('uden valg og uden noget i gang bruges det eneste hun har', () => {
		expect(vaelgProgram3([a], null, null)).toBe(a);
	});

	it('flere programmer og intet valg giver ingenting', () => {
		expect(vaelgProgram3([a, b, c], null, null)).toBeNull();
	});

	it('ingen programmer giver ingenting', () => {
		expect(vaelgProgram3([], 'a', null)).toBeNull();
	});
});

describe('skalBekraefteSkift3', () => {
	it('bekraeftes naar hun skifter vaek fra noget', () => {
		expect(skalBekraefteSkift3('a', 'b')).toBe(true);
	});

	it('bekraeftes ikke naar hun trykker paa det hun allerede foelger', () => {
		expect(skalBekraefteSkift3('a', 'a')).toBe(false);
	});

	// Har hun ikke valgt endnu, er der ingenting at skifte vaek fra.
	it('bekraeftes ikke naar hun ikke har valgt endnu', () => {
		expect(skalBekraefteSkift3(null, 'b')).toBe(false);
	});
});

describe('klaretIProgramIDag3', () => {
	const nu = new Date(2026, 7, 21, 14, 0).getTime();

	it('sand naar hun traenede i dag', () => {
		expect(klaretIProgramIDag3(new Date(2026, 7, 21, 7, 30).getTime(), nu)).toBe(true);
	});

	it('falsk naar hun traenede i gaar', () => {
		expect(klaretIProgramIDag3(new Date(2026, 7, 20, 23, 59).getTime(), nu)).toBe(false);
	});

	// Har hun aldrig traenet i programmet, er senestAt nul.
	it('falsk naar hun aldrig har traenet i programmet', () => {
		expect(klaretIProgramIDag3(0, nu)).toBe(false);
	});
});

describe('sammeDag3', () => {
	it('midnat og lige foer midnat er to forskellige dage', () => {
		const sent = new Date(2026, 7, 20, 23, 59, 59).getTime();
		const tidligt = new Date(2026, 7, 21, 0, 0, 1).getTime();
		expect(sammeDag3(sent, tidligt)).toBe(false);
	});

	it('samme dag paa tvaers af tidspunkter', () => {
		expect(
			sammeDag3(new Date(2026, 7, 21, 0, 0).getTime(), new Date(2026, 7, 21, 23, 59).getTime())
		).toBe(true);
	});
});
