// Backfill: kopier abonnement-access-felter fra users/{uid} til
// allowedEmails/{email} for alle kunder der har basis/premium-abo på
// users-doc'en men mangler det på allowedEmails. Det fixer manglende
// fortegnelser i admin-tællingen forårsaget af at webhook tidligere
// kun skrev til users-doc (ikke allowedEmails) hvis users-doc fandtes.
//
// Brug:
//   npx tsx scripts/backfill-allowedemails-fra-users.ts          # dry-run
//   npx tsx scripts/backfill-allowedemails-fra-users.ts --apply

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');

const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

interface UserData {
	email?: string;
	accessLevel?: string;
	accessSource?: string;
	activeProduct?: string;
	activeSubscription?: boolean;
	simpleroCustomerId?: string;
	firstName?: string;
	lastName?: string;
	state?: string;
	expiresAt?: number;
	bonusPeriodEndsAt?: number;
}

interface AllowedEmail {
	accessLevel?: string;
	accessSource?: string;
	activeProduct?: string;
	activeSubscription?: boolean;
	simpleroCustomerId?: string;
	firstName?: string;
	lastName?: string;
	expiresAt?: number;
}

console.log(APPLY ? '=== APPLY mode ===\n' : '=== DRY-RUN ===\n');

const usersSnap = await db.collection('users').get();
let kandidater = 0;
let opdaterede = 0;
let allereadeOk = 0;

for (const userDoc of usersSnap.docs) {
	const u = userDoc.data() as UserData;
	if (!u.email) continue;
	if (u.accessSource !== 'abonnement') continue;
	if (!u.accessLevel) continue;

	kandidater++;

	const email = u.email.toLowerCase();
	const allowedRef = db.collection('allowedEmails').doc(email.replace(/\//g, '_'));
	const allowedSnap = await allowedRef.get();
	const allowed = allowedSnap.exists ? (allowedSnap.data() as AllowedEmail) : null;

	// Tjek om allowedEmails allerede har de samme felter
	const samme =
		allowed &&
		allowed.accessLevel === u.accessLevel &&
		allowed.accessSource === u.accessSource &&
		allowed.activeSubscription === u.activeSubscription &&
		allowed.activeProduct === u.activeProduct;

	if (samme) {
		allereadeOk++;
		continue;
	}

	const opdatering: Record<string, unknown> = {
		accessLevel: u.accessLevel,
		accessSource: u.accessSource,
		activeProduct: u.activeProduct,
		activeSubscription: u.activeSubscription,
		updatedAt: Date.now()
	};
	if (u.simpleroCustomerId) opdatering.simpleroCustomerId = u.simpleroCustomerId;
	if (u.firstName) opdatering.firstName = u.firstName;
	if (u.lastName) opdatering.lastName = u.lastName;
	if (u.expiresAt) opdatering.expiresAt = u.expiresAt;
	if (!allowedSnap.exists) opdatering.email = email;

	if (opdaterede < 5) {
		console.log(`  ${allowedSnap.exists ? '↻' : '＋'} ${email}`);
		console.log(
			`     fra users: accessLevel=${u.accessLevel} accessSource=${u.accessSource} activeProduct=${u.activeProduct} activeSub=${u.activeSubscription}`
		);
		if (allowed) {
			console.log(
				`     før i allowedEmails: accessLevel=${allowed.accessLevel ?? '-'} accessSource=${allowed.accessSource ?? '-'} activeSub=${allowed.activeSubscription ?? '-'}`
			);
		}
	} else if (opdaterede === 5) {
		console.log('  …');
	}

	if (APPLY) {
		await allowedRef.set(opdatering, { merge: true });
	}
	opdaterede++;
}

console.log(`\nResultat:`);
console.log(`  Kandidater (abo i users):         ${kandidater}`);
console.log(`  Allerede i sync med allowedEmails: ${allereadeOk}`);
console.log(`  ${APPLY ? 'Opdaterede' : 'Ville opdatere'}:                  ${opdaterede}`);
if (!APPLY) console.log('\nKør med --apply for at skrive.');
