import { describe, it, expect } from 'vitest';
import { sekunderFoerKlaret, SEKUNDER_LAESNING, ANDEL_FOER_KLARET } from './lektion3';

describe('sekunderFoerKlaret', () => {
	it('tager 80 procent af den angivne tid', () => {
		expect(sekunderFoerKlaret(10)).toBe(Math.round(10 * 60 * ANDEL_FOER_KLARET));
		expect(sekunderFoerKlaret(5, 'video')).toBe(Math.round(5 * 60 * ANDEL_FOER_KLARET));
	});

	// LINNS BESLUTNING 25. august. Maalt paa Kropsro: kun 6 af 43
	// guide-lektioner har en varighed sat, saa de 37 andre kunne ALDRIG
	// markere sig selv. Dagen foldede sig derfor aldrig sammen.
	it('giver en laesning uden varighed en fast graense', () => {
		expect(sekunderFoerKlaret(undefined, 'side')).toBe(SEKUNDER_LAESNING);
		expect(sekunderFoerKlaret(0, 'side')).toBe(SEKUNDER_LAESNING);
	});

	// Video og lyd faar ingenting uden varighed: dér ved vi ikke hvor
	// lang filmen er, og et gaet ville markere den mens hun stadig ser.
	it('markerer aldrig video eller lyd paa et gaet', () => {
		expect(sekunderFoerKlaret(undefined, 'video')).toBeNull();
		expect(sekunderFoerKlaret(undefined, 'lyd')).toBeNull();
	});

	// Et link aabner i et nyt vindue, saa uret staar stille imens.
	// Den markeres i stedet naar hun trykker Åbn, se lektions-siden.
	it('bruger ikke et ur paa et link', () => {
		expect(sekunderFoerKlaret(undefined, 'link')).toBeNull();
		expect(sekunderFoerKlaret(undefined)).toBeNull();
	});

	it('lader en angivet varighed vinde, ogsaa paa en laesning', () => {
		expect(sekunderFoerKlaret(2, 'side')).toBe(Math.round(2 * 60 * ANDEL_FOER_KLARET));
	});
});
