// Sammenligner: hvilke kunder fra vanetracker-eksporten (320) er FAKTISK
// importeret som Firebase Auth-konti i den nye app, og hvilke mangler.
//
// Brug:
//   npx tsx scripts/tjek-auth-migration.ts

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });

interface GammelUser {
	localId: string;
	email?: string;
	passwordHash?: string;
	salt?: string;
}

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

const eksport = JSON.parse(
	readFileSync(join(__dirname, 'vanetracker-users-rå.json'), 'utf-8')
) as { users: GammelUser[] };

const testEmails = laesTestEmails();

console.log(`Total i vanetracker-users-rå.json: ${eksport.users.length}\n`);

// Kategoriser kandidater
let udenEmail = 0;
let testFlagged = 0;
let udenPasswordHash = 0;
const skulleVaereImporteret: { email: string; uid: string }[] = [];
for (const u of eksport.users) {
	const email = u.email?.toLowerCase();
	if (!email) {
		udenEmail++;
		continue;
	}
	if (testEmails.has(email)) {
		testFlagged++;
		continue;
	}
	if (!u.passwordHash || !u.salt) {
		udenPasswordHash++;
		continue;
	}
	skulleVaereImporteret.push({ email, uid: u.localId });
}

console.log(`Kandidater til import:`);
console.log(`  Sprunget — uden email:         ${udenEmail}`);
console.log(`  Sprunget — TEST-flagged:        ${testFlagged}`);
console.log(`  Sprunget — uden password-hash:  ${udenPasswordHash}`);
console.log(`  Skulle være importeret:         ${skulleVaereImporteret.length}\n`);

// Hent alle Firebase Auth-konti i ny app
console.log('Henter alle Firebase Auth-konti i ny app…');
const auth = getAuth();
const emailToUid = new Map<string, string>();
let pageToken: string | undefined = undefined;
let total = 0;
do {
	const res: { users: { email?: string; uid: string }[]; pageToken?: string } = await auth.listUsers(
		1000,
		pageToken
	);
	for (const u of res.users) {
		if (u.email) emailToUid.set(u.email.toLowerCase(), u.uid);
	}
	total += res.users.length;
	pageToken = res.pageToken;
} while (pageToken);

console.log(`  Fundet ${total} konti i Firebase Auth (${emailToUid.size} unikke emails)\n`);

// Find mismatch
const importeret: string[] = [];
const manglerHelt: string[] = [];
for (const u of skulleVaereImporteret) {
	if (emailToUid.has(u.email)) importeret.push(u.email);
	else manglerHelt.push(u.email);
}

console.log(`Resultat:`);
console.log(`  Migreret korrekt:               ${importeret.length}`);
console.log(`  Mangler i Firebase Auth:        ${manglerHelt.length}\n`);

if (manglerHelt.length > 0) {
	console.log(`Kunder fra vanetracker-eksporten der IKKE er i ny Firebase Auth:`);
	for (const e of manglerHelt) console.log(`  ${e}`);
}

// Også omvendt: er der nye Firebase Auth-konti der IKKE var i vanetracker-eksporten?
const eksportEmails = new Set(skulleVaereImporteret.map((u) => u.email));
const nyeUdenforEksport: string[] = [];
for (const email of emailToUid.keys()) {
	if (!eksportEmails.has(email) && !testEmails.has(email)) nyeUdenforEksport.push(email);
}

console.log(`\nKonti i Firebase Auth der IKKE er i vanetracker-eksporten: ${nyeUdenforEksport.length}`);
console.log('(disse er nye kunder oprettet i den nye app eller test/admin):');
for (const e of nyeUdenforEksport.slice(0, 30)) console.log(`  ${e}`);
if (nyeUdenforEksport.length > 30) console.log(`  … og ${nyeUdenforEksport.length - 30} flere`);
