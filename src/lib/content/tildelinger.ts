// Tildelinger — admin tildeler træningsprogrammer og custom-builder-adgang
// til kunder. To-vejs tildeling: enten direkte til en kunde (uid) eller
// til hele et forløb (forlobId) — alle deltagere arver tildelingen.
//
// Datamodel er forberedelse til Linns Academy 2.0 (handover v27). I dag er
// programmer hardcoded pr forløb; den her tabel åbner for at samme program
// kan deles ud på tværs.

export type ModtagerType = 'kunde' | 'forlob';

export interface ProgramTildeling {
	/** Auto-genereret doc-id. Sat efter create. */
	id?: string;
	/** Program-id som det optræder under forlob/{forlobId}/mikrotraeningProgrammer/. */
	programId: string;
	/** Forløbet hvor programmet ligger (programmer er stadig hostet pr forløb). */
	forlobId: string;
	/** Hvem tildelingen rammer. */
	modtagerType: ModtagerType;
	/** uid hvis modtagerType='kunde', forløbs-doc-id hvis 'forlob'. */
	modtagerId: string;
	/** Unix-ms da tildelingen blev oprettet. */
	tildeltAt: number;
	/** Admin-uid der oprettede tildelingen. */
	tildeltAf: string;
}

export interface CustomBuilderTildeling {
	id?: string;
	modtagerType: ModtagerType;
	modtagerId: string;
	tildeltAt: number;
	tildeltAf: string;
}

/**
 * Beregner om en kunde har adgang til et bestemt program ud fra alle
 * tildelinger og kundens forløbs-tilhørsforhold.
 *
 * Kundens egne tildelinger (modtagerType='kunde', modtagerId=uid) gælder
 * altid. Forløbs-tildelinger gælder kun hvis kunden er på det forløb.
 */
export function harProgramAdgang(
	uid: string,
	programId: string,
	kundensForlobIds: string[],
	tildelinger: ProgramTildeling[]
): boolean {
	return tildelinger.some((t) => {
		if (t.programId !== programId) return false;
		if (t.modtagerType === 'kunde') return t.modtagerId === uid;
		return kundensForlobIds.includes(t.modtagerId);
	});
}

/**
 * Som harProgramAdgang men for custom-builder-tildelinger (uden program-id).
 */
export function harCustomBuilderAdgang(
	uid: string,
	kundensForlobIds: string[],
	tildelinger: CustomBuilderTildeling[]
): boolean {
	return tildelinger.some((t) => {
		if (t.modtagerType === 'kunde') return t.modtagerId === uid;
		return kundensForlobIds.includes(t.modtagerId);
	});
}

/**
 * Filtrerer en liste af tildelinger ned til dem der rammer en bestemt kunde
 * (enten direkte eller via forløb). Bruges til "vis hvem har hvad" i admin.
 */
export function tildelingerForKunde<T extends { modtagerType: ModtagerType; modtagerId: string }>(
	uid: string,
	kundensForlobIds: string[],
	tildelinger: T[]
): T[] {
	return tildelinger.filter((t) => {
		if (t.modtagerType === 'kunde') return t.modtagerId === uid;
		return kundensForlobIds.includes(t.modtagerId);
	});
}
