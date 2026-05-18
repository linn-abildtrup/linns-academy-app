// Finder kunder der har:
//   - accessLevel = 'basis' eller 'premium'
//   - activeSubscription = true (abonnement aktivt)
//   - expiresAt < now (fra forløbs-migration)
// Disse blev fejlagtigt vist som 'udlobet' før fixet i userAdgang.ts.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const now = Date.now();

interface Bruger {
	email?: string;
	firstName?: string;
	accessLevel?: string;
	accessSource?: string;
	activeSubscription?: boolean;
	expiresAt?: number;
}

console.log('Søger efter aktive abonnenter med udløbet expiresAt…\n');

const fundet: { sti: string; email: string; data: Bruger }[] = [];

const usersSnap = await db.collection('users').get();
for (const d of usersSnap.docs) {
	const data = d.data() as Bruger;
	if (
		(data.accessLevel === 'basis' || data.accessLevel === 'premium') &&
		data.activeSubscription === true &&
		data.expiresAt &&
		data.expiresAt < now
	) {
		fundet.push({ sti: `users/${d.id}`, email: data.email ?? '', data });
	}
}

const allowedSnap = await db.collection('allowedEmails').get();
for (const d of allowedSnap.docs) {
	const data = d.data() as Bruger;
	if (
		(data.accessLevel === 'basis' || data.accessLevel === 'premium') &&
		data.activeSubscription === true &&
		data.expiresAt &&
		data.expiresAt < now
	) {
		// Skip hvis allerede med fra users-collection (samme email)
		if (fundet.some((f) => f.email === data.email)) continue;
		fundet.push({ sti: `allowedEmails/${d.id}`, email: data.email ?? '', data });
	}
}

console.log(`Antal fejlagtigt-udløbne abonnenter: ${fundet.length}\n`);
for (const f of fundet) {
	const eksp = f.data.expiresAt ? new Date(f.data.expiresAt).toLocaleDateString('da-DK') : '-';
	console.log(`  ${f.email}  · ${f.data.firstName ?? '?'} · ${f.data.accessLevel} · expiresAt=${eksp}`);
}
console.log(`\nEfter deploy af fix-commit ser de alle appen korrekt ved næste refresh.`);
