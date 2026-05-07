// Migration-script: kopier opskrifter fra gammel vanetracker Firebase
// til det nye linns-academy-app projekt.
//
// Forudsætter:
//   - scripts/service-account-key.json    (linns-academy-app)
//   - scripts/vanetracker-key.json        (vanetracker — gammel database)
//
// Kør med:
//   npm run migrate:recipes              (alle opskrifter)
//   npm run migrate:recipes -- --dry     (kun preview, skriver intet)
//
// Idempotent: opskrifter med samme id overskrives. Du kan køre det flere
// gange. Det gemmer alle opskrifter som aktiv=false så Linn kan gennemgå
// dem og aktivere dem manuelt før klienterne ser dem.

import { initializeApp, cert, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const dryRun = process.argv.includes('--dry');

function loadKey(navn: string): App {
	const path = join(__dirname, navn);
	if (!existsSync(path)) {
		console.error(`❌ Mangler ${navn} i scripts/. Se README/handover for hvordan du henter den.`);
		process.exit(1);
	}
	const sa = JSON.parse(readFileSync(path, 'utf-8'));
	return initializeApp({ credential: cert(sa) }, navn);
}

const sourceApp = loadKey('vanetracker-key.json');
const targetApp = loadKey('service-account-key.json');

const sourceDb = getFirestore(sourceApp);
const targetDb = getFirestore(targetApp);

// ==============================================
// Mapping fra gammel struktur til ny
// ==============================================

const KENDTE_KATEGORIER = new Set([
	'morgenmad',
	'frokost',
	'aftensmad',
	'salat',
	'snack',
	'dessert',
	'tilbehor'
]);

interface GammelIngrediens {
	name?: string;
	displayName?: string;
	amount?: number;
	unit?: string;
	groceryGroup?: string;
}

interface GammelOpskrift {
	title?: string;
	description?: string;
	imageUrl?: string;
	defaultServings?: number;
	categories?: string[];
	dietTags?: string[];
	ingredients?: GammelIngrediens[];
	instructions?: string;
}

function mapKategori(rå: string): string | null {
	const lower = rå.toLowerCase().trim();
	const mapped =
		lower === 'morgen'
			? 'morgenmad'
			: lower === 'aften' || lower === 'middagsmad'
				? 'aftensmad'
				: lower === 'mellemmad' || lower === 'snacks'
					? 'snack'
					: lower === 'tilbehør'
						? 'tilbehor'
						: lower === 'salater'
							? 'salat'
							: lower;
	return KENDTE_KATEGORIER.has(mapped) ? mapped : null;
}

function mapKategorier(input: string[] | undefined): {
	kategorier: string[];
	droppede: string[];
} {
	if (!Array.isArray(input)) return { kategorier: [], droppede: [] };
	const kategorier: string[] = [];
	const droppede: string[] = [];
	for (const k of input) {
		const mapped = mapKategori(String(k));
		if (mapped) {
			if (!kategorier.includes(mapped)) kategorier.push(mapped);
		} else {
			droppede.push(String(k));
		}
	}
	return { kategorier, droppede };
}

function mapIngredienser(input: GammelIngrediens[] | undefined) {
	if (!Array.isArray(input)) return [];
	return input
		.map((ing) => ({
			navn: (ing.displayName || ing.name || '').toString().trim(),
			maengde: typeof ing.amount === 'number' ? ing.amount : 0,
			enhed: (ing.unit || '').toString().trim()
		}))
		.filter((ing) => ing.navn);
}

function mapOpskrift(id: string, gammel: GammelOpskrift) {
	const { kategorier, droppede } = mapKategorier(gammel.categories);
	const droppedDietTags = (gammel.dietTags ?? []).length;

	return {
		ny: {
			id,
			titel: (gammel.title || 'Uden titel').trim(),
			beskrivelse: (gammel.description || '').trim(),
			billedeUrl: gammel.imageUrl?.trim() || null,
			kategorier,
			defaultPortioner: gammel.defaultServings || 4,
			ingredienser: mapIngredienser(gammel.ingredients),
			instruktioner: (gammel.instructions || '').trim(),
			aktiv: false
		},
		ukendteKats: droppede,
		droppedDietTags
	};
}

async function main() {
	console.log(`🚚 Migrerer opskrifter fra vanetracker → linns-academy-app${dryRun ? ' (DRY-RUN)' : ''}`);

	const snap = await sourceDb.collection('recipes').get();
	if (snap.empty) {
		console.log('   (ingen opskrifter i vanetracker)');
		process.exit(0);
	}
	console.log(`\n📋 Fandt ${snap.size} opskrifter i vanetracker.\n`);

	let okay = 0;
	let utenIngredienser = 0;
	const ukendteKategorier = new Set<string>();
	let totalDroppedDietTags = 0;

	const batchSize = 400;
	const docs = snap.docs;

	for (let start = 0; start < docs.length; start += batchSize) {
		const chunk = docs.slice(start, start + batchSize);
		const batch = targetDb.batch();
		for (const d of chunk) {
			const { ny, ukendteKats, droppedDietTags } = mapOpskrift(
				d.id,
				d.data() as GammelOpskrift
			);
			ukendteKats.forEach((k) => ukendteKategorier.add(k));
			totalDroppedDietTags += droppedDietTags;
			if (ny.ingredienser.length === 0) utenIngredienser++;
			console.log(
				`   ${ny.titel}` +
					(ny.kategorier.length > 0 ? ` [${ny.kategorier.join(', ')}]` : '') +
					` · ${ny.ingredienser.length} ingredienser`
			);
			if (!dryRun) {
				const { id, ...data } = ny;
				const ref = targetDb.collection('opskrifter').doc(id);
				batch.set(ref, data, { merge: true });
			}
			okay++;
		}
		if (!dryRun) {
			await batch.commit();
		}
	}

	console.log(`\n✅ ${dryRun ? 'Ville migrere' : 'Migrerede'} ${okay} opskrifter`);
	if (utenIngredienser > 0) {
		console.log(`   ⚠️  ${utenIngredienser} opskrifter havde ingen ingredienser`);
	}
	if (ukendteKategorier.size > 0) {
		console.log(`   ⚠️  Ukendte kategorier sprunget over: ${[...ukendteKategorier].join(', ')}`);
	}
	if (totalDroppedDietTags > 0) {
		console.log(`   ℹ️  ${totalDroppedDietTags} dietTags droppet (ikke understøttet i ny model)`);
	}
	console.log(
		`\n   Alle opskrifter blev sat til aktiv=false. Gå til /app/admin/opskrifter for at gennemse og aktivere.`
	);
}

main().then(() => process.exit(0));
