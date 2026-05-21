// Lister alle brugere med accessLevel='premium'.
//
// Brug:
//   npx tsx scripts/find-premium-kunder.ts

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const snap = await db.collection('users').where('accessLevel', '==', 'premium').get();
console.log(`Brugere med accessLevel='premium': ${snap.size}\n`);

for (const d of snap.docs) {
	const u = d.data() as Record<string, unknown>;
	const forlobIds = (u.forlobIds as string[] | undefined) ?? [];
	const expires = u.expiresAt as number | undefined;
	const bonus = u.bonusPeriodEndsAt as number | undefined;
	console.log(`  uid=${d.id}`);
	console.log(`    email:            ${u.email}`);
	console.log(`    firstName:        ${u.firstName ?? '-'}`);
	console.log(`    accessSource:     ${u.accessSource ?? '-'}`);
	console.log(`    activeProduct:    ${u.activeProduct ?? '-'}`);
	console.log(`    activeSubscription: ${u.activeSubscription ?? '-'}`);
	console.log(`    state:            ${u.state ?? '-'}`);
	console.log(`    forlobIds:        ${forlobIds.length > 0 ? forlobIds.join(', ') : '-'}`);
	console.log(`    expiresAt:        ${expires ? new Date(expires).toLocaleDateString('da-DK') : '-'}`);
	console.log(`    bonusEnd:         ${bonus ? new Date(bonus).toLocaleDateString('da-DK') : '-'}`);
	console.log();
}
