// Sammenligner gamle app's pfMeals + pfMealFavorites mod ny app's
// maaltider + favoritmaaltider for hver migreret kunde. Rapporterer
// mismatch (mistede måltider).
//
// Brug: npx tsx scripts/tjek-maaltids-migration.ts

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
const kandidater = eksport.users.filter((u) => {
	const e = u.email?.toLowerCase();
	return e && !testEmails.has(e);
});

console.log(`Tjekker ${kandidater.length} migrerede kunder…\n`);

interface Resultat {
	email: string;
	uid: string;
	gammelMeals: number;
	nyMeals: number;
	gammelFavs: number;
	nyFavs: number;
}

const ramteMeals: Resultat[] = [];
const ramteFavs: Resultat[] = [];
let scannede = 0;
let totalManglendeMeals = 0;
let totalManglendeFavs = 0;

for (const u of kandidater) {
	const email = u.email!.toLowerCase();
	scannede++;
	if (scannede % 30 === 0) console.log(`  ${scannede}/${kandidater.length}…`);
	try {
		const [gMeals, nMeals, gFavs, nFavs] = await Promise.all([
			gammelDb.collection('users').doc(u.localId).collection('pfMeals').count().get(),
			nyDb.collection('users').doc(u.localId).collection('maaltider').count().get(),
			gammelDb.collection('users').doc(u.localId).collection('pfMealFavorites').count().get(),
			nyDb.collection('users').doc(u.localId).collection('favoritmaaltider').count().get()
		]);
		const gM = gMeals.data().count;
		const nM = nMeals.data().count;
		const gF = gFavs.data().count;
		const nF = nFavs.data().count;

		const res: Resultat = { email, uid: u.localId, gammelMeals: gM, nyMeals: nM, gammelFavs: gF, nyFavs: nF };
		if (gM > nM) {
			ramteMeals.push(res);
			totalManglendeMeals += gM - nM;
		}
		if (gF > nF) {
			ramteFavs.push(res);
			totalManglendeFavs += gF - nF;
		}
	} catch (e) {
		console.warn(`  ! ${email}: ${(e as Error).message}`);
	}
}

console.log(`\nFærdig.\n`);
console.log(`=== MÅLTIDER ===`);
console.log(`Kunder med færre måltider i ny app end gammel: ${ramteMeals.length}`);
console.log(`Total manglende måltider: ${totalManglendeMeals}\n`);
for (const r of ramteMeals.slice(0, 30)) {
	console.log(`  ${r.email}  · gammel=${r.gammelMeals}, ny=${r.nyMeals}, mangler=${r.gammelMeals - r.nyMeals}`);
}
if (ramteMeals.length > 30) console.log(`  … og ${ramteMeals.length - 30} flere`);

console.log(`\n=== FAVORITTER ===`);
console.log(`Kunder med færre favoritter i ny app end gammel: ${ramteFavs.length}`);
console.log(`Total manglende favoritter: ${totalManglendeFavs}\n`);
for (const r of ramteFavs.slice(0, 30)) {
	console.log(`  ${r.email}  · gammel=${r.gammelFavs}, ny=${r.nyFavs}, mangler=${r.gammelFavs - r.nyFavs}`);
}
if (ramteFavs.length > 30) console.log(`  … og ${ramteFavs.length - 30} flere`);
