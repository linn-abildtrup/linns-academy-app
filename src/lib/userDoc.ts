import {
	arrayUnion,
	deleteField,
	doc,
	getDoc,
	onSnapshot,
	setDoc,
	updateDoc
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { BrugerProfil, DagligeMaal, UserDoc } from '$lib/types';
import { hentAllowedEmail, markerAllowedEmailRegistreret } from '$lib/firestore/forlob';
import {
	forlobTypeForId,
	programIdForVariant,
	vaelgProgramForVariant,
	type Variant
} from '$lib/utils/traeningsvariant';
import { hentForlobsProgrammer } from '$lib/firestore/mikrotraening';
import { forlobSlutMs, bibliotekBonusSlutMs, forlobAdgangFelter } from '$lib/content/forlobAdgang';
import { resolverAktuelAdgang, type ForlobVindue } from '$lib/content/adgangResolver';

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

	// Slaa forl0b-type op saa vi opretter den rigtige productId (kickstart vs
	// premiumforl0b) og kan gemme den paa userDoc'en til effektivUserDoc.
	const forlobRef = doc(db, 'forlob', forlobId);
	const forlobSnap = await getDoc(forlobRef);
	const forlobData = forlobSnap.exists() ? forlobSnap.data() : null;
	const erKropsro = forlobData?.type === 'kropsro';
	const productId = erKropsro ? 'premiumforløb' : 'kickstart';

	await updateDoc(doc(db, 'users', uid), {
		adminKlientForlobId: forlobId,
		adminKlientMode: 'forlob',
		adminKlientAktivProdukt: productId
	});

	const productRef = doc(db, `users/${uid}/adminKlient/${forlobId}/products/${productId}`);
	const eks = await getDoc(productRef);
	if (!eks.exists()) {
		await setDoc(productRef, {
			productId,
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
		adminKlientMode: deleteField(),
		adminKlientAktivProdukt: deleteField()
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
	firstName: string = ''
): Promise<void> {
	const ref = doc(db, 'users', uid);
	// Nye brugere starter UDEN adgang (accessLevel='none'). Hvis kunden har
	// koebt eller er paa et forloeb, opgraderer login-sync
	// (synkroniserForlobskundeStatus) straks felterne fra allowedEmails.
	const userDoc: UserDoc = {
		firstName,
		email,
		accessLevel: 'none',
		createdAt: Date.now()
	};
	await setDoc(ref, userDoc);
}

/**
 * Gemmer hvilken app-build klienten netop bootede med på userDoc. Skriver
 * KUN hvis versionen adskiller sig fra den lagrede — så vi ikke laver et
 * write ved hvert load for 600-700 kunder. Best-effort: fejl logges men
 * kastes ikke, så det aldrig kan blokere login.
 */
export async function gemAppVersion(
	uid: string,
	version: string,
	current: UserDoc | null
): Promise<void> {
	if (!version || current?.appVersion === version) return;
	try {
		await updateDoc(doc(db, 'users', uid), {
			appVersion: version,
			appVersionSetAt: Date.now()
		});
	} catch (e) {
		console.warn('Kunne ikke gemme appVersion:', e);
	}
}

/**
 * Synkroniserer brugerens adgang mod allowedEmails-whitelisten. Kaldes hver
 * gang brugeren logger ind (eller første gang efter signup).
 *
 * Den håndterer to typer allowedEmails-records:
 *
 * 1. **Forløbs-records** (oprettet via CSV-import) har `forlobId` sat:
 *    - accessLevel/accessSource sættes til forløbs-adgang
 *    - users/{uid}/products/kickstart oprettes med forlobId
 *    - allowedEmails-status sættes til 'registered'
 *
 * 2. **Abonnements-records** (oprettet af Simplero-webhook) har
 *    `accessLevel` sat:
 *    - userDoc får accessLevel/accessSource/activeProduct/etc kopieret over
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
	// først tager Kickstart og senere Kropsro ender med to docs:
	// products/kickstart + products/premiumforløb (det interne id for
	// Kropsro — se KROPSRO_PRODUCT_ID i types.ts).
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

		// Hent forløbet en gang — bruges baade til udloebs-tjek og expiresAt.
		let forlobStartMs = 0;
		let forlobAntalDage = 0;
		let forlobBygget = false;
		let forlobFeatures: Record<string, boolean> | null = null;
		try {
			const forlobSnap = await getDoc(doc(db, 'forlob', allowed.forlobId));
			if (forlobSnap.exists()) {
				const data = forlobSnap.data() as {
					startDato?: { toMillis?: () => number; seconds?: number };
					antalDage?: number;
					byggetForlob?: boolean;
					features?: Record<string, boolean>;
				};
				forlobStartMs = data.startDato?.toMillis?.() ?? (data.startDato?.seconds ?? 0) * 1000;
				forlobAntalDage = data.antalDage ?? 0;
				forlobBygget = data.byggetForlob === true;
				forlobFeatures = data.features ?? {};
			}
		} catch (e) {
			console.warn('Kunne ikke hente forloeb:', e);
		}
		// Fælles slut-beregning (forlobSlutMs i $lib/content/forlobAdgang) så
		// login-sync og webhooks aldrig regner forskelligt. Se A4-oprydning.
		const slutMs = forlobSlutMs(forlobStartMs, forlobAntalDage);
		// Har kunden købt appen mens forløbet kører, er abo'en parkeret med
		// adgangFra (= dagen efter forløbets effektive slut). Så holdes forløbet
		// "aktivt" indtil det tidspunkt — ellers ville et pause-forskudt forløb
		// blive regnet som udløbet, før appen tager over. (Webhook A + B.)
		const parkeretTil = allowed.adgangFra && allowed.adgangFra > Date.now() ? allowed.adgangFra : 0;
		const effektivSlutMs = Math.max(slutMs, parkeretTil);
		const forlobUdloebet = effektivSlutMs > 0 && Date.now() > effektivSlutMs;

		// Features frit pr forløb: er kunden på et AKTIVT bygget forløb, lægger
		// vi forløbets feature-flag på userDoc (harFeatureAdgang læser dem).
		// Ellers ryddes feltet, så Kickstart/Kropsro-kunder altid falder tilbage
		// på den type-baserede matrix.
		if (forlobBygget && !forlobUdloebet) {
			opdateringer.forlobFeatures = forlobFeatures ?? {};
		} else if (current.forlobFeatures) {
			opdateringer.forlobFeatures = deleteField();
		}

		if (!forlobUdloebet) {
			// Aktivt forl0b. state-feltet opdateres ikke laengere (A2 etape B) -
			// effektivState udleder tilstanden af accessLevel/accessSource.

			// Resync aktivtTraeningsprogram til det NYE forl0b. Bug fundet
			// 5. juni 2026: 81 ud af 276 juni-Kickstart-kunder havde
			// aktivtTraeningsprogram der pegede paa kickstart_maj_2026 fordi
			// vi aldrig syncede ved forl0bsskifte.
			//
			// Variant (kettlebell/no_kettlebell) er kundens valg og bevares.
			// programId udledes ud fra forl0bs-type (kickstart/kropsro) +
			// variant. Hvis kunden endnu ikke har valgt variant, lader vi
			// aktivtTraeningsprogram vaere indtil onboarding s0tter den.
			const variant: Variant | null =
				current.mikrotraeningVariant === 'kettlebell' ||
				current.mikrotraeningVariant === 'no_kettlebell'
					? current.mikrotraeningVariant
					: null;
			// Byggede forloeb: kundens program er forloebets EGET program for
			// varianten (udstyr). Kickstart/Kropsro: de hardcodede id'er (uaendret).
			let forventetProgramId: string | null = null;
			if (variant) {
				if (forlobBygget) {
					const programmer = await hentForlobsProgrammer(allowed.forlobId);
					forventetProgramId = vaelgProgramForVariant(programmer, variant)?.id ?? null;
				} else {
					forventetProgramId = programIdForVariant(variant, forlobTypeForId(allowed.forlobId));
				}
			}
			const skalResynce =
				forventetProgramId &&
				(!current.aktivtTraeningsprogram ||
					current.aktivtTraeningsprogram.forlobId !== allowed.forlobId ||
					current.aktivtTraeningsprogram.programId !== forventetProgramId);
			if (skalResynce && forventetProgramId) {
				opdateringer.aktivtTraeningsprogram = {
					kilde: 'tildelt',
					programId: forventetProgramId,
					forlobId: allowed.forlobId
				};
			}
		} else {
			// Udl0bet forl0b — kunden er reelt modulbruger nu. Slet stale
			// aktivtTraeningsprogram der peger paa det udl0bne forl0b, saa
			// forsiden ikke router hende til programmet bag "Dagens
			// mikrotraening" (typisk Kickstart maj 2026 med fejl-data).
			// Hun falder dermed tilbage paa abo-mikrotraeningen.
			//
			// Bug fundet 8/6 2026 (Annette Buhl-Soerensen): forsiden viste
			// et andet program end Moduler -> Traening fordi den brugte
			// aktivtTraeningsprogram direkte, mens Moduler-overblikket viste
			// "Mikrotraening"-row der peger paa abo-programmet.

			// (Tidligere blev userDoc.state sat til 'modulbruger' her for en
			// udl0bet forl0bskunde der reelt var abo-kunde. Fjernet i A2 etape
			// B - effektivState udleder nu tilstanden af accessLevel/
			// accessSource, saa state-feltet skrives ikke mere.)

			if (
				current.aktivtTraeningsprogram?.kilde === 'tildelt' &&
				current.aktivtTraeningsprogram?.forlobId === allowed.forlobId
			) {
				opdateringer.aktivtTraeningsprogram = deleteField();
			}
		}

		// Beregn expiresAt + bonusPeriodEndsAt hvis de mangler. Det er
		// forudsaetningen for at brugeren automatisk overgaar til "udlobet
		// med bibliotek-adgang" naar forl0bet slutter. Dette er den ENESTE
		// kilde til bonus-datoen (webhooks saetter den ikke laengere - A4).
		if (slutMs > 0 && (!current.expiresAt || !current.bonusPeriodEndsAt)) {
			if (!current.expiresAt) opdateringer.expiresAt = slutMs;
			if (!current.bonusPeriodEndsAt) {
				opdateringer.bonusPeriodEndsAt = bibliotekBonusSlutMs(forlobStartMs, forlobAntalDage);
			}
		}
	}

	// Abonnement/Simplero-flow: kopier access-felter over på userDoc.
	// Disse har forrang over forløbs-state hvis begge er sat — fordi
	// accessLevel/accessSource er den autoritative kilde i den nye model.
	// Undtagelse: hvis allowed.adgangFra er sat og endnu ikke passeret, så
	// ignorerer vi abo-felterne — bruges fx ved migration hvor kunden er
	// på et forløb i dag men først aktiveres som abonnent ved midnat.
	// Abo-DATA-felterne kopieres ALTID (også ved parkeret abo, adgangFra i
	// fremtiden), så den dato-styrede resolver nedenfor altid har abo-perioden
	// og kan skifte kunden tilbage til app efter et forløb.
	if (allowed.aboKoebtAt !== undefined) opdateringer.aboKoebtAt = allowed.aboKoebtAt;
	if (allowed.aboSlutterAt !== undefined) opdateringer.aboSlutterAt = allowed.aboSlutterAt;
	if (allowed.aboProdukt !== undefined) opdateringer.aboProdukt = allowed.aboProdukt;
	if (allowed.aboAccessLevel !== undefined) opdateringer.aboAccessLevel = allowed.aboAccessLevel;
	if (allowed.simpleroCustomerId) opdateringer.simpleroCustomerId = allowed.simpleroCustomerId;

	const aboAktivNu = !allowed.adgangFra || allowed.adgangFra <= Date.now();
	if (allowed.accessLevel && aboAktivNu) {
		opdateringer.accessLevel = allowed.accessLevel;
		if (allowed.accessSource) opdateringer.accessSource = allowed.accessSource;
		if (allowed.activeProduct) opdateringer.activeProduct = allowed.activeProduct;
		if (allowed.activeSubscription !== undefined) {
			opdateringer.activeSubscription = allowed.activeSubscription;
		}
		if (allowed.expiresAt !== undefined) opdateringer.expiresAt = allowed.expiresAt;
		opdateringer.updatedAt = Date.now();
		// (state-feltet holdes ikke laengere i sync - A2 etape B.)
	}

	if (!current.firstName && allowed.firstName) {
		opdateringer.firstName = allowed.firstName;
	}

	// ── Samlet dato-styret adgang (autoritativ for tilstands-felterne) ──
	// Kør resolveren på ALLE kundens forløb + abo, så app↔forløb-skiftet sker
	// efter dato: app før forløb-start, forløb i vinduet, app igen efter (hvis
	// abo gyldig), ellers udløbet. Overstyrer accessSource/activeProduct/
	// accessLevel/expiresAt. Ved 'udlobet' rører vi ikke felterne — så den
	// eksisterende expiresAt + 90-dages bibliotek-bonus (bonusPeriodEndsAt)
	// bevares uændret.
	try {
		const alleForlobIds = Array.from(
			new Set([
				...((current as UserDoc & { forlobIds?: string[] }).forlobIds ?? []),
				...(allowed.forlobId ? [allowed.forlobId] : [])
			])
		);
		const vinduer: ForlobVindue[] = [];
		for (const fid of alleForlobIds) {
			try {
				const snap = await getDoc(doc(db, 'forlob', fid));
				if (!snap.exists()) continue;
				const d = snap.data() as {
					startDato?: { toMillis?: () => number; seconds?: number };
					antalDage?: number;
					type?: 'kickstart' | 'kropsro';
					adgangsNiveau?: 'basis' | 'premium';
					byggetForlob?: boolean;
					produktNoegle?: string;
				};
				const startMs = d.startDato?.toMillis?.() ?? (d.startDato?.seconds ?? 0) * 1000;
				const felter = forlobAdgangFelter({
					type: d.type,
					adgangsNiveau: d.adgangsNiveau,
					byggetForlob: d.byggetForlob,
					produktNoegle: d.produktNoegle
				});
				vinduer.push({
					id: fid,
					startMs,
					slutMs: forlobSlutMs(startMs, d.antalDage ?? 0),
					accessLevel: felter.accessLevel,
					activeProduct: felter.activeProduct
				});
			} catch (e) {
				console.warn('Kunne ikke hente forløb til adgangs-resolver:', fid, e);
			}
		}
		const abo = {
			slutterAt: (opdateringer.aboSlutterAt as number | undefined) ?? current.aboSlutterAt,
			produkt: (opdateringer.aboProdukt as string | undefined) ?? current.aboProdukt,
			accessLevel:
				(opdateringer.aboAccessLevel as 'basis' | 'premium' | undefined) ?? current.aboAccessLevel
		};
		const res = resolverAktuelAdgang(Date.now(), vinduer, abo);
		if (res.state === 'forlobskunde') {
			opdateringer.accessSource = 'forløb';
			opdateringer.activeProduct = res.activeProduct;
			opdateringer.accessLevel = res.accessLevel;
			opdateringer.activeSubscription = false;
			if (res.expiresAt !== undefined) opdateringer.expiresAt = res.expiresAt;
		} else if (res.state === 'modulbruger') {
			opdateringer.accessSource = 'abonnement';
			opdateringer.activeProduct = res.activeProduct;
			opdateringer.accessLevel = res.accessLevel;
			opdateringer.activeSubscription = true;
			if (res.expiresAt !== undefined) opdateringer.expiresAt = res.expiresAt;
		}
		// res.state === 'udlobet': ingen override — behold eksisterende felter + bonus.
	} catch (e) {
		console.warn('Adgangs-resolver fejlede, beholder eksisterende felter:', e);
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
