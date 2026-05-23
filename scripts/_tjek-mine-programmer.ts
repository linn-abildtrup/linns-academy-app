// Lister mine egne programmer for at se om dage-feltet er gemt
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
	// Find Linns admin-bruger
	const arg = process.argv[2] ?? 'linnabildtrup00@gmail.com';
	const u = await db.collection('users').where('email', '==', arg).limit(1).get();
	if (u.empty) {
		console.log('Ingen admin-bruger.');
		return;
	}
	const uid = u.docs[0].id;
	console.log(`Admin uid: ${uid}\n`);

	const snap = await db.collection('users').doc(uid).collection('mineProgrammer').get();
	console.log(`${snap.size} programmer:\n`);
	for (const d of snap.docs) {
		const data = d.data();
		console.log(`---  ${d.id}  ---`);
		console.log(`navn: ${data.navn}`);
		console.log(`oevelser.length: ${(data.oevelser ?? []).length}`);
		console.log(`dage: ${data.dage ? `${data.dage.length} dage` : 'INGEN'}`);
		if (data.dage && data.dage.length > 0) {
			console.log(`  dag 1 har ${data.dage[0].oevelser.length} øvelser`);
		}
		console.log(`config: ${data.config ? 'JA' : 'NEJ'}`);
		console.log('');
	}
}
main().then(() => process.exit(0));
