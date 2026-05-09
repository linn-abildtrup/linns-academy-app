import { doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { BrugerProfil, DagligeMaal, UserDoc, UserState } from '$lib/types';
import {
	hentAllowedEmail,
	markerAllowedEmailRegistreret
} from '$lib/firestore/forlob';

/**
 * Opdaterer brugerens udvidet-næring-toggle og daglige mål. Kaldes fra
 * profil-siden når brugeren skifter indstillinger.
 */
export async function gemNaeringsindstillinger(
	uid: string,
	visUdvidetNaering: boolean,
	dagligeMaal?: DagligeMaal
): Promise<void> {
	const data: Record<string, unknown> = { visUdvidetNaering };
	if (dagligeMaal) data.dagligeMaal = dagligeMaal;
	await updateDoc(doc(db, 'users', uid), data);
}

/**
 * Gemmer brugerens fysiske profil sammen med beregnede daglige mål.
 * Bruges af 'Beregn mine mål automatisk'-wizarden.
 */
export async function gemBrugerProfilOgMaal(
	uid: string,
	profil: BrugerProfil,
	dagligeMaal: DagligeMaal
): Promise<void> {
	await updateDoc(doc(db, 'users', uid), {
		brugerProfil: profil,
		dagligeMaal,
		visUdvidetNaering: true
	});
}

/**
 * Sætter admin-klient-mode for en bestemt forløbsId. Mens feltet er sat
 * opfører appen sig som om admin var klient på forløbet. Auto-opretter
 * userProduct på den scoped path så klient-modulerne har data at læse.
 */
export async function gemAdminKlientMode(uid: string, forlobId: string): Promise<void> {
	const { serverTimestamp, getDoc } = await import('firebase/firestore');

	// 1. Sæt mode-flaget på userDoc
	await updateDoc(doc(db, 'users', uid), { adminKlientForlobId: forlobId });

	// 2. Auto-opret userProduct hvis det ikke findes på den scoped path
	const productRef = doc(
		db,
		`users/${uid}/adminKlient/${forlobId}/products/kickstart`
	);
	const eks = await getDoc(productRef);
	if (!eks.exists()) {
		// Hent forløb for at få startDato
		const forlobRef = doc(db, 'forlob', forlobId);
		const forlobSnap = await getDoc(forlobRef);
		const forlobData = forlobSnap.exists() ? forlobSnap.data() : null;
		await setDoc(productRef, {
			productId: 'kickstart',
			forlobId,
			startDato: forlobData?.startDato ?? serverTimestamp(),
			udloberDato: null,
			koebt: serverTimestamp(),
			programValg: {},
			fremgang: {}
		});
	}
}

/**
 * Skifter tilbage til admin-mode ved at fjerne adminKlientForlobId.
 * Bruger 'deleteField' så feltet ikke står tilbage som null/undefined.
 */
export async function ryAdminKlientMode(uid: string): Promise<void> {
	const { deleteField } = await import('firebase/firestore');
	await updateDoc(doc(db, 'users', uid), {
		adminKlientForlobId: deleteField()
	});
}

/**
 * Henter bruger-dokumentet fra Firestore.
 * Returnerer null hvis dokumentet ikke findes.
 */
export async function getUserDoc(uid: string): Promise<UserDoc | null> {
	const ref = doc(db, 'users', uid);
	const snap = await getDoc(ref);
	if (!snap.exists()) return null;
	return snap.data() as UserDoc;
}

/**
 * Lytter på bruger-dokumentet og kalder callback ved hver ændring.
 * Returnerer en unsubscribe-funktion. Bruges i layoutet så ændringer
 * (fx senestSpoergsmaalLaestAt) propageres uden at brugeren skal
 * genindlæse siden.
 */
export function lytTilUserDoc(
	uid: string,
	callback: (userDoc: UserDoc | null) => void
): () => void {
	const ref = doc(db, 'users', uid);
	return onSnapshot(
		ref,
		(snap) => {
			if (!snap.exists()) {
				callback(null);
				return;
			}
			callback(snap.data() as UserDoc);
		},
		(err) => {
			console.warn('userDoc-listener fejlede:', err);
		}
	);
}

/**
 * Opretter et nyt bruger-dokument i Firestore.
 * Bruges når en bruger registrerer sig for første gang.
 */
export async function createUserDoc(
	uid: string,
	email: string,
	firstName: string = '',
	state: UserState = 'modulbruger'
): Promise<void> {
	const ref = doc(db, 'users', uid);
	const userDoc: UserDoc = {
		firstName,
		email,
		state,
		createdAt: Date.now()
	};
	await setDoc(ref, userDoc);
}

/**
 * Synkroniserer brugerens forløbs-status mod allowedEmails-whitelisten.
 *
 * Hvis brugerens email findes i allowedEmails:
 *   - userDoc.state sættes til 'forlobskunde'
 *   - userDoc.firstName udfyldes hvis det mangler
 *   - users/{uid}/products/kickstart oprettes/opdateres med forlobId
 *   - allowedEmails-status sættes til 'registered' hvis den var 'invited'
 *
 * Hvis brugerens email ikke findes på listen, gør funktionen ingenting —
 * userDoc beholder sin nuværende state (typisk 'modulbruger').
 *
 * Returnerer det opdaterede userDoc-objekt (eller det oprindelige hvis
 * intet ændredes), så kalderen kan opdatere sin lokale kopi.
 */
export async function synkroniserForlobskundeStatus(
	uid: string,
	email: string,
	current: UserDoc
): Promise<UserDoc> {
	if (!email) return current;

	const allowed = await hentAllowedEmail(email);
	if (!allowed) return current;

	const productRef = doc(db, 'users', uid, 'products', 'kickstart');
	const productSnap = await getDoc(productRef);
	if (productSnap.exists()) {
		const data = productSnap.data() as { forlobId?: string };
		if (data.forlobId !== allowed.forlobId) {
			await updateDoc(productRef, { forlobId: allowed.forlobId });
		}
	} else {
		await setDoc(productRef, {
			forlobId: allowed.forlobId,
			koebt: new Date(),
			startDato: new Date(),
			udloberDato: null,
			programValg: {},
			fremgang: {}
		});
	}

	const opdateringer: Partial<UserDoc> = {};
	if (current.state !== 'forlobskunde') {
		opdateringer.state = 'forlobskunde';
	}
	if (!current.firstName && allowed.firstName) {
		opdateringer.firstName = allowed.firstName;
	}
	if (Object.keys(opdateringer).length > 0) {
		const userRef = doc(db, 'users', uid);
		await updateDoc(userRef, opdateringer);
	}

	if (allowed.status === 'invited') {
		await markerAllowedEmailRegistreret(email).catch((e) =>
			console.warn('Kunne ikke markere allowedEmail som registreret:', e)
		);
	}

	return { ...current, ...opdateringer };
}
