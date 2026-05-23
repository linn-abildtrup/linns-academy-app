// Hvad er URL'en paa kropsro dag 0 lektionen?
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
	const dage = await db.collection('forlob').doc('kropsro_maj_2026').collection('dage').get();
	console.log(`Kropsro maj 2026 — antal dage: ${dage.size}`);
	for (const d of dage.docs) {
		const data = d.data();
		console.log(`\n--- dag ${d.id} ---`);
		console.log(`dagNummer: ${data.dagNummer}, uge: ${data.uge}`);
		const lekt = data.lektioner ?? [];
		for (const l of lekt) {
			console.log(`  [${l.id}] "${l.titel}"`);
			console.log(`     url: ${l.url}`);
			console.log(`     format: ${l.format}, varighed: ${l.varighedMin} min`);
		}
	}
}
main().then(() => process.exit(0));
