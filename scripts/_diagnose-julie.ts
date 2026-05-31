import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const EMAIL = 'julieaaen76@gmail.com';

(async () => {
	console.log(`Diagnose: ${EMAIL}\n`);

	const a = await db.collection('allowedEmails').doc(EMAIL).get();
	if (a.exists) {
		const d = a.data() ?? {};
		console.log('=== allowedEmails ===');
		console.log(`  forlobId: ${d.forlobId}`);
		console.log(`  accessLevel: ${d.accessLevel}`);
		console.log(`  activeProduct: ${d.activeProduct}`);
		console.log(`  status: ${d.status}`);
		console.log(`  oprettet: ${d.oprettet ? new Date(d.oprettet._seconds * 1000).toISOString().slice(0, 10) : '—'}`);
	}

	const u = await db.collection('users').where('email', '==', EMAIL).get();
	for (const d of u.docs) {
		const ud = d.data();
		console.log('\n=== userDoc ===');
		console.log(`  uid: ${d.id}`);
		console.log(`  firstName: ${ud.firstName}`);
		console.log(`  forlobIds: ${JSON.stringify(ud.forlobIds)}`);
		console.log(`  activeProduct: ${ud.activeProduct}`);
		console.log(`  accessLevel: ${ud.accessLevel}`);
		console.log(`  expiresAt: ${ud.expiresAt ? new Date(ud.expiresAt).toISOString().slice(0, 10) : '—'}`);
		console.log(`  bonusPeriodEndsAt: ${ud.bonusPeriodEndsAt ? new Date(ud.bonusPeriodEndsAt).toISOString().slice(0, 10) : '—'}`);

		// Tjek subcollections
		const subs = ['maaltider', 'mrs_scores', 'traeningHistorik', 'mineProgrammer', 'privateOpskrifter'];
		console.log('\n  Data-subcollections:');
		for (const s of subs) {
			const snap = await db.collection(`users/${d.id}/${s}`).get();
			if (snap.size > 0) console.log(`    ${s}: ${snap.size} docs`);
		}
		const productsSnap = await db.collection(`users/${d.id}/products`).get();
		if (productsSnap.size > 0) console.log(`    products: ${productsSnap.size} docs`);
	}
	process.exit(0);
})();
