// Lister alle brugere med adgang til basis-app i den nye app.
// Kør med: npx tsx scripts/list-basis-brugere.ts

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const snap = await db.collection('users').get();
console.log(`Gennemgår ${snap.size} brugere…\n`);

interface UserData {
	email?: string;
	firstName?: string;
	accessLevel?: string;
	accessSource?: string;
	activeProduct?: string;
	state?: string;
	expiresAt?: number;
	bonusPeriodEndsAt?: number;
}

const basisBrugere: { uid: string; data: UserData }[] = [];
for (const doc of snap.docs) {
	const d = doc.data() as UserData;
	if (d.accessLevel === 'basis') {
		basisBrugere.push({ uid: doc.id, data: d });
	}
}

console.log(`${basisBrugere.length} bruger(e) med accessLevel='basis':\n`);
for (const u of basisBrugere) {
	const d = u.data;
	const navn = d.firstName ?? '(uden fornavn)';
	const src = d.accessSource ?? '(uden kilde)';
	const prod = d.activeProduct ?? '(uden produkt)';
	const eksp = d.expiresAt ? new Date(d.expiresAt).toISOString().slice(0, 10) : 'aldrig';
	console.log(`  ${d.email ?? u.uid}`);
	console.log(`    navn: ${navn} · source: ${src} · product: ${prod} · expires: ${eksp}`);
}
