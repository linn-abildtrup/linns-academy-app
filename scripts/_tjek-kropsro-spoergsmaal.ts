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
	const alle = await db.collection('klientspoergsmaal').get();
	console.log(`Total spoergsmaal: ${alle.size}\n`);

	const counts: Record<string, number> = {};
	const kropsroPosts: Array<{ id: string; email: string; tekst: string; status: string; forlobId: string }> = [];
	for (const d of alle.docs) {
		const data = d.data();
		const fid = String(data.forlobId ?? '(ingen)');
		counts[fid] = (counts[fid] ?? 0) + 1;
		if (fid === 'kropsro_maj_2026') {
			kropsroPosts.push({
				id: d.id,
				email: String(data.email ?? '?'),
				tekst: String(data.tekst ?? '').slice(0, 80),
				status: String(data.status ?? '?'),
				forlobId: fid
			});
		}
	}

	console.log('Fordeling efter forlobId:');
	for (const [fid, antal] of Object.entries(counts)) {
		console.log(`  ${fid}: ${antal}`);
	}

	console.log(`\n=== Alle 8 spoergsmaal med email + forlobId ===`);
	for (const d of alle.docs) {
		const data = d.data();
		console.log(`  email=${data.email ?? '?'}, forlobId=${data.forlobId ?? '(ingen)'}, tekst="${String(data.tekst ?? '').slice(0, 50)}"`);
	}
}
main().then(() => process.exit(0));
