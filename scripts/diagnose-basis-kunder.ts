// Diagnostik: tjek alle aktive basis-abo-kunder for data-anomalier der
// kunne forklare hvorfor nogle ikke kan komme ind i appen / biblioteket.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

interface UserData {
	email?: string;
	firstName?: string;
	accessLevel?: string;
	accessSource?: string;
	activeSubscription?: boolean;
	activeProduct?: string;
	state?: string;
	expiresAt?: number | null;
	forlobIds?: string[];
	simpleroCustomerId?: string;
}

const usersSnap = await db.collection('users').get();
const allowedSnap = await db.collection('allowedEmails').get();

const allowedByEmail = new Map<string, Record<string, unknown>>();
for (const d of allowedSnap.docs) {
	const data = d.data();
	const email = String(data.email ?? '').toLowerCase();
	if (email) allowedByEmail.set(email, data);
}

interface Issue {
	email: string;
	navn: string;
	uid: string;
	problemer: string[];
}

const issues: Issue[] = [];
let totalBasisAbo = 0;
let basisAboMedForlobIds = 0;
let basisAboUdenForlobIds = 0;
let basisAboMedExpiresAt = 0;
let stateMismatch = 0;
let userDocVsAllowedMismatch = 0;

for (const d of usersSnap.docs) {
	const u = d.data() as UserData;
	if (u.accessLevel !== 'basis') continue;
	if (u.accessSource !== 'abonnement') continue;
	if (u.activeSubscription !== true) continue;
	totalBasisAbo++;

	const problemer: string[] = [];

	// Tjek 1: state matcher access-felter
	if (u.state !== 'modulbruger') {
		problemer.push(`state='${u.state}' (forventet 'modulbruger')`);
		stateMismatch++;
	}

	// Tjek 2: forlobIds findes
	if (!u.forlobIds || u.forlobIds.length === 0) {
		problemer.push('mangler forlobIds (kan ikke se Kickstart-lektioner)');
		basisAboUdenForlobIds++;
	} else {
		basisAboMedForlobIds++;
	}

	// Tjek 3: expiresAt sat (skal være null efter fixet)
	if (u.expiresAt && u.expiresAt < Date.now()) {
		problemer.push(`expiresAt=${new Date(u.expiresAt).toISOString().slice(0, 10)} er passeret`);
		basisAboMedExpiresAt++;
	}

	// Tjek 4: allowedEmails matcher
	const email = (u.email ?? '').toLowerCase();
	const allowed = allowedByEmail.get(email);
	if (!allowed) {
		problemer.push('mangler i allowedEmails');
		userDocVsAllowedMismatch++;
	} else if (
		allowed.accessLevel !== u.accessLevel ||
		allowed.accessSource !== u.accessSource ||
		allowed.activeSubscription !== u.activeSubscription
	) {
		problemer.push(
			`allowedEmails forskelligt: accessLevel=${allowed.accessLevel ?? '-'} accessSource=${allowed.accessSource ?? '-'} activeSub=${allowed.activeSubscription ?? '-'}`
		);
		userDocVsAllowedMismatch++;
	}

	if (problemer.length > 0) {
		issues.push({
			email,
			navn: u.firstName ?? '?',
			uid: d.id,
			problemer
		});
	}
}

console.log('=== Overblik ===');
console.log(`Total aktive basis-abo: ${totalBasisAbo}`);
console.log(`  Med forlobIds:        ${basisAboMedForlobIds}`);
console.log(`  Uden forlobIds:       ${basisAboUdenForlobIds}`);
console.log(`  Med udløbet expiresAt:${basisAboMedExpiresAt}`);
console.log(`  state-mismatch:       ${stateMismatch}`);
console.log(`  users/allowed-mismatch: ${userDocVsAllowedMismatch}\n`);

if (issues.length > 0) {
	console.log(`=== ${issues.length} kunder med data-anomalier ===`);
	for (const i of issues) {
		console.log(`\n  ${i.email} (${i.navn})`);
		for (const p of i.problemer) console.log(`    ! ${p}`);
	}
} else {
	console.log('Ingen data-anomalier fundet. Problemerne er højst sandsynligt cache-side.');
}
