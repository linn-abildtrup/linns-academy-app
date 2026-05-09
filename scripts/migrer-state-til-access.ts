// Migration: bagudfyld accessLevel/accessSource/activeProduct på alle
// eksisterende userDocs og allowedEmails-dokumenter, baseret på den gamle
// state-model.
//
// Mapping (besluttet med Linn 9. maj 2026):
//   state='forlobskunde' → accessLevel='basis', accessSource='forløb',
//                          activeProduct='kickstart'
//   state='modulbruger'  → accessLevel='basis', accessSource='abonnement',
//                          activeProduct='basisabo', activeSubscription=true
//   state='udlobet'      → accessLevel='none',  accessSource='forløb'
//
// Eksisterende værdier i de nye felter overskrives IKKE — vi bruger merge
// så manuelle rettelser bevares.
//
// Kør:
//   npx tsx scripts/migrer-state-til-access.ts            # dry-run
//   npx tsx scripts/migrer-state-til-access.ts --skriv    # skriv

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const skriv = process.argv.includes('--skriv');

interface Mapping {
	accessLevel: 'none' | 'basis' | 'premium';
	accessSource: 'abonnement' | 'forløb';
	activeProduct?: 'kickstart' | 'premiumforløb' | 'basisabo' | 'premiumabo';
	activeSubscription?: boolean;
}

function mapState(state: string | undefined): Mapping {
	if (state === 'forlobskunde') {
		return {
			accessLevel: 'basis',
			accessSource: 'forløb',
			activeProduct: 'kickstart'
		};
	}
	if (state === 'modulbruger') {
		return {
			accessLevel: 'basis',
			accessSource: 'abonnement',
			activeProduct: 'basisabo',
			activeSubscription: true
		};
	}
	// udlobet eller ukendt
	return {
		accessLevel: 'none',
		accessSource: 'forløb'
	};
}

async function migrerUsers() {
	const snap = await db.collection('users').get();
	let opdateret = 0;
	let sprunget = 0;
	console.log(`\n--- users (${snap.size} dokumenter) ---`);
	for (const d of snap.docs) {
		const data = d.data();
		const state = data.state as string | undefined;
		if (!state) {
			sprunget++;
			console.log(`  ${d.id}: (ingen state — sprunget over)`);
			continue;
		}
		// Hvis accessLevel allerede findes, spring over (manuel sat)
		if (data.accessLevel !== undefined) {
			sprunget++;
			console.log(`  ${d.id}: ${data.email ?? '?'} (har allerede accessLevel=${data.accessLevel})`);
			continue;
		}
		const mapping = mapState(state);
		console.log(
			`  ${d.id}: ${data.email ?? '?'} · ${state} → ${mapping.accessLevel}/${mapping.accessSource}${
				mapping.activeProduct ? '/' + mapping.activeProduct : ''
			}`
		);
		if (skriv) {
			await d.ref.update({
				...mapping,
				updatedAt: FieldValue.serverTimestamp()
			});
		}
		opdateret++;
	}
	console.log(`  → ${opdateret} opdateret, ${sprunget} sprunget over`);
}

async function migrerAllowedEmails() {
	const snap = await db.collection('allowedEmails').get();
	let opdateret = 0;
	let sprunget = 0;
	console.log(`\n--- allowedEmails (${snap.size} dokumenter) ---`);
	for (const d of snap.docs) {
		const data = d.data();
		// allowedEmails har normalt forlobId — alle disse er forløbskunder
		if (data.accessLevel !== undefined) {
			sprunget++;
			console.log(`  ${d.id}: (har allerede accessLevel=${data.accessLevel})`);
			continue;
		}
		const mapping = data.forlobId
			? {
					accessLevel: 'basis' as const,
					accessSource: 'forløb' as const,
					activeProduct: 'kickstart' as const
				}
			: {
					accessLevel: 'none' as const,
					accessSource: 'forløb' as const
				};
		console.log(
			`  ${d.id}: forlobId=${data.forlobId ?? '(ingen)'} → ${mapping.accessLevel}/${mapping.accessSource}`
		);
		if (skriv) {
			await d.ref.update({
				...mapping,
				updatedAt: FieldValue.serverTimestamp()
			});
		}
		opdateret++;
	}
	console.log(`  → ${opdateret} opdateret, ${sprunget} sprunget over`);
}

async function main() {
	console.log(skriv ? '🌱 Skriver til Firestore...' : '🔍 Dry-run');
	await migrerUsers();
	await migrerAllowedEmails();
	if (!skriv) {
		console.log('\n(dry-run færdig — kør med --skriv for at gennemføre)');
	} else {
		console.log('\n✓ Migration færdig.');
	}
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e);
		process.exit(1);
	});
