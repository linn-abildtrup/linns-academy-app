// Lille hjælpe-script til at liste eksisterende forløb.
// Kør med: npx tsx scripts/list-forlob.ts

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(
	readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8')
);

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function main() {
	const snap = await db.collection('forlob').get();
	console.log('Forløb i Firestore:\n');
	for (const d of snap.docs) {
		const data = d.data();
		const start = data.startDato?.toDate?.()?.toLocaleDateString('da-DK') ?? '?';
		console.log(`  ${d.id}`);
		console.log(`    navn: ${data.navn}`);
		console.log(`    start: ${start}`);
		console.log(`    antalDage: ${data.antalDage}`);
		console.log(`    aktiv: ${data.aktiv}`);
		console.log(`    vaneProgramId: ${data.vaneProgramId ?? 'null'}`);
		console.log('');
	}
}
main().then(() => process.exit(0));
