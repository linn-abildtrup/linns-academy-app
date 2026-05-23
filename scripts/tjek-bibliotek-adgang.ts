// Lister alle aktive basis-abo-kunder og om de har forlobIds på userDoc'en
// (det er det der styrer om de ser Træningsøvelser + Kickstart-lektioner
// i biblioteket).

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

interface UserData {
	email?: string;
	firstName?: string;
	accessLevel?: string;
	accessSource?: string;
	activeSubscription?: boolean;
	forlobIds?: string[];
	simpleroCustomerId?: string;
}

const usersSnap = await db.collection('users').get();
let basisAbo = 0;
let medForlobIds = 0;
let udenForlobIds = 0;
const udenListe: { email: string; navn: string }[] = [];

for (const d of usersSnap.docs) {
	const u = d.data() as UserData;
	if (u.accessLevel !== 'basis') continue;
	if (u.accessSource !== 'abonnement') continue;
	if (u.activeSubscription !== true) continue;
	basisAbo++;
	const harForlob = (u.forlobIds?.length ?? 0) > 0;
	if (harForlob) medForlobIds++;
	else {
		udenForlobIds++;
		udenListe.push({ email: u.email ?? '?', navn: u.firstName ?? '?' });
	}
}

console.log(`Aktive basis-abonnenter i users-collection: ${basisAbo}`);
console.log(`  Med forlobIds (ser lektioner + Træningsøvelser): ${medForlobIds}`);
console.log(`  Uden forlobIds (ser KUN Links + Opskrifter):     ${udenForlobIds}\n`);

if (udenListe.length > 0) {
	console.log('Basis-abo-kunder uden forlobIds:');
	for (const u of udenListe) console.log(`  ${u.email} (${u.navn})`);
}

// Tjek også allowedEmails for kunder uden users-doc
console.log('\n--- Allowed (whitelist-only) ---');
const allowedSnap = await db.collection('allowedEmails').get();
let allowedBasis = 0;
let allowedMedForlob = 0;
for (const d of allowedSnap.docs) {
	const a = d.data() as { accessLevel?: string; accessSource?: string; activeSubscription?: boolean; forlobId?: string };
	if (a.accessLevel === 'basis' && a.accessSource === 'abonnement' && a.activeSubscription) {
		allowedBasis++;
		if (a.forlobId) allowedMedForlob++;
	}
}
console.log(`Aktive basis i allowedEmails: ${allowedBasis}`);
console.log(`  Med forlobId-felt: ${allowedMedForlob}`);
