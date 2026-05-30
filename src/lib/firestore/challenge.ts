// Firestore-helpers for challenge-feature.

import {
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	query,
	serverTimestamp,
	setDoc,
	Timestamp,
	where
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { Challenge, ChallengeIndtastning } from '$lib/content/challenge';
import { kanSkrive } from '$lib/viewOnlyState.svelte';

function fraDoc(forlobId: string, id: string, data: Record<string, unknown>): Challenge {
	return {
		id,
		forlobId,
		navn: (data.navn as string) ?? '',
		beskrivelse: (data.beskrivelse as string) ?? '',
		startDato: data.startDato as Timestamp,
		slutDato: data.slutDato as Timestamp,
		aktiv: (data.aktiv as boolean) ?? false,
		fravalgteBrugere: (data.fravalgteBrugere as string[]) ?? [],
		oprettet: data.oprettet as Timestamp | undefined,
		opdateret: data.opdateret as Timestamp | undefined
	};
}

/**
 * Henter alle challenges for et forloeb.
 */
export async function hentChallenges(forlobId: string): Promise<Challenge[]> {
	const snap = await getDocs(collection(db, 'forlob', forlobId, 'challenges'));
	return snap.docs
		.map((d) => fraDoc(forlobId, d.id, d.data()))
		.sort((a, b) => {
			const aMs = a.startDato?.toMillis?.() ?? 0;
			const bMs = b.startDato?.toMillis?.() ?? 0;
			return bMs - aMs;
		});
}

/**
 * Henter den aktuelt aktive challenge for et forloeb (hvis nogen).
 * Returnerer foerste challenge hvor aktiv === true og nu er i perioden.
 */
export async function hentAktivChallenge(forlobId: string): Promise<Challenge | null> {
	const q = query(
		collection(db, 'forlob', forlobId, 'challenges'),
		where('aktiv', '==', true)
	);
	const snap = await getDocs(q);
	const nu = Date.now();
	for (const d of snap.docs) {
		const c = fraDoc(forlobId, d.id, d.data());
		const startMs = c.startDato?.toMillis?.() ?? 0;
		const slutMs = c.slutDato?.toMillis?.() ?? 0;
		// Inkluder hele slutdagen (23:59:59)
		const slutMidnat = slutMs + (24 * 60 * 60 * 1000 - 1);
		if (nu >= startMs && nu <= slutMidnat) return c;
	}
	return null;
}

export async function hentChallenge(
	forlobId: string,
	challengeId: string
): Promise<Challenge | null> {
	const snap = await getDoc(doc(db, 'forlob', forlobId, 'challenges', challengeId));
	if (!snap.exists()) return null;
	return fraDoc(forlobId, snap.id, snap.data());
}

export async function gemChallenge(challenge: Challenge): Promise<void> {
	const { id, forlobId, oprettet, ...data } = challenge;
	const ref = doc(db, 'forlob', forlobId, 'challenges', id);
	const eks = await getDoc(ref);
	const skrivData: Record<string, unknown> = { ...data, opdateret: serverTimestamp() };
	if (!eks.exists()) {
		skrivData.oprettet = oprettet ?? serverTimestamp();
	}
	await setDoc(ref, skrivData, { merge: true });
}

export async function sletChallenge(forlobId: string, challengeId: string): Promise<void> {
	await deleteDoc(doc(db, 'forlob', forlobId, 'challenges', challengeId));
}

/**
 * Henter alle klienters indtastninger for en challenge.
 * Bruges af stillings-skaermen til at beregne rangering.
 */
export async function hentAlleIndtastninger(
	forlobId: string,
	challengeId: string
): Promise<ChallengeIndtastning[]> {
	const snap = await getDocs(
		collection(db, 'forlob', forlobId, 'challenges', challengeId, 'indtastninger')
	);
	return snap.docs.map((d) => {
		const data = d.data() as {
			foedevarer?: string[];
			fornavn?: string;
			efternavn?: string;
			opdateret?: Timestamp;
		};
		return {
			uid: d.id,
			foedevarer: (data.foedevarer ?? []).slice(),
			fornavn: data.fornavn,
			efternavn: data.efternavn,
			opdateret: data.opdateret
		};
	});
}

/**
 * Henter klientens egen indtastning for en challenge.
 */
export async function hentMinIndtastning(
	forlobId: string,
	challengeId: string,
	uid: string
): Promise<ChallengeIndtastning | null> {
	const snap = await getDoc(
		doc(db, 'forlob', forlobId, 'challenges', challengeId, 'indtastninger', uid)
	);
	if (!snap.exists()) return null;
	const data = snap.data();
	return {
		uid,
		foedevarer: (data.foedevarer as string[]) ?? [],
		opdateret: data.opdateret as Timestamp | undefined
	};
}

/**
 * Gemmer klientens unikke foedevarer for en challenge. Duplikater fjernes
 * og listen normaliseres til trimmet/case-normaliseret form for at undgaa
 * 'Æble' og 'æble' som to forskellige.
 */
export async function gemMinIndtastning(
	forlobId: string,
	challengeId: string,
	uid: string,
	foedevarer: string[],
	fornavn: string,
	efternavn: string
): Promise<void> {
	if (!kanSkrive()) return;
	const normaliseret = normaliserFoedevareListe(foedevarer);
	await setDoc(
		doc(db, 'forlob', forlobId, 'challenges', challengeId, 'indtastninger', uid),
		{
			foedevarer: normaliseret,
			fornavn: fornavn ?? '',
			efternavn: efternavn ?? '',
			opdateret: serverTimestamp()
		},
		{ merge: true }
	);
}

/**
 * Henter alle registrerede brugere paa et forloeb (til admin-fravalg-listen).
 * Returnerer uid + navn + email. Bruger users-collection-query.
 */
export async function hentBrugerePaaForlob(
	forlobId: string
): Promise<Array<{ uid: string; fornavn: string; efternavn: string; email: string }>> {
	const q = query(
		collection(db, 'users'),
		where('forlobIds', 'array-contains', forlobId)
	);
	const snap = await getDocs(q);
	return snap.docs
		.map((d) => {
			const data = d.data() as {
				firstName?: string;
				lastName?: string;
				email?: string;
			};
			return {
				uid: d.id,
				fornavn: data.firstName ?? '',
				efternavn: data.lastName ?? '',
				email: data.email ?? ''
			};
		})
		.sort((a, b) => `${a.fornavn} ${a.efternavn}`.localeCompare(`${b.fornavn} ${b.efternavn}`, 'da'));
}

/**
 * Normaliserer en liste: trim hver, fjern tomme, fjern duplikater
 * (case-insensitivt). Bevarer first-seen casing for den visuelle visning.
 */
export function normaliserFoedevareListe(items: string[]): string[] {
	const seen = new Set<string>();
	const ud: string[] = [];
	for (const i of items) {
		const trim = i.trim();
		if (!trim) continue;
		const key = trim.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		ud.push(trim);
	}
	return ud;
}
