import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const uid = 'uLd5uRubf8ajCOPV5buztB3DV123';
(async () => {
	const up = await db.doc(`users/${uid}/products/premiumforløb`).get();
	const data = up.data() ?? {};
	console.log('premiumforloeb-doc:', JSON.stringify({
		productId: data.productId,
		forlobId: data.forlobId,
		startDato: data.startDato?.toDate?.().toISOString().slice(0,10),
		koebt: data.koebt?.toDate?.().toISOString().slice(0,10),
		udloberDato: data.udloberDato?.toDate?.().toISOString().slice(0,10),
		fremgang: data.fremgang
	}, null, 2));
	process.exit(0);
})();
