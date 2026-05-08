// Engangs-helper: opdater startDato på et forløb.
// Bruges efter migration af lektioner hvis startDatoen er forkert sat.
//
// Kør med: npx tsx scripts/_set-forlob-startdato.ts <forlobId> <YYYY-MM-DD>

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const forlobId = process.argv[2];
const datoStr = process.argv[3];

if (!forlobId || !datoStr) {
	console.error('Brug: npx tsx scripts/_set-forlob-startdato.ts <forlobId> <YYYY-MM-DD>');
	process.exit(1);
}

const path = join(__dirname, 'service-account-key.json');
if (!existsSync(path)) {
	console.error('❌ Mangler service-account-key.json');
	process.exit(1);
}
const sa = JSON.parse(readFileSync(path, 'utf-8'));
const app = initializeApp({ credential: cert(sa) });
const db = getFirestore(app);

const startDato = new Date(datoStr + 'T06:00:00');
if (isNaN(startDato.getTime())) {
	console.error('❌ Ugyldig dato:', datoStr);
	process.exit(1);
}

(async () => {
	const ref = db.collection('forlob').doc(forlobId);
	const snap = await ref.get();
	if (!snap.exists) {
		console.error(`❌ Forløb '${forlobId}' findes ikke.`);
		process.exit(1);
	}
	await ref.update({ startDato: Timestamp.fromDate(startDato) });
	console.log(`✓ Opdateret '${forlobId}' startDato til ${datoStr}`);
	process.exit(0);
})();
