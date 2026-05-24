import { describe, it, expect } from 'vitest';
import { filtrerVanerForUge, type AdminTildeltVane } from './admintildelteVaner';

function lavVane(id: string, label: string, ugeNummer?: number): AdminTildeltVane {
	return { id, label, oprettetAt: 0, oprettetAf: 'test', ...(ugeNummer !== undefined ? { ugeNummer } : {}) };
}

describe('filtrerVanerForUge', () => {
	it('returnerer kun vaner med matching ugeNummer', () => {
		const vaner = [
			lavVane('a', 'Uge 1 vane', 1),
			lavVane('b', 'Uge 2 vane', 2),
			lavVane('c', 'Uge 3 vane', 3)
		];
		expect(filtrerVanerForUge(vaner, 2)).toEqual([vaner[1]]);
	});

	it('inkluderer altid vaner uden ugeNummer (legacy / Kickstart-stil)', () => {
		const vaner = [
			lavVane('a', 'Altid aktiv'),
			lavVane('b', 'Uge 1', 1),
			lavVane('c', 'Uge 2', 2)
		];
		expect(filtrerVanerForUge(vaner, 1).map((v) => v.id)).toEqual(['a', 'b']);
	});

	it('returnerer kun altid-aktive hvis ingen matcher ugen', () => {
		const vaner = [lavVane('a', 'Altid aktiv'), lavVane('b', 'Uge 3', 3)];
		expect(filtrerVanerForUge(vaner, 7).map((v) => v.id)).toEqual(['a']);
	});

	it('returnerer tom liste hvis alle vaner har ugeNummer der ikke matcher', () => {
		const vaner = [lavVane('a', 'Uge 1', 1), lavVane('b', 'Uge 2', 2)];
		expect(filtrerVanerForUge(vaner, 5)).toEqual([]);
	});

	it('haandterer tom input-liste', () => {
		expect(filtrerVanerForUge([], 1)).toEqual([]);
	});
});
