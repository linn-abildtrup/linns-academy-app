// Finder brugere hvor userDoc.state IKKE matcher effektivState (beregnet
// fra accessLevel + accessSource). Disse kunder oplevede bug'en hvor
// forsidens effects skippede modulbruger-data fordi raw state stadig var
// 'forlobskunde' selvom de er aktive abonnenter.
//
// Brug:
//   npx tsx scripts/tjek-state-mismatch.ts          # rapport
//   npx tsx scripts/tjek-state-mismatch.ts --apply  # ret state-feltet

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const APPLY = process.argv.includes('--apply');

interface UserData {
	email?: string;
	firstName?: string;
	accessLevel?: string;
	accessSource?: string;
	state?: string;
	activeSubscription?: boolean;
	expiresAt?: number | null;
}

function udledState(accessLevel: string | undefined, accessSource: string | undefined): string {
	if (!accessLevel || accessLevel === 'none') return 'udlobet';
	if (accessSource === 'forløb') return 'forlobskunde';
	return 'modulbruger';
}

const usersSnap = await db.collection('users').get();
let i = 0;
let opdaterede = 0;
const mismatch: { email: string; uid: string; nuvarende: string; forventet: string }[] = [];

for (const d of usersSnap.docs) {
	const u = d.data() as UserData;
	if (!u.accessLevel || u.accessLevel === 'none') continue;
	const forventet = udledState(u.accessLevel, u.accessSource);
	if (u.state === forventet) continue;
	i++;
	mismatch.push({
		email: u.email ?? '?',
		uid: d.id,
		nuvarende: u.state ?? '-',
		forventet
	});
	if (APPLY) {
		await d.ref.update({ state: forventet, updatedAt: Date.now() });
		opdaterede++;
	}
}

console.log(`Brugere med state-mismatch: ${mismatch.length}\n`);
for (const m of mismatch) {
	console.log(`  ${m.email}  · state='${m.nuvarende}' → bør være '${m.forventet}'`);
}

if (APPLY) {
	console.log(`\nOpdaterede ${opdaterede} brugere.`);
} else if (mismatch.length > 0) {
	console.log('\nKør med --apply for at rette state-feltet.');
}
