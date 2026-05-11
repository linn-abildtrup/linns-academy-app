// Firestore-helpers for Linn AI.
//
// Datamodel:
//   - linnAiVidenbase/{id}                       ← admin uploader videnbase
//   - users/{uid}/linnAiSamtaler/{samtaleId}     ← brugerens chat-samtaler
//   - users/{uid}/linnAiQuotaer/{YYYY-MM-DD}     ← daglig rate-limit-tæller

import {
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	increment,
	orderBy,
	query,
	serverTimestamp,
	setDoc,
	Timestamp
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type {
	AiBesked,
	AiSamtale,
	VidenbaseDokument
} from '$lib/content/linnAi';
import { quotaNoegle, MAX_QUERIES_PR_DAG } from '$lib/content/linnAi';
import { aktivBrugerBasisPath } from '$lib/utils/adminKlient';

// ==============================================
// Konfiguration (admin)
// ==============================================

export interface LinnAiKonfiguration {
	systemPrompt?: string;
	opdateretAt?: Timestamp;
}

const KONFIG_PATH = 'linnAiKonfiguration/aktiv';

export async function hentLinnAiKonfiguration(): Promise<LinnAiKonfiguration | null> {
	const snap = await getDoc(doc(db, KONFIG_PATH));
	if (!snap.exists()) return null;
	return snap.data() as LinnAiKonfiguration;
}

export async function gemLinnAiKonfiguration(
	systemPrompt: string
): Promise<void> {
	await setDoc(
		doc(db, KONFIG_PATH),
		{ systemPrompt, opdateretAt: Timestamp.now() },
		{ merge: true }
	);
}

// ==============================================
// Videnbase (admin)
// ==============================================

export async function hentAlleVidenbaseDokumenter(): Promise<VidenbaseDokument[]> {
	const snap = await getDocs(collection(db, 'linnAiVidenbase'));
	return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as VidenbaseDokument);
}

export async function gemVidenbaseDokument(
	id: string,
	doc_: Omit<VidenbaseDokument, 'id' | 'oprettetAt' | 'opdateretAt'>
): Promise<void> {
	const ref = doc(db, 'linnAiVidenbase', id);
	const eks = await getDoc(ref);
	const nu = serverTimestamp();
	const data: Record<string, unknown> = {
		...doc_,
		opdateretAt: nu
	};
	if (!eks.exists()) data.oprettetAt = nu;
	await setDoc(ref, data, { merge: true });
}

export async function sletVidenbaseDokument(id: string): Promise<void> {
	await deleteDoc(doc(db, 'linnAiVidenbase', id));
}

// ==============================================
// Samtaler (bruger)
// ==============================================

function samtaleCollection(uid: string) {
	return collection(db, `${aktivBrugerBasisPath(uid)}/linnAiSamtaler`);
}

function samtaleRef(uid: string, samtaleId: string) {
	return doc(db, `${aktivBrugerBasisPath(uid)}/linnAiSamtaler/${samtaleId}`);
}

export async function hentSamtaler(uid: string): Promise<AiSamtale[]> {
	const snap = await getDocs(query(samtaleCollection(uid), orderBy('opdateretAt', 'desc')));
	return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AiSamtale);
}

export async function hentSamtale(uid: string, samtaleId: string): Promise<AiSamtale | null> {
	const snap = await getDoc(samtaleRef(uid, samtaleId));
	if (!snap.exists()) return null;
	return { id: snap.id, ...snap.data() } as AiSamtale;
}

export async function opretSamtale(uid: string, titel: string): Promise<string> {
	const id = `samtale_${Date.now()}`;
	const nu = Timestamp.now();
	await setDoc(samtaleRef(uid, id), {
		titel,
		beskeder: [],
		oprettetAt: nu,
		opdateretAt: nu
	});
	return id;
}

export async function tilfojBeskeder(
	uid: string,
	samtaleId: string,
	nyeBeskeder: AiBesked[]
): Promise<void> {
	const eks = await hentSamtale(uid, samtaleId);
	if (!eks) throw new Error('Samtale findes ikke');
	const beskeder = [...eks.beskeder, ...nyeBeskeder];
	await setDoc(
		samtaleRef(uid, samtaleId),
		{ beskeder, opdateretAt: Timestamp.now() },
		{ merge: true }
	);
}

export async function sletSamtale(uid: string, samtaleId: string): Promise<void> {
	await deleteDoc(samtaleRef(uid, samtaleId));
}

// ==============================================
// Rate limiting
// ==============================================

function quotaRef(uid: string, dato: string) {
	return doc(db, `${aktivBrugerBasisPath(uid)}/linnAiQuotaer/${dato}`);
}

/** Returnerer hvor mange queries brugeren har brugt i dag (0 hvis ingen). */
export async function hentDagensQuota(uid: string): Promise<number> {
	const noegle = quotaNoegle();
	const snap = await getDoc(quotaRef(uid, noegle));
	if (!snap.exists()) return 0;
	return (snap.data() as { antal?: number }).antal ?? 0;
}

/**
 * Øger dagens quota med 1. Returnerer det nye antal — hvis det er over
 * MAX_QUERIES_PR_DAG, skal kalder afvise yderligere queries.
 */
export async function oegQuota(uid: string): Promise<number> {
	const noegle = quotaNoegle();
	const ref = quotaRef(uid, noegle);
	await setDoc(ref, { antal: increment(1), opdateretAt: serverTimestamp() }, { merge: true });
	return hentDagensQuota(uid);
}

export const QUOTA_MAKS = MAX_QUERIES_PR_DAG;
