// Lektion-noter — kundens egne refleksioner pr lektion i et forløb.
//
// Gemmes pr kunde under users/{uid}/lektionNoter/{noterId} hvor noterId
// er sammensat af forlobId + lektionId så samme lektion-id i forskellige
// forløb (fx hvis Linn genbruger en lektion) holdes adskilt.

export interface LektionNote {
	/** Auto-genereret doc-id (kombineret forlobId__lektionId). */
	id?: string;
	/** Hvilket forløb noten hører til. */
	forlobId: string;
	/** Hvilken lektion noten hører til. */
	lektionId: string;
	/** Selve tekst-indholdet. Tom streng er gyldig (men gemmes ikke). */
	tekst: string;
	/** Unix-ms da noten blev oprettet. */
	oprettet: number;
	/** Unix-ms da noten sidst blev opdateret. */
	opdateret: number;
}

/** Maks længde for noten — beskytter mod misbrug, ikke en hård UX-grænse. */
export const MAKS_NOTE_LAENGDE = 4000;

/** Konstruerer doc-id for en note ud fra forlobId + lektionId. */
export function noteDocId(forlobId: string, lektionId: string): string {
	return `${forlobId}__${lektionId}`;
}

/** Returnerer en fejlbesked eller null hvis noten er gyldig. */
export function validerNote(tekst: string): string | null {
	if (tekst.length > MAKS_NOTE_LAENGDE) {
		return `Noten må højst være ${MAKS_NOTE_LAENGDE} tegn.`;
	}
	return null;
}
