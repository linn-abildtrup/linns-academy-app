// Tjekker om kickstart-forl0bet startende 1. juni 2026 findes.

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
	const snap = await db.collection('forlob').get();
	console.log(`${snap.size} forl0b i alt:\n`);
	for (const d of snap.docs) {
		const f = d.data() ?? {};
		const start = f.startDato?.toDate?.()?.toISOString?.()?.slice(0, 10) ?? '—';
		console.log(`${d.id.padEnd(28)}  type:${(f.type ?? '?').padEnd(10)}  start:${start}  aktiv:${f.aktiv}`);
	}
}

main().then(() => process.exit(0));
