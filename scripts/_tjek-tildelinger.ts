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
	const ud = u.docs[0].data();
	console.log('=== userDoc.aktivtTraeningsprogram ===');
	console.log(JSON.stringify(ud.aktivtTraeningsprogram));
	console.log('');

	console.log('=== programTildelinger der rammer linnsacademy ===');
	const allePT = await db.collection('programTildelinger').get();
	for (const t of allePT.docs) {
		const d = t.data();
		const rammer = (d.modtagerType === 'forlob' && ud.forlobIds?.includes(d.modtagerId))
			|| (d.modtagerType === 'kunde' && d.modtagerId === uid);
		if (rammer) {
			console.log(`  ${t.id}: forlobId=${d.forlobId}, programId=${d.programId}, modtager=${d.modtagerType}/${d.modtagerId}`);
		}
	}
}
main().then(() => process.exit(0));
