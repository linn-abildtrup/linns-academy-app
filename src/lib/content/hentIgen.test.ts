import { describe, it, expect } from 'vitest';
import { medGentagelse, ventetidFor, ANTAL_FORSOEG } from './hentIgen';

/** Sover ikke rigtigt, men skriver ned hvor laenge der blev ventet. */
function ur() {
	const ventet: number[] = [];
	return { ventet, sov: async (ms: number) => void ventet.push(ms) };
}

describe('ventetidFor', () => {
	it('venter ikke foer foerste forsoeg', () => {
		expect(ventetidFor(1)).toBe(0);
	});

	it('venter laengere for hvert forsoeg', () => {
		expect(ventetidFor(2)).toBe(400);
		expect(ventetidFor(3)).toBe(1200);
	});

	it('giver nul ud over sidste forsoeg', () => {
		expect(ventetidFor(4)).toBe(0);
	});
});

describe('medGentagelse', () => {
	it('koerer kun én gang naar det lykkes', async () => {
		const { ventet, sov } = ur();
		let kald = 0;
		const svar = await medGentagelse(async () => {
			kald++;
			return 'ok';
		}, sov);
		expect(svar).toBe('ok');
		expect(kald).toBe(1);
		expect(ventet).toEqual([]);
	});

	it('proever igen og lykkes anden gang', async () => {
		const { ventet, sov } = ur();
		let kald = 0;
		const svar = await medGentagelse(async () => {
			kald++;
			if (kald === 1) throw new Error('netvaerk');
			return 'ok';
		}, sov);
		expect(svar).toBe('ok');
		expect(kald).toBe(2);
		expect(ventet).toEqual([400]);
	});

	it('giver op efter tre forsoeg og kaster den sidste fejl', async () => {
		const { ventet, sov } = ur();
		let kald = 0;
		await expect(
			medGentagelse(async () => {
				kald++;
				throw new Error('fejl ' + kald);
			}, sov)
		).rejects.toThrow('fejl 3');
		expect(kald).toBe(ANTAL_FORSOEG);
		expect(ventet).toEqual([400, 1200]);
	});

	it('fortaeller opgaven hvilket forsoeg det er', async () => {
		const { sov } = ur();
		const set: number[] = [];
		await medGentagelse(async (n) => {
			set.push(n);
			if (n < 3) throw new Error('nej');
			return 'ok';
		}, sov);
		expect(set).toEqual([1, 2, 3]);
	});
});
