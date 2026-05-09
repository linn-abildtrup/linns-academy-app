// Migration-script: kopier FAQ-kategorier og -items fra gammel vanetracker
// Firebase til det nye linns-academy-app projekt.
//
// Kilde: top-level faqCategories/{id} og faqItems/{id} i vanetracker
// Mål:   forlob/{forlobId}/faqKategorier/{id} og forlob/{forlobId}/faqItems/{id}
//        i linns-academy-app
//
// Mapping (kategorier):
//   name       → navn
//   order      → orden
//   createdAt  → oprettet
//
// Mapping (items):
//   categoryId → kategoriId
//   question   → spoergsmaal
//   answer     → svar
//   order      → orden
//   published  → udgivet  (manglende felt eller true → true, false → false)
//   createdAt  → oprettet og opdateret (vi har ikke separat updated i ref-app)
//
// Forudsætter:
//   - scripts/service-account-key.json    (linns-academy-app)
//   - scripts/vanetracker-key.json        (vanetracker — gammel database)
//
// Kør med:
//   npm run migrate:faq                          (kickstart_maj_2026, skriver)
//   npm run migrate:faq -- --dry                 (kun preview)
//   npm run migrate:faq -- --forlob <id>         (anden forløb-id)
//
// Idempotent: bevarer original-ID fra vanetracker, så gentagne kørsler
// overskriver i stedet for at duplikere. Items uden question/answer springes
// over, items med ukendt categoryId springes også over (logges).

