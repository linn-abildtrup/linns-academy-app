// Firestore-helpers til klient-spørgsmål til Linn.
//
// Klienter på forløb kan stille et spørgsmål. Spørgsmålene gemmes med
// brugerens uid og email så Linn kan se hvem der har spurgt om hvad i
// admin-fladen. Klienten får ikke et personligt svar — spørgsmålene
// bruges til at forme videoer, live-events og kommende app-indhold.

import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	getDocs,
	limit,
	orderBy,
	query,
	serverTimestamp,
	updateDoc,
	where,
	type Timestamp
} from 'firebase/firestore';
import { db } from '$lib/firebase';

export type SpoergsmaalStatus = 'ny' | 'laest' | 'besvaret' | 'brugt';

export interface KlientSpoergsmaal {
	id: string;
	uid: string;
	email: string;
	spoergsmaal: string;
	status: SpoergsmaalStatus;
	oprettet: Timestamp;
	svar?: string;
	besvaretAt?: Timestamp;
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

/**
 * Henter alle klientspørgsmål sorteret med nyeste først. Kun admin har
 * læseadgang i Firestore-rules. Begrænset til 500 for performance.
 */
export async function hentAlleSpoergsmaal(): Promise<KlientSpoergsmaal[]> {
	const q = query(
		collection(db, 'klientspoergsmaal'),
		orderBy('oprettet', 'desc'),
		limit(500)
	);
	const snap = await getDocs(q);
	return snap.docs.map((d) => {
		const data = d.data();
		return {
			id: d.id,
			uid: data.uid ?? '',
			email: data.email ?? '',
			spoergsmaal: data.spoergsmaal ?? '',
			status: (data.status as SpoergsmaalStatus) ?? 'ny',
			oprettet: data.oprettet
		};
	});
}

/** Opdaterer status på et spørgsmål. */
export async function opdaterSpoergsmaalStatus(
	id: string,
	status: SpoergsmaalStatus
): Promise<void> {
	await updateDoc(doc(db, 'klientspoergsmaal', id), { status });
}

/** Sletter et spørgsmål permanent. */
export async function sletSpoergsmaal(id: string): Promise<void> {
	await deleteDoc(doc(db, 'klientspoergsmaal', id));
}

/**
 * Gemmer et svar på et spørgsmål og sætter status til 'besvaret'.
 * Trimmer whitespace og afviser tomme svar.
 */
export async function svarPaaSpoergsmaal(id: string, svar: string): Promise<void> {
	const trimmet = svar.trim();
	if (!trimmet) throw new Error('Svar må ikke være tomt');
	await updateDoc(doc(db, 'klientspoergsmaal', id), {
		svar: trimmet,
		status: 'besvaret' as SpoergsmaalStatus,
		besvaretAt: serverTimestamp()
	});
}

/**
 * Markerer at brugeren har set sine spørgsmål-svar nu. Skriver til
 * userDoc fordi det er rule-frit (brugeren har skriveadgang til sin
 * egen brugerdokument). Bruges af forsiden til at vise notifikations-
 * prik på spørgsmål-cardet når der er ubeskrevne svar.
 */
export async function markerSpoergsmaalLaest(uid: string): Promise<void> {
	await updateDoc(doc(db, 'users', uid), {
		senestSpoergsmaalLaestAt: Date.now()
	});
}

/**
 * Henter en bestemt klients egne spørgsmål, sorteret med nyeste først.
 * Bruges på klientens "Mine spørgsmål"-side så de kan se Linns svar.
 */
export async function hentMineSpoergsmaal(uid: string): Promise<KlientSpoergsmaal[]> {
	const q = query(
		collection(db, 'klientspoergsmaal'),
		where('uid', '==', uid),
		orderBy('oprettet', 'desc'),
		limit(100)
	);
	const snap = await getDocs(q);
	return snap.docs.map((d) => {
		const data = d.data();
		return {
			id: d.id,
			uid: data.uid ?? '',
			email: data.email ?? '',
			spoergsmaal: data.spoergsmaal ?? '',
			status: (data.status as SpoergsmaalStatus) ?? 'ny',
			oprettet: data.oprettet,
			svar: data.svar ?? undefined,
			besvaretAt: data.besvaretAt ?? undefined
		};
	});
}
