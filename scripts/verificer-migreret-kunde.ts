// Verificer at en migreret kunde har fået sin data korrekt overført.
// Tjekker:
//   - måltider (count)
//   - favoritter (count)
//   - vane-historik (antal dage + om baseline er der)
//   - 1 sample-vanedag (vist i sin helhed)
//   - 1 sample-måltid (vist i sin helhed)
//
// Brug:
//   npx tsx scripts/verificer-migreret-kunde.ts <email>

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const email = (process.argv[2] ?? '').trim().toLowerCase();
if (!email) {
	console.error('Brug: npx tsx scripts/verificer-migreret-kunde.ts <email>');
	process.exit(1);
}

const snap = await db.collection('users').where('email', '==', email).get();
if (snap.empty) {
	console.log(`Ingen users-doc med email=${email}`);
	process.exit(0);
}

for (const userDoc of snap.docs) {
	const uid = userDoc.id;
	const data = userDoc.data() as Record<string, unknown>;
	console.log(`\n=== ${email} ===`);
	console.log(`uid: ${uid}`);
	console.log(`navn: ${data.firstName} ${data.lastName ?? ''}`);
	console.log(`accessLevel: ${data.accessLevel} · accessSource: ${data.accessSource} · activeSub: ${data.activeSubscription}`);
	console.log(`forlobIds: ${JSON.stringify(data.forlobIds)}`);

	const maaltider = await userDoc.ref.collection('maaltider').get();
	console.log(`\n📒 Måltider: ${maaltider.size}`);
	if (maaltider.size > 0) {
		const seneste = maaltider.docs
			.map((d) => d.data())
			.sort((a, b) => (b.dato ?? '').localeCompare(a.dato ?? ''))[0];
		console.log(`   Seneste: ${seneste.dato} · ${seneste.navn} (${seneste.type}) · ${seneste.items?.length ?? 0} ingredienser`);
		console.log(`           protein=${seneste.totalP}g · fiber=${seneste.totalF}g`);
	}

	const favoritter = await userDoc.ref.collection('favoritmaaltider').get();
	console.log(`\n⭐ Favoritter: ${favoritter.size}`);
	if (favoritter.size > 0) {
		const f = favoritter.docs[0].data();
		console.log(`   Eksempel: ${f.navn} (${f.items?.length ?? 0} ingredienser)`);
	}

	const vanedage = await userDoc.ref.collection('products').doc('kickstart').collection('vanedage').get();
	console.log(`\n🌱 Vane-historik: ${vanedage.size} dage`);
	if (vanedage.size > 0) {
		const dage = vanedage.docs.map((d) => d.data()).sort((a, b) => (a.dagNummer ?? 0) - (b.dagNummer ?? 0));
		const dagsListe = dage.map((d) => d.dagNummer).join(', ');
		console.log(`   Dage gemt: ${dagsListe}`);
		const baseline = dage.find((d) => d.dagNummer === 0);
		if (baseline) {
			console.log(`\n   🩺 Baseline (dag 0):`);
			console.log(`      checkin: ${JSON.stringify(baseline.checkin ?? {})}`);
			console.log(`      note: ${(baseline.note || '').slice(0, 200)}${(baseline.note?.length ?? 0) > 200 ? '…' : ''}`);
		}
		const dag1 = dage.find((d) => d.dagNummer === 1);
		if (dag1) {
			console.log(`\n   📅 Dag 1 (eksempel):`);
			console.log(`      checks: ${JSON.stringify(dag1.checks ?? {})}`);
			console.log(`      bonus:  ${JSON.stringify(dag1.bonus ?? {})}`);
			console.log(`      note: ${(dag1.note || '').slice(0, 100)}`);
		}
	}
}
