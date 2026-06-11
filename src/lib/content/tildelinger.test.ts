import { describe, it, expect } from 'vitest';
import { harProgramAdgang, tildelingerForKunde, type ProgramTildeling } from './tildelinger';

const tildelt: ProgramTildeling = {
	id: 't1',
	programId: 'prog-a',
	forlobId: 'kickstart_maj_2026',
	modtagerType: 'kunde',
	modtagerId: 'uid-maria',
	tildeltAt: 1716200000000,
	tildeltAf: 'admin-uid'
};

const tildeltViaForlob: ProgramTildeling = {
	id: 't2',
	programId: 'prog-b',
	forlobId: 'kickstart_maj_2026',
	modtagerType: 'forlob',
	modtagerId: 'kickstart_maj_2026',
	tildeltAt: 1716200000000,
	tildeltAf: 'admin-uid'
};

describe('harProgramAdgang', () => {
	it('giver adgang ved direkte kunde-tildeling', () => {
		expect(harProgramAdgang('uid-maria', 'prog-a', [], [tildelt])).toBe(true);
	});

	it('nægter adgang når program-id ikke matcher', () => {
		expect(harProgramAdgang('uid-maria', 'prog-x', [], [tildelt])).toBe(false);
	});

	it('nægter adgang når kunde-id ikke matcher', () => {
		expect(harProgramAdgang('uid-anne', 'prog-a', [], [tildelt])).toBe(false);
	});

	it('giver adgang via forløb når kunde er på forløbet', () => {
		expect(harProgramAdgang('uid-anne', 'prog-b', ['kickstart_maj_2026'], [tildeltViaForlob])).toBe(
			true
		);
	});

	it('nægter adgang via forløb når kunde IKKE er på forløbet', () => {
		expect(harProgramAdgang('uid-anne', 'prog-b', ['andet_forlob'], [tildeltViaForlob])).toBe(
			false
		);
	});

	it('giver adgang når enten direkte ELLER forløb matcher', () => {
		expect(
			harProgramAdgang('uid-maria', 'prog-a', ['kickstart_maj_2026'], [tildelt, tildeltViaForlob])
		).toBe(true);
	});

	it('tom liste = ingen adgang', () => {
		expect(harProgramAdgang('uid-maria', 'prog-a', [], [])).toBe(false);
	});
});

describe('tildelingerForKunde', () => {
	it('filtrerer både direkte- og forløbs-tildelinger', () => {
		const resultat = tildelingerForKunde(
			'uid-maria',
			['kickstart_maj_2026'],
			[tildelt, tildeltViaForlob]
		);
		expect(resultat).toHaveLength(2);
	});

	it('udelukker tildelinger til andre kunder', () => {
		const andenKunde: ProgramTildeling = {
			...tildelt,
			id: 't3',
			modtagerId: 'uid-anne'
		};
		const resultat = tildelingerForKunde('uid-maria', [], [tildelt, andenKunde]);
		expect(resultat).toHaveLength(1);
		expect(resultat[0].modtagerId).toBe('uid-maria');
	});
});
