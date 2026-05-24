// Vis alle 7 spoergsmaal stemplet med forlobId=kickstart_maj_2026 saa
// Linn kan beslutte hvilke der skal flyttes til Kropsro.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

async function main() {
	const snap = await db.collection('klientspoergsmaal')
		.where('forlobId', '==', 'kickstart_maj_2026')
		.get();

	console.log(`Antal spoergsmaal med forlobId=kickstart_maj_2026: ${snap.size}\n`);

	// Hent alle relevante users for at se deres nuvaerende activeProduct
	const emails = [...new Set(snap.docs.map((d) => d.data().email).filter(Boolean))];
	const userMap = new Map<string, { activeProduct: string; forlobIds: string[] }>();
	for (const email of emails) {
		const u = await db.collection('users').where('email', '==', email).limit(1).get();
		if (!u.empty) {
			const data = u.docs[0].data();
			userMap.set(email, {
				activeProduct: String(data.activeProduct ?? '?'),
				forlobIds: (data.forlobIds ?? []) as string[]
			});
		}
	}

	// Sorter efter oprettet (nyeste foerst)
	const docs = snap.docs.slice().sort((a, b) => {
		const at = a.data().oprettet?.toMillis?.() ?? 0;
		const bt = b.data().oprettet?.toMillis?.() ?? 0;
		return bt - at;
	});

	let i = 1;
	for (const d of docs) {
		const data = d.data();
		const dato = data.oprettet?.toDate?.()?.toLocaleString?.('da-DK', { timeZone: 'Europe/Copenhagen' }) ?? '?';
		const user = userMap.get(data.email);
		const nu = user
			? `nuvaerende activeProduct=${user.activeProduct}, forlobIds=[${user.forlobIds.join(', ')}]`
			: 'bruger ikke fundet';
		console.log(`${i}. [${d.id}]`);
		console.log(`   Email:    ${data.email ?? '?'}`);
		console.log(`   Sendt:    ${dato}`);
		console.log(`   Status:   ${data.status ?? '?'}`);
		console.log(`   Tekst:    "${String(data.spoergsmaal ?? data.tekst ?? '').slice(0, 100)}"`);
		console.log(`   ${nu}`);
		console.log('');
		i++;
	}
}
main().then(() => process.exit(0));
