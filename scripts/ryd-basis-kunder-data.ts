// Rydder op i data for aktive basis-abo-kunder så feltlaget matcher
// effektivState-logikken:
// - Sætter state='modulbruger' hvor det fejlagtigt står 'forlobskunde'
// - Sætter expiresAt=null hvor den var et levn fra migrationen
// Begge rettelser skrives til BÅDE users-doc og allowedEmails.

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
const now = Date.now();

interface UserData {
	email?: string;
	accessLevel?: string;
	accessSource?: string;
	activeSubscription?: boolean;
	state?: string;
	expiresAt?: number | null;
}

const usersSnap = await db.collection('users').get();
let rettetState = 0;
let rettetExpiresAt = 0;
let i = 0;

for (const d of usersSnap.docs) {
	const u = d.data() as UserData;
	if (u.accessLevel !== 'basis') continue;
	if (u.accessSource !== 'abonnement') continue;
	if (u.activeSubscription !== true) continue;

	const rettelse: Record<string, unknown> = {};
	if (u.state !== 'modulbruger') {
		rettelse.state = 'modulbruger';
		rettetState++;
	}
	if (u.expiresAt && u.expiresAt < now) {
		rettelse.expiresAt = null;
		rettetExpiresAt++;
	}

	if (Object.keys(rettelse).length === 0) continue;
	rettelse.updatedAt = now;
	i++;

	const email = (u.email ?? '').toLowerCase();
	if (i <= 5) {
		console.log(`  ${email}:`, rettelse);
	} else if (i === 6) {
		console.log('  …');
	}

	if (APPLY) {
		await d.ref.update(rettelse);
		const allowedRef = db.collection('allowedEmails').doc(email);
		const allowedSnap = await allowedRef.get();
		if (allowedSnap.exists) {
			await allowedRef.update(rettelse);
		}
	}
}

console.log(`\nResultat:`);
console.log(`  state rettet:      ${rettetState}`);
console.log(`  expiresAt nulstillet: ${rettetExpiresAt}`);
console.log(`  Total opdaterede:  ${i}`);
if (!APPLY) console.log('\nKør med --apply for at skrive.');
