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
	const arg = process.argv[2] ?? 'premium_app@linnsacademy.dk';
	const snap = await db.collection('users').where('email', '==', arg).limit(1).get();
	if (snap.empty) {
		console.log(`Ingen userDoc med email ${arg}`);
		return;
	}
	const d = snap.docs[0];
	const data = d.data();
	console.log(`userDoc: ${d.ref.path}`);
	console.log(`uid: ${d.id}`);
	console.log(`email: ${data.email}`);
	console.log(`firstName: ${data.firstName}`);
	console.log(`state: ${data.state}`);
	console.log(`accessLevel: ${data.accessLevel}`);
	console.log(`accessSource: ${data.accessSource}`);
	console.log(`activeProduct: ${data.activeProduct}`);
	console.log(`forlobIds: ${JSON.stringify(data.forlobIds ?? [])}`);
	console.log(`bonusPeriodEndsAt: ${data.bonusPeriodEndsAt ?? '(ingen)'}`);
}
main().then(() => process.exit(0));
