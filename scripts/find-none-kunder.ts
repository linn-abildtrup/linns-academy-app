import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const snap = await db.collection('users').where('accessLevel', '==', 'none').get();
console.log(`Brugere med accessLevel='none': ${snap.size}\n`);
for (const d of snap.docs) {
	const u = d.data() as Record<string, unknown>;
	const forlobIds = (u.forlobIds as string[] | undefined) ?? [];
	const bonus = u.bonusPeriodEndsAt as number | undefined;
	console.log(`  ${u.email} · forlobIds=${forlobIds.length} · bonusEnd=${bonus ? new Date(bonus).toLocaleDateString('da-DK') : '-'}`);
}
