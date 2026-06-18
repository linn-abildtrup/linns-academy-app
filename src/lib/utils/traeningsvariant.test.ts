import { describe, it, expect } from 'vitest';
import { aktivtForlobId, vaelgProgramForVariant } from './traeningsvariant';
import type { UserDoc } from '$lib/types';

function lavUserDoc(overrides: Partial<UserDoc>): UserDoc {
	return {
		firstName: 'Test',
		email: 'test@example.com',
		accessLevel: 'basis',
		accessSource: 'forløb',
		createdAt: 0,
		...overrides
	} as UserDoc;
}

describe('aktivtForlobId', () => {
	it('bruger aktivtTraeningsprogram.forlobId når det er sat', () => {
		const ud = lavUserDoc({
			aktivtTraeningsprogram: {
				kilde: 'tildelt',
				programId: 'mikrotraening_kettlebell',
				forlobId: 'kickstart_juni_2026'
			},
			forlobIds: ['kickstart_maj_2026', 'kickstart_juni_2026']
		});
		expect(aktivtForlobId(ud)).toBe('kickstart_juni_2026');
	});

	it('falder tilbage til seneste forløb i forlobIds når aktivtTraeningsprogram mangler', () => {
		const ud = lavUserDoc({
			forlobIds: ['kickstart_maj_2026', 'kropsro_maj_2026']
		});
		expect(aktivtForlobId(ud)).toBe('kropsro_maj_2026');
	});

	it('returnerer null når kunden ikke har forløb', () => {
		expect(aktivtForlobId(lavUserDoc({}))).toBeNull();
		expect(aktivtForlobId(lavUserDoc({ forlobIds: [] }))).toBeNull();
	});

	it('håndterer null/undefined userDoc', () => {
		expect(aktivtForlobId(null)).toBeNull();
		expect(aktivtForlobId(undefined)).toBeNull();
	});
});

describe('vaelgProgramForVariant', () => {
	const medKb = { id: 'p_kb', udstyr: ['kettlebell', 'elastik'] };
	const udenKb = { id: 'p_ingen', udstyr: ['ingen'] };

	it('kettlebell-variant vælger program med kettlebell', () => {
		expect(vaelgProgramForVariant([udenKb, medKb], 'kettlebell')?.id).toBe('p_kb');
	});

	it('no_kettlebell-variant vælger program uden kettlebell', () => {
		expect(vaelgProgramForVariant([medKb, udenKb], 'no_kettlebell')?.id).toBe('p_ingen');
	});

	it('returnerer null når der ingen programmer er (ingen træning)', () => {
		expect(vaelgProgramForVariant([], 'kettlebell')).toBeNull();
	});

	it('falder tilbage til første program hvis ingen matcher præcist', () => {
		// kun kettlebell-program findes, men kunden valgte uden kettlebell
		expect(vaelgProgramForVariant([medKb], 'no_kettlebell')?.id).toBe('p_kb');
	});
});
