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
	const forlobId = process.argv[2] ?? 'kropsro_maj_2026';
	const snap = await db.collection('forlob').doc(forlobId).collection('dage').get();
	console.log(`forlob/${forlobId}/dage: ${snap.size} dokumenter`);
	for (const d of snap.docs) {
		const data = d.data();
		const ant = data.lektioner?.length ?? 0;
		const note = data.noteFraLinn ? ` · note: ${(data.noteFraLinn as string).slice(0, 40)}...` : '';
		console.log(`  dag ${d.id}: ${ant} lektion(er)${note}`);
		if (ant > 0) {
			for (const l of data.lektioner) {
				console.log(`    - ${l.titel || '(ingen titel)'} · ${l.format} · ${l.url ? 'har URL' : 'INGEN URL'}`);
			}
		}
	}
}
main().then(() => process.exit(0));
