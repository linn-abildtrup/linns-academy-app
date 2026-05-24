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
	const snap = await db.collection('klientspoergsmaal')
		.where('email', '==', 'linnsacademy@gmail.com')
		.get();
	console.log(`Antal sporgsmaal fra linnsacademy@gmail.com: ${snap.size}\n`);
	for (const d of snap.docs) {
		const data = d.data();
		const dato = data.oprettet?.toDate?.()?.toLocaleString?.('da-DK', { timeZone: 'Europe/Copenhagen' });
		console.log(`[${d.id}]`);
		console.log(`  oprettet:   ${dato}`);
		console.log(`  forlobId:   ${data.forlobId ?? '(intet)'}`);
		console.log(`  forlobNavn: ${data.forlobNavn ?? '(intet)'}`);
		console.log(`  kundeType:  ${data.kundeType ?? '(intet)'}`);
		console.log(`  status:     ${data.status}`);
		console.log(`  tekst:      "${String(data.spoergsmaal ?? '').slice(0, 80)}"`);
		console.log('');
	}

	// Hvilken bruger er linnsacademy?
	const u = await db.collection('users').where('email', '==', 'linnsacademy@gmail.com').limit(1).get();
	if (!u.empty) {
		const ud = u.docs[0].data();
		console.log('=== linnsacademy userDoc ===');
		console.log(`  activeProduct:  ${ud.activeProduct}`);
		console.log(`  accessLevel:    ${ud.accessLevel}`);
		console.log(`  accessSource:   ${ud.accessSource}`);
		console.log(`  forlobIds:      ${JSON.stringify(ud.forlobIds)}`);
	}
}
main().then(() => process.exit(0));


