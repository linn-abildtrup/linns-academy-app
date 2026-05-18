// Lister alle der har simpleroCustomerId (har betalt via Simplero) og viser om
// de har adgang til basis-app. Finder dem der "burde have adgang" men ikke har.
//
// Brug:
//   npx tsx scripts/tjek-alle-koebte.ts

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

interface Doc {
	id: string;
	data: Record<string, unknown>;
}

const allowedSnap = await db.collection('allowedEmails').get();
const usersSnap = await db.collection('users').get();

const allowedByEmail = new Map<string, Doc>();
for (const d of allowedSnap.docs) {
	const data = d.data();
	const email = String(data.email ?? '').toLowerCase();
	if (email) allowedByEmail.set(email, { id: d.id, data });
}

const usersByEmail = new Map<string, Doc>();
for (const d of usersSnap.docs) {
	const data = d.data();
	const email = String(data.email ?? '').toLowerCase();
	if (email) usersByEmail.set(email, { id: d.id, data });
}

// Find unique simpleroCustomerIds — alle der har betalt via Simplero
const koebte = new Set<string>();
for (const a of allowedByEmail.values()) {
	if (a.data.simpleroCustomerId) koebte.add(String(a.data.email).toLowerCase());
}
for (const u of usersByEmail.values()) {
	if (u.data.simpleroCustomerId) koebte.add(String(u.data.email).toLowerCase());
}

console.log(`Antal kunder med simpleroCustomerId (har betalt): ${koebte.size}\n`);

let aktive = 0;
let inaktive = 0;
let manglerAdgang = 0;
const problemkunder: string[] = [];

for (const email of koebte) {
	const a = allowedByEmail.get(email);
	const u = usersByEmail.get(email);
	const aktiv =
		(a?.data.accessLevel === 'basis' || a?.data.accessLevel === 'premium') &&
		a?.data.activeSubscription === true;
	const aktivUser =
		(u?.data.accessLevel === 'basis' || u?.data.accessLevel === 'premium') &&
		u?.data.activeSubscription === true;

	if (aktiv || aktivUser) {
		aktive++;
	} else if (a?.data.activeSubscription === false || u?.data.activeSubscription === false) {
		inaktive++;
	} else {
		manglerAdgang++;
		problemkunder.push(email);
	}
}

console.log(`Aktive (har adgang):        ${aktive}`);
console.log(`Inaktive (cancelled/refund): ${inaktive}`);
console.log(`Mangler adgang (problem):    ${manglerAdgang}`);

if (problemkunder.length > 0) {
	console.log('\nKunder der har simpleroCustomerId men ikke har adgang:');
	for (const email of problemkunder) {
		const a = allowedByEmail.get(email);
		const u = usersByEmail.get(email);
		console.log(`  ${email}`);
		console.log(
			`    allowedEmails: accessLevel=${a?.data.accessLevel ?? '-'} accessSource=${a?.data.accessSource ?? '-'} activeSub=${a?.data.activeSubscription ?? '-'}`
		);
		if (u) {
			console.log(
				`    users:         accessLevel=${u.data.accessLevel ?? '-'} accessSource=${u.data.accessSource ?? '-'} activeSub=${u.data.activeSubscription ?? '-'} state=${u.data.state ?? '-'}`
			);
		}
	}
}
