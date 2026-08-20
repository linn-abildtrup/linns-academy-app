// ============================================================
// Admin-adgang til 3.0's AI-log og kontakten der slukker for den.
//
// Loggen SKRIVES kun af serveren (via service-account, uden om rules).
// Herfra laeses den kun, og kun af admin. Se firestore.rules.
// ============================================================

import {
	collection,
	doc,
	getDoc,
	getDocs,
	limit,
	orderBy,
	query,
	setDoc
} from 'firebase/firestore';
import { db } from '$lib/firebase';

export interface NyAiLinje {
	id: string;
	uid: string;
	/**
	 * 'inspirator' bliver ikke skrevet mere. Kortet blev fjernet fra
	 * forsiden 20. august 2026, men de gamle linjer ligger stadig i
	 * nyAiLog, og admin-siden i den gamle app filtrerer paa dem.
	 * SLET DEN IKKE fra typen, saa braekker den side.
	 */
	tilstand: 'samtale' | 'inspirator';
	tidspunkt: number;
	/** Kun samtale. */
	spoergsmaal?: string;
	/** AI'ens svar, begge tilstande. */
	svar?: string;
	/** Kun samtale. AI'ens egen vurdering af sit svar, 0-100. */
	sikkerhed?: number | null;
	/** Kun inspirator. */
	situation?: string;
	fakta?: string;
}

/** Nyeste foerst. Graensen holder siden hurtig, ogsaa naar loggen vokser. */
export async function hentNyAiLog(maks: number = 200): Promise<NyAiLinje[]> {
	const q = query(collection(db, 'nyAiLog'), orderBy('tidspunkt', 'desc'), limit(maks));
	const snap = await getDocs(q);
	return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NyAiLinje, 'id'>) }));
}

export interface NyAiKonfiguration {
	/** Sand = AI'en svarer ikke, hverken i Snak eller som inspirator. */
	slukket?: boolean;
	opdateretAt?: number;
}

export async function hentNyAiKonfiguration(): Promise<NyAiKonfiguration> {
	const snap = await getDoc(doc(db, 'nyAiKonfiguration', 'aktiv'));
	return snap.exists() ? (snap.data() as NyAiKonfiguration) : {};
}

export async function saetNyAiSlukket(slukket: boolean): Promise<void> {
	await setDoc(
		doc(db, 'nyAiKonfiguration', 'aktiv'),
		{ slukket, opdateretAt: Date.now() },
		{ merge: true }
	);
}
