// Firestore-helpers for forløb og whitelist.
// Holdt adskilt fra src/lib/content/forlobAdgang.ts (typer + pure logik) så
// unit tests for sidstnævnte ikke trækker firebase/firestore-runtime ind.

import {
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	onSnapshot,
	query,
	serverTimestamp,
	setDoc,
	updateDoc,
	where,
	writeBatch,
	type Timestamp
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { AllowedEmail, CsvRow, Forlob } from '$lib/content/forlobAdgang';
import { forlobAdgangFelter, forlobSlutMs, produktTypeForForlob } from '$lib/content/forlobAdgang';
import type { ForlobDag, LektionItem } from '$lib/content/forlob';
import { tomForlobDag } from '$lib/content/forlob';
import { KICKSTART_PRODUCT_ID, type ForlobProduct } from '$lib/types';

// ==============================================
// Forlob-helpers
// ==============================================

/**
 * Henter alle forløb sorteret efter oprettelse-tidspunkt (nyeste først).
 */
export async function hentAlleForlob(): Promise<Forlob[]> {
	const snap = await getDocs(collection(db, 'forlob'));
	return snap.docs
		.map((d) => ({ id: d.id, ...d.data() }) as Forlob)
		.sort((a, b) => {
			const ta = a.oprettet?.toMillis?.() ?? 0;
			const tb = b.oprettet?.toMillis?.() ?? 0;
			return tb - ta;
		});
}

// In-memory cache pr session af forløb og forløbsdage. Forløb-templates
// ændres ikke under en session, så vi cacher dem aggressivt og deler på
// tværs af alle steder der bruger dem (bibliotek, forløb-modul, admin).
const forlobCache = new Map<string, Forlob | null>();
const forlobPromises = new Map<string, Promise<Forlob | null>>();
const forlobsdageCache = new Map<string, ForlobDag[]>();
const forlobsdagePromises = new Map<string, Promise<ForlobDag[]>>();

/**
 * Henter et enkelt forløb. Returnerer null hvis det ikke findes.
 * In-memory cached pr session.
 */
export async function hentForlob(forlobId: string): Promise<Forlob | null> {
	if (forlobCache.has(forlobId)) return forlobCache.get(forlobId) ?? null;
	const aktiv = forlobPromises.get(forlobId);
	if (aktiv) return aktiv;
	const p = (async () => {
		try {
			const ref = doc(db, 'forlob', forlobId);
			const snap = await getDoc(ref);
			const v = snap.exists() ? ({ id: snap.id, ...snap.data() } as Forlob) : null;
			forlobCache.set(forlobId, v);
			return v;
		} finally {
			forlobPromises.delete(forlobId);
		}
	})();
	forlobPromises.set(forlobId, p);
	return p;
}

/**
 * Invaliderer forløb-cachen. Bruges efter admin opretter/redigerer.
 */
export function ryForlobCache(): void {
	forlobCache.clear();
	forlobPromises.clear();
	forlobsdageCache.clear();
	forlobsdagePromises.clear();
}

/**
 * Finder hvilken activeProduct den nuvaerende dato falder indenfor for en
 * bruger med flere forloebsIDs. Returnerer KROPSRO_PRODUCT_ID hvis brugeren
 * aktuelt er paa et Kropsro-forloeb, ellers KICKSTART_PRODUCT_ID. Falder
 * tilbage til Kickstart hvis intet forloeb matcher (fx hvis ingen er
 * aktive endnu).
 *
 * Bruges af mikrotraenings-siderne som ellers hardcodede Kickstart og
 * derfor ikke kunne haandtere Kropsro-kunders programValg + fremgang.
 */
export async function hentAktivProduktType(forlobIds: string[]): Promise<ForlobProduct | string> {
	if (forlobIds.length === 0) return KICKSTART_PRODUCT_ID;
	const forløbsData = await Promise.all(forlobIds.map((id) => hentForlob(id)));
	const idagMs = Date.now();
	for (const f of forløbsData) {
		if (!f) continue;
		const startMs = f.startDato.toMillis();
		// Fælles slut-beregning (+1 dag) så kunden tæller som aktiv hele sin
		// sidste dag — ikke off-by-one som den gamle inlinede formel.
		const slutMs = forlobSlutMs(startMs, f.antalDage);
		if (idagMs >= startMs && idagMs < slutMs) {
			return produktTypeForForlob(f);
		}
	}
	return KICKSTART_PRODUCT_ID;
}

/**
 * Returnerer det forløb der er AKTIVT i dag blandt kundens forlobIds (det første
 * hvor nu ligger i [start, slut)), ellers null. Samme aktiv-vindue som
 * hentAktivProduktType og forsidens indlaesForlob, men returnerer hele forløbet
 * (inkl. id) så kald kan klassificere på id-præfiks. Bruges af symptomcheck-
 * kadencen og profil-statussen så et udløbet Kickstart-id i forlobIds ikke
 * længere overruler det aktive forløb.
 */
export async function hentAktivtForlob(
	forlobIds: string[],
	now: number = Date.now()
): Promise<Forlob | null> {
	if (forlobIds.length === 0) return null;
	const forløbsData = await Promise.all(forlobIds.map((id) => hentForlob(id)));
	for (const f of forløbsData) {
		if (!f) continue;
		const startMs = f.startDato.toMillis();
		const slutMs = forlobSlutMs(startMs, f.antalDage);
		if (now >= startMs && now < slutMs) return f;
	}
	return null;
}

/**
 * Opretter eller opdaterer et forløb. Bruger setDoc med merge så eksisterende
 * felter ikke nulstilles ved partielle opdateringer.
 *
 * Forventer at oprettet-feltet er sat ved første kald — efterfølgende kald
 * skal sende oprettet=undefined for ikke at overskrive.
 */
export async function gemForlob(
	forlobId: string,
	data: Partial<Omit<Forlob, 'id'>>
): Promise<void> {
	const ref = doc(db, 'forlob', forlobId);
	await setDoc(ref, data, { merge: true });
	// VIGTIGT: ryd in-memory cache så næste hentForlob() returnerer den
	// netop gemte version, ikke den gamle. Ellers ser admin sine egne
	// ændringer rulle tilbage når hun navigerer væk og tilbage.
	forlobCache.delete(forlobId);
	forlobPromises.delete(forlobId);
}

/**
 * Opretter et helt nyt forløb med oprettet-stempel sat af serveren.
 * Fejler hvis forløbet allerede findes (vi vil ikke overskrive ved et uheld).
 */
export async function opretForlob(
	forlobId: string,
	data: Omit<Forlob, 'id' | 'oprettet'>
): Promise<void> {
	const ref = doc(db, 'forlob', forlobId);
	const findes = await getDoc(ref);
	if (findes.exists()) {
		throw new Error(`Forløbet '${forlobId}' findes allerede.`);
	}
	await setDoc(ref, { ...data, oprettet: serverTimestamp() });
}

/**
 * Sletter et forløb. Sletter IKKE de tilhørende allowedEmails — det skal
 * gøres separat hvis ønsket, så historik bevares som default.
 */
export async function sletForlob(forlobId: string): Promise<void> {
	await deleteDoc(doc(db, 'forlob', forlobId));
}

/**
 * Kopierer alt indhold (vaneprogram-dage, FAQ, guides) fra et eksisterende
 * forløb til et nyt. Bruges når et nyt forløb oprettes baseret på et tidligere
 * — fx Linn laver "Kickstart august 2026" med samme spørgsmål og guides som
 * maj-forløbet.
 *
 * Items beholder deres reference til kategorierne via kategoriId, og fordi
 * vi kopierer kategorierne med deres oprindelige id (samme doc-id) bevares
 * forholdet i det nye forløb.
 *
 * Idempotent: hvis det nye forløb allerede har indhold, overskrives det.
 */
export async function kopierForlobIndhold(
	fraForlobId: string,
	tilForlobId: string
): Promise<{
	vaneprogramDage: number;
	forlobsdage: number;
	faqKategorier: number;
	faqItems: number;
	guideKategorier: number;
	guideItems: number;
	mikrotraeningProgrammer: number;
	mikrotraeningDage: number;
}> {
	const [fraVane, fraDage, fraFaqKats, fraFaqItems, fraGuideKats, fraGuideItems, fraMikroProgs] =
		await Promise.all([
			getDocs(collection(db, 'forlob', fraForlobId, 'vaneprogram')),
			getDocs(collection(db, 'forlob', fraForlobId, 'forlobsdage')),
			getDocs(collection(db, 'forlob', fraForlobId, 'faqKategorier')),
			getDocs(collection(db, 'forlob', fraForlobId, 'faqItems')),
			getDocs(collection(db, 'forlob', fraForlobId, 'guideKategorier')),
			getDocs(collection(db, 'forlob', fraForlobId, 'guideItems')),
			getDocs(collection(db, 'forlob', fraForlobId, 'mikrotraeningProgrammer'))
		]);

	// Hent dage for hvert mikrotræningsprogram parallelt så vi kan kopiere
	// både program-dokument og subcollection days/{dagId} i samme batch.
	const mikroDageSnaps = await Promise.all(
		fraMikroProgs.docs.map((p) =>
			getDocs(collection(db, 'forlob', fraForlobId, 'mikrotraeningProgrammer', p.id, 'days'))
		)
	);
	let mikroDageTotal = 0;

	const batch = writeBatch(db);
	for (const d of fraVane.docs) {
		batch.set(doc(db, 'forlob', tilForlobId, 'vaneprogram', d.id), d.data());
	}
	for (const d of fraDage.docs) {
		batch.set(doc(db, 'forlob', tilForlobId, 'forlobsdage', d.id), d.data());
	}
	for (const d of fraFaqKats.docs) {
		batch.set(doc(db, 'forlob', tilForlobId, 'faqKategorier', d.id), d.data());
	}
	for (const d of fraFaqItems.docs) {
		batch.set(doc(db, 'forlob', tilForlobId, 'faqItems', d.id), d.data());
	}
	for (const d of fraGuideKats.docs) {
		batch.set(doc(db, 'forlob', tilForlobId, 'guideKategorier', d.id), d.data());
	}
	for (const d of fraGuideItems.docs) {
		batch.set(doc(db, 'forlob', tilForlobId, 'guideItems', d.id), d.data());
	}
	for (let i = 0; i < fraMikroProgs.docs.length; i++) {
		const p = fraMikroProgs.docs[i];
		batch.set(doc(db, 'forlob', tilForlobId, 'mikrotraeningProgrammer', p.id), p.data());
		const dageSnap = mikroDageSnaps[i];
		mikroDageTotal += dageSnap.size;
		for (const d of dageSnap.docs) {
			batch.set(
				doc(db, 'forlob', tilForlobId, 'mikrotraeningProgrammer', p.id, 'days', d.id),
				d.data()
			);
		}
	}
	await batch.commit();

	return {
		vaneprogramDage: fraVane.size,
		forlobsdage: fraDage.size,
		faqKategorier: fraFaqKats.size,
		faqItems: fraFaqItems.size,
		guideKategorier: fraGuideKats.size,
		guideItems: fraGuideItems.size,
		mikrotraeningProgrammer: fraMikroProgs.size,
		mikrotraeningDage: mikroDageTotal
	};
}

// ==============================================
// AllowedEmail-helpers
// ==============================================

/**
 * Live-lytter paa kundens egen allowedEmail-doc. Fyrer hver gang
 * Linn aendrer hendes whitelist-entry (fx flytter hende til et nyt
 * forl0b). Bruges af +layout.svelte til automatisk re-sync uden
 * at kunden skal lukke/aabne appen.
 *
 * Returnerer en unsubscribe-funktion. Kalderen er ansvarlig for at
 * kalde den ved cleanup.
 */
export function lytTilAllowedEmail(
	email: string,
	callback: (allowed: AllowedEmail | null) => void
): () => void {
	const id = email.trim().toLowerCase();
	if (!id) return () => {};
	const ref = doc(db, 'allowedEmails', id);
	return onSnapshot(
		ref,
		(snap) => {
			if (!snap.exists()) {
				callback(null);
				return;
			}
			callback(snap.data() as AllowedEmail);
		},
		(err) => {
			console.warn('lytTilAllowedEmail fejlede:', err);
		}
	);
}

/**
 * Henter en allowedEmail-record ud fra email-adressen.
 * Returnerer null hvis emailen ikke er på nogen liste.
 * Email lower-cases før opslag for at matche document-id-konventionen.
 */
export async function hentAllowedEmail(email: string): Promise<AllowedEmail | null> {
	const id = email.trim().toLowerCase();
	if (!id) return null;
	const ref = doc(db, 'allowedEmails', id);
	const snap = await getDoc(ref);
	if (!snap.exists()) return null;
	return snap.data() as AllowedEmail;
}

/**
 * Lister alle allowedEmails for et bestemt forløb.
 */
export async function hentAllowedEmailsForForlob(forlobId: string): Promise<AllowedEmail[]> {
	const q = query(collection(db, 'allowedEmails'), where('forlobId', '==', forlobId));
	const snap = await getDocs(q);
	return snap.docs
		.map((d) => d.data() as AllowedEmail)
		.sort((a, b) => a.email.localeCompare(b.email));
}

/**
 * Henter hvilken app-build hver registreret kunde på et forløb sidst bootede
 * med. Slår userDoc op via forlobIds (array-contains) — kunder der endnu ikke
 * har oprettet konto/logget ind er ikke med. Nøglen er lowercased email så
 * den kan slås op mod allowedEmails-listen. Bruges af admin-forløbssiden til
 * at se om en kunde sidder fast på et gammelt cachet build.
 */
export async function hentAppVersionerForForlob(
	forlobId: string
): Promise<Map<string, { appVersion?: string; appVersionSetAt?: number }>> {
	const q = query(collection(db, 'users'), where('forlobIds', 'array-contains', forlobId));
	const snap = await getDocs(q);
	const map = new Map<string, { appVersion?: string; appVersionSetAt?: number }>();
	for (const d of snap.docs) {
		const data = d.data() as { email?: string; appVersion?: string; appVersionSetAt?: number };
		if (!data.email) continue;
		map.set(data.email.toLowerCase(), {
			appVersion: data.appVersion,
			appVersionSetAt: data.appVersionSetAt
		});
	}
	return map;
}

/**
 * Lister alle abonnement-allowedEmails (basis-/premium-abo).
 * Sorteret efter senest opdaterede, så nye køb står øverst.
 */
/**
 * Bygger et opslag fra email (lowercase) til "Fornavn Efternavn" ud fra hele
 * allowedEmails-collectionen. Bruges af admin-sider der kun har klientens email
 * (fx Spørgsmål) men gerne vil kunne søge på navn. Emails uden navn udelades.
 */
export async function hentNavnePerEmail(): Promise<Map<string, string>> {
	const snap = await getDocs(collection(db, 'allowedEmails'));
	const map = new Map<string, string>();
	for (const d of snap.docs) {
		const data = d.data() as AllowedEmail;
		const email = (data.email ?? d.id).toLowerCase();
		const navn = `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim();
		if (email && navn) map.set(email, navn);
	}
	return map;
}

export async function hentAbonnentAllowedEmails(): Promise<AllowedEmail[]> {
	const q = query(collection(db, 'allowedEmails'), where('accessSource', '==', 'abonnement'));
	const snap = await getDocs(q);
	return snap.docs
		.map((d) => d.data() as AllowedEmail)
		.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

/**
 * Opdaterer status='registered' og registreret-tidsstempel for en allowedEmail.
 * Bruges af login-flow når en bruger logger ind for første gang.
 */
export async function markerAllowedEmailRegistreret(email: string): Promise<void> {
	const id = email.trim().toLowerCase();
	if (!id) return;
	const ref = doc(db, 'allowedEmails', id);
	await updateDoc(ref, {
		status: 'registered',
		registreret: serverTimestamp()
	});
}

export interface ImportResultat {
	tilfoejet: number;
	opdateret: number;
	uaendret: number;
	fejl: number;
}

/**
 * Returnerer de adgangs-felter en allowedEmail SKAL have for et givet
 * forl0b. Slaar forl0bets type op og udleder activeProduct, accessLevel,
 * accessSource og activeSubscription. Bruges af baade CSV-import og
 * single-add saa alle nye kunder faar konsistente felter.
 *
 * - Kropsro (type='kropsro')  → premium-niveau
 * - Kickstart (default)       → basis-niveau
 */
async function adgangsFelterForForlob(forlobId: string): Promise<{
	activeProduct: string;
	accessLevel: 'premium' | 'basis';
	accessSource: 'forløb';
	activeSubscription: false;
}> {
	const fSnap = await getDoc(doc(db, 'forlob', forlobId));
	if (!fSnap.exists()) {
		// Bug #4 fra A-Z-review: f0r returnerede vi stille en basis-default
		// hvis forl0bet ikke fandtes. CSV-import med typo i forl0bId
		// importerede dermed alle kunder med basis-adgang uden fejl-besked.
		// Nu kaster vi i stedet — kalderen skal vise en tydelig besked.
		throw new Error(
			`Forløbet "${forlobId}" findes ikke. Tjek stavning af forløbs-id. Ingen kunder er importeret.`
		);
	}
	const data = fSnap.data() as {
		type?: 'kickstart' | 'kropsro';
		adgangsNiveau?: 'basis' | 'premium';
		byggetForlob?: boolean;
		produktNoegle?: string;
	};
	// Eneste sandhedskilde for niveau + data-skuffe (deles med /koeb-webhooken).
	return forlobAdgangFelter(data);
}

/**
 * Skriver en batch af CSV-rækker til allowedEmails. Idempotent:
 * - Nye emails oprettes med status='invited'
 * - Eksisterende emails får navn og forløb opdateret hvis det er ændret
 * - Allerede registrerede emails beholder deres status
 *
 * Adgangs-felter (activeProduct, accessLevel osv) udledes fra forl0bets
 * type via adgangsFelterForForlob saa nye kunder automatisk faar korrekt
 * premium/basis-niveau. Eksisterende kunder faar OGSAA felterne opdateret
 * hvis de mangler eller er forkerte for det nye forl0b (oprydning).
 *
 * Firestore har en grænse på 500 ops pr batch — vi splitter op i 400-chunks
 * for at have margen.
 */
export async function gemAllowedEmailsBatch(
	rows: CsvRow[],
	forlobId: string
): Promise<ImportResultat> {
	const resultat: ImportResultat = { tilfoejet: 0, opdateret: 0, uaendret: 0, fejl: 0 };
	const eksisterende = new Map<string, AllowedEmail>();

	const adgangsFelter = await adgangsFelterForForlob(forlobId);

	const eksSnap = await getDocs(collection(db, 'allowedEmails'));
	for (const d of eksSnap.docs) {
		eksisterende.set(d.id, d.data() as AllowedEmail);
	}

	const batchSize = 400;
	for (let start = 0; start < rows.length; start += batchSize) {
		const batch = writeBatch(db);
		const chunk = rows.slice(start, start + batchSize);

		for (const row of chunk) {
			const id = row.email.trim().toLowerCase();
			if (!id) {
				resultat.fejl++;
				continue;
			}
			const ref = doc(db, 'allowedEmails', id);
			const eks = eksisterende.get(id);

			if (!eks) {
				batch.set(ref, {
					email: id,
					firstName: row.firstName,
					lastName: row.lastName,
					forlobId,
					...adgangsFelter,
					status: 'invited' as const,
					oprettet: serverTimestamp() as unknown as Timestamp
				});
				resultat.tilfoejet++;
			} else {
				const ingenAendring =
					eks.firstName === row.firstName &&
					eks.lastName === row.lastName &&
					eks.forlobId === forlobId &&
					eks.activeProduct === adgangsFelter.activeProduct &&
					eks.accessLevel === adgangsFelter.accessLevel &&
					eks.accessSource === adgangsFelter.accessSource &&
					eks.activeSubscription === adgangsFelter.activeSubscription;
				if (ingenAendring) {
					resultat.uaendret++;
				} else {
					batch.update(ref, {
						firstName: row.firstName,
						lastName: row.lastName,
						forlobId,
						...adgangsFelter
					});
					resultat.opdateret++;
				}
			}
		}

		try {
			await batch.commit();
		} catch (e) {
			console.error('Batch-commit fejlede:', e);
			resultat.fejl += chunk.length;
		}
	}

	return resultat;
}

/**
 * Tilfoejer en enkelt kunde til et forl0b. Returnerer info om hvad der skete
 * — 'tilfoejet' for ny, 'opdateret' hvis allerede eksisterende. Bruger samme
 * adgangs-felter-logik som batch-import.
 */
export async function tilfoejEnKunde(
	forlobId: string,
	email: string,
	firstName: string,
	lastName: string
): Promise<{ status: 'tilfoejet' | 'opdateret'; email: string }> {
	const id = email.trim().toLowerCase();
	if (!id || !id.includes('@')) {
		throw new Error('Ugyldig email');
	}
	const adgangsFelter = await adgangsFelterForForlob(forlobId);
	const ref = doc(db, 'allowedEmails', id);
	const eks = await getDoc(ref);
	if (eks.exists()) {
		await updateDoc(ref, {
			firstName: firstName.trim(),
			lastName: lastName.trim(),
			forlobId,
			...adgangsFelter
		});
		return { status: 'opdateret', email: id };
	}
	await setDoc(ref, {
		email: id,
		firstName: firstName.trim(),
		lastName: lastName.trim(),
		forlobId,
		...adgangsFelter,
		status: 'invited' as const,
		oprettet: serverTimestamp()
	});
	return { status: 'tilfoejet', email: id };
}

// ==============================================
// Forløbsdage (lektioner + note pr dagNummer)
// ==============================================

/**
 * Henter alle forløbsdage for et forløb sorteret efter dagNummer.
 * In-memory cached pr session — forløbsdage ændres kun via admin.
 */
export async function hentForlobsdage(forlobId: string): Promise<ForlobDag[]> {
	const cached = forlobsdageCache.get(forlobId);
	if (cached) return cached;
	const aktiv = forlobsdagePromises.get(forlobId);
	if (aktiv) return aktiv;
	const p = (async () => {
		try {
			const snap = await getDocs(collection(db, 'forlob', forlobId, 'forlobsdage'));
			const dage = snap.docs
				.map((d) => d.data() as ForlobDag)
				.sort((a, b) => a.dagNummer - b.dagNummer);
			forlobsdageCache.set(forlobId, dage);
			return dage;
		} finally {
			forlobsdagePromises.delete(forlobId);
		}
	})();
	forlobsdagePromises.set(forlobId, p);
	return p;
}

/**
 * Henter én specifik forløbsdag. Returnerer null hvis dagen ikke er gemt
 * endnu — kalderen kan så bruge tomForlobDag() til at få en tom skabelon.
 */
export async function hentForlobsdag(
	forlobId: string,
	dagNummer: number
): Promise<ForlobDag | null> {
	const ref = doc(db, 'forlob', forlobId, 'forlobsdage', `dag${dagNummer}`);
	const snap = await getDoc(ref);
	if (!snap.exists()) return null;
	return snap.data() as ForlobDag;
}

/**
 * Gemmer en forløbsdag. Dokument-id er 'dag${dagNummer}' så kopiering
 * mellem forløb kan bevare reference.
 */
export async function gemForlobsdag(forlobId: string, dag: ForlobDag): Promise<void> {
	const id = `dag${dag.dagNummer}`;
	const ref = doc(db, 'forlob', forlobId, 'forlobsdage', id);
	await setDoc(ref, dag);
}

/**
 * Sletter en forløbsdag (typisk hvis Linn beslutter at en dag ikke skal
 * have lektioner overhovedet — eller før hun gemmer en helt ny version).
 */
export async function sletForlobsdag(forlobId: string, dagNummer: number): Promise<void> {
	await deleteDoc(doc(db, 'forlob', forlobId, 'forlobsdage', `dag${dagNummer}`));
}

// ==============================================
// Gruppe-operationer for lektioner og noter
// ==============================================

/**
 * Genererer en ny grupperingId. Bruges naar Linn vaelger flere dage at vise
 * en lektion eller note paa.
 */
function nyGrupperingId(): string {
	return typeof crypto !== 'undefined' && crypto.randomUUID
		? crypto.randomUUID()
		: 'g-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

async function hentEksisterendeOgTomDage(
	forlobId: string,
	dageNumre: number[]
): Promise<Map<number, ForlobDag>> {
	const ud = new Map<number, ForlobDag>();
	for (const n of dageNumre) {
		const eks = await hentForlobsdag(forlobId, n);
		ud.set(n, eks ?? tomForlobDag(n));
	}
	return ud;
}

/**
 * Tilfoejer/opdaterer en lektion paa de valgte dage. Lektionen kopieres til
 * hver dag som en selvstaendig forekomst med samme grupperingId, saa de kan
 * opdateres samlet via opdaterLektionGruppe().
 *
 * - Hvis lektion allerede har en grupperingId, bruges den. Ellers genereres en ny.
 * - Hvis en dag allerede har en lektion fra samme gruppe, opdateres den i
 *   stedet for at oprette en duplikat.
 */
export async function gemLektionPaaDage(
	forlobId: string,
	lektionFelter: Omit<LektionItem, 'id'>,
	dageNumre: number[],
	eksisterendeGrupperingId?: string
): Promise<{ grupperingId: string }> {
	const grupperingId = eksisterendeGrupperingId ?? nyGrupperingId();
	const dage = await hentEksisterendeOgTomDage(forlobId, dageNumre);

	for (const [_, dag] of dage) {
		const eksisterendeIdx = dag.lektioner.findIndex((l) => l.grupperingId === grupperingId);
		const data = { ...lektionFelter, grupperingId };
		if (eksisterendeIdx >= 0) {
			dag.lektioner[eksisterendeIdx] = {
				...data,
				id: dag.lektioner[eksisterendeIdx].id
			};
		} else {
			dag.lektioner.push({
				...data,
				id:
					typeof crypto !== 'undefined' && crypto.randomUUID
						? crypto.randomUUID()
						: 'l-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
			});
		}
		await gemForlobsdag(forlobId, dag);
	}

	ryForlobCache();
	return { grupperingId };
}

/**
 * Propagerer aendringer til alle dage med samme grupperingId — bruges naar
 * Linn vaelger 'Ret alle' efter at have aendret en grupperet lektion.
 * Beholder lektionens eksisterende id pr dag (hver dag har sin egen).
 */
export async function opdaterLektionGruppe(
	forlobId: string,
	grupperingId: string,
	nyeFelter: Omit<LektionItem, 'id' | 'grupperingId'>
): Promise<void> {
	const alleDage = await hentForlobsdage(forlobId);
	for (const dag of alleDage) {
		const idx = dag.lektioner.findIndex((l) => l.grupperingId === grupperingId);
		if (idx < 0) continue;
		const nu: ForlobDag = {
			...dag,
			lektioner: dag.lektioner.map((l, i) =>
				i === idx ? { ...nyeFelter, id: l.id, grupperingId } : l
			)
		};
		await gemForlobsdag(forlobId, nu);
	}
	ryForlobCache();
}

/**
 * Sletter alle lektioner med en given grupperingId fra alle dage. Bruges
 * naar Linn vaelger 'Slet alle' i slet-dialog.
 */
export async function sletLektionGruppe(forlobId: string, grupperingId: string): Promise<void> {
	const alleDage = await hentForlobsdage(forlobId);
	for (const dag of alleDage) {
		const harDen = dag.lektioner.some((l) => l.grupperingId === grupperingId);
		if (!harDen) continue;
		const nu: ForlobDag = {
			...dag,
			lektioner: dag.lektioner.filter((l) => l.grupperingId !== grupperingId)
		};
		await gemForlobsdag(forlobId, nu);
	}
	ryForlobCache();
}

/**
 * Returnerer listen af dagNumre hvor en given lektion-gruppe ligger.
 * Bruges til at vise 'Denne lektion ligger paa dage 3, 5, 7'-tooltip.
 */
export async function findDageMedLektionGruppe(
	forlobId: string,
	grupperingId: string
): Promise<number[]> {
	const alleDage = await hentForlobsdage(forlobId);
	return alleDage
		.filter((d) => d.lektioner.some((l) => l.grupperingId === grupperingId))
		.map((d) => d.dagNummer)
		.sort((a, b) => a - b);
}

/**
 * Tilfoejer/opdaterer note-fra-Linn paa de valgte dage med faelles
 * noteGrupperingId. Note overskriver eksisterende note paa hver valgt dag.
 */
export async function gemNotePaaDage(
	forlobId: string,
	noteFraLinn: string,
	dageNumre: number[],
	eksisterendeGrupperingId?: string
): Promise<{ noteGrupperingId: string }> {
	const noteGrupperingId = eksisterendeGrupperingId ?? nyGrupperingId();
	const dage = await hentEksisterendeOgTomDage(forlobId, dageNumre);
	for (const [_, dag] of dage) {
		await gemForlobsdag(forlobId, { ...dag, noteFraLinn, noteGrupperingId });
	}
	ryForlobCache();
	return { noteGrupperingId };
}

/**
 * Propagerer note-aendring til alle dage med samme noteGrupperingId.
 */
export async function opdaterNoteGruppe(
	forlobId: string,
	noteGrupperingId: string,
	nyTekst: string
): Promise<void> {
	const alleDage = await hentForlobsdage(forlobId);
	for (const dag of alleDage) {
		if (dag.noteGrupperingId !== noteGrupperingId) continue;
		await gemForlobsdag(forlobId, { ...dag, noteFraLinn: nyTekst });
	}
	ryForlobCache();
}

/**
 * Sletter (saetter til tom) noter med en given noteGrupperingId paa alle dage.
 */
export async function sletNoteGruppe(forlobId: string, noteGrupperingId: string): Promise<void> {
	const alleDage = await hentForlobsdage(forlobId);
	for (const dag of alleDage) {
		if (dag.noteGrupperingId !== noteGrupperingId) continue;
		await gemForlobsdag(forlobId, { ...dag, noteFraLinn: '', noteGrupperingId: undefined });
	}
	ryForlobCache();
}

/**
 * Returnerer listen af dagNumre hvor en given note-gruppe ligger.
 */
export async function findDageMedNoteGruppe(
	forlobId: string,
	noteGrupperingId: string
): Promise<number[]> {
	const alleDage = await hentForlobsdage(forlobId);
	return alleDage
		.filter((d) => d.noteGrupperingId === noteGrupperingId)
		.map((d) => d.dagNummer)
		.sort((a, b) => a - b);
}
