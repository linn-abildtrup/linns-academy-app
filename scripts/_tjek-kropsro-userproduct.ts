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
	console.log(`=== userDoc ${uid} ===`);
	console.log(`forlobIds: ${JSON.stringify(ud.forlobIds)}`);
	console.log('');

	console.log('=== users/{uid}/products ===');
	const prods = await db.collection('users').doc(uid).collection('products').get();
	for (const p of prods.docs) {
		console.log(`  ${p.id}:`, JSON.stringify(p.data()));
	}
	console.log('');

	console.log('=== forlob/kropsro_maj_2026/mikrotraeningProgrammer ===');
	const progs = await db.collection('forlob').doc('kropsro_maj_2026').collection('mikrotraeningProgrammer').get();
	for (const pr of progs.docs) {
		const d = pr.data();
		console.log(`  ${pr.id}: navn=${d.navn}, antalDage=${d.antalDage}, aktiv=${d.aktiv}`);
		const dage = await pr.ref.collection('days').get();
		console.log(`    dage gemt: ${dage.size}`);
		for (const dd of dage.docs.slice(0, 2)) {
			const dat = dd.data();
			console.log(`    ${dd.id}: dagNummer=${dat.dagNummer}, exercises=${(dat.exercises ?? []).length}`);
		}
	}
}
main().then(() => process.exit(0));
