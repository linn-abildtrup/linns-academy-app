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
	const snap = await db
		.collection('forlob')
		.doc('kropsro_maj_2026')
		.collection('mikrotraeningProgrammer')
		.get();
	console.log(`Kropsro-programmer: ${snap.size}`);
	for (const d of snap.docs) {
		const data = d.data();
		const dage = await d.ref.collection('dage').get();
		console.log(`  ${d.id}: ${data.navn ?? '?'} · antalDage=${data.antalDage ?? '?'} · aktiv=${data.aktiv} · ${dage.size} dage-doks`);
	}
}
main().then(() => process.exit(0));
