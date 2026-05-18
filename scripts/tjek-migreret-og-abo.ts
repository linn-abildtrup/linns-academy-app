// Sammenligner: hvilke af de 320 migrerede vanetracker-kunder er ALLE
// aktive basis-abonnenter, og hvilke af disse er ramt af expiresAt-bug.
//
// Brug:
//   npx tsx scripts/tjek-migreret-og-abo.ts

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

interface GammelUser {
	localId: string;
	email?: string;
}

interface Bruger {
	email?: string;
	accessLevel?: string;
	accessSource?: string;
	activeSubscription?: boolean;
	expiresAt?: number;
	state?: string;
}

// Læs de 320 migrerede emails (eksklusiv TEST-kunder)
const eksport = JSON.parse(
	readFileSync(join(__dirname, 'vanetracker-users-rå.json'), 'utf-8')
) as { users: GammelUser[] };

function laesTestEmails(): Set<string> {
	const csv = readFileSync(join(__dirname, 'gamle-brugere_opdateret.csv'), 'utf-8');
	const test = new Set<string>();
	for (const linje of csv.split('\n').slice(1)) {
		if (!linje.trim()) continue;
		const felter = linje.split(';');
		if (felter[6]?.trim().toUpperCase() === 'TEST') {
			const email = (felter[0] ?? '').replace(/"/g, '').trim().toLowerCase();
			if (email) test.add(email);
		}
	}
	return test;
}

const testEmails = laesTestEmails();
const migreredeEmails = new Set(
	eksport.users
		.map((u) => (u.email ?? '').toLowerCase())
		.filter((e) => e && !testEmails.has(e))
);

console.log(`Migrerede vanetracker-kunder (eks. TEST): ${migreredeEmails.size}\n`);

// Hent alle users + allowedEmails
const usersSnap = await db.collection('users').get();
const allowedSnap = await db.collection('allowedEmails').get();

const usersByEmail = new Map<string, Bruger>();
for (const d of usersSnap.docs) {
	const data = d.data() as Bruger;
	if (data.email) usersByEmail.set(data.email.toLowerCase(), data);
}

const allowedByEmail = new Map<string, Bruger>();
for (const d of allowedSnap.docs) {
	const data = d.data() as Bruger;
	if (data.email) allowedByEmail.set(data.email.toLowerCase(), data);
}

// Find alle migrerede der er basis-abo (i users ELLER allowedEmails)
const migreretMedAbo: { email: string; u?: Bruger; a?: Bruger }[] = [];
for (const email of migreredeEmails) {
	const u = usersByEmail.get(email);
	const a = allowedByEmail.get(email);
	const erAbo =
		(u?.accessLevel === 'basis' && u?.activeSubscription === true) ||
		(a?.accessLevel === 'basis' && a?.activeSubscription === true);
	if (erAbo) migreretMedAbo.push({ email, u, a });
}

console.log(`Migrerede der OGSÅ er basis-abo: ${migreretMedAbo.length}\n`);

// Kategoriser: ramt vs ikke ramt
let ramtAfBug = 0;
let abnormStatus = 0;
let intetExpiresAt = 0;
const kategorier: Record<string, number> = {};

for (const m of migreretMedAbo) {
	const u = m.u;
	const a = m.a;

	const userExpired = !!(u?.expiresAt && u.expiresAt < now);
	const allowedExpired = !!(a?.expiresAt && a.expiresAt < now);
	const userAktiv = u?.accessLevel === 'basis' && u?.activeSubscription === true;
	const allowedAktiv = a?.accessLevel === 'basis' && a?.activeSubscription === true;

	let kategori: string;
	if (userExpired && userAktiv) {
		kategori = 'users-doc har expiresAt + abo-felter → ramt af bug';
		ramtAfBug++;
	} else if (allowedExpired && allowedAktiv && !userAktiv) {
		kategori = 'KUN allowedEmails har abo-data (ikke logget ind endnu?)';
		abnormStatus++;
	} else if (userAktiv && !u?.expiresAt) {
		kategori = 'users-doc har abo-data men INGEN expiresAt';
		intetExpiresAt++;
	} else if (allowedAktiv && !a?.expiresAt) {
		kategori = 'allowedEmails har abo-data men INGEN expiresAt';
		intetExpiresAt++;
	} else {
		kategori = `andet (userExpiresAt=${u?.expiresAt}, userAktiv=${userAktiv}, allowedAktiv=${allowedAktiv})`;
	}
	kategorier[kategori] = (kategorier[kategori] ?? 0) + 1;
}

console.log('Fordeling:');
for (const [k, v] of Object.entries(kategorier).sort((a, b) => b[1] - a[1])) {
	console.log(`  ${v} · ${k}`);
}

console.log(`\nTotal:`);
console.log(`  Ramt af bug (vist i forrige diagnose):     ${ramtAfBug}`);
console.log(`  Har abo i allowedEmails men ikke users:    ${abnormStatus}`);
console.log(`  Har abo-data uden expiresAt:               ${intetExpiresAt}`);
