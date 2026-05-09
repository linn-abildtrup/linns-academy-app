// Rydder allowedEmails-collection så kun emails der tilhører faktiske
// aktive brugere bevares. Alle andre slettes.
//
// Strategi:
//   1. Læs alle dokumenter i 'users' og find deres emails
//   2. Slet alle dokumenter i 'allowedEmails' der IKKE matcher
//
// Kør:
//   npx tsx scripts/ryd-allowedemails.ts            # dry-run (default)
//   npx tsx scripts/ryd-allowedemails.ts --skriv    # gennemfør sletning

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const skriv = process.argv.includes('--skriv');

async function main() {
	console.log(skriv ? '🗑️  Sletter fra Firestore...' : '🔍 Dry-run\n');

	const usersSnap = await db.collection('users').get();
	const aktiveEmails = new Set<string>();
	for (const u of usersSnap.docs) {
		const email = (u.data().email as string | undefined)?.toLowerCase();
		if (email) aktiveEmails.add(email);
	}
	console.log(`Aktive brugere (${aktiveEmails.size}):`);
	for (const e of aktiveEmails) console.log(`  ${e}`);

	const allowedSnap = await db.collection('allowedEmails').get();
	const bevares: string[] = [];
	const slettes: string[] = [];
	for (const d of allowedSnap.docs) {
		const email = (d.data().email as string | undefined)?.toLowerCase() ?? d.id;
		if (aktiveEmails.has(email)) bevares.push(email);
		else slettes.push(email);
	}

	console.log(`\nBevares: ${bevares.length}`);
	for (const e of bevares) console.log(`  ✓ ${e}`);
	console.log(`\nSlettes: ${slettes.length}`);

	if (!skriv) {
		console.log('\n(dry-run — kør med --skriv for at slette)');
		return;
	}

	const CHUNK = 400;
	let slettet = 0;
	for (let i = 0; i < allowedSnap.docs.length; i += CHUNK) {
		const slice = allowedSnap.docs.slice(i, i + CHUNK);
		const batch = db.batch();
		let n = 0;
		for (const d of slice) {
			const email = (d.data().email as string | undefined)?.toLowerCase() ?? d.id;
			if (aktiveEmails.has(email)) continue;
			batch.delete(d.ref);
			n++;
		}
		if (n > 0) {
			await batch.commit();
			slettet += n;
		}
	}
	console.log(`\n✓ ${slettet} dokumenter slettet.`);
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e);
		process.exit(1);
	});
