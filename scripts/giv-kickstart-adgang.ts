// Opretter userDoc + products/kickstart subdoc for de 320 importerede
// brugere så de får adgang til Kickstart maj 2026-forløbet, med
// 90 dages bibliotek-bonus efter forløbets slut.
//
// Bruger samme værdier som forløbet beregner via formlen
// expiresAt = startMs + (antalDage+1)*dayMs (se src/lib/userDoc.ts):
//   expiresAt          = 2026-05-18 06:00 dansk tid
//   bonusPeriodEndsAt  = 2026-08-16 06:00 dansk tid
//
// firstName/lastName trækkes fra Auth-displayName.
//
// Brug:
//   npx tsx scripts/giv-kickstart-adgang.ts                # dry-run, alle
//   npx tsx scripts/giv-kickstart-adgang.ts --limit=3      # dry-run, 3
//   npx tsx scripts/giv-kickstart-adgang.ts --apply --limit=3
//   npx tsx scripts/giv-kickstart-adgang.ts --apply

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const limitArg = args.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;

const FORLOB_ID = 'kickstart_maj_2026';
const EXPIRES_AT = 1779076800000; // 2026-05-18 06:00 DK = slutMs fra forløb
const BONUS_END = 1786852800000; // EXPIRES_AT + 90 dage

const nyKey = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(nyKey) });
const db = getFirestore();

interface GammelUser {
	localId: string;
	email?: string;
	emailVerified?: boolean;
	displayName?: string;
	createdAt?: string;
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

async function main() {
	console.log(APPLY ? '=== APPLY mode — skriver til Firestore ===' : '=== DRY-RUN ===\n');
	if (Number.isFinite(LIMIT)) console.log(`Begrænset til første ${LIMIT} brugere\n`);

	const eksport = JSON.parse(
		readFileSync(join(__dirname, 'vanetracker-users-rå.json'), 'utf-8')
	) as { users: GammelUser[] };
	const testEmails = laesTestEmails();

	const kandidater = eksport.users.filter(
		(u) => u.email && !testEmails.has(u.email.toLowerCase())
	);
	console.log(`Kandidater (alle ikke-test): ${kandidater.length}`);

	let oprettede = 0;
	let allerede = 0;
	let fejlede = 0;
	const begraenset = kandidater.slice(0, Number.isFinite(LIMIT) ? LIMIT : kandidater.length);

	for (const u of begraenset) {
		const uid = u.localId;
		const email = u.email!.toLowerCase();
		const { firstName, lastName } = splitNavn(u.displayName);

		try {
			const eksisterende = await db.collection('users').doc(uid).get();
			if (eksisterende.exists) {
				const data = eksisterende.data()!;
				if (data.activeProduct === 'kickstart' && data.expiresAt === EXPIRES_AT) {
					allerede++;
					if (!APPLY && allerede <= 3) {
						console.log(`  ${email} — allerede sat op, springes over`);
					}
					continue;
				}
			}

			const userDoc = {
				email,
				firstName: firstName || '',
				...(lastName ? { lastName } : {}),
				state: 'forlobskunde',
				createdAt: u.createdAt ? Number(u.createdAt) : Date.now(),
				accessLevel: 'basis',
				activeProduct: 'kickstart',
				accessSource: 'forløb',
				forlobIds: [FORLOB_ID],
				activeSubscription: false,
				expiresAt: EXPIRES_AT,
				bonusPeriodEndsAt: BONUS_END,
				updatedAt: Date.now()
			};

			const productDoc = {
				forlobId: FORLOB_ID,
				koebt: Timestamp.now(),
				startDato: Timestamp.now(),
				udloberDato: null,
				programValg: {},
				fremgang: {}
			};

			if (oprettede < 5) {
				console.log(
					`  ${email}  | uid=${uid.slice(0, 8)}…  | navn=${firstName} ${lastName}`.trim()
				);
			} else if (oprettede === 5) {
				console.log('  …');
			}

			if (APPLY) {
				await db.collection('users').doc(uid).set(userDoc, { merge: true });
				await db
					.collection('users')
					.doc(uid)
					.collection('products')
					.doc('kickstart')
					.set(productDoc, { merge: true });
			}
			oprettede++;
		} catch (e) {
			fejlede++;
			console.error(`  ! ${email}: ${(e as Error).message}`);
		}
	}

	console.log(`\nResultat:`);
	console.log(`  Oprettet/opdateret: ${oprettede}`);
	console.log(`  Allerede sat op:    ${allerede}`);
	console.log(`  Fejlede:            ${fejlede}`);
	if (!APPLY) console.log(`\nKør med --apply for at skrive.`);
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e);
		process.exit(1);
	});
