// Reset-script til mikrotræning for en testbruger
// Bruges når man vil teste onboarding-flowet eller starte forfra på et program.
//
// Fjerner programValg.mikrotraening og nulstiller fremgang.mikrotraening
// på userProducts/kickstart, og sletter alle pause-docs for brugeren.
//
// Kør med: npm run reset:mikrotraening -- <uid>
//   eller: npm run reset:mikrotraening (defaulter til Marias UID)

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(
	readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8')
);

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const MARIA_UID = 'NxqDU9r5VJhDSNP1PnFa5UimntC2';

async function reset(uid: string) {
	console.log(`🔄 Nulstiller mikrotræning for bruger ${uid}...`);

	const productRef = db.collection('users').doc(uid).collection('products').doc('kickstart');
	const productSnap = await productRef.get();

	if (!productSnap.exists) {
		console.error(`❌ Brugeren har ikke et kickstart-produkt — intet at nulstille.`);
		process.exit(1);
	}

	await productRef.update({
		'programValg.mikrotraening': FieldValue.delete(),
		'fremgang.mikrotraening': { gennemforte: [], feedback: {} }
	});
	console.log(`   ✓ programValg.mikrotraening fjernet`);
	console.log(`   ✓ fremgang.mikrotraening nulstillet`);

	const pausesRef = db.collection('users').doc(uid).collection('pauses');
	const pausesSnap = await pausesRef.get();
	const sletninger = await Promise.all(pausesSnap.docs.map((d) => d.ref.delete()));
	console.log(`   ✓ ${sletninger.length} pause-doc(s) slettet`);

	console.log(`\n✅ Færdig. Brugeren ser nu onboarding-flowet næste gang.`);
}

const uid = process.argv[2] ?? MARIA_UID;
reset(uid).then(() => process.exit(0));
