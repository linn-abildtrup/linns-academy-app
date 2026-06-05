// Firestore-helpers for svarHistorik-collection.
//
// Hver gang admin sender et svar (uanset om AI-udkast blev brugt eller ej)
// gemmes et dokument her. Worker'en /api/svar-udkast bruger collection'en
// til at hente Linns tidligere svar som few-shot stemme-eksempler.
//
// Når vi gemmer både udkast OG endelig tekst kan vi senere se hvor AI'en
// ofte rammer forbi, og bruge det til at justere system-prompten.

import {
	collection,
	doc,
	getDocs,
	limit,
	orderBy,
	query,
	serverTimestamp,
	setDoc,
	where,
	type Timestamp
} from 'firebase/firestore';
import { db } from '$lib/firebase';

export interface SvarDiffStats {
	udkastLaengde: number;
	endeligLaengde: number;
	tegnTilfoejet: number;
	tegnFjernet: number;
}

export interface SvarHistorik {
	id: string;
	spoergsmaalId: string;
	forlobId: string;
	klientUid: string;
	klientEmail: string;
	spoergsmaalTekst: string;
	udkastTekst: string | null;
	endeligTekst: string;
	brugteUdkast: boolean;
	redigeretEfterBrug: boolean;
	lavSikkerhed: boolean;
	oprettet: Timestamp;
	diffStats: SvarDiffStats | null;
}

export interface GemSvarHistorikInput {
	spoergsmaalId: string;
	forlobId: string;
	klientUid: string;
	klientEmail: string;
	spoergsmaalTekst: string;
	udkastTekst: string | null;
	endeligTekst: string;
	brugteUdkast: boolean;
	redigeretEfterBrug: boolean;
	lavSikkerhed: boolean;
}

const COLLECTION = 'svarHistorik';

export function beregnDiffStats(
	udkast: string | null,
	endelig: string
): SvarDiffStats | null {
	if (udkast === null) return null;
	return {
		udkastLaengde: udkast.length,
		endeligLaengde: endelig.length,
		tegnTilfoejet: Math.max(0, endelig.length - udkast.length),
		tegnFjernet: Math.max(0, udkast.length - endelig.length)
	};
}

/**
 * Gemmer en svarHistorik-entry. Kaldes fra admin-siden efter at svar er
 * sendt. Doc-id sammensættes af spoergsmaalId + timestamp så vi kan
 * genskrive samme spørgsmål uden id-kollision (fx hvis admin opdaterer
 * et eksisterende svar).
 */
export async function gemSvarHistorik(input: GemSvarHistorikInput): Promise<string> {
	const id = `${input.spoergsmaalId}_${Date.now()}`;
	const diffStats = beregnDiffStats(input.udkastTekst, input.endeligTekst);
	await setDoc(doc(db, COLLECTION, id), {
		spoergsmaalId: input.spoergsmaalId,
		forlobId: input.forlobId,
		klientUid: input.klientUid,
		klientEmail: input.klientEmail,
		spoergsmaalTekst: input.spoergsmaalTekst,
		udkastTekst: input.udkastTekst,
		endeligTekst: input.endeligTekst,
		brugteUdkast: input.brugteUdkast,
		redigeretEfterBrug: input.redigeretEfterBrug,
		lavSikkerhed: input.lavSikkerhed,
		oprettet: serverTimestamp(),
		diffStats
	});
	return id;
}

/**
 * Henter de seneste N svar fra et forløb. Bruges på admin-statistik-siden
 * (fase 2). Worker'en bruger sin egen REST-baserede variant.
 */
export async function hentSenesteSvarForForlob(
	forlobId: string,
	maks = 50
): Promise<SvarHistorik[]> {
	const q = query(
		collection(db, COLLECTION),
		where('forlobId', '==', forlobId),
		orderBy('oprettet', 'desc'),
		limit(maks)
	);
	const snap = await getDocs(q);
	return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SvarHistorik, 'id'>) }));
}
