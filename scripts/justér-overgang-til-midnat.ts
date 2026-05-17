// Engangs-script til Kickstart maj 2026-overgangen:
//
// 1. Sætter expiresAt + bonusPeriodEndsAt på alle 320 importerede kunders
//    userDoc til midnatten (2026-05-18 00:00 dansk tid) i stedet for kl 06:00.
//    bonusPeriodEndsAt = expiresAt + 90 dage.
//
// 2. Backupper allowedEmails-data for de 58 basis-abonnenter til JSON.
//
// 3. Sætter adgangFra=midnat på de 58 basis-abonnenters allowedEmails,
//    så abo-flag først aktiveres ved midnat (kombineret med sync-ændring
//    i src/lib/userDoc.ts).
//
// Resultat: alle 320 ser Kickstart indtil midnat. Ved midnat udløber
// Kickstart automatisk. De 58 basisabonnenter overgår til basis-app ved
// næste login (sync ser adgangFra er passeret og aktiverer abo).
// De 262 øvrige overgår til 90 dages bibliotek-bonus.
//
// Kør med:
//   npx tsx scripts/justér-overgang-til-midnat.ts          # dry-run
//   npx tsx scripts/justér-overgang-til-midnat.ts --apply  # skriv

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');

// 2026-05-18 00:00 dansk tid (CEST/UTC+2) = 2026-05-17 22:00 UTC
const MIDNAT_MS = Date.UTC(2026, 4, 17, 22, 0, 0);
const BONUS_END_MS = MIDNAT_MS + 90 * 24 * 60 * 60 * 1000;

console.log(`Midnat-tidspunkt: ${new Date(MIDNAT_MS).toLocaleString('da-DK', { timeZone: 'Europe/Copenhagen' })}`);
console.log(`Bonus slut:       ${new Date(BONUS_END_MS).toLocaleString('da-DK', { timeZone: 'Europe/Copenhagen' })}`);
console.log('');

const nyKey = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(nyKey) });
const db = getFirestore();

interface GammelUser {
	localId: string;
	email?: string;
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

async function justérExpiresAtPå320() {
	console.log(APPLY ? '=== Trin 1: Justér expiresAt på 320 brugere ===' : '=== TRIN 1 DRY-RUN: expiresAt-justering ===');
	const eksport = JSON.parse(
		readFileSync(join(__dirname, 'vanetracker-users-rå.json'), 'utf-8')
	) as { users: GammelUser[] };
	const testEmails = laesTestEmails();
	const kandidater = eksport.users.filter(
		(u) => u.email && !testEmails.has(u.email.toLowerCase())
	);

	let opdaterede = 0;
	for (const u of kandidater) {
		if (APPLY) {
			await db.collection('users').doc(u.localId).set(
				{
					expiresAt: MIDNAT_MS,
					bonusPeriodEndsAt: BONUS_END_MS,
					updatedAt: Date.now()
				},
				{ merge: true }
			);
		}
		opdaterede++;
	}
	console.log(`  ${APPLY ? 'Opdateret' : 'Ville opdatere'}: ${opdaterede} userDocs`);
}

async function parkérBasisAbonnenter() {
	console.log(APPLY ? '\n=== Trin 2: Backup + parker basisabonnenter ===' : '\n=== TRIN 2 DRY-RUN: parker basisabonnenter ===');

	const eksport = JSON.parse(
		readFileSync(join(__dirname, 'vanetracker-users-rå.json'), 'utf-8')
	) as { users: GammelUser[] };
	const testEmails = laesTestEmails();
	const importeredeEmails = new Set(
		eksport.users
			.map((u) => (u.email ?? '').toLowerCase())
			.filter((e) => e && !testEmails.has(e))
	);

	const allowedSnap = await db.collection('allowedEmails').get();
	const overlapDocs: { id: string; data: FirebaseFirestore.DocumentData }[] = [];
	for (const d of allowedSnap.docs) {
		const data = d.data();
		const email = (data.email ?? '').toLowerCase();
		if (
			data.activeProduct === 'basisabo' &&
			data.accessLevel === 'basis' &&
			importeredeEmails.has(email)
		) {
			overlapDocs.push({ id: d.id, data });
		}
	}
	console.log(`  Overlap basis-abo ∩ 320 importerede: ${overlapDocs.length}`);

	if (APPLY) {
		const backupSti = join(__dirname, 'backup-basisabo-overlap.json');
		writeFileSync(
			backupSti,
			JSON.stringify(
				{
					beskrivelse: 'Backup af basisabo-allowedEmails før parkering med adgangFra',
					genereret: new Date().toISOString(),
					midnatTimestamp: MIDNAT_MS,
					docs: overlapDocs
				},
				null,
				2
			),
			'utf-8'
		);
		console.log(`  Backup skrevet til: ${backupSti}`);
	} else {
		console.log(`  (Ville skrive backup til scripts/backup-basisabo-overlap.json)`);
	}

	let parkerede = 0;
	for (const { id } of overlapDocs) {
		if (APPLY) {
			await db.collection('allowedEmails').doc(id).set(
				{
					adgangFra: MIDNAT_MS,
					updatedAt: Date.now()
				},
				{ merge: true }
			);
		}
		parkerede++;
	}
	console.log(`  ${APPLY ? 'Parkeret' : 'Ville parkere'}: ${parkerede} entries med adgangFra=midnat`);
}

async function main() {
	await justérExpiresAtPå320();
	await parkérBasisAbonnenter();
	if (!APPLY) console.log('\nKør med --apply for at skrive.');
	else console.log('\nFærdig. Kode-ændringen i userDoc.ts skal deployes for at sync respekterer adgangFra.');
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e);
		process.exit(1);
	});
