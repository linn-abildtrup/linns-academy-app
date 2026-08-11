import { describe, it, expect } from 'vitest';
import {
	maaAabnePaaKopi,
	tidsgraense,
	HURTIG_START_MS,
	HURTIG_START_FLAG,
	HURTIG_START_FOR_ALLE
} from './hurtigStart';
import type { UserDoc } from '$lib/types';

const DAG = 86_400_000;

/** En kunde MED flaget, altsaa en af testerne under udrulningen. */
function kunde(delvis: Partial<UserDoc> = {}): UserDoc {
	return {
		accessLevel: 'basis',
		accessSource: 'abonnement',
		activeSubscription: true,
		testerFeatures: [HURTIG_START_FLAG],
		...delvis
	} as UserDoc;
}

/** En almindelig kunde i drift, altsaa uden flaget. */
function udenFlag(delvis: Partial<UserDoc> = {}): UserDoc {
	return kunde({ testerFeatures: [], ...delvis });
}

describe('maaAabnePaaKopi', () => {
	it('lukker den almindelige abonnent ind paa kopien', () => {
		expect(maaAabnePaaKopi(kunde(), false)).toBe(true);
	});

	it('lukker forloebskunden ind paa kopien', () => {
		const k = kunde({ accessLevel: 'premium', accessSource: 'forløb', activeSubscription: false });
		expect(maaAabnePaaKopi(k, false)).toBe(true);
	});

	// Den vigtigste af dem alle. Er der ingen kopi, er der intet at aabne paa,
	// og saa skal opstarten opfoere sig praecis som foer.
	it('aabner ikke naar der ingen kopi er', () => {
		expect(maaAabnePaaKopi(null, false)).toBe(false);
		expect(maaAabnePaaKopi(undefined, false)).toBe(false);
	});

	// Den anden vigtige. En kopi der ville vise "ingen adgang" bruges ikke.
	// Vi venter hellere paa serveren end at risikere at en betalende kunde
	// faar den skaerm at se, bare fordi telefonen laa med en gammel kopi.
	it('aabner ikke paa en kopi der ville vise ingen adgang', () => {
		const udloebet = kunde({
			accessLevel: 'none',
			accessSource: 'forløb',
			activeSubscription: false
		});
		expect(maaAabnePaaKopi(udloebet, false)).toBe(false);
	});

	it('aabner ikke paa en kopi hvor adgangen er udloebet via expiresAt', () => {
		const udloebet = kunde({
			accessLevel: 'basis',
			accessSource: 'forløb',
			activeSubscription: false,
			expiresAt: Date.now() - 5 * DAG
		});
		expect(maaAabnePaaKopi(udloebet, false)).toBe(false);
	});

	it('aabner paa en kopi hvor kunden stadig er i sin bonus-periode', () => {
		const bonus = kunde({
			accessLevel: 'none',
			accessSource: 'forløb',
			activeSubscription: false,
			bonusPeriodEndsAt: Date.now() + 30 * DAG
		});
		expect(maaAabnePaaKopi(bonus, false)).toBe(true);
	});

	// Admin gaar altid igennem, praecis som i selve skallen. Ellers kunne en
	// forkert dato paa Linns egen konto bremse hendes opstart.
	it('lukker admin ind selv paa en kopi uden adgang', () => {
		const udloebet = kunde({
			accessLevel: 'none',
			accessSource: 'forløb',
			activeSubscription: false
		});
		expect(maaAabnePaaKopi(udloebet, true)).toBe(true);
	});

	// Admin uden kopi har stadig ingenting at aabne paa.
	it('lukker ikke admin ind uden en kopi', () => {
		expect(maaAabnePaaKopi(null, true)).toBe(false);
	});
});

// Udrulningen. Det her er testen der beskytter de cirka 760 kunder i drift
// mens vi ser den hurtige opstart an. De skal koere videre paa praecis den
// opstart de koerer paa i dag.
describe('udrulning bag flag', () => {
	it('giver IKKE en almindelig kunde uden flaget den hurtige opstart', () => {
		expect(maaAabnePaaKopi(udenFlag(), false)).toBe(false);
	});

	it('giver heller ikke forloebskunden uden flaget den', () => {
		const k = udenFlag({
			accessLevel: 'premium',
			accessSource: 'forløb',
			activeSubscription: false
		});
		expect(maaAabnePaaKopi(k, false)).toBe(false);
	});

	it('giver kunden med flaget den', () => {
		expect(maaAabnePaaKopi(kunde(), false)).toBe(true);
	});

	it('giver admin den, ogsaa uden flaget', () => {
		expect(maaAabnePaaKopi(udenFlag(), true)).toBe(true);
	});

	// Et manglende testerFeatures-felt er det normale for langt de fleste
	// dokumenter, og det skal opfoere sig som "ingen flag".
	it('behandler et manglende testerFeatures-felt som ingen adgang', () => {
		const k = kunde({ testerFeatures: undefined });
		expect(maaAabnePaaKopi(k, false)).toBe(false);
	});

	// Naar kontakten en dag saettes til true, skal den almindelige kunde med.
	// Vi kan ikke aendre konstanten i en test, saa vi laeser den i stedet og
	// bekraefter at den stadig staar paa udrulning. Faelder testen, er
	// kontakten blevet vippet, og saa er det et bevidst valg der skal ses.
	it('staar stadig paa udrulning og ikke paa alle', () => {
		expect(HURTIG_START_FOR_ALLE).toBe(false);
	});
});

describe('tidsgraense', () => {
	it('falder til ro og melder tid', async () => {
		await expect(tidsgraense(1)).resolves.toBe('tid');
	});

	// Sikkerhedsnet. Bliver tallet en dag sat til noget urimeligt, faelder
	// testen det, foer kunderne goer.
	it('holder sig paa et tal der er hurtigere end den ventetid vi retter', () => {
		expect(HURTIG_START_MS).toBeGreaterThanOrEqual(1000);
		expect(HURTIG_START_MS).toBeLessThanOrEqual(5000);
	});
});
