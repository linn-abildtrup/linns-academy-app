// Tildelinger — admin tildeler træningsprogrammer og custom-builder-adgang
// til kunder. To-vejs tildeling: enten direkte til en kunde (uid) eller
// til hele et forløb (forlobId) — alle deltagere arver tildelingen.
//
// Datamodel er forberedelse til Linns Academy 2.0 (handover v27). I dag er
// programmer hardcoded pr forløb; den her tabel åbner for at samme program
// kan deles ud på tværs.

// Modtager-typer:
//   'kunde'     — én bestemt person (modtagerId = uid)
//   'forlob'    — alle på ét forløb (modtagerId = forløbs-id). Flere hold
//                 tildeles ved at oprette én 'forlob'-tildeling pr hold.
//   'alle-app'  — alle app-brugere (modtagerId = tom streng)
export type ModtagerType = 'kunde' | 'forlob' | 'alle-app';

// Hvor programmet er hostet:
//   'master' — top-collection trainingPrograms (siden "Mine programmer")
//   'forlob' — under et forløb (forlob/{id}/mikrotraeningProgrammer)
export type ProgramKilde = 'master' | 'forlob';

export interface ProgramTildeling {
	/** Auto-genereret doc-id. Sat efter create. */
	id?: string;
	/** Program-id (master-program eller forløbs-program). */
	programId: string;
	/**
	 * Forløbet hvor programmet ligger. Sat for forløbs-hostede programmer,
	 * tom streng for master-programmer (se programKilde).
	 */
	forlobId: string;
	/**
	 * Hvor programmet er hostet. Udeladt = 'forlob' (bagudkompat for de
	 * tildelinger der fandtes før master-programmer blev indført).
	 */
	programKilde?: ProgramKilde;
	/** Hvem tildelingen rammer. */
	modtagerType: ModtagerType;
	/** uid ved 'kunde', forløbs-id ved 'forlob', tom streng ved 'alle-app'. */
	modtagerId: string;
	/** Unix-ms da tildelingen blev oprettet. */
	tildeltAt: number;
	/** Admin-uid der oprettede tildelingen. */
	tildeltAf: string;
}

export interface TildelingOpts {
	/** Er kunden en app-bruger? Afgør om 'alle-app'-tildelinger rammer hende. */
	erAppBruger?: boolean;
}

/**
 * Beregner om en kunde har adgang til et bestemt program ud fra alle
 * tildelinger og kundens forløbs-tilhørsforhold.
 *
 * Kundens egne tildelinger (modtagerType='kunde', modtagerId=uid) gælder
 * altid. Forløbs-tildelinger gælder kun hvis kunden er på det forløb.
 * 'alle-app'-tildelinger gælder kun hvis kunden er app-bruger (opts.erAppBruger).
 */
export function harProgramAdgang(
	uid: string,
	programId: string,
	kundensForlobIds: string[],
	tildelinger: ProgramTildeling[],
	opts: TildelingOpts = {}
): boolean {
	const erApp = opts.erAppBruger ?? false;
	return tildelinger.some((t) => {
		if (t.programId !== programId) return false;
		if (t.modtagerType === 'kunde') return t.modtagerId === uid;
		if (t.modtagerType === 'alle-app') return erApp;
		return kundensForlobIds.includes(t.modtagerId);
	});
}

/**
 * Filtrerer en liste af tildelinger ned til dem der rammer en bestemt kunde
 * (direkte, via forløb, eller via 'alle-app' hvis hun er app-bruger).
 * Bruges til "vis hvem har hvad" i admin og til klient-levering.
 */
export function tildelingerForKunde<T extends { modtagerType: ModtagerType; modtagerId: string }>(
	uid: string,
	kundensForlobIds: string[],
	tildelinger: T[],
	opts: TildelingOpts = {}
): T[] {
	const erApp = opts.erAppBruger ?? false;
	return tildelinger.filter((t) => {
		if (t.modtagerType === 'kunde') return t.modtagerId === uid;
		if (t.modtagerType === 'alle-app') return erApp;
		return kundensForlobIds.includes(t.modtagerId);
	});
}
