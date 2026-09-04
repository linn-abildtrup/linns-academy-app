import { describe, it, expect } from 'vitest';
import { tilChatTraade3 } from './beskedside3';

const DAG = 86_400_000;
const NU = new Date('2026-09-04T12:00:00').getTime();

const t = (id: string, sendtMs: number) => ({ id, sendtMs });

describe('tilChatTraade3', () => {
	// Traadene kommer nyeste foerst fra firestore-laget. En samtale
	// laeses den anden vej.
	it('vender raekkefoelgen om, saa aeldst staar oeverst', () => {
		const ud = tilChatTraade3([t('ny', NU), t('gammel', NU - 3 * DAG)], NU);
		expect(ud.map((x) => x.traad.id)).toEqual(['gammel', 'ny']);
	});

	it('saetter et dag-maerke paa den foerste', () => {
		const ud = tilChatTraade3([t('a', NU)], NU);
		expect(ud[0].dagLabel).toBe('I dag');
	});

	it('gentager ikke maerket inden for samme dag', () => {
		const ud = tilChatTraade3([t('a', NU - 3600_000), t('b', NU)], NU);
		expect(ud[0].dagLabel).toBe('I dag');
		expect(ud[1].dagLabel).toBeNull();
	});

	it('saetter et nyt maerke naar dagen skifter', () => {
		const ud = tilChatTraade3([t('a', NU - DAG), t('b', NU)], NU);
		expect(ud[0].dagLabel).toBe('I går');
		expect(ud[1].dagLabel).toBe('I dag');
	});

	it('taaler en tom liste', () => {
		expect(tilChatTraade3([], NU)).toEqual([]);
	});

	// Ellers ville hendes egne spoergsmaal hoppe rundt i samtalen hver
	// gang Linn svarede paa et gammelt et.
	it('sorterer paa hvornaar traaden begyndte, ikke paa svaret', () => {
		const ud = tilChatTraade3(
			[
				{ id: 'gammel-spm-nyt-svar', sendtMs: NU - 5 * DAG, besvaretMs: NU },
				{ id: 'nyt-spm', sendtMs: NU - DAG }
			],
			NU
		);
		expect(ud.map((x) => x.traad.id)).toEqual(['gammel-spm-nyt-svar', 'nyt-spm']);
	});
});
