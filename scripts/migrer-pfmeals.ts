// Migrerer brugerdata fra gammel app (vanetracker) til ny app (linns-academy-app):
//   pfMeals          → users/{uid}/maaltider
//   pfMealFavorites  → users/{uid}/favoritmaaltider
//
// Bruger UID 1:1 (de 320 importerede har samme UID i begge apps).
// Items med kendt foodId mappes direkte. Items med ukendt foodId (egne
// opskrifter, custom-fødevarer) mappes til manuel-items så navn + enhed
// bevares.
//
// Brug:
//   npx tsx scripts/migrer-pfmeals.ts                  # dry-run, alle
//   npx tsx scripts/migrer-pfmeals.ts --limit=5        # dry-run, 5 brugere
//   npx tsx scripts/migrer-pfmeals.ts --apply --limit=5
//   npx tsx scripts/migrer-pfmeals.ts --apply

import { initializeApp, cert, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const limitArg = args.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;

const gammelKey = JSON.parse(readFileSync(join(__dirname, 'vanetracker-key.json'), 'utf-8'));
const nyKey = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));

const gammel: App = initializeApp({ credential: cert(gammelKey) }, 'gammel');
const ny: App = initializeApp({ credential: cert(nyKey) }, 'ny');
const gammelDb = getFirestore(gammel);
const nyDb = getFirestore(ny);

const TYPE_MAP: Record<string, string> = {
	morgen: 'morgenmad',
	morgenmad: 'morgenmad',
	frokost: 'frokost',
	middag: 'aftensmad',
	aften: 'aftensmad',
	aftensmad: 'aftensmad',
	snack: 'snack'
};

interface GammelUser {
	localId: string;
	email?: string;
}

interface GammelItem {
	foodId?: string;
	name?: string;
	grams?: number;
	qty?: number;
	unit?: string;
	liquid?: boolean;
	p?: number;
	f?: number;
	isRecipe?: boolean;
	recipeId?: string | null;
}

interface NyItem {
	foodId: string;
	portion: number;
	enhedId?: string;
	manuel?: { navn: string; enhed: string };
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

function mapItem(gi: GammelItem, kendteFoodIds: Set<string>): NyItem {
	const portion = gi.qty ?? gi.grams ?? 0;
	const enhedId = gi.unit ?? 'g';
	if (gi.foodId && kendteFoodIds.has(gi.foodId)) {
		const item: NyItem = { foodId: gi.foodId, portion };
		if (enhedId && enhedId !== 'g') item.enhedId = enhedId;
		return item;
	}
	// Ukendt foodId — gem som manuelt item så navn + enhed bevares
	return {
		foodId: '',
		portion,
		manuel: { navn: gi.name ?? '(uden navn)', enhed: enhedId }
	};
}

async function main() {
	console.log(APPLY ? '=== APPLY mode ===' : '=== DRY-RUN ===\n');

	console.log('Henter ny app fødevare-IDs…');
	const nyFoodSnap = await nyDb.collection('fodevarer').get();
	const kendteFoodIds = new Set(nyFoodSnap.docs.map((d) => d.id));
	console.log(`  ${kendteFoodIds.size} fødevarer i ny app\n`);

	const eksport = JSON.parse(
		readFileSync(join(__dirname, 'vanetracker-users-rå.json'), 'utf-8')
	) as { users: GammelUser[] };
	const testEmails = laesTestEmails();
	const uids = eksport.users
		.filter((u) => u.email && !testEmails.has(u.email.toLowerCase()))
		.map((u) => ({ uid: u.localId, email: u.email!.toLowerCase() }))
		.slice(0, Number.isFinite(LIMIT) ? LIMIT : undefined);

	console.log(`Behandler ${uids.length} brugere…\n`);

	let brugereMedData = 0;
	let totalMeals = 0;
	let totalFavs = 0;
	let totalManuelleItems = 0;
	let totalGenkendteItems = 0;

	const eksemplerVist: string[] = [];

	for (const { uid, email } of uids) {
		const [mealsSnap, favsSnap] = await Promise.all([
			gammelDb.collection('users').doc(uid).collection('pfMeals').get(),
			gammelDb.collection('users').doc(uid).collection('pfMealFavorites').get()
		]);

		if (mealsSnap.empty && favsSnap.empty) continue;
		brugereMedData++;

		// Måltider
		for (const d of mealsSnap.docs) {
			const data = d.data();
			const gamleItems = (data.items ?? []) as GammelItem[];
			const nyeItems = gamleItems.map((gi) => mapItem(gi, kendteFoodIds));
			for (const it of nyeItems) {
				if (it.manuel) totalManuelleItems++;
				else totalGenkendteItems++;
			}

			const createdAt = data.createdAt;
			const oprettetMs =
				typeof createdAt?._seconds === 'number'
					? createdAt._seconds * 1000
					: createdAt?.toMillis?.() ?? Date.now();

			const nyMaaltid = {
				navn: data.name ?? '',
				type: TYPE_MAP[data.type] ?? 'morgenmad',
				dato: data.date ?? '',
				items: nyeItems,
				totalP: data.totalP ?? 0,
				totalF: data.totalF ?? 0,
				oprettet: Timestamp.fromMillis(oprettetMs),
				migreretFraGammel: true
			};

			if (eksemplerVist.length < 3) {
				eksemplerVist.push(
					`Måltid: ${nyMaaltid.navn} (${nyMaaltid.type}, ${nyMaaltid.dato}) — ${nyeItems.length} items: ${nyeItems.filter((i) => i.foodId).length} kendt, ${nyeItems.filter((i) => i.manuel).length} manuel`
				);
			}

			if (APPLY) {
				await nyDb
					.collection('users')
					.doc(uid)
					.collection('maaltider')
					.doc(d.id)
					.set(nyMaaltid, { merge: true });
			}
			totalMeals++;
		}

		// Favoritter
		for (const d of favsSnap.docs) {
			const data = d.data();
			const gamleItems = (data.items ?? []) as GammelItem[];
			const nyeItems = gamleItems.map((gi) => mapItem(gi, kendteFoodIds));
			for (const it of nyeItems) {
				if (it.manuel) totalManuelleItems++;
				else totalGenkendteItems++;
			}

			const createdAt = data.createdAt;
			const oprettetMs =
				typeof createdAt?._seconds === 'number'
					? createdAt._seconds * 1000
					: createdAt?.toMillis?.() ?? Date.now();

			const nyFavorit = {
				navn: data.name ?? '',
				items: nyeItems,
				oprettet: Timestamp.fromMillis(oprettetMs),
				migreretFraGammel: true
			};

			if (APPLY) {
				await nyDb
					.collection('users')
					.doc(uid)
					.collection('favoritmaaltider')
					.doc(d.id)
					.set(nyFavorit, { merge: true });
			}
			totalFavs++;
		}
	}

	console.log(`\n=== Eksempler ===`);
	for (const e of eksemplerVist) console.log(`  ${e}`);

	console.log(`\n=== Resultat ===`);
	console.log(`Brugere med data:    ${brugereMedData}`);
	console.log(`Måltider migreret:   ${totalMeals}`);
	console.log(`Favoritter migreret: ${totalFavs}`);
	console.log(`Items genkendt:      ${totalGenkendteItems}`);
	console.log(`Items manuelt:       ${totalManuelleItems}`);
	if (!APPLY) console.log('\nKør med --apply for at skrive.');
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e);
		process.exit(1);
	});
