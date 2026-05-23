// Diagnose: hvorfor ser linnsacademy@gmail.com ikke Kropsro på forsiden?
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

async function main() {
	const u = await db.collection('users').where('email', '==', 'linnsacademy@gmail.com').limit(1).get();
	const uid = u.docs[0].id;
	const ud = u.docs[0].data();
	console.log(`=== userDoc ===`);
	console.log(`accessSource: ${ud.accessSource}, activeProduct: ${ud.activeProduct}`);
	console.log(`forlobIds: ${JSON.stringify(ud.forlobIds)}`);
	console.log('');

	console.log('=== userProducts (users/{uid}/products) ===');
	const prods = await db.collection('users').doc(uid).collection('products').get();
	if (prods.empty) {
		console.log('(ingen)');
	} else {
		for (const p of prods.docs) {
			console.log(`  ${p.id}: ${JSON.stringify(p.data())}`);
		}
	}
	console.log('');

	console.log('=== Kropsro maj 2026 forlob ===');
	const k = await db.collection('forlob').doc('kropsro_maj_2026').get();
	if (k.exists) {
		const d = k.data();
		console.log(`navn: ${d?.navn}`);
		console.log(`aktiv: ${d?.aktiv}`);
		console.log(`startDato: ${d?.startDato?.toDate?.()?.toISOString?.()}`);
		console.log(`antalDage: ${d?.antalDage}`);
	} else {
		console.log('(findes ikke)');
	}
	console.log('');

	console.log('=== Forlobsdage for kropsro_maj_2026 ===');
	const dage = await db.collection('forlob').doc('kropsro_maj_2026').collection('dage').get();
	console.log(`Antal dage gemt: ${dage.size}`);
	if (dage.size > 0) {
		console.log(`Første dag (${dage.docs[0].id}):`, JSON.stringify(dage.docs[0].data()).slice(0, 200));
	}
}
main().then(() => process.exit(0));
