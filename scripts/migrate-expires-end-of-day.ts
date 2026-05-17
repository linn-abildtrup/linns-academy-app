// Migrerer eksisterende forløbskunder's expiresAt + bonusPeriodEndsAt så de
// matcher den nye end-of-day-logik: forløbet løber TIL OG MED dag {antalDage}
// kl. 23:59. Gammel formel: slutMs = startMs + antalDage*dayMs.
// Ny formel:                slutMs = startMs + (antalDage+1)*dayMs.
//
// Kør: npm run migrate:expires-end-of-day [-- --dry]

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const dryRun = process.argv.includes('--dry');
const dayMs = 24 * 60 * 60 * 1000;

async function main() {
	console.log(`${dryRun ? '[DRY] ' : ''}Migrerer expiresAt til end-of-day\n`);

	// Cache forløb-data så vi ikke henter samme forløb flere gange
	const forlobCache = new Map<string, { startMs: number; antalDage: number }>();

	const usersSnap = await db.collection('users').get();
	let ramt = 0;
	let opdateret = 0;
	let sprunget = 0;

	for (const userDoc of usersSnap.docs) {
		const data = userDoc.data() as {
			email?: string;
			accessSource?: string;
			forlobIds?: string[];
			expiresAt?: number;
			bonusPeriodEndsAt?: number;
		};

		// Kun forløbskunder med expiresAt sat
		if (data.accessSource !== 'forløb') continue;
		if (!data.forlobIds || data.forlobIds.length === 0) continue;
		if (!data.expiresAt) continue;

		const forlobId = data.forlobIds[data.forlobIds.length - 1];
		let info = forlobCache.get(forlobId);
		if (!info) {
			const fSnap = await db.collection('forlob').doc(forlobId).get();
			if (!fSnap.exists) {
				console.log(`  ↷ ${data.email}: forløb ${forlobId} findes ikke — springes`);
				sprunget++;
				continue;
			}
			const fData = fSnap.data() as {
				startDato?: Timestamp;
				antalDage?: number;
			};
			info = {
				startMs: fData.startDato?.toMillis() ?? 0,
				antalDage: fData.antalDage ?? 0
			};
			forlobCache.set(forlobId, info);
		}
		if (!info.startMs || info.antalDage === 0) {
			sprunget++;
			continue;
		}

		const gammelSlut = info.startMs + info.antalDage * dayMs;
		const nySlut = info.startMs + (info.antalDage + 1) * dayMs;

		// Kun opdater hvis expiresAt matcher den gamle formel (off-by-one).
		// Hvis Linn har sat en custom dato manuelt, rør vi den ikke.
		if (data.expiresAt !== gammelSlut) {
			console.log(
				`  ↷ ${data.email}: expiresAt=${new Date(data.expiresAt).toISOString().slice(0, 10)} matcher ikke gammel formel — springes`
			);
			sprunget++;
			continue;
		}

		ramt++;
		const fra = new Date(gammelSlut).toISOString().slice(0, 10);
		const til = new Date(nySlut).toISOString().slice(0, 10);
		console.log(
			`  ${dryRun ? '✦' : '✓'} ${data.email} (forløb: ${forlobId})\n      expiresAt: ${fra} → ${til}`
		);
		// Også opdater bonusPeriodEndsAt hvis den matcher den gamle formel
		const gammelBonus = gammelSlut + 90 * dayMs;
		const nyBonus = nySlut + 90 * dayMs;
		const opdat: Record<string, number> = { expiresAt: nySlut };
		if (data.bonusPeriodEndsAt === gammelBonus) {
			opdat.bonusPeriodEndsAt = nyBonus;
			console.log(
				`      bonusPeriodEndsAt: ${new Date(gammelBonus).toISOString().slice(0, 10)} → ${new Date(nyBonus).toISOString().slice(0, 10)}`
			);
		}

		if (!dryRun) {
			await userDoc.ref.update(opdat);
			opdateret++;
		}
	}

	console.log(`\n${dryRun ? '[DRY] ' : ''}Resultat:`);
	console.log(`  Berørt af migration:  ${ramt}`);
	console.log(`  Opdateret:            ${opdateret}`);
	console.log(`  Sprunget:             ${sprunget}`);
}

main().catch((e) => {
	console.error('Fejl:', e);
	process.exit(1);
});
