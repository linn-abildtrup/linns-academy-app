import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const SPOERGSMAAL_ID = 'Lu3wEcvb5RVPGCkYTFxG';
const NYT_FORLOB_ID = 'kropsro_maj_2026';

async function main() {
	const f = await db.collection('forlob').doc(NYT_FORLOB_ID).get();
	const navn = f.data()?.navn;
	if (!navn) {
		console.error('Kropsro-forloeb ikke fundet');
		process.exit(1);
	}

	await db.collection('klientspoergsmaal').doc(SPOERGSMAAL_ID).update({
		forlobId: NYT_FORLOB_ID,
		forlobNavn: navn
	});

	console.log(`Flyttet spoergsmaal ${SPOERGSMAAL_ID} til ${NYT_FORLOB_ID} (${navn})`);
}
main().then(() => process.exit(0));
