import { describe, it, expect, beforeEach } from 'vitest';
import { husk, husket, glemAlt } from './sidehukommelse3';

describe('sidehukommelse3', () => {
	beforeEach(() => glemAlt());

	it('giver undefined foer der er gemt noget', () => {
		expect(husket('u1', 'traening')).toBeUndefined();
	});

	it('husker det der er gemt', () => {
		husk('u1', 'traening', { antal: 4 });
		expect(husket<{ antal: number }>('u1', 'traening')).toEqual({ antal: 4 });
	});

	it('holder faner adskilt', () => {
		husk('u1', 'traening', 'a');
		husk('u1', 'udvikling', 'b');
		expect(husket('u1', 'traening')).toBe('a');
		expect(husket('u1', 'udvikling')).toBe('b');
	});

	// DEN VIGTIGSTE. En kunde maa aldrig se et glimt af en andens tal.
	it('rydder alt naar brugeren skifter', () => {
		husk('u1', 'traening', 'hemmeligt');
		expect(husket('u2', 'traening')).toBeUndefined();
		// Og den gamle er vaek, ogsaa hvis han kommer tilbage.
		expect(husket('u1', 'traening')).toBeUndefined();
	});

	it('rydder ogsaa naar den anden bruger GEMMER foerst', () => {
		husk('u1', 'traening', 'hemmeligt');
		husk('u2', 'udvikling', 'andet');
		expect(husket('u2', 'traening')).toBeUndefined();
	});

	it('glemAlt tommer hukommelsen', () => {
		husk('u1', 'traening', 'a');
		glemAlt();
		expect(husket('u1', 'traening')).toBeUndefined();
	});

	it('gemmer ikke paa et tomt uid', () => {
		husk('', 'traening', 'a');
		expect(husket('', 'traening')).toBeUndefined();
	});
});
