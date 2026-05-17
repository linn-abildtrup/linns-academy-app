// Importerer Firebase Auth-brugere fra gammel app (vanetracker) til
// ny app (linns-academy-app). Bevarer passwordHash + salt så kunderne
// kan logge ind med samme kode som i den gamle app.
//
// Filtrerer testbrugere fra baseret på TEST-markering i CSV'en
// gamle-brugere_opdateret.csv (kolonne 7).
//
// UID bevares fra gammel app — letter senere data-migration.
//
// Brug:
//   npx tsx scripts/importer-auth-brugere.ts                # dry-run, alle
//   npx tsx scripts/importer-auth-brugere.ts --limit=3      # dry-run, 3
//   npx tsx scripts/importer-auth-brugere.ts --apply --limit=3   # skriv 3
//   npx tsx scripts/importer-auth-brugere.ts --apply        # skriv alle

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth, type UserImportRecord, type UserImportOptions } from 'firebase-admin/auth';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const limitArg = args.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;
const onlyArg = args.find((a) => a.startsWith('--only='));
const ONLY_EMAILS = onlyArg
	? new Set(
			onlyArg
				.split('=')[1]
				.split(',')
				.map((s) => s.trim().toLowerCase())
		)
	: null;

// Hash-config læses fra scripts/vanetracker-hash-config.json (gitignored).
// Hent den med: npx tsx scripts/hent-hash-config.ts
const hashCfg = JSON.parse(
	readFileSync(join(__dirname, 'vanetracker-hash-config.json'), 'utf-8')
) as { signerKey: string; saltSeparator: string; rounds: number; memoryCost: number };
const HASH_CONFIG: UserImportOptions = {
	hash: {
		algorithm: 'SCRYPT',
		key: Buffer.from(hashCfg.signerKey, 'base64'),
		saltSeparator: Buffer.from(hashCfg.saltSeparator, 'base64'),
		rounds: hashCfg.rounds,
		memoryCost: hashCfg.memoryCost
	}
};

const nyKey = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(nyKey) });

interface GammelUser {
	localId: string;
	email?: string;
	emailVerified?: boolean;
	passwordHash?: string;
	salt?: string;
	displayName?: string;
	lastSignedInAt?: string;
	createdAt?: string;
	disabled?: boolean;
}

function laesTestEmails(): Set<string> {
	const csv = readFileSync(join(__dirname, 'gamle-brugere_opdateret.csv'), 'utf-8');
	const linjer = csv.split('\n').slice(1);
	const test = new Set<string>();
	for (const linje of linjer) {
		if (!linje.trim()) continue;
		const felter = linje.split(';');
		if (felter[6] && felter[6].trim().toUpperCase() === 'TEST') {
			const email = (felter[0] ?? '').replace(/"/g, '').trim().toLowerCase();
			if (email) test.add(email);
		}
	}
	return test;
}

async function main() {
	console.log(APPLY ? '=== APPLY mode — skriver til ny app ===' : '=== DRY-RUN ===\n');
	if (Number.isFinite(LIMIT)) console.log(`Begrænset til første ${LIMIT} brugere\n`);
	if (ONLY_EMAILS) console.log(`Kun emails: ${[...ONLY_EMAILS].join(', ')}\n`);

	const eksport = JSON.parse(
		readFileSync(join(__dirname, 'vanetracker-users-rå.json'), 'utf-8')
	) as { users: GammelUser[] };
	console.log(`Læst ${eksport.users.length} brugere fra eksport-fil`);

	const testEmails = laesTestEmails();
	console.log(`Testbrugere fundet i CSV: ${testEmails.size} (${[...testEmails].join(', ')})\n`);

	const kandidater: UserImportRecord[] = [];
	let sprungetTest = 0;
	let sprungetUdenEmail = 0;
	let sprungetUdenPassword = 0;

	for (const u of eksport.users) {
		const email = u.email?.toLowerCase();
		if (!email) {
			sprungetUdenEmail++;
			continue;
		}
		if (testEmails.has(email)) {
			sprungetTest++;
			continue;
		}
		if (ONLY_EMAILS && !ONLY_EMAILS.has(email)) continue;
		if (!u.passwordHash || !u.salt) {
			sprungetUdenPassword++;
			console.warn(`  ! ${email} mangler password-hash — springes over`);
			continue;
		}

		const rec: UserImportRecord = {
			uid: u.localId,
			email,
			emailVerified: u.emailVerified ?? false,
			displayName: u.displayName,
			passwordHash: Buffer.from(u.passwordHash, 'base64'),
			passwordSalt: Buffer.from(u.salt, 'base64'),
			disabled: u.disabled ?? false,
			metadata: {
				creationTime: u.createdAt ? new Date(Number(u.createdAt)).toISOString() : undefined,
				lastSignInTime: u.lastSignedInAt
					? new Date(Number(u.lastSignedInAt)).toISOString()
					: undefined
			}
		};
		kandidater.push(rec);
		if (kandidater.length >= LIMIT) break;
	}

	console.log(`Importeres: ${kandidater.length}`);
	console.log(`  Sprunget — testbruger: ${sprungetTest}`);
	console.log(`  Sprunget — uden email: ${sprungetUdenEmail}`);
	console.log(`  Sprunget — uden password: ${sprungetUdenPassword}`);

	if (kandidater.length <= 10) {
		console.log('\nKandidater:');
		for (const k of kandidater) console.log(`  ${k.email}  (uid=${k.uid.slice(0, 12)}…)`);
	} else {
		console.log('\nFørste 5 og sidste 5:');
		for (const k of kandidater.slice(0, 5)) console.log(`  ${k.email}`);
		console.log('  …');
		for (const k of kandidater.slice(-5)) console.log(`  ${k.email}`);
	}

	if (!APPLY) {
		console.log('\nKør med --apply for at importere.');
		return;
	}

	// Firebase tillader op til 1000 brugere per importUsers-kald
	const auth = getAuth();
	const BATCH = 1000;
	let success = 0;
	let failed = 0;
	for (let i = 0; i < kandidater.length; i += BATCH) {
		const slice = kandidater.slice(i, i + BATCH);
		const res = await auth.importUsers(slice, HASH_CONFIG);
		success += res.successCount;
		failed += res.failureCount;
		console.log(
			`  Batch ${i / BATCH + 1}: success=${res.successCount} failed=${res.failureCount}`
		);
		if (res.errors.length > 0) {
			for (const err of res.errors.slice(0, 10)) {
				console.error(`    [${err.index}] ${slice[err.index].email}: ${err.error.message}`);
			}
		}
	}
	console.log(`\nTotal: ${success} importeret, ${failed} fejlede`);
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e);
		process.exit(1);
	});
