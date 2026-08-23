// ============================================================
// Hvem kan naas paa telefonen, og hvad de har sagt ja til.
//
// KUN 3.0. Linns krav 23. august: der maa aldrig sendes til en kunde i
// den gamle app. Der spoerges kun om lov paa /ny, og maaFaaNoti3
// tjekker det én gang til foer der sendes. To laase om det samme.
//
// HVOR TINGENE LIGGER:
//
//   users/{uid}/pushTelefon3/{id}   én pr telefon. Hun kan have flere:
//                                   mobil og tablet er to tilmeldinger
//   users/{uid} feltet notiValg3    hvad hun selv har slaaet fra
//   notiAdgang3/regler              hvad Linn tillader, pr forloeb
//
// ÉN PR TELEFON OG IKKE ÉN PR KUNDE. Skifter hun telefon, kommer der en
// ny, og den gamle doer af sig selv naar push-tjenesten svarer at den
// ikke findes mere. Se ryd doede adresser i afsendelses-endpointet.
// ============================================================

import {
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	setDoc,
	updateDoc
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import { harTestAdgang } from '$lib/utils/userAdgang';
import { isAdmin } from '$lib/admin';
import type { User } from 'firebase/auth';
import type { UserDoc } from '$lib/types';
import type { NotiRegler3, NotiValg3 } from '$lib/content/notifikation3';

/** Én telefon, som den ligger gemt. */
export interface PushTelefon3 {
	id: string;
	endpoint: string;
	p256dh: string;
	auth: string;
	tilmeldtMs: number;
}

/**
 * Maa den her kunde overhovedet faa beskeder.
 *
 * Reglen er Linns og staar to steder med vilje. Er 3.0 ikke aabnet for
 * hende, findes der ingen vej ind til hendes telefon.
 */
export function maaFaaNoti3(user: User | null, userDoc: UserDoc | null): boolean {
	return isAdmin(user) || harTestAdgang(userDoc, 'ny-app');
}

function telefonerRef(uid: string) {
	return collection(db, 'users', uid, 'pushTelefon3');
}

/**
 * Et kort, stabilt navn paa telefonen, udledt af dens egen adresse.
 *
 * Uden det ville den samme telefon lave en ny raekke hver gang hun
 * aabnede appen, og saa ville hun faa fem ens beskeder.
 */
export function telefonId3(endpoint: string): string {
	let h1 = 5381;
	let h2 = 52711;
	for (let i = 0; i < endpoint.length; i++) {
		const c = endpoint.charCodeAt(i);
		h1 = (h1 * 33) ^ c;
		h2 = (h2 * 31) ^ c;
	}
	return `t-${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}`;
}

/** Gemmer eller opdaterer den telefon hun lige har sagt ja paa. */
export async function gemTelefon3(
	uid: string,
	adresse: { endpoint: string; p256dh: string; auth: string }
): Promise<void> {
	const id = telefonId3(adresse.endpoint);
	await setDoc(doc(telefonerRef(uid), id), { ...adresse, tilmeldtMs: Date.now() }, { merge: true });
}

/** Alle hendes telefoner. */
export async function hentTelefoner3(uid: string): Promise<PushTelefon3[]> {
	try {
		const snap = await getDocs(telefonerRef(uid));
		return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PushTelefon3, 'id'>) }));
	} catch (e) {
		console.warn('[noti] kunne ikke hente telefonerne', e);
		return [];
	}
}

/** Fjerner én telefon. Bruges naar hun slaar alt fra, og naar en doer. */
export async function fjernTelefon3(uid: string, id: string): Promise<void> {
	await deleteDoc(doc(telefonerRef(uid), id));
}

/** Hvad hun selv har slaaet fra. Ligger paa hende selv, som resten. */
export async function hentNotiValg3(uid: string): Promise<NotiValg3> {
	try {
		const snap = await getDoc(doc(db, 'users', uid));
		return (snap.data()?.notiValg3 ?? {}) as NotiValg3;
	} catch (e) {
		console.warn('[noti] kunne ikke hente hendes valg', e);
		return {};
	}
}

/** Skriver KUN det ene felt. Bruger-dokumentet deles med den gamle app. */
export async function gemNotiValg3(uid: string, valg: NotiValg3): Promise<void> {
	await updateDoc(doc(db, 'users', uid), { notiValg3: valg });
}

/** Hvad Linn tillader. Tomt betyder alt aabent, som med naeringen. */
export async function hentNotiRegler3(): Promise<NotiRegler3> {
	try {
		const snap = await getDoc(doc(db, 'notiAdgang3', 'regler'));
		if (!snap.exists()) return {};
		const d = snap.data() as NotiRegler3;
		return { medlemmer: d.medlemmer ?? {}, forlob: d.forlob ?? {} };
	} catch (e) {
		console.warn('[noti] kunne ikke hente reglerne', e);
		return {};
	}
}

/** Kun admin. */
export async function gemNotiRegler3(regler: NotiRegler3): Promise<void> {
	await setDoc(
		doc(db, 'notiAdgang3', 'regler'),
		{ medlemmer: regler.medlemmer ?? {}, forlob: regler.forlob ?? {}, opdateretMs: Date.now() },
		{ merge: true }
	);
}
