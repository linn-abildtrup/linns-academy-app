// Migrerer vanetracker-historik fra gammel app til ny app for de 320
// importerede kunder.
//
// Læser:  entries/{uid}/days/{dateKey} i vanetracker (gammel Firebase)
// Skriver: users/{uid}/products/kickstart/vanedage/dag{N} i linns-academy-app
//
// Inkluderer: vane-checks, bonus-svar, noter, baseline-check-in (dag 0),
// ugentligt check-in (dag 7, 14, 21).
//
// UID er bevaret fra gammel app (auth-import gjorde det), så vi kan
// kopiere direkte mellem projekterne.
//
// Brug:
//   npx tsx scripts/migrer-vane-historik.ts                # dry-run
//   npx tsx scripts/migrer-vane-historik.ts --apply        # skriv
//   npx tsx scripts/migrer-vane-historik.ts --apply --only=email@x.dk

import { initializeApp, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const ONLY_EMAIL = onlyArg ? onlyArg.split('=')[1].trim().toLowerCase() : null;

const nyKey = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
const gammelKey = JSON.parse(readFileSync(join(__dirname, 'vanetracker-key.json'), 'utf-8'));

const nyApp = initializeApp({ credential: cert(nyKey) }, 'ny');
const gammelApp = initializeApp({ credential: cert(gammelKey) }, 'gammel');
const nyDb = getFirestore(nyApp);
const gammelDb = getFirestore(gammelApp);

interface GammelUser {
	localId: string;
	email?: string;
}

interface GammelDayEntry {
	dayNum?: number;
	checks?: Record<string, string>;
	note?: string;
	bonus?: Record<string, string>;
	checkin?: Record<string, number | string>;
	updatedAt?: FirebaseFirestore.Timestamp;
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

async function migrerKunde(uid: string, email: string): Promise<{ dage: number; baseline: boolean }> {
	const daysSnap = await gammelDb.collection('entries').doc(uid).collection('days').get();
	if (daysSnap.empty) return { dage: 0, baseline: false };

	let antalDage = 0;
	let baseline = false;

	for (const d of daysSnap.docs) {
		const data = d.data() as GammelDayEntry;
		const dagNummer = typeof data.dayNum === 'number' ? data.dayNum : parseInt(d.id, 10);
		if (!Number.isFinite(dagNummer) || dagNummer < 0 || dagNummer > 21) continue;

		const ny = {
			dagNummer,
			checks: data.checks ?? {},
			bonus: data.bonus ?? {},
			checkin: data.checkin ?? {},
			note: data.note ?? '',
			savedAt: data.updatedAt ?? new Date()
		};

		if (APPLY) {
			await nyDb
				.collection('users')
				.doc(uid)
				.collection('products')
				.doc('kickstart')
				.collection('vanedage')
				.doc(`dag${dagNummer}`)
				.set(ny, { merge: true });
		}

		antalDage++;
		if (dagNummer === 0) baseline = true;
	}

	return { dage: antalDage, baseline };
}

async function main() {
	console.log(APPLY ? '=== APPLY ===\n' : '=== DRY-RUN ===\n');

	const eksport = JSON.parse(
		readFileSync(join(__dirname, 'vanetracker-users-rå.json'), 'utf-8')
	) as { users: GammelUser[] };

	const testEmails = laesTestEmails();
	const kandidater = eksport.users.filter((u) => {
		const e = u.email?.toLowerCase();
		if (!e) return false;
		if (testEmails.has(e)) return false;
		if (ONLY_EMAIL && e !== ONLY_EMAIL) return false;
		return true;
	});

	console.log(`Kandidater: ${kandidater.length}\n`);

	let migreret = 0;
	let medBaseline = 0;
	let medHistorik = 0;
	let totalDage = 0;
	let fejlet = 0;

	for (const u of kandidater) {
		const email = u.email!.toLowerCase();
		try {
			const res = await migrerKunde(u.localId, email);
			if (res.dage > 0) {
				medHistorik++;
				totalDage += res.dage;
				if (res.baseline) medBaseline++;
				if (medHistorik <= 10) {
					console.log(`  ${email}: ${res.dage} dage${res.baseline ? ' + baseline' : ''}`);
				} else if (medHistorik === 11) {
					console.log('  …');
				}
			}
			migreret++;
		} catch (e) {
			fejlet++;
			console.error(`  ! ${email}: ${(e as Error).message}`);
		}
	}

	console.log(`\nResultat:`);
	console.log(`  Gennemløbet:      ${migreret}`);
	console.log(`  Med historik:      ${medHistorik}`);
	console.log(`  Med baseline (dag 0): ${medBaseline}`);
	console.log(`  Total dage migreret: ${totalDage}`);
	console.log(`  Fejlede:           ${fejlet}`);
	if (!APPLY) console.log('\nKør med --apply for at skrive.');
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e);
		process.exit(1);
	});
