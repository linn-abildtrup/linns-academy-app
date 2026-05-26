// Nulstiller programValg.mikrotraening + aktivtTraeningsprogram for
// emmajuhler@yahoo.dk saa hun ser onboarding-modal naest gang hun
// aabner mikrotraening. Hendes tidligere programValg pegede paa et
// ugyldigt 'test'-program.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

async function main() {
	const uSnap = await db.collection('users').where('email', '==', 'emmajuhler@yahoo.dk').limit(1).get();
	if (uSnap.empty) {
		console.error('Bruger ikke fundet');
		return;
	}
	const uDoc = uSnap.docs[0];

	// 1. Nulstil userProduct.programValg.mikrotraening
	const pRef = uDoc.ref.collection('products').doc('premiumforløb');
	await pRef.update({ 'programValg.mikrotraening': FieldValue.delete() });
	console.log('Slettet programValg.mikrotraening fra users/{uid}/products/premiumforloeb');

	// 2. Nulstil aktivtTraeningsprogram paa userDoc
	const u = uDoc.data();
	if (u.aktivtTraeningsprogram?.programId === 'test') {
		await uDoc.ref.update({ aktivtTraeningsprogram: FieldValue.delete() });
		console.log('Slettet userDoc.aktivtTraeningsprogram');
	} else {
		console.log('userDoc.aktivtTraeningsprogram er ikke "test" — ikke rørt');
	}
	console.log('\nEmma vil nu se onboarding-modalen ved næste mikrotraening-besøg.');
}
main().then(() => process.exit(0));
