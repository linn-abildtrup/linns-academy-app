// Migrerer alle historiske slider-data fra vanedage-collections til
// mrs_scores. Sliders fra vaner-modulet (energi, mave, cravings, humor,
// sovn) bliver fra denne aendring kun gemt i mrs_scores via symptomcheck.
//
// Migration:
// - Scanner alle users/{uid}/products/{produkt}/vanedage/{dagId}
// - For hver vanedag med mindst én slider-vaerdi:
//   - Tjek om der allerede er en mrs_scores med samme dato (skip dup)
//   - Opret mrs_scores med kun sliders (scores tom, MRS-felter null)
//   - Behold sliders-felterne paa vanedag (legacy, ikke slettet)
//
// Brug: npx tsx scripts/_migrer-sliders-til-mrs.ts [--apply]

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const apply = process.argv.includes('--apply');

interface CheckinSliders {
	energi?: number;
	mave?: number;
	cravings?: number;
	humor?: number;
	sovn?: number;
}

function harSliderVaerdi(c: CheckinSliders | undefined): boolean {
	if (!c) return false;
	return (
		typeof c.energi === 'number' ||
		typeof c.mave === 'number' ||
		typeof c.cravings === 'number' ||
		typeof c.humor === 'number' ||
		typeof c.sovn === 'number'
	);
}

async function findEksisterendeMrsScore(
	uid: string,
	timestamp: number
): Promise<boolean> {
	// Tjekker om der allerede er en mrs_score med samme +/- 60 sek
	const snap = await db
		.collection(`users/${uid}/mrs_scores`)
		.where('timestamp', '>=', timestamp - 60_000)
		.where('timestamp', '<=', timestamp + 60_000)
		.limit(1)
		.get();
	return !snap.empty;
}

async function main() {
	console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}\n`);

	const usersSnap = await db.collection('users').get();
	console.log(`Scanner ${usersSnap.size} brugere\n`);

	let total = 0;
	let migreret = 0;
	let sprunget = 0;
	let brugereMedMigration = 0;
	const fejlListe: string[] = [];

	for (const uDoc of usersSnap.docs) {
		const u = uDoc.data() ?? {};
		const uid = uDoc.id;
		const email = (u.email as string) ?? '';
		let migreretPrBruger = 0;

		const products = await db.collection(`users/${uid}/products`).get();
		for (const p of products.docs) {
			const vanedage = await db.collection(`users/${uid}/products/${p.id}/vanedage`).get();
			for (const v of vanedage.docs) {
				const vd = v.data() ?? {};
				const checkin = vd.checkin as CheckinSliders | undefined;
				if (!harSliderVaerdi(checkin)) continue;
				total++;

				const savedAt = vd.savedAt;
				const timestamp =
					typeof savedAt?.toMillis === 'function'
						? savedAt.toMillis()
						: typeof savedAt === 'number'
							? savedAt
							: Date.now();

				const findesAllerede = await findEksisterendeMrsScore(uid, timestamp);
				if (findesAllerede) {
					sprunget++;
					continue;
				}

				const dagNummer = vd.dagNummer as number;
				const measurePoint = dagNummer === 0 ? 'baseline' : 'opfoelgning';

				const nyMrs = {
					uid,
					email,
					measurePoint,
					timestamp,
					scores: {},
					subscales: { somatisk: 0, psykologisk: 0, urogenital: 0 },
					total: 0,
					sliders: {
						energi: checkin?.energi ?? 0,
						mave: checkin?.mave ?? 0,
						cravings: checkin?.cravings ?? 0,
						humor: checkin?.humor ?? 0,
						sovn: checkin?.sovn ?? 0
					},
					kunSliders: true,
					migrationDate: Date.now()
				};

				if (apply) {
					try {
						await db.collection(`users/${uid}/mrs_scores`).add(nyMrs);
					} catch (e) {
						fejlListe.push(`${email} dag${dagNummer}: ${e instanceof Error ? e.message : 'fejl'}`);
						continue;
					}
				}
				migreret++;
				migreretPrBruger++;
			}
		}

		if (migreretPrBruger > 0) {
			brugereMedMigration++;
			console.log(`  ${email.padEnd(40)} ${migreretPrBruger} sliders`);
		}
	}

	console.log('\n=== Opsummering ===');
	console.log(`Total slider-entries fundet:  ${total}`);
	console.log(`Migreret til mrs_scores:      ${migreret}`);
	console.log(`Sprunget over (duplikater):   ${sprunget}`);
	console.log(`Brugere med migration:        ${brugereMedMigration}`);
	if (fejlListe.length > 0) {
		console.log(`\nFejl (${fejlListe.length}):`);
		fejlListe.forEach((f) => console.log(`  ${f}`));
	}
	if (!apply) console.log('\n⚠️  DRY-RUN — koer med --apply.');
}

main().then(() => process.exit(0));
