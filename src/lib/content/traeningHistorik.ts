// Træning-historik — én entry pr gennemført træning, gemt pr kunde.
//
// Formålet er at kunden altid kan kigge tilbage på en historisk dato og
// se hvad hun trænede den dag, uanset hvilket program der er aktivt nu.
// Hvis hun fx trænede mikrotræning i uge 1 og skiftede til sit eget
// program i uge 2, vil et klik på en uge-1-dato stadig vise mikrotræning.
//
// Gemmes pr kunde under users/{uid}/traeningHistorik/{auto-id}.

export type HistorikKilde = 'mikrotraening' | 'eget' | 'tildelt';

export interface TraeningHistorikEntry {
	/** Auto-genereret doc-id. */
	id?: string;
	/** YYYY-MM-DD (lokal dato — samme format som andre per-dato-stier i appen). */
	dato: string;
	/** Hvilken type træning der blev gennemført. */
	kilde: HistorikKilde;
	/** Program-id for eget eller tildelt. Tomt for mikrotræning. */
	programId?: string;
	/** Visningsnavn for programmet — denormaliseret så vi kan vise det uden
	 *  at slå op i kilde-collection (programmet kan være slettet siden). */
	programNavn: string;
	/** forløb-id (kun for tildelt-kilde). */
	forlobId?: string;
	/** Unix-ms da træningen blev gennemført. */
	gennemfoertAt: number;
}

/** Bygger en YYYY-MM-DD streng fra en Date. */
export function formaterHistorikDato(d: Date): string {
	const aar = d.getFullYear();
	const maaned = String(d.getMonth() + 1).padStart(2, '0');
	const dag = String(d.getDate()).padStart(2, '0');
	return `${aar}-${maaned}-${dag}`;
}

/**
 * Vælger den "primære" historik-entry for en dato hvis kunden har trænet
 * flere gange samme dag — fx mikrotræning om morgenen + eget program om
 * aftenen. Returnerer den senest gennemførte.
 */
export function senesteEntry(
	entries: TraeningHistorikEntry[]
): TraeningHistorikEntry | null {
	if (entries.length === 0) return null;
	return entries.reduce((a, b) =>
		a.gennemfoertAt > b.gennemfoertAt ? a : b
	);
}
