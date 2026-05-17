// Inspicér hvordan pfMeals + pfMealFavorites er gemt i den gamle app.
// Læser kun — ændrer intet.

import { initializeApp, cert, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const k = JSON.parse(readFileSync(join(__dirname, 'vanetracker-key.json'), 'utf-8'));
const gammelApp: App = initializeApp({ credential: cert(k) }, 'gammel');
const db = getFirestore(gammelApp);

async function main() {
	console.log('=== Finder brugere med pfMeals ===');
	// Vi prøver med et par specifikke uids fra de 320
	const sampleUids = [
		'0FtJGIiRAoPbq7z8JXw5SGj79vI3', // vj@vivian-alex.dk
		'0Gdc7xGjLsYSZnbIT6cfpmRagCx1', // dorrit.flp@
		'0OHZuVeGCpO5KkbqDJsKJqaJzWg2'  // sofieht@
	];

	for (const uid of sampleUids) {
		const mealsSnap = await db
			.collection('users')
			.doc(uid)
			.collection('pfMeals')
			.limit(3)
			.get();
		console.log(`\n--- uid ${uid.slice(0, 12)}… pfMeals: ${mealsSnap.size} ---`);
		for (const d of mealsSnap.docs) {
			console.log('Doc id:', d.id);
			console.log(JSON.stringify(d.data(), null, 2));
		}

		const favSnap = await db
			.collection('users')
			.doc(uid)
			.collection('pfMealFavorites')
			.limit(3)
			.get();
		console.log(`--- uid ${uid.slice(0, 12)}… pfMealFavorites: ${favSnap.size} ---`);
		for (const d of favSnap.docs) {
			console.log('Doc id:', d.id);
			console.log(JSON.stringify(d.data(), null, 2));
		}
	}

	// Tæl total
	console.log('\n=== Aggregat (kan tage lidt tid) ===');
	const usersSnap = await db.collection('users').get();
	let medMeals = 0;
	let medFavs = 0;
	let totalMeals = 0;
	let totalFavs = 0;
	for (const u of usersSnap.docs) {
		const m = await db.collection('users').doc(u.id).collection('pfMeals').count().get();
		const f = await db.collection('users').doc(u.id).collection('pfMealFavorites').count().get();
		if (m.data().count > 0) medMeals++;
		if (f.data().count > 0) medFavs++;
		totalMeals += m.data().count;
		totalFavs += f.data().count;
	}
	console.log(`Brugere med pfMeals: ${medMeals} (i alt ${totalMeals} dokumenter)`);
	console.log(`Brugere med pfMealFavorites: ${medFavs} (i alt ${totalFavs} dokumenter)`);
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e);
		process.exit(1);
	});
