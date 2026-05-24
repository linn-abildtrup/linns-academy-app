import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
const sa = JSON.parse(readFileSync('/Users/linnabildtrup/Projekter/linns-academy-app/scripts/service-account-key.json', 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const u = await db.collection('users').where('email', '==', 'linnsacademy@gmail.com').limit(1).get();
const uid = u.docs[0].id;
const prods = await db.collection('users').doc(uid).collection('products').get();
for (const p of prods.docs) {
	const d = p.data();
	console.log(`  products/${p.id}: forlobId=${d.forlobId ?? 'IKKE SAT'}, koebt=${d.koebt?.toDate?.()?.toISOString?.()}`);
}
process.exit(0);
