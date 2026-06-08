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
	getDoc,
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
export type SpoergsmaalKundeType = 'forlobskunde' | 'modulbruger' | 'udlobet';

export interface KlientSpoergsmaal {
	id: string;
	uid: string;
	email: string;
	spoergsmaal: string;
	status: SpoergsmaalStatus;
	oprettet: Timestamp;
	svar?: string;
	besvaretAt?: Timestamp;

	// Kontekst-felter — fastfryses ved oprettelse, ændres ikke senere
	// selvom kunden flytter til et nyt forløb. Det betyder Linn altid kan
	// se hvilket forløb spørgsmålet kom fra.
	forlobId?: string;
	forlobNavn?: string;
	kundeType?: SpoergsmaalKundeType;
}

export const SPOERGSMAAL_MAX_LAENGDE = 500;

interface NytSpoergsmaalKontekst {
	uid: string;
	email: string;
	spoergsmaal: string;
	forlobId?: string;
	forlobNavn?: string;
	kundeType?: SpoergsmaalKundeType;
}

/**
 * Gemmer et nyt klientspørgsmål. Returnerer id'et for det oprettede dokument.
 * Trimmer whitespace og afviser tomme spørgsmål.
 *
 * `forlobId`/`forlobNavn`/`kundeType` fastfryses i dokumentet så Linn senere
 * kan filtrere pr forløb selvom kunden flyttes til et nyt forløb bagefter.
 */
export async function gemSpoergsmaal(kontekst: NytSpoergsmaalKontekst): Promise<string> {
	const trimmet = kontekst.spoergsmaal.trim();
	if (!trimmet) throw new Error('Spørgsmål må ikke være tomt');
	if (trimmet.length > SPOERGSMAAL_MAX_LAENGDE) {
		throw new Error(`Spørgsmål må højst være ${SPOERGSMAAL_MAX_LAENGDE} tegn`);
	}

	// Self-healing: hvis caller ikke gav forlobId med, prov at finde det
	// fra brugerens userDoc + userProducts foer vi skriver. Det daekker
	// race conditions hvor onMount/effect endnu ikke har hentet kontekst,
	// og PWA-brugere paa cached gammel kode der ikke havde fix'et.
	// Bug 7-8/6 2026: ~60 sporgsmaal fra Kickstart juni-kunder var gemt
	// uden forlobId og kunne ikke faa AI-udkast bagefter.
	let forlobId = kontekst.forlobId;
	let forlobNavn = kontekst.forlobNavn;
	let kundeType = kontekst.kundeType;
	if (!forlobId) {
		try {
			const uDoc = await getDoc(doc(db, `users/${kontekst.uid}`));
			const ud = uDoc.exists() ? uDoc.data() : null;
			const forlobIds = (ud?.forlobIds as string[] | undefined) ?? [];
			if (forlobIds.length > 0) {
				// Forsoeg userProducts.premiumforløb, derefter kickstart
				for (const productId of ['premiumforløb', 'kickstart']) {
					const p = await getDoc(doc(db, `users/${kontekst.uid}/products/${productId}`));
					const fId = p.exists() ? (p.data().forlobId as string | undefined) : undefined;
					if (fId) {
						forlobId = fId;
						break;
					}
				}
				// Sidste fallback: brug seneste forløb i forlobIds-arrayet
				if (!forlobId) forlobId = forlobIds[forlobIds.length - 1];

				// Hent forlobNavn + bekraeft kundeType
				if (forlobId && !forlobNavn) {
					const f = await getDoc(doc(db, `forlob/${forlobId}`));
					forlobNavn = (f.data()?.navn as string | undefined) ?? undefined;
				}
				if (!kundeType && ud?.state === 'forlobskunde') {
					kundeType = 'forlobskunde';
				}
			}
		} catch (e) {
			// Self-healing er best-effort. Hvis det fejler, gemmer vi uden
			// forlobId og admin ser det stadig under "Uden forløb"-filteret.
			console.warn('Kunne ikke berige forlobId ved gem:', e);
		}
	}

	const data: Record<string, unknown> = {
		uid: kontekst.uid,
		email: kontekst.email,
		spoergsmaal: trimmet,
		status: 'ny' as SpoergsmaalStatus,
		oprettet: serverTimestamp()
	};
	if (forlobId) data.forlobId = forlobId;
	if (forlobNavn) data.forlobNavn = forlobNavn;
	if (kundeType) data.kundeType = kundeType;

	const ref = await addDoc(collection(db, 'klientspoergsmaal'), data);
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
			oprettet: data.oprettet,
			svar: data.svar ?? undefined,
			besvaretAt: data.besvaretAt ?? undefined,
			forlobId: data.forlobId ?? undefined,
			forlobNavn: data.forlobNavn ?? undefined,
			kundeType: (data.kundeType as SpoergsmaalKundeType | undefined) ?? undefined
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
 *
 * Sorterer klient-side i stedet for at bruge orderBy, så vi undgår
 * et composite index på (uid, oprettet). Hver klient har normalt
 * meget få spørgsmål så det er billigt.
 */
export async function hentMineSpoergsmaal(uid: string): Promise<KlientSpoergsmaal[]> {
	const q = query(
		collection(db, 'klientspoergsmaal'),
		where('uid', '==', uid),
		limit(100)
	);
	const snap = await getDocs(q);
	const items = snap.docs.map((d) => {
		const data = d.data();
		return {
			id: d.id,
			uid: data.uid ?? '',
			email: data.email ?? '',
			spoergsmaal: data.spoergsmaal ?? '',
			status: (data.status as SpoergsmaalStatus) ?? 'ny',
			oprettet: data.oprettet,
			svar: data.svar ?? undefined,
			besvaretAt: data.besvaretAt ?? undefined,
			forlobId: data.forlobId ?? undefined,
			forlobNavn: data.forlobNavn ?? undefined,
			kundeType: (data.kundeType as SpoergsmaalKundeType | undefined) ?? undefined
		};
	});
	items.sort((a, b) => {
		const at = a.oprettet?.toDate?.()?.getTime?.() ?? 0;
		const bt = b.oprettet?.toDate?.()?.getTime?.() ?? 0;
		return bt - at;
	});
	return items;
}
