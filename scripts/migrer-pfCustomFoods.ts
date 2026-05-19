// Migrerer pfCustomFoods (gamle app's egne fødevarer) til ny app's
// users/{uid}/customFodevarer/-collection.
//
// 75 kunder har 403 egne fødevarer totalt — alle bevares med samme
// doc.id, samme navn, protein, fiber, liquid-flag og hint.
// Tilføjer cat='andet' (gamle app havde ikke kategori) og kilde='custom'.
//
// Idempotent: bruger set med merge:true så genkørsel ikke duplikerer.
//
// Brug:
//   npx tsx scripts/migrer-pfCustomFoods.ts          # dry-run
//   npx tsx scripts/migrer-pfCustomFoods.ts --apply  # skriv

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');

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

interface GammelCustomFood {
	name?: string;
	p?: number;
	f?: number;
	liquid?: boolean;
	hint?: string;
	createdAt?: { _seconds?: number; toMillis?: () => number };
}

function laesTestEmails(): Set<string> {
	const csv = readFileSync(join(__dirname, 'gamle-brugere_opdateret.csv'), 'utf-8');
	const test = new Set<string>();
	for (const linje of csv.split('\n').slice(1)) {
		if (!linje.trim()) continue;
		const felter = linje.split(';');
		if (felter[6]?.trim().toUpperCase() === 'TEST') {
			const email = (felter[0] ?? '').replace(/"/g, '').trim().toLowerCase();
			if (email) test.add(email);
		}
	}
	return test;
}

const eksport = JSON.parse(
	readFileSync(join(__dirname, 'vanetracker-users-rå.json'), 'utf-8')
) as { users: GammelUser[] };
const testEmails = laesTestEmails();
const kandidater = eksport.users.filter(
	(u) => u.email && !testEmails.has(u.email.toLowerCase())
);

console.log(APPLY ? '=== APPLY ===\n' : '=== DRY-RUN ===\n');
console.log(`Tjekker ${kandidater.length} migrerede kunder…\n`);

let brugereMedData = 0;
let totalFodevarer = 0;
const eksempler: string[] = [];

for (const u of kandidater) {
	const snap = await gammelDb.collection('users').doc(u.localId).collection('pfCustomFoods').get();
	if (snap.empty) continue;
	brugereMedData++;
	totalFodevarer += snap.size;

	for (const d of snap.docs) {
		const data = d.data() as GammelCustomFood;
		const nyData = {
			name: data.name ?? '',
			cat: 'andet' as const,
			p: typeof data.p === 'number' ? data.p : 0,
			f: typeof data.f === 'number' ? data.f : 0,
			liquid: data.liquid === true,
			hint: data.hint ?? '',
			kilde: 'custom' as const
		};
		if (eksempler.length < 5) {
			eksempler.push(`${u.email}: "${nyData.name}" (p=${nyData.p}g/100g, f=${nyData.f}g/100g)`);
		}
		if (APPLY) {
			await nyDb
				.collection('users')
				.doc(u.localId)
				.collection('customFodevarer')
				.doc(d.id)
				.set(nyData, { merge: true });
		}
	}
}

console.log(`=== Eksempler ===`);
for (const e of eksempler) console.log(`  ${e}`);
console.log(`\n=== Resultat ===`);
console.log(`Kunder med egne fødevarer:  ${brugereMedData}`);
console.log(`Egne fødevarer migreret:    ${totalFodevarer}`);
if (!APPLY) console.log('\nKør med --apply for at skrive.');
