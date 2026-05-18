// Engangs: giv Maria (forlob@linnsacademy.dk) basis-app-adgang så hun kan
// bruges som test-kunde for basis-app-flowet.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const EMAIL = 'forlob@linnsacademy.dk';
const APPLY = process.argv.includes('--apply');

console.log(APPLY ? '=== APPLY ===\n' : '=== DRY-RUN ===\n');

const opdatering = {
	accessLevel: 'basis',
	accessSource: 'abonnement',
	activeProduct: 'basisabo',
	activeSubscription: true,
	state: 'modulbruger',
	expiresAt: null,
	updatedAt: Date.now()
};

console.log(`Opdatering der vil blive skrevet:`);
console.log(opdatering);
console.log();

// 1. allowedEmails
const allowedRef = db.collection('allowedEmails').doc(EMAIL);
const allowedSnap = await allowedRef.get();
if (allowedSnap.exists) {
	console.log(`allowedEmails/${EMAIL} findes — opdaterer`);
	if (APPLY) await allowedRef.set(opdatering, { merge: true });
} else {
	console.log(`allowedEmails/${EMAIL} findes IKKE — opretter med email-feltet`);
	if (APPLY) await allowedRef.set({ email: EMAIL, ...opdatering });
}

// 2. users (slå op via email)
const usersSnap = await db.collection('users').where('email', '==', EMAIL).get();
if (usersSnap.empty) {
	console.log(`users-doc for ${EMAIL}: ingen fundet (Maria har ikke logget ind?)`);
} else {
	for (const d of usersSnap.docs) {
		console.log(`users/${d.id}: opdaterer`);
		if (APPLY) await d.ref.set(opdatering, { merge: true });
	}
}

if (!APPLY) console.log('\nKør med --apply for at skrive.');
else console.log('\nFærdig. Maria er nu basis-app-bruger.');
