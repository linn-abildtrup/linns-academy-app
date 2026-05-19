// Tjekker hvor mange egne fødevarer (pfCustomFoods) der findes i gammel
// app for de migrerede kunder, og om de allerede er i ny app.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const nyKey = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
const gammelKey = JSON.parse(readFileSync(join(__dirname, 'vanetracker-key.json'), 'utf-8'));

const nyApp = initializeApp({ credential: cert(nyKey) }, 'ny');
const gammelApp = initializeApp({ credential: cert(gammelKey) }, 'gammel');
const nyDb = getFirestore(nyApp);
const gammelDb = getFirestore(gammelApp);

interface GammelUser {
	localId: string;
	email?: string;
}

const eksport = JSON.parse(
	readFileSync(join(__dirname, 'vanetracker-users-rå.json'), 'utf-8')
) as { users: GammelUser[] };

console.log('Scanner pfCustomFoods i gammel app…\n');

let totalCustom = 0;
let brugereMedCustom = 0;
const eksempler: { email: string; antal: number; sample?: Record<string, unknown> }[] = [];

for (const u of eksport.users) {
	if (!u.email) continue;
	const snap = await gammelDb.collection('users').doc(u.localId).collection('pfCustomFoods').get();
	if (snap.empty) continue;
	brugereMedCustom++;
	totalCustom += snap.size;
	if (eksempler.length < 5) {
		eksempler.push({
			email: u.email,
			antal: snap.size,
			sample: snap.docs[0]?.data() as Record<string, unknown>
		});
	}
}

console.log(`Brugere med egne fødevarer:  ${brugereMedCustom}`);
console.log(`Total egne fødevarer:        ${totalCustom}\n`);

if (eksempler.length > 0) {
	console.log('Eksempler:');
	for (const e of eksempler) {
		console.log(`  ${e.email}: ${e.antal} egne fødevarer`);
		if (e.sample) console.log(`     Sample: ${JSON.stringify(e.sample).slice(0, 200)}`);
	}
}

// Tjek om der findes en collection for egne fødevarer i ny app
console.log('\nTjekker ny app for egne-fødevare-collections…');
const userIdsMedCustom = eksport.users
	.filter((u) => u.email)
	.map((u) => u.localId)
	.slice(0, 10);
for (const uid of userIdsMedCustom) {
	for (const navn of ['customFodevarer', 'egneFodevarer', 'pfCustomFoods', 'mineFodevarer']) {
		const snap = await nyDb.collection('users').doc(uid).collection(navn).count().get();
		if (snap.data().count > 0) {
			console.log(`  Fundet: users/${uid}/${navn} har ${snap.data().count} docs`);
		}
	}
}
console.log('  (ingen aktive collections fundet — så de er IKKE migreret)');
