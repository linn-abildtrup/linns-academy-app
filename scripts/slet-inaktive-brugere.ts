// Sletter brugere der ikke har haft aktivitet i 5 år.
//
// "Sidste aktivitet" defineres som det seneste af:
//   - userDoc.updatedAt (sidste webhook eller sync)
//   - userDoc.bonusPeriodEndsAt (sidste bonus-periode-slut)
//   - userDoc.expiresAt (eksplicit udløbsdato)
//   - users/{uid}/products/{*}.koebt (sidste forløb-køb)
//
// Hvis seneste aktivitet er > 5 år gammel, slettes:
//   - users/{uid} doc + alle sub-collections
//   - allowedEmails/{email}
//   - klientspoergsmaal hvor uid matcher
//   - Firebase Auth-konto
//
// Kør:
//   npx tsx scripts/slet-inaktive-brugere.ts            # dry-run (default)
//   npx tsx scripts/slet-inaktive-brugere.ts --skriv    # gennemfør sletning
//   npx tsx scripts/slet-inaktive-brugere.ts --skriv --aar=4   # ændre tærskel

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const auth = getAuth();

const skriv = process.argv.includes('--skriv');
const aarArg = process.argv.find((a) => a.startsWith('--aar='));
const aar = aarArg ? parseInt(aarArg.split('=')[1], 10) : 5;
const taerskelMs = aar * 365 * 24 * 60 * 60 * 1000;

interface SletKandidat {
	uid: string;
	email: string;
	sidsteAktivitet: number;
	alderDage: number;
}

async function uddragSidsteAktivitet(
	uid: string,
	data: Record<string, unknown>
): Promise<number> {
	const kandidater: number[] = [];
	if (typeof data.updatedAt === 'number') kandidater.push(data.updatedAt);
	if (typeof data.bonusPeriodEndsAt === 'number') kandidater.push(data.bonusPeriodEndsAt);
	if (typeof data.expiresAt === 'number') kandidater.push(data.expiresAt);
	if (typeof data.createdAt === 'number') kandidater.push(data.createdAt);

	// Tjek seneste produkt-køb
	const productsSnap = await db.collection('users').doc(uid).collection('products').get();
	for (const p of productsSnap.docs) {
		const pd = p.data() as { koebt?: { toMillis?: () => number } };
		const koebt = pd.koebt?.toMillis?.();
		if (typeof koebt === 'number') kandidater.push(koebt);
	}

	if (kandidater.length === 0) return 0;
	return Math.max(...kandidater);
}

/**
 * Rekursivt slet en collection inkl. alle sub-docs. Firebase Admin har ingen
 * direkte API for dette — vi går igennem og sletter doc-for-doc.
 */
async function sletCollection(db: Firestore, collectionPath: string): Promise<number> {
	const ref = db.collection(collectionPath);
	const snap = await ref.get();
	let n = 0;
	for (const d of snap.docs) {
		// Tjek om dokumentet selv har sub-collections — slet dem rekursivt
		const subColls = await d.ref.listCollections();
		for (const sub of subColls) {
			n += await sletCollection(db, sub.path);
		}
		await d.ref.delete();
		n++;
	}
	return n;
}

async function sletBruger(kandidat: SletKandidat): Promise<void> {
	// Slet alle sub-collections under brugeren
	const subColls = await db.collection('users').doc(kandidat.uid).listCollections();
	for (const sub of subColls) {
		await sletCollection(db, sub.path);
	}
	// Slet selve user-dokumentet
	await db.collection('users').doc(kandidat.uid).delete();

	// Slet allowedEmails-entry hvis den findes
	if (kandidat.email) {
		await db.collection('allowedEmails').doc(kandidat.email).delete().catch(() => undefined);
	}

	// Slet klientspoergsmaal fra denne bruger
	const sporgSnap = await db
		.collection('klientspoergsmaal')
		.where('uid', '==', kandidat.uid)
		.get();
	for (const s of sporgSnap.docs) await s.ref.delete();

	// Slet Firebase Auth-konto
	await auth.deleteUser(kandidat.uid).catch((e) => {
		console.warn(`  Kunne ikke slette auth-konto for ${kandidat.email}: ${e.message}`);
	});
}

async function main() {
	console.log(skriv ? '🗑️  Skriver til Firestore...' : '🔍 Dry-run\n');
	console.log(`Tærskel: ${aar} år (${taerskelMs / (24 * 60 * 60 * 1000)} dage)\n`);

	const usersSnap = await db.collection('users').get();
	console.log(`Tjekker ${usersSnap.size} brugere...\n`);

	const kandidater: SletKandidat[] = [];
	const beholdes: number[] = [];
	const nu = Date.now();

	for (const u of usersSnap.docs) {
		const data = u.data();
		const email = (data.email as string | undefined) ?? '(ingen email)';
		const sidste = await uddragSidsteAktivitet(u.id, data);
		const alderMs = nu - sidste;

		if (sidste === 0) {
			console.log(`⚠️  ${u.id} (${email}) — ingen aktivitets-data fundet, springer over`);
			continue;
		}

		if (alderMs > taerskelMs) {
			kandidater.push({
				uid: u.id,
				email,
				sidsteAktivitet: sidste,
				alderDage: Math.floor(alderMs / (24 * 60 * 60 * 1000))
			});
		} else {
			beholdes.push(alderMs);
		}
	}

	console.log(`\n=== Slet-kandidater (${kandidater.length}) ===`);
	for (const k of kandidater) {
		console.log(`  ${k.email} (${k.uid}) — sidst aktiv ${k.alderDage} dage siden`);
	}

	console.log(`\n=== Beholdes (${beholdes.length}) ===`);
	if (beholdes.length > 0) {
		const dage = beholdes.map((ms) => Math.floor(ms / (24 * 60 * 60 * 1000)));
		const mindst = Math.min(...dage);
		const mest = Math.max(...dage);
		console.log(`  Aldre: fra ${mindst} til ${mest} dage siden`);
	}

	if (!skriv) {
		console.log('\n(dry-run — kør med --skriv for at slette)');
		return;
	}

	if (kandidater.length === 0) {
		console.log('\nIngen at slette. Færdig.');
		return;
	}

	console.log(`\n🗑️  Sletter ${kandidater.length} brugere...\n`);
	for (const k of kandidater) {
		try {
			await sletBruger(k);
			console.log(`  ✓ Slettet ${k.email}`);
		} catch (e) {
			console.error(`  ✗ Fejl ved sletning af ${k.email}:`, e);
		}
	}
	console.log('\n✓ Færdig.');
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e);
		process.exit(1);
	});
