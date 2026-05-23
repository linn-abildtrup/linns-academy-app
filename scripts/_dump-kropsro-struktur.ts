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
	const forlob = await db.collection('forlob').doc('kropsro_maj_2026').get();
	const d = forlob.data();
	console.log('Forlob top-level data keys:', Object.keys(d ?? {}));
	console.log('navn:', d?.navn, '| antalDage:', d?.antalDage);
	console.log('lektioner-paa-doc?', (d?.lektioner?.length ?? 0));
	console.log('dage-paa-doc?', (d?.dage?.length ?? 0));

	const subs = await forlob.ref.listCollections();
	for (const s of subs) {
		const snaps = await s.get();
		console.log(`subcollection: ${s.id} (${snaps.size} docs)`);
		for (const dd of snaps.docs.slice(0,3)) {
			console.log(`  ${dd.id}:`, JSON.stringify(dd.data()).slice(0, 500));
		}
	}
}
main().then(() => process.exit(0));
