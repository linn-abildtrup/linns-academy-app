import { describe, it, expect } from 'vitest';
import {
	startPortioner,
	ingrediensMaengde,
	makroForPortioner,
	gemEtiket
} from './opskriftPortion3';

describe('startPortioner', () => {
	it('aabner paa opskriftens eget tal', () => {
		expect(startPortioner(1)).toBe(1);
		expect(startPortioner(4)).toBe(4);
		expect(startPortioner(12)).toBe(12);
	});

	// Et manglende eller meningsloest tal maa aldrig give 0 portioner, for saa
	// ville hele arket vise nul af alting.
	it('falder tilbage til 1 naar tallet mangler eller er meningsloest', () => {
		expect(startPortioner(undefined)).toBe(1);
		expect(startPortioner(0)).toBe(1);
		expect(startPortioner(-3)).toBe(1);
	});
});

describe('ingrediensMaengde', () => {
	// Retten er skrevet til 4. Ved 4 portioner staar der praecis det der er
	// tastet ind, saa listen kan laeses direkte som opskrift.
	it('viser listen som den er tastet naar portioner er lig defaultPortioner', () => {
		expect(ingrediensMaengde(600, 4, 4)).toBe(600);
	});

	// Selve fejlen der blev fundet 12. august: 3.0 viste 600 g ved 1 portion.
	it('deler ned til én portion paa en ret der er skrevet til fire', () => {
		expect(ingrediensMaengde(600, 4, 1)).toBe(150);
	});

	it('halverer ved en halv portion', () => {
		expect(ingrediensMaengde(600, 4, 2)).toBe(300);
		expect(ingrediensMaengde(200, 1, 0.5)).toBe(100);
	});

	// Den anden halvdel af fejlen: 4 portioner af en fire-portioners ret blev
	// til 2.400 g, altsaa fire hele retter.
	it('ganger IKKE op til fire hele retter', () => {
		expect(ingrediensMaengde(600, 4, 4)).not.toBe(2400);
	});

	it('opfoerer sig som ren gange naar retten er til én portion', () => {
		expect(ingrediensMaengde(70, 1, 1)).toBe(70);
		expect(ingrediensMaengde(70, 1, 2)).toBe(140);
	});

	it('taaler at defaultPortioner mangler', () => {
		expect(ingrediensMaengde(100, undefined, 2)).toBe(200);
	});
});

describe('makroForPortioner', () => {
	// Konvention 1: tallet er allerede pr portion. defaultPortioner maa
	// ALDRIG indgaa her. Det er praecis dét den gamle app goer forkert.
	it('ganger med antal portioner og intet andet', () => {
		expect(makroForPortioner(48, 1)).toBe(48);
		expect(makroForPortioner(48, 4)).toBe(192);
		expect(makroForPortioner(48, 0.5)).toBe(24);
	});

	it('deler ALDRIG med noget, uanset hvor mange portioner retten er til', () => {
		// Den gamle app ville give 12 her. Det er fejlen.
		expect(makroForPortioner(48, 1)).not.toBe(12);
	});

	it('runder til én decimal', () => {
		expect(makroForPortioner(7.77, 1)).toBe(7.8);
		expect(makroForPortioner(5, 1.5)).toBe(7.5);
	});

	// Et manglende tal skal blive ved med at mangle. Bliver det til 0, ser det
	// ud som om retten ikke indeholder protein.
	it('lader et manglende tal blive ved med at mangle', () => {
		expect(makroForPortioner(null, 4)).toBeNull();
	});
});

describe('gemEtiket', () => {
	it('naevner ikke antallet ved én portion', () => {
		expect(gemEtiket('Aftensmad', 1)).toBe('Læg i aftensmad');
	});

	// Aabner arket paa 4, skal hun kunne se hvad der bliver lagt i uden at
	// kigge op paa taelleren.
	it('naevner antallet naar det ikke er 1', () => {
		expect(gemEtiket('Aftensmad', 4)).toBe('Læg 4 portioner i aftensmad');
		expect(gemEtiket('Morgenmad', 0.5)).toBe('Læg 0,5 portioner i morgenmad');
	});
});
