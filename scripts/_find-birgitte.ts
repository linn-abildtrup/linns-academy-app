import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const auth = getAdminAuth();

const EMAIL = 'birgitte.g.h@gmail.com';

(async () => {
	console.log(`Diagnose: ${EMAIL}\n`);

	const a = await db.collection('allowedEmails').doc(EMAIL).get();
	if (a.exists) {
		console.log('=== allowedEmails ===');
		console.log(JSON.stringify(a.data(), null, 2));
	} else {
		console.log('Ingen allowedEmail-doc.');
	}

	console.log('');
	try {
		const u = await auth.getUserByEmail(EMAIL);
		console.log('=== Firebase Auth ===');
		console.log(`  uid: ${u.uid}`);
		console.log(`  sidste login: ${u.metadata.lastSignInTime}`);
		console.log(`  oprettet: ${u.metadata.creationTime}`);
	} catch {
		console.log('Findes ikke i Firebase Auth.');
	}

	console.log('');
	const u = await db.collection('users').where('email', '==', EMAIL).get();
	if (u.empty) console.log('userDoc: ikke fundet');
	for (const d of u.docs) {
		const ud = d.data();
		console.log('=== userDoc ===');
		console.log(`  uid: ${d.id}`);
		console.log(`  firstName: ${ud.firstName}`);
		console.log(`  forlobIds: ${JSON.stringify(ud.forlobIds)}`);
		console.log(`  activeProduct: ${ud.activeProduct}`);
		console.log(`  accessLevel: ${ud.accessLevel}`);

		// Tjek subcollections
		const subs = ['maaltider', 'mrs_scores', 'traeningHistorik'];
		for (const s of subs) {
			const snap = await db.collection(`users/${d.id}/${s}`).get();
			if (snap.size > 0) console.log(`  ${s}: ${snap.size} docs`);
		}
		const productsSnap = await db.collection(`users/${d.id}/products`).get();
		if (productsSnap.size > 0) console.log(`  products: ${productsSnap.size} docs`);
	}
	process.exit(0);
})();
