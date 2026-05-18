// Kompakt overblik for en liste af kunder — én linje pr kunde med
// måltider, favoritter, vane-dage og om de har baseline.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const emails = process.argv.slice(2).map((e) => e.trim().toLowerCase());

console.log(`Tjekker ${emails.length} kunder:\n`);
console.log('email'.padEnd(36) + ' navn'.padEnd(20) + ' adgang'.padEnd(18) + ' måltider | favs | vanedage | baseline');
console.log('-'.repeat(110));

for (const email of emails) {
	const snap = await db.collection('users').where('email', '==', email).get();
	if (snap.empty) {
		console.log(email.padEnd(36) + ' (ingen users-doc)');
		continue;
	}
	for (const userDoc of snap.docs) {
		const data = userDoc.data() as Record<string, unknown>;
		const navn = String(data.firstName ?? '').slice(0, 18);
		const adgang = `${data.accessLevel ?? '-'}/${data.accessSource ?? '-'}`;
		const maaltider = (await userDoc.ref.collection('maaltider').get()).size;
		const favoritter = (await userDoc.ref.collection('favoritmaaltider').get()).size;
		const vanedage = await userDoc.ref
			.collection('products')
			.doc('kickstart')
			.collection('vanedage')
			.get();
		const harBaseline = vanedage.docs.some((d) => (d.data() as { dagNummer?: number }).dagNummer === 0);
		console.log(
			email.padEnd(36) +
				' ' +
				navn.padEnd(19) +
				' ' +
				adgang.padEnd(17) +
				' ' +
				String(maaltider).padStart(8) +
				' | ' +
				String(favoritter).padStart(4) +
				' | ' +
				String(vanedage.size).padStart(8) +
				' | ' +
				(harBaseline ? '✓' : '–')
		);
	}
}
