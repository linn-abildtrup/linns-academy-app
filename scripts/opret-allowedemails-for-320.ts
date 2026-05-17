// Opretter/opdaterer allowedEmails-entries for de 320 importerede kunder
// med forlobId='kickstart_maj_2026' så admin-siden viser dem som
// tilmeldte. Merge — bevarer eksisterende felter (basisabo + adgangFra
// på de 58 der allerede har en entry).
//
// Brug:
//   npx tsx scripts/opret-allowedemails-for-320.ts            # dry-run
//   npx tsx scripts/opret-allowedemails-for-320.ts --apply

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
const FORLOB_ID = 'kickstart_maj_2026';

const nyKey = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(nyKey) });
const db = getFirestore();

interface GammelUser {
	localId: string;
	email?: string;
	displayName?: string;
}

function splitNavn(displayName?: string): { firstName: string; lastName: string } {
	const n = (displayName ?? '').trim();
	if (!n) return { firstName: '', lastName: '' };
	const idx = n.indexOf(' ');
	if (idx === -1) return { firstName: n, lastName: '' };
	return { firstName: n.slice(0, idx).trim(), lastName: n.slice(idx + 1).trim() };
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

function docId(email: string): string {
	return email.replace(/\//g, '_');
}

async function main() {
	console.log(APPLY ? '=== APPLY mode ===' : '=== DRY-RUN ===\n');
	const eksport = JSON.parse(
		readFileSync(join(__dirname, 'vanetracker-users-rå.json'), 'utf-8')
	) as { users: GammelUser[] };
	const testEmails = laesTestEmails();
	const kandidater = eksport.users.filter(
		(u) => u.email && !testEmails.has(u.email.toLowerCase())
	);
	console.log(`Kandidater: ${kandidater.length}\n`);

	let nye = 0;
	let opdaterede = 0;
	let fejlede = 0;

	for (const u of kandidater) {
		const email = u.email!.toLowerCase();
		const id = docId(email);
		const ref = db.collection('allowedEmails').doc(id);
		const { firstName, lastName } = splitNavn(u.displayName);

		try {
			const snap = await ref.get();
			const findesAllerede = snap.exists;
			const opdatering: Record<string, unknown> = {
				email,
				forlobId: FORLOB_ID,
				status: 'registered',
				updatedAt: Date.now()
			};
			if (firstName && !snap.data()?.firstName) opdatering.firstName = firstName;
			if (lastName && !snap.data()?.lastName) opdatering.lastName = lastName;
			if (!findesAllerede) opdatering.oprettet = FieldValue.serverTimestamp();

			if (nye + opdaterede < 5) {
				console.log(
					`  ${findesAllerede ? '↻' : '＋'} ${email}  | ${firstName} ${lastName}`.trim()
				);
			} else if (nye + opdaterede === 5) {
				console.log('  …');
			}

			if (APPLY) await ref.set(opdatering, { merge: true });
			if (findesAllerede) opdaterede++;
			else nye++;
		} catch (e) {
			fejlede++;
			console.error(`  ! ${email}: ${(e as Error).message}`);
		}
	}

	console.log(`\nResultat:`);
	console.log(`  Nye:        ${nye}`);
	console.log(`  Opdaterede: ${opdaterede}`);
	console.log(`  Fejlede:    ${fejlede}`);
	if (!APPLY) console.log('\nKør med --apply for at skrive.');
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e);
		process.exit(1);
	});
