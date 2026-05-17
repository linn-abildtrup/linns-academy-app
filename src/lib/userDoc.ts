import { arrayUnion, doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { BrugerProfil, DagligeMaal, UserDoc, UserState } from '$lib/types';
import {
	hentAllowedEmail,
	markerAllowedEmailRegistreret
} from '$lib/firestore/forlob';
import { udledState } from '$lib/utils/userAdgang';

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
 * Sætter admin-klient-mode til et specifikt forløb. Mens feltet er sat
 * opfører appen sig som om admin var forløbskunde på forløbet. Auto-opretter
 * userProduct på den scoped path så klient-modulerne har data at læse.
 */
export async function gemAdminKlientForlob(uid: string, forlobId: string): Promise<void> {
	const { serverTimestamp, getDoc } = await import('firebase/firestore');

	await updateDoc(doc(db, 'users', uid), {
		adminKlientForlobId: forlobId,
		adminKlientMode: 'forlob'
	});

	const productRef = doc(
		db,
		`users/${uid}/adminKlient/${forlobId}/products/kickstart`
	);
	const eks = await getDoc(productRef);
	if (!eks.exists()) {
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
 * Sætter admin-klient-mode til basis- eller premium-app. Scope-id er en
 * reserved-streng (__basisapp / __premiumapp) så data scope'r til en
 * dedikeret sandkasse under users/{uid}/adminKlient/{scope}/...
 */
export async function gemAdminKlientApp(
	uid: string,
	mode: 'basisapp' | 'premiumapp'
): Promise<void> {
	const scope = mode === 'basisapp' ? '__basisapp' : '__premiumapp';
	await updateDoc(doc(db, 'users', uid), {
		adminKlientForlobId: scope,
		adminKlientMode: mode
	});
}

/**
 * @deprecated Brug gemAdminKlientForlob i stedet. Beholdt mens andre
 * kald-steder migreres.
 */
export async function gemAdminKlientMode(uid: string, forlobId: string): Promise<void> {
	return gemAdminKlientForlob(uid, forlobId);
}

/**
 * Skifter tilbage til admin-mode ved at fjerne både adminKlientForlobId
 * og adminKlientMode. Bruger deleteField så felterne ikke står tilbage.
 */
export async function ryAdminKlientMode(uid: string): Promise<void> {
	const { deleteField } = await import('firebase/firestore');
	await updateDoc(doc(db, 'users', uid), {
		adminKlientForlobId: deleteField(),
		adminKlientMode: deleteField()
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
 * Synkroniserer brugerens adgang mod allowedEmails-whitelisten. Kaldes hver
 * gang brugeren logger ind (eller første gang efter signup).
 *
 * Den håndterer to typer allowedEmails-records:
 *
 * 1. **Forløbs-records** (oprettet via CSV-import) har `forlobId` sat:
 *    - userDoc.state = 'forlobskunde'
 *    - users/{uid}/products/kickstart oprettes med forlobId
 *    - allowedEmails-status sættes til 'registered'
 *
 * 2. **Abonnements-records** (oprettet af Simplero-webhook) har
 *    `accessLevel` sat:
 *    - userDoc får accessLevel/accessSource/activeProduct/etc kopieret over
 *    - userDoc.state synces fra accessLevel via udledState-helperen
 *    - simpleroCustomerId gemmes så vi kan koble til Simplero ved cancel
 *
 * En record kan have begge dele (forløbs-køb via Simplero i fremtiden) —
 * vi håndterer begge sæt felter i samme update så ingen data går tabt.
 *
 * Returnerer det opdaterede userDoc-objekt så kalderen kan opdatere sin
 * lokale kopi.
 */
export async function synkroniserForlobskundeStatus(
	uid: string,
	email: string,
	current: UserDoc
): Promise<UserDoc> {
	if (!email) return current;

	const allowed = await hentAllowedEmail(email);
	if (!allowed) return current;

	const opdateringer: Record<string, unknown> = {};

	// Forløbs-flow: opret userProduct og append forløbet til forlobIds-arrayet.
	// Vigtigt: gamle userProducts slettes ALDRIG — bibliotek skal stadig vise
	// materiale fra forløb brugeren har gennemført, selv hvis hun nu er på
	// noget andet. activeProduct-id'et bruges som dokumentnavn så Maria der
	// først tager Kickstart og senere Premium-forløb ender med to docs:
	// products/kickstart + products/premiumforløb.
	if (allowed.forlobId) {
		const productId = allowed.activeProduct ?? 'kickstart';
		const productRef = doc(db, 'users', uid, 'products', productId);
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
		// Append forløbet til userDoc.forlobIds — historik bevares så
		// bibliotek kan vise materiale fra alle tidligere forløb.
		opdateringer.forlobIds = arrayUnion(allowed.forlobId);
		if (current.state !== 'forlobskunde') {
			opdateringer.state = 'forlobskunde';
		}

		// Beregn expiresAt = forløbets slutdato og bonusPeriodEndsAt = slut + 90
		// dage ud fra forløb-dokumentet. Det er forudsætningen for at brugeren
		// automatisk overgår til "udlobet med bibliotek-adgang" når forløbet
		// slutter. Webhook-flow'et bruger sin egen mekanisme — her sætter vi
		// kun felterne hvis de ikke allerede er på userDoc (eller hvis
		// forløbet er ændret).
		if (!current.expiresAt || !current.bonusPeriodEndsAt) {
			try {
				const forlobSnap = await getDoc(doc(db, 'forlob', allowed.forlobId));
				if (forlobSnap.exists()) {
					const data = forlobSnap.data() as {
						startDato?: { toMillis?: () => number; seconds?: number };
						antalDage?: number;
					};
					const startMs =
						data.startDato?.toMillis?.() ?? (data.startDato?.seconds ?? 0) * 1000;
					const antalDage = data.antalDage ?? 0;
					if (startMs && antalDage > 0) {
						// Forløbet løber fra Dag 0 (startDato) til og med Dag {antalDage}
						// kl. 23:59. expiresAt sættes til midnatten EFTER sidste dag, så
						// `expiresAt > now` returnerer true så længe vi er inden for
						// Dag {antalDage}. Bonus-periode er 90 dage efter forløbet slutter.
						const dayMs = 24 * 60 * 60 * 1000;
						const slutMs = startMs + (antalDage + 1) * dayMs;
						if (!current.expiresAt) opdateringer.expiresAt = slutMs;
						if (!current.bonusPeriodEndsAt) {
							opdateringer.bonusPeriodEndsAt = slutMs + 90 * dayMs;
						}
					}
				}
			} catch (e) {
				console.warn('Kunne ikke hente forløb til at sætte expiresAt:', e);
			}
		}
	}

	// Abonnement/Simplero-flow: kopier access-felter over på userDoc.
	// Disse har forrang over forløbs-state hvis begge er sat — fordi
	// accessLevel/accessSource er den autoritative kilde i den nye model.
	// Undtagelse: hvis allowed.adgangFra er sat og endnu ikke passeret, så
	// ignorerer vi abo-felterne — bruges fx ved migration hvor kunden er
	// på et forløb i dag men først aktiveres som abonnent ved midnat.
	const aboAktivNu = !allowed.adgangFra || allowed.adgangFra <= Date.now();
	if (allowed.accessLevel && aboAktivNu) {
		opdateringer.accessLevel = allowed.accessLevel;
		if (allowed.accessSource) opdateringer.accessSource = allowed.accessSource;
		if (allowed.activeProduct) opdateringer.activeProduct = allowed.activeProduct;
		if (allowed.activeSubscription !== undefined) {
			opdateringer.activeSubscription = allowed.activeSubscription;
		}
		if (allowed.simpleroCustomerId) {
			opdateringer.simpleroCustomerId = allowed.simpleroCustomerId;
		}
		if (allowed.expiresAt !== undefined) opdateringer.expiresAt = allowed.expiresAt;
		opdateringer.updatedAt = Date.now();
		// Hold legacy state-feltet i sync med accessLevel/accessSource så
		// de gamle 12 kald-steder (der falder tilbage til state) virker.
		const udledtState = udledState(allowed.accessLevel, allowed.accessSource);
		if (current.state !== udledtState) opdateringer.state = udledtState;
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

	// Build returneret userDoc — erstat arrayUnion-FieldValue med den
	// faktiske array-værdi vi forventer at have i Firestore bagefter.
	const lokalOpdateringer = { ...opdateringer };
	if (allowed.forlobId) {
		const eks = (current as UserDoc & { forlobIds?: string[] }).forlobIds ?? [];
		lokalOpdateringer.forlobIds = Array.from(new Set([...eks, allowed.forlobId]));
	}
	return { ...current, ...lokalOpdateringer } as UserDoc;
}
