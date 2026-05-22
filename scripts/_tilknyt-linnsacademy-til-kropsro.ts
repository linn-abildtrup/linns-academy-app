// Engangs-script: tilknyt linnsacademy@gmail.com til Kropsro 25. maj 2026.
//
// Opretter/opdaterer allowedEmails-entry med:
//   email: linnsacademy@gmail.com
//   forlobId: kropsro_maj_2026
//   accessLevel: 'premium'
//   accessSource: 'forløb'
//   activeProduct: 'premiumforløb'
//
// Hvis userDoc allerede findes, sættes også forlobIds (arrayUnion) +
// adgangsfelterne direkte, så ændringen får virkning ved næste sideload
// uden at vente på en login-sync.
//
// Brug:
//   npx tsx scripts/_tilknyt-linnsacademy-til-kropsro.ts          # dry-run
//   npx tsx scripts/_tilknyt-linnsacademy-til-kropsro.ts --apply

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');

const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const EMAIL = 'linnsacademy@gmail.com';
const FORLOB_ID = 'kropsro_maj_2026';

async function main() {
	console.log(APPLY ? '=== APPLY ===\n' : '=== DRY-RUN ===\n');
	console.log(`Email:    ${EMAIL}`);
	console.log(`Forløb:   ${FORLOB_ID}\n`);

	const forlobSnap = await db.collection('forlob').doc(FORLOB_ID).get();
	if (!forlobSnap.exists) {
		console.error(`! Forløb ${FORLOB_ID} findes ikke.`);
		process.exit(1);
	}
	console.log(`Forløb-navn: ${forlobSnap.data()?.navn}\n`);

	// 1) allowedEmails
	const allowedRef = db.collection('allowedEmails').doc(EMAIL);
	const allowedSnap = await allowedRef.get();
	const findesAllowed = allowedSnap.exists;
	console.log(`allowedEmails/${EMAIL}: ${findesAllowed ? 'findes' : 'ny'}`);
	if (findesAllowed) {
		console.log(`  nuværende:`, allowedSnap.data());
	}

	const allowedData: Record<string, unknown> = {
		email: EMAIL,
		forlobId: FORLOB_ID,
		accessLevel: 'premium',
		accessSource: 'forløb',
		activeProduct: 'premiumforløb',
		activeSubscription: false,
		status: findesAllowed ? allowedSnap.data()?.status ?? 'invited' : 'invited',
		updatedAt: Date.now()
	};
	if (!findesAllowed) {
		allowedData.oprettet = FieldValue.serverTimestamp();
	}

	if (APPLY) {
		await allowedRef.set(allowedData, { merge: true });
		console.log(`  ✓ allowedEmails opdateret`);
	} else {
		console.log(`  vil sætte:`, allowedData);
	}

	// 2) Find userDoc hvis den findes
	const userSnap = await db.collection('users').where('email', '==', EMAIL).limit(1).get();
	if (userSnap.empty) {
		console.log(`\nuserDoc: ingen — emailen får adgangen ved næste login.`);
	} else {
		const userRef = userSnap.docs[0].ref;
		const userData = userSnap.docs[0].data();
		console.log(`\nuserDoc: ${userRef.path}`);
		console.log(`  nuværende forlobIds:`, userData.forlobIds ?? []);
		console.log(`  nuværende accessLevel: ${userData.accessLevel}`);

		const userUpdate: Record<string, unknown> = {
			forlobIds: FieldValue.arrayUnion(FORLOB_ID),
			accessLevel: 'premium',
			accessSource: 'forløb',
			activeProduct: 'premiumforløb',
			updatedAt: Date.now()
		};

		if (APPLY) {
			await userRef.update(userUpdate);
			console.log(`  ✓ userDoc opdateret`);
		} else {
			console.log(`  vil sætte:`, userUpdate);
		}
	}

	console.log(`\n${APPLY ? '✅ Færdig.' : '(dry-run — kør med --apply for at gemme)'}`);
}

main().then(() => process.exit(0));
