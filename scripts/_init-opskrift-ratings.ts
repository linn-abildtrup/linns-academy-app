// Initialiserer rating-felter paa alle eksisterende opskrifter.
// Idempotent — kun opskrifter der ikke allerede har felterne opdateres.
// Saetter ratingSum=0, ratingCount=0, ratingAvg=null saa klient-koden
// kan stole paa at felterne findes.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const apply = process.argv.includes('--apply');

async function main() {
	console.log(`Mode: ${apply ? 'APPLY (skriver til Firestore)' : 'DRY-RUN'}\n`);

	const snap = await db.collection('opskrifter').get();
	console.log(`Behandler ${snap.size} opskrifter\n`);

	let opdateret = 0;
	let sprunget = 0;

	for (const d of snap.docs) {
		const data = d.data();
		const harAlle =
			typeof data.ratingSum === 'number' &&
			typeof data.ratingCount === 'number' &&
			(data.ratingAvg === null || typeof data.ratingAvg === 'number');

		if (harAlle) {
			sprunget++;
			continue;
		}

		const aend: Record<string, unknown> = {};
		if (typeof data.ratingSum !== 'number') aend.ratingSum = 0;
		if (typeof data.ratingCount !== 'number') aend.ratingCount = 0;
		if (data.ratingAvg === undefined) aend.ratingAvg = null;

		if (apply) await d.ref.update(aend);
		console.log(`OK    ${data.titel ?? d.id} (${Object.keys(aend).join(', ')})`);
		opdateret++;
	}

	console.log('');
	console.log(`Opdateret: ${opdateret}`);
	console.log(`Allerede sat: ${sprunget}`);
	if (!apply && opdateret > 0) {
		console.log('\nKoer med --apply for at skrive aendringerne.');
	}
}
main().then(() => process.exit(0));
