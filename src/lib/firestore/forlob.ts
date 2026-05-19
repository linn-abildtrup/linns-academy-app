// Firestore-helpers for forløb og whitelist.
// Holdt adskilt fra src/lib/content/forlobAdgang.ts (typer + pure logik) så
// unit tests for sidstnævnte ikke trækker firebase/firestore-runtime ind.

import {
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	query,
	serverTimestamp,
	setDoc,
	updateDoc,
	where,
	writeBatch,
	type Timestamp
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type {
	AllowedEmail,
	CsvRow,
	Forlob
} from '$lib/content/forlobAdgang';
import type { ForlobDag } from '$lib/content/forlob';

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
	const [
		fraVane,
		fraDage,
		fraFaqKats,
		fraFaqItems,
		fraGuideKats,
		fraGuideItems,
		fraMikroProgs
	] = await Promise.all([
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
			getDocs(
				collection(
					db,
					'forlob',
					fraForlobId,
					'mikrotraeningProgrammer',
					p.id,
					'days'
				)
			)
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
		batch.set(
			doc(db, 'forlob', tilForlobId, 'mikrotraeningProgrammer', p.id),
			p.data()
		);
		const dageSnap = mikroDageSnaps[i];
		mikroDageTotal += dageSnap.size;
		for (const d of dageSnap.docs) {
			batch.set(
				doc(
					db,
					'forlob',
					tilForlobId,
					'mikrotraeningProgrammer',
					p.id,
					'days',
					d.id
				),
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
 * Lister alle abonnement-allowedEmails (basis-/premium-abo).
 * Sorteret efter senest opdaterede, så nye køb står øverst.
 */
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
 * Skriver en batch af CSV-rækker til allowedEmails. Idempotent:
 * - Nye emails oprettes med status='invited'
 * - Eksisterende emails får navn og forløb opdateret hvis det er ændret
 * - Allerede registrerede emails beholder deres status
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
					status: 'invited' as const,
					oprettet: serverTimestamp() as unknown as Timestamp
				});
				resultat.tilfoejet++;
			} else {
				const ingenAendring =
					eks.firstName === row.firstName &&
					eks.lastName === row.lastName &&
					eks.forlobId === forlobId;
				if (ingenAendring) {
					resultat.uaendret++;
				} else {
					batch.update(ref, {
						firstName: row.firstName,
						lastName: row.lastName,
						forlobId
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
