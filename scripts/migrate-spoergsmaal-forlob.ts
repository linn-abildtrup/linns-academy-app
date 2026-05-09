// Migration: bagudfyld forlobId/forlobNavn/kundeType på eksisterende
// klientspoergsmaal-dokumenter. Spørgsmål gemt før forløbskontekst-feltet
// blev tilføjet har ingen forlobId, og bliver derfor ikke vist på den
// forløbs-specifikke admin-side `/app/admin/forlob/[id]/beskeder`.
//
// Strategi: for hvert spørgsmål uden forlobId, slå brugerens userProduct
// (kickstart) op og kopier forlobId derfra. Hvis brugeren ikke har et
// userProduct, eller hvis userProduct ikke har forlobId, lader vi
// dokumentet være — det forbliver i 'Uden forløb'-kategorien.
//
// Kør:
//   npx tsx scripts/migrate-spoergsmaal-forlob.ts            # dry-run
//   npx tsx scripts/migrate-spoergsmaal-forlob.ts --skriv    # skriv

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));

const app = initializeApp({ credential: cert(sa) });
const db = getFirestore(app);

const skriv = process.argv.includes('--skriv');

async function main() {
	console.log(skriv ? '🌱 Skriver til Firestore...\n' : '🔍 Dry-run\n');

	const spqSnap = await db.collection('klientspoergsmaal').get();
	const forlobCache = new Map<string, string>(); // forlobId → navn

	const opdateringer: { id: string; uid: string; forlobId: string; forlobNavn: string }[] = [];
	const sprungetOver: { id: string; grund: string }[] = [];

	for (const d of spqSnap.docs) {
		const data = d.data();
		if (data.forlobId) continue; // har allerede

		const uid = data.uid as string | undefined;
		if (!uid) {
			sprungetOver.push({ id: d.id, grund: 'mangler uid' });
			continue;
		}

		const upRef = db.collection('users').doc(uid).collection('products').doc('kickstart');
		const upSnap = await upRef.get();
		if (!upSnap.exists) {
			sprungetOver.push({ id: d.id, grund: 'ingen userProduct' });
			continue;
		}
		const up = upSnap.data() as { forlobId?: string };
		if (!up.forlobId) {
			sprungetOver.push({ id: d.id, grund: 'userProduct har ikke forlobId' });
			continue;
		}

		let forlobNavn = forlobCache.get(up.forlobId);
		if (!forlobNavn) {
			const fSnap = await db.collection('forlob').doc(up.forlobId).get();
			forlobNavn = (fSnap.data()?.navn as string | undefined) ?? up.forlobId;
			forlobCache.set(up.forlobId, forlobNavn);
		}

		opdateringer.push({ id: d.id, uid, forlobId: up.forlobId, forlobNavn });
	}

	console.log(`Vil opdatere ${opdateringer.length} spørgsmål:`);
	for (const o of opdateringer) {
		console.log(`  ${o.id} → ${o.forlobNavn}`);
	}
	if (sprungetOver.length > 0) {
		console.log(`\n${sprungetOver.length} sprunget over:`);
		for (const s of sprungetOver) console.log(`  ${s.id} → ${s.grund}`);
	}

	if (!skriv) {
		console.log('\n(dry-run — kør med --skriv for at opdatere)');
		return;
	}

	if (opdateringer.length === 0) {
		console.log('\n(intet at skrive)');
		return;
	}

	const CHUNK = 400;
	for (let i = 0; i < opdateringer.length; i += CHUNK) {
		const batch = db.batch();
		for (const o of opdateringer.slice(i, i + CHUNK)) {
			batch.update(db.collection('klientspoergsmaal').doc(o.id), {
				forlobId: o.forlobId,
				forlobNavn: o.forlobNavn,
				kundeType: 'forlobskunde'
			});
		}
		await batch.commit();
	}
	console.log(`\n✓ ${opdateringer.length} spørgsmål opdateret`);
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e);
		process.exit(1);
	});
