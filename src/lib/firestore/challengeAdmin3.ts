// ============================================================
// Admin-siden for challenges i 3.0.
//
// Skriver kun til den nye samling challenges/{id}. De gamle, der
// ligger inde under et forloeb, roerer vi ikke. De skal fortsat kunne
// laeses af den gamle app praecis som i dag.
// ============================================================

import {
	collection,
	deleteDoc,
	doc,
	getDocs,
	serverTimestamp,
	setDoc,
	Timestamp
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { MasterChallenge, Modtager } from '$lib/content/challenge3';

export interface GemChallengeInput {
	/** Tomt ved en ny. Sat naar en eksisterende rettes. */
	id?: string;
	navn: string;
	beskrivelse: string;
	/** Lokale datoer paa formen YYYY-MM-DD. */
	startDato: string;
	slutDato: string;
	aktiv: boolean;
	maal: number;
	modtagere: Modtager[];
	fravalgteBrugere: string[];
}

/** YYYY-MM-DD til midnat lokal tid, saa dagen taeller helt med. */
function tilTimestamp(dato: string): Timestamp {
	const [aar, m, d] = dato.split('-').map(Number);
	return Timestamp.fromDate(new Date(aar, (m ?? 1) - 1, d ?? 1));
}

/** Timestamp til YYYY-MM-DD, saa dato-felterne kan udfyldes ved rettelse. */
export function tilDatoFelt(ts: { toMillis?: () => number } | null): string {
	const ms = ts?.toMillis?.();
	if (!ms) return '';
	const d = new Date(ms);
	const m = `${d.getMonth() + 1}`.padStart(2, '0');
	const dag = `${d.getDate()}`.padStart(2, '0');
	return `${d.getFullYear()}-${m}-${dag}`;
}

export async function gemChallenge(input: GemChallengeInput): Promise<string> {
	const id = input.id || doc(collection(db, 'challenges')).id;
	await setDoc(
		doc(db, 'challenges', id),
		{
			navn: input.navn.trim(),
			beskrivelse: input.beskrivelse.trim(),
			startDato: tilTimestamp(input.startDato),
			slutDato: tilTimestamp(input.slutDato),
			aktiv: input.aktiv,
			maal: input.maal,
			modtagere: input.modtagere,
			fravalgteBrugere: input.fravalgteBrugere,
			opdateret: serverTimestamp(),
			...(input.id ? {} : { oprettet: serverTimestamp() })
		},
		{ merge: true }
	);
	return id;
}

export async function sletChallenge(id: string): Promise<void> {
	// Indtastningerne under den bliver liggende. Firestore sletter ikke
	// underliggende dokumenter af sig selv, og det er med vilje: skulle
	// en challenge slettes ved et uheld, er kundernes planter ikke vaek.
	await deleteDoc(doc(db, 'challenges', id));
}

export async function hentAlleMasterChallenges(): Promise<MasterChallenge[]> {
	const snap = await getDocs(collection(db, 'challenges'));
	return snap.docs
		.map((d) => {
			const data = d.data();
			return {
				id: d.id,
				navn: (data.navn as string) ?? '',
				beskrivelse: (data.beskrivelse as string) ?? '',
				startDato: (data.startDato as Timestamp) ?? null,
				slutDato: (data.slutDato as Timestamp) ?? null,
				aktiv: (data.aktiv as boolean) ?? false,
				maal: typeof data.maal === 'number' ? data.maal : undefined,
				fravalgteBrugere: (data.fravalgteBrugere as string[]) ?? [],
				modtagere: Array.isArray(data.modtagere) ? (data.modtagere as Modtager[]) : []
			};
		})
		.sort((a, b) => (b.startDato?.toMillis?.() ?? 0) - (a.startDato?.toMillis?.() ?? 0));
}

/** Hvor mange har tastet ind i challenge'n. Bruges til oversigten. */
export async function taelIndtastninger(id: string): Promise<number> {
	const snap = await getDocs(collection(db, 'challenges', id, 'indtastninger'));
	return snap.size;
}
