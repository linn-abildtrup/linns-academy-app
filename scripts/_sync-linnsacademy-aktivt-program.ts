// Synkroniser linnsacademy@gmail.com's aktivtTraeningsprogram med
// hendes onboarding-valg (programValg.mikrotraening). Saa stopper
// inkonsistensen mellem forsiden/traening-modul (B) og profil (A).
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
	const u = await db.collection('users').where('email', '==', 'linnsacademy@gmail.com').limit(1).get();
	const uid = u.docs[0].id;

	const up = await db.collection('users').doc(uid).collection('products').doc('premiumforløb').get();
	const upData = up.data();
	const valgtProgramId = upData?.programValg?.mikrotraening;
	const forlobId = upData?.forlobId;

	if (!valgtProgramId || !forlobId) {
		console.log('Ingen programValg eller forlobId — afbryder.');
		return;
	}

	await db.collection('users').doc(uid).update({
		aktivtTraeningsprogram: {
			kilde: 'tildelt',
			programId: valgtProgramId,
			forlobId
		}
	});
	console.log(`Sat aktivtTraeningsprogram = { tildelt, ${valgtProgramId}, ${forlobId} }`);
}
main().then(() => process.exit(0));
