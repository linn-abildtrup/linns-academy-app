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
	const forlob = await db.collection('forlob').doc('kickstart_maj_2026').get();
	const d = forlob.data();
	console.log('Kickstart navn:', d?.navn, '| antalDage:', d?.antalDage);

	const dage = await forlob.ref.collection('forlobsdage').get();
	console.log(`forlobsdage: ${dage.size}`);
	const dage0_3 = dage.docs.slice(0, 4);
	for (const dd of dage0_3) {
		const data = dd.data();
		console.log(`\n--- ${dd.id} (dag ${data.dagNummer}) ---`);
		for (const l of (data.lektioner ?? [])) {
			console.log(`  [${l.format}] ${l.titel}`);
			console.log(`     ${l.url}`);
		}
	}
}
main().then(() => process.exit(0));
