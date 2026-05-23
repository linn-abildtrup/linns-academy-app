// Dump alle vane-relaterede docs for en bruger så vi kan se hvor data ligger.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const email = (process.argv[2] ?? '').trim().toLowerCase();
const snap = await db.collection('users').where('email', '==', email).get();
for (const userDoc of snap.docs) {
	const uid = userDoc.id;
	console.log(`uid=${uid}\n`);

	console.log('=== aboVaneOpsaetning ===');
	const opsSnap = await userDoc.ref.collection('aboVaneOpsaetning').get();
	if (opsSnap.empty) console.log('  (ingen)');
	else for (const d of opsSnap.docs) console.log(`  ${d.id}:`, JSON.stringify(d.data()));

	console.log('\n=== aboVanedage (seneste 5) ===');
	const dageSnap = await userDoc.ref.collection('aboVanedage').orderBy('dato', 'desc').limit(5).get();
	if (dageSnap.empty) console.log('  (ingen)');
	else for (const d of dageSnap.docs) console.log(`  ${d.id}:`, JSON.stringify(d.data()));

	console.log('\n=== products/kickstart/vanedage (seneste 5) ===');
	const kvSnap = await userDoc.ref
		.collection('products')
		.doc('kickstart')
		.collection('vanedage')
		.limit(5)
		.get();
	if (kvSnap.empty) console.log('  (ingen)');
	else for (const d of kvSnap.docs) console.log(`  ${d.id}:`, JSON.stringify(d.data()).slice(0, 200));
}
