// Liste alle kunder paa Kropsro 24. maj 2026 — baade allowedEmails
// (invited/registered) og brugere der har det i forlobIds.
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

async function main() {
	console.log(`=== allowedEmails med forlobId="${FORLOB_ID}" ===`);
	const allowed = await db.collection('allowedEmails')
		.where('forlobId', '==', FORLOB_ID)
		.get();
	console.log(`Antal: ${allowed.size}\n`);
	for (const d of allowed.docs) {
		const data = d.data();
		console.log(`  email: ${data.email ?? d.id}`);
		console.log(`    navn: ${data.firstName ?? '?'} ${data.lastName ?? '?'}`);
		console.log(`    status: ${data.status ?? '?'}`);
		console.log(`    activeProduct: ${data.activeProduct ?? '?'}`);
		console.log(`    accessLevel: ${data.accessLevel ?? '?'}`);
		console.log(`    accessSource: ${data.accessSource ?? '?'}`);
		console.log('');
	}

	console.log(`=== users med forlobIds.includes("${FORLOB_ID}") ===`);
	const users = await db.collection('users')
		.where('forlobIds', 'array-contains', FORLOB_ID)
		.get();
	console.log(`Antal: ${users.size}\n`);
	for (const u of users.docs) {
		const ud = u.data();
		console.log(`  uid: ${u.id}`);
		console.log(`    email: ${ud.email ?? '?'}`);
		console.log(`    navn: ${ud.firstName ?? '?'} ${ud.lastName ?? '?'}`);
		console.log(`    accessLevel: ${ud.accessLevel ?? '?'}`);
		console.log(`    accessSource: ${ud.accessSource ?? '?'}`);
		console.log(`    activeProduct: ${ud.activeProduct ?? '?'}`);
		console.log('');
	}
}
main().then(() => process.exit(0));
