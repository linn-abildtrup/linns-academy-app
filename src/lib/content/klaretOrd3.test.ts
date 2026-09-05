import { describe, it, expect } from 'vitest';
import { klaretOrd3 } from './lektion3';

describe('klaretOrd3', () => {
	// Linns udgangspunkt: man ser ikke en lydfil.
	it('lyd hoeres', () => {
		expect(klaretOrd3('lyd')).toEqual({ knap: 'Markér som hørt', klaret: 'Hørt' });
	});

	it('en skreven lektion laeses', () => {
		expect(klaretOrd3('side')).toEqual({ knap: 'Markér som læst', klaret: 'Læst' });
	});

	it('video ses', () => {
		expect(klaretOrd3('video')).toEqual({ knap: 'Markér som set', klaret: 'Set' });
	});

	// En lektion der aabner i et nyt vindue markeres naar hun trykker Åbn.
	// Vi ved kun at hun aabnede den, saa "set" er det aerlige ord.
	it('et link ses', () => {
		expect(klaretOrd3('link')).toEqual({ knap: 'Markér som set', klaret: 'Set' });
	});
});
