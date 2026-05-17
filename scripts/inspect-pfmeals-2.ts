// Itererer alle 320 uids fra eksporten, tæller pfMeals + pfMealFavorites,
// og krydsrefererer fødevare-IDs mod ny app's fodevarer-collection.

import { initializeApp, cert, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const gammelKey = JSON.parse(readFileSync(join(__dirname, 'vanetracker-key.json'), 'utf-8'));
const nyKey = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));

const gammel: App = initializeApp({ credential: cert(gammelKey) }, 'gammel');
const ny: App = initializeApp({ credential: cert(nyKey) }, 'ny');

interface GammelUser {
	localId: string;
	email?: string;
}

function laesTestEmails(): Set<string> {
	const csv = readFileSync(join(__dirname, 'gamle-brugere_opdateret.csv'), 'utf-8');
	const test = new Set<string>();
	for (const linje of csv.split('\n').slice(1)) {
		const felter = linje.split(';');
		if (felter[6]?.trim().toUpperCase() === 'TEST') {
			const email = (felter[0] ?? '').replace(/"/g, '').trim().toLowerCase();
			if (email) test.add(email);
		}
	}
	return test;
}

async function main() {
	const eksport = JSON.parse(
		readFileSync(join(__dirname, 'vanetracker-users-rå.json'), 'utf-8')
	) as { users: GammelUser[] };
	const testEmails = laesTestEmails();
	const uids = eksport.users
		.filter((u) => u.email && !testEmails.has(u.email.toLowerCase()))
		.map((u) => ({ uid: u.localId, email: u.email!.toLowerCase() }));

	console.log(`Tjekker ${uids.length} brugere…`);

	const gammelDb = getFirestore(gammel);
	const nyDb = getFirestore(ny);

	let medMeals = 0;
	let medFavs = 0;
	let totalMeals = 0;
	let totalFavs = 0;
	const alleFoodIds = new Set<string>();

	let n = 0;
	for (const { uid } of uids) {
		const [mealSnap, favSnap] = await Promise.all([
			gammelDb.collection('users').doc(uid).collection('pfMeals').get(),
			gammelDb.collection('users').doc(uid).collection('pfMealFavorites').get()
		]);
		if (mealSnap.size > 0) medMeals++;
		if (favSnap.size > 0) medFavs++;
		totalMeals += mealSnap.size;
		totalFavs += favSnap.size;
		for (const d of [...mealSnap.docs, ...favSnap.docs]) {
			const items = (d.data().items ?? []) as { foodId?: string }[];
			for (const it of items) if (it.foodId) alleFoodIds.add(it.foodId);
		}
		n++;
		if (n % 50 === 0) console.log(`  ${n}/${uids.length} (${medMeals} m. meals, ${medFavs} m. favs)`);
	}

	console.log(`\n=== Resultat ===`);
	console.log(`Brugere med pfMeals:        ${medMeals}/${uids.length}  (i alt ${totalMeals} måltider)`);
	console.log(`Brugere med pfMealFavorites: ${medFavs}/${uids.length}  (i alt ${totalFavs} favoritter)`);
	console.log(`Unikke fødevare-IDs brugt:   ${alleFoodIds.size}`);

	// Tjek hvilke fødevare-IDs der findes i ny app
	console.log(`\nTjekker fødevare-overlap mod ny app's fodevarer…`);
	const nyFoodSnap = await nyDb.collection('fodevarer').get();
	const nyFoodIds = new Set(nyFoodSnap.docs.map((d) => d.id));
	console.log(`Ny app har ${nyFoodIds.size} fødevarer i fodevarer-collection`);

	const findes: string[] = [];
	const mangler: string[] = [];
	for (const id of alleFoodIds) {
		if (nyFoodIds.has(id)) findes.push(id);
		else mangler.push(id);
	}
	console.log(`\nFindes i ny app: ${findes.length}`);
	console.log(`Mangler i ny app: ${mangler.length}`);
	if (mangler.length > 0) {
		console.log(`\nFørste 20 manglende foodIds:`);
		for (const m of mangler.slice(0, 20)) console.log(`  ${m}`);
	}
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e);
		process.exit(1);
	});
