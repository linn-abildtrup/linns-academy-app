// Saetter indledning='' paa alle 84+84 day-docs i de to nye Kropsro-
// programmer. CSV-noterne (fx 'NY ØVELSE: Calf raise') var udviklings-
// noter til Linn, ikke noget kunden skal se.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const FORLOB_ID = 'kropsro_maj_2026';
const PROGRAMMER = ['kropsro_84_uden_kb', 'kropsro_84_med_kb'];

async function main() {
	for (const programId of PROGRAMMER) {
		const ref = db.collection('forlob').doc(FORLOB_ID).collection('mikrotraeningProgrammer').doc(programId).collection('days');
		const snap = await ref.get();
		const batch = db.batch();
		for (const d of snap.docs) {
			batch.update(d.ref, { indledning: '' });
		}
		await batch.commit();
		console.log(`${programId}: ryddet indledning paa ${snap.size} day-docs`);
	}
}
main().then(() => process.exit(0));
