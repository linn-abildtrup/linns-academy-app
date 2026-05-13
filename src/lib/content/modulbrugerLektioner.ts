// Lektioner som Linn lægger op for modulbrugere (basis-app + premium-app).
// Hver lektion er knyttet til en kalender-dato (YYYY-MM-DD) og vises på
// forsiden for alle modulbrugere på den pågældende dato. Til forskel fra
// forløbs-lektioner (knyttet til forløb + dagNummer) sidder modulbruger-
// lektioner direkte på kalenderen og vises uafhængigt af forløbs-fremgang.

import type { Timestamp } from 'firebase/firestore';

/**
 * En lektion for en specifik dato. Doc-id i Firestore er datoen som
 * YYYY-MM-DD. Hvis dokumentet ikke findes, er der ingen lektion den dag.
 */
export interface ModulbrugerLektion {
	dato: string; // YYYY-MM-DD (matcher doc-id)
	titel: string;
	beskrivelse: string;
	/** Valgfri længere fri-tekst (markdown eller plain). Vises i lektion-overlay. */
	indhold?: string;
	/** Valgfri ekstern URL (fx Vimeo eller blog-post). */
	url?: string;
	/** Lektions-format som "Video", "Læsestof", "Lyd" osv. */
	format?: string;
	/** Estimeret varighed i minutter. 0 = ikke specificeret. */
	varighedMin?: number;
	oprettetAt?: Timestamp;
	opdateretAt?: Timestamp;
}

export function tomLektion(dato: string): ModulbrugerLektion {
	return {
		dato,
		titel: '',
		beskrivelse: '',
		indhold: '',
		url: '',
		format: '',
		varighedMin: 0
	};
}