import { initializeApp, cert, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ==============================================
// CLI-argumenter
// ==============================================

const dryRun = process.argv.includes('--dry');
const forlobIdx = process.argv.indexOf('--forlob');
const forlobId = forlobIdx >= 0 ? process.argv[forlobIdx + 1] : 'kickstart_maj_2026';

// ==============================================
// Firebase-init
// ==============================================

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

const sourceDb: Firestore = getFirestore(sourceApp);
const targetDb: Firestore = getFirestore(targetApp);

// ==============================================
// Typer
// ==============================================

interface RefFaqCategory {
	name?: string;
	order?: number;
	createdAt?: FirebaseFirestore.Timestamp;
}

interface RefFaqItem {
	categoryId?: string;
	question?: string;
	answer?: string;
	order?: number;
	published?: boolean;
	createdAt?: FirebaseFirestore.Timestamp;
}

interface FaqKategoriDoc {
	navn: string;
	orden: number;
	oprettet: FirebaseFirestore.Timestamp;
}

interface FaqItemDoc {
	kategoriId: string;
	spoergsmaal: string;
	svar: string;
	orden: number;
	udgivet: boolean;
	oprettet: FirebaseFirestore.Timestamp;
	opdateret: FirebaseFirestore.Timestamp;
}

// ==============================================
// Migration
// ==============================================

async function migrer() {
	console.log(`\n🌱 Migrerer FAQ til forløb '${forlobId}'`);
	if (dryRun) console.log('   (dry-run — skriver intet)');

	// Tjek at target-forløbet findes
	const forlobSnap = await targetDb.collection('forlob').doc(forlobId).get();
	if (!forlobSnap.exists) {
		console.error(`❌ Forløb '${forlobId}' findes ikke i target-projektet.`);
		process.exit(1);
	}
	const forlobData = forlobSnap.data() as { navn?: string };
	console.log(`   Forløb: ${forlobData.navn ?? forlobId}\n`);

	// ----------------------------------------
	// Hent kategorier fra ref-app
	// ----------------------------------------

	const catSnap = await sourceDb.collection('faqCategories').get();
	const refKategorier = catSnap.docs.map((d) => ({
		id: d.id,
		data: d.data() as RefFaqCategory
	}));

	if (refKategorier.length === 0) {
		console.log('   Ingen FAQ-kategorier fundet i vanetracker. Stopper.');
		return;
	}

	console.log(`   Fandt ${refKategorier.length} kategori${refKategorier.length === 1 ? '' : 'er'}:`);
	for (const k of refKategorier) {
		console.log(`     · ${k.data.name ?? '(uden navn)'} (id: ${k.id})`);
	}

	// ----------------------------------------
	// Hent items fra ref-app
	// ----------------------------------------

	const itemSnap = await sourceDb.collection('faqItems').get();
	const refItems = itemSnap.docs.map((d) => ({
		id: d.id,
		data: d.data() as RefFaqItem
	}));

	console.log(`\n   Fandt ${refItems.length} spørgsmål total.`);

	const kendteKatIds = new Set(refKategorier.map((k) => k.id));
	const gyldigeItems: { id: string; data: RefFaqItem }[] = [];
	const sprungetOver: { id: string; grund: string }[] = [];

	for (const it of refItems) {
		const d = it.data;
		if (!d.question || !d.question.trim()) {
			sprungetOver.push({ id: it.id, grund: 'tomt spørgsmål' });
			continue;
		}
		if (!d.answer || !d.answer.trim()) {
			sprungetOver.push({ id: it.id, grund: 'tomt svar' });
			continue;
		}
		if (!d.categoryId || !kendteKatIds.has(d.categoryId)) {
			sprungetOver.push({ id: it.id, grund: `ukendt categoryId (${d.categoryId ?? 'mangler'})` });
			continue;
		}
		gyldigeItems.push(it);
	}

	// Print oversigt pr kategori
	console.log(`\n   Pr kategori:`);
	for (const k of refKategorier) {
		const antal = gyldigeItems.filter((it) => it.data.categoryId === k.id).length;
		console.log(`     ${k.data.name ?? '(uden navn)'}: ${antal} spørgsmål`);
	}

	if (sprungetOver.length > 0) {
		console.log(`\n   ${sprungetOver.length} spørgsmål sprunget over:`);
		for (const s of sprungetOver) {
			console.log(`     ${s.id} → ${s.grund}`);
		}
	}

	if (gyldigeItems.length === 0 && refKategorier.length === 0) {
		console.log('\n   Intet at migrere.');
		return;
	}

	if (dryRun) {
		console.log('\n   (dry-run — intet skrevet)');
		return;
	}

	// ----------------------------------------
	// Skriv kategorier til target
	// ----------------------------------------

	console.log(`\n   Skriver ${refKategorier.length} kategori${refKategorier.length === 1 ? '' : 'er'}...`);
	const katBatch = targetDb.batch();
	for (const k of refKategorier) {
		const doc: FaqKategoriDoc = {
			navn: (k.data.name ?? '').trim() || '(uden navn)',
			orden: typeof k.data.order === 'number' ? k.data.order : 0,
			oprettet: k.data.createdAt ?? Timestamp.now()
		};
		const ref = targetDb
			.collection('forlob')
			.doc(forlobId)
			.collection('faqKategorier')
			.doc(k.id);
		katBatch.set(ref, doc);
	}
	await katBatch.commit();
	console.log(`   ✓ ${refKategorier.length} kategori${refKategorier.length === 1 ? '' : 'er'} gemt`);

	// ----------------------------------------
	// Skriv items til target
	// ----------------------------------------

	if (gyldigeItems.length === 0) {
		console.log('   (ingen gyldige spørgsmål at skrive)\n');
		return;
	}

	console.log(`\n   Skriver ${gyldigeItems.length} spørgsmål...`);
	// Firestore batch-grænse er 500 operationer
	const CHUNK = 400;
	for (let i = 0; i < gyldigeItems.length; i += CHUNK) {
		const slice = gyldigeItems.slice(i, i + CHUNK);
		const batch = targetDb.batch();
		for (const it of slice) {
			const d = it.data;
			const oprettet = d.createdAt ?? Timestamp.now();
			const doc: FaqItemDoc = {
				kategoriId: d.categoryId!,
				spoergsmaal: (d.question ?? '').trim(),
				svar: (d.answer ?? '').trim(),
				orden: typeof d.order === 'number' ? d.order : 0,
				udgivet: d.published !== false,
				oprettet,
				opdateret: oprettet
			};
			const ref = targetDb
				.collection('forlob')
				.doc(forlobId)
				.collection('faqItems')
				.doc(it.id);
			batch.set(ref, doc);
		}
		await batch.commit();
	}
	console.log(`   ✓ ${gyldigeItems.length} spørgsmål gemt\n`);
}

migrer()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error('❌ Fejl:', e);
		process.exit(1);
	});
