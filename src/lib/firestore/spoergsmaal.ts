// Firestore-helpers til klient-spørgsmål til Linn.
//
// Klienter på forløb kan stille et spørgsmål. Spørgsmålene gemmes med
// brugerens uid og email så Linn kan se hvem der har spurgt om hvad i
// admin-fladen. Klienten får ikke et personligt svar — spørgsmålene
// bruges til at forme videoer, live-events og kommende app-indhold.

import { addDoc, collection, serverTimestamp, type Timestamp } from 'firebase/firestore';
import { db } from '$lib/firebase';

export type SpoergsmaalStatus = 'ny' | 'laest' | 'besvaret' | 'brugt';

export interface KlientSpoergsmaal {
	id: string;
	uid: string;
	email: string;
	spoergsmaal: string;
	status: SpoergsmaalStatus;
	oprettet: Timestamp;
}

export const SPOERGSMAAL_MAX_LAENGDE = 500;

/**
 * Gemmer et nyt klientspørgsmål. Returnerer id'et for det oprettede dokument.
 * Trimmer whitespace og afviser tomme spørgsmål.
 */
export async function gemSpoergsmaal(
	uid: string,
	email: string,
	spoergsmaal: string
): Promise<string> {
	const trimmet = spoergsmaal.trim();
	if (!trimmet) throw new Error('Spørgsmål må ikke være tomt');
	if (trimmet.length > SPOERGSMAAL_MAX_LAENGDE) {
		throw new Error(`Spørgsmål må højst være ${SPOERGSMAAL_MAX_LAENGDE} tegn`);
	}

	const ref = await addDoc(collection(db, 'klientspoergsmaal'), {
		uid,
		email,
		spoergsmaal: trimmet,
		status: 'ny' as SpoergsmaalStatus,
		oprettet: serverTimestamp()
	});
	return ref.id;
}
