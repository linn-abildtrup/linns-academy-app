import { describe, it, expect } from 'vitest';
import {
	MAKS_NOTE_LAENGDE,
	noteDocId,
	validerNote
} from './lektionNoter';

describe('noteDocId', () => {
	it('kombinerer forlobId og lektionId med dobbelt-underscore', () => {
		expect(noteDocId('kickstart_maj_2026', 'lektion-123')).toBe(
			'kickstart_maj_2026__lektion-123'
		);
	});
});

describe('validerNote', () => {
	it('godkender tom note', () => {
		expect(validerNote('')).toBeNull();
	});

	it('godkender almindelig tekst', () => {
		expect(validerNote('Det her var en fed lektion.')).toBeNull();
	});

	it('godkender note præcis på grænsen', () => {
		expect(validerNote('a'.repeat(MAKS_NOTE_LAENGDE))).toBeNull();
	});

	it('afviser note over grænsen', () => {
		expect(validerNote('a'.repeat(MAKS_NOTE_LAENGDE + 1))).toMatch(/4000 tegn/);
	});
});
