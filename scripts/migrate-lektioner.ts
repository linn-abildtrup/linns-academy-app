// Migration-script: kopier lektioner fra gammel vanetracker Firebase
// til det nye linns-academy-app projekt.
//
// Kilde: programConfig/global i vanetracker — felt days[YYYY-MM-DD].lessons[]
// Mål:   forlob/{forlobId}/forlobsdage/dag{N} i linns-academy-app
//
// Mapping: dagNummer = (lektionsdato - forløbets startDato) + 1
//   - Dag 1 = forløbets startdag
//   - Dag 0 = dagen før (baseline-dag)
//   - Dag 1-21 = programdage (eller op til antalDage)
//   - Lektioner uden for [0, antalDage] springes over (logges)
//
// Forudsætter:
//   - scripts/service-account-key.json    (linns-academy-app)
//   - scripts/vanetracker-key.json        (vanetracker — gammel database)
//
// Kør med:
//   npm run migrate:lektioner                          (kickstart_maj_2026, skriver)
//   npm run migrate:lektioner -- --dry                 (kun preview)
//   npm run migrate:lektioner -- --forlob <id>         (anden forløb-id)
//
// Idempotent: dage med samme dagNummer overskrives. Eksisterende lektioner
// for dagen erstattes. Note fra Linn (hvis sat i admin) bevares ikke —
// scriptet skriver hele dagen om. Kør derfor migrationen FØR Linn skriver
// noter i den nye admin.

import { initializeApp, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';

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
// Typer (matcher src/lib/content/forlob.ts)
// ==============================================

interface LektionItem {
	id: string;
	titel: string;
	beskrivelse: string;
	varighedMin: number;
	format: string;
	url: string;
}

interface ForlobDag {
	dagNummer: number;
	uge: number;
	lektioner: LektionItem[];
	noteFraLinn: string;
}

interface RefLektion {
	title?: string;
	url?: string;
}

// ==============================================
// Helpers
// ==============================================

function ugeForDag(dagNummer: number): number {
	if (dagNummer <= 0) return 0;
	return Math.ceil(dagNummer / 7);
}

function detekterFormat(url: string): string {
	if (!url) return '';
	const u = url.toLowerCase();
	if (u.includes('youtube.com/') || u.includes('youtu.be/')) return 'Video';
	if (u.includes('vimeo.com/')) return 'Video';
	if (u.endsWith('.pdf') || u.includes('.pdf?')) return 'PDF';
	if (u.endsWith('.mp3') || u.endsWith('.m4a') || u.endsWith('.wav')) return 'Lyd';
	return 'Link';
}

/**
 * Beregner dagNummer ud fra YYYY-MM-DD og forløbets startDato.
 * dag 1 = startDato, dag 0 = startDato - 1, dag -1 = før, osv.
 */
function dagNummerFor(dateKey: string, startDato: Date): number {
	const d = new Date(dateKey + 'T06:00:00');
	const start = new Date(startDato);
	start.setHours(6, 0, 0, 0);
	const ms = d.getTime() - start.getTime();
	const dage = Math.round(ms / (1000 * 60 * 60 * 24));
	return dage + 1;
}

// ==============================================
// Migration
// ==============================================

async function migrer() {
	console.log(`\n🌱 Migrerer lektioner til forløb '${forlobId}'`);
	if (dryRun) console.log('   (dry-run — skriver intet)');

	// Hent forløbet fra target for at få startDato + antalDage
	const forlobSnap = await targetDb.collection('forlob').doc(forlobId).get();
	if (!forlobSnap.exists) {
		console.error(`❌ Forløb '${forlobId}' findes ikke i target-projektet.`);
		process.exit(1);
	}
	const forlobData = forlobSnap.data() as { startDato: { toDate: () => Date }; antalDage: number; navn?: string };
	const startDato = forlobData.startDato.toDate();
	const antalDage = forlobData.antalDage;
	console.log(`   Forløb: ${forlobData.navn ?? forlobId}`);
	console.log(`   Start: ${startDato.toISOString().slice(0, 10)} · ${antalDage} dage\n`);

	// Hent ref-app's programConfig/global
	const programSnap = await sourceDb.collection('programConfig').doc('global').get();
	if (!programSnap.exists) {
		console.error('❌ Fandt ikke programConfig/global i vanetracker.');
		process.exit(1);
	}
	const programData = programSnap.data() as { days?: Record<string, { lessons?: RefLektion[] }> };
	const days = programData.days ?? {};
	const dateKeys = Object.keys(days).sort();
	console.log(`   Fandt ${dateKeys.length} dage med lektioner i vanetracker:`);

	// Map til dagNummer
	const grupperetPrDag = new Map<number, { dateKey: string; lessons: RefLektion[] }>();
	const sprungetOver: { dateKey: string; dagNummer: number; grund: string }[] = [];

	for (const dateKey of dateKeys) {
		const lessons = (days[dateKey].lessons ?? []).filter(
			(l) => l && l.title && l.url
		);
		if (lessons.length === 0) {
			sprungetOver.push({ dateKey, dagNummer: 0, grund: 'tom' });
			continue;
		}
		const dn = dagNummerFor(dateKey, startDato);
		if (dn < 0 || dn > antalDage) {
			sprungetOver.push({
				dateKey,
				dagNummer: dn,
				grund: dn < 0 ? 'før forløb' : 'efter forløb'
			});
			continue;
		}
		// Hvis flere kalender-datoer mapper til samme dagNummer (kan ske hvis
		// Linn har test-data tæt på forløbets start), samles lektionerne.
		const eksisterende = grupperetPrDag.get(dn);
		if (eksisterende) {
			grupperetPrDag.set(dn, {
				dateKey: eksisterende.dateKey,
				lessons: [...eksisterende.lessons, ...lessons]
			});
		} else {
			grupperetPrDag.set(dn, { dateKey, lessons });
		}
	}

	// Print oversigt
	const rapport: { dagNummer: number; dateKey: string; antalLektioner: number; titler: string[] }[] = [];
	for (const [dn, info] of [...grupperetPrDag.entries()].sort((a, b) => a[0] - b[0])) {
		rapport.push({
			dagNummer: dn,
			dateKey: info.dateKey,
			antalLektioner: info.lessons.length,
			titler: info.lessons.map((l) => l.title ?? '')
		});
	}

	for (const r of rapport) {
		console.log(`     Dag ${r.dagNummer.toString().padStart(2, ' ')} (${r.dateKey}): ${r.antalLektioner} lektion${r.antalLektioner === 1 ? '' : 'er'}`);
		for (const t of r.titler) {
			console.log(`        · ${t}`);
		}
	}

	if (sprungetOver.length > 0) {
		console.log(`\n   ${sprungetOver.length} dato${sprungetOver.length === 1 ? '' : 'er'} sprunget over:`);
		for (const s of sprungetOver) {
			console.log(`     ${s.dateKey} → dag ${s.dagNummer} (${s.grund})`);
		}
	}

	if (grupperetPrDag.size === 0) {
		console.log('\n   Ingen lektioner at migrere.');
		return;
	}

	if (dryRun) {
		console.log('\n   (dry-run — intet skrevet)');
		return;
	}

	// Skriv til target
	console.log(`\n   Skriver ${grupperetPrDag.size} forløbsdage...`);
	const batch = targetDb.batch();
	for (const [dn, info] of grupperetPrDag.entries()) {
		const lektioner: LektionItem[] = info.lessons.map((l) => ({
			id: randomUUID(),
			titel: (l.title ?? '').trim(),
			beskrivelse: '',
			varighedMin: 0,
			format: detekterFormat(l.url ?? ''),
			url: (l.url ?? '').trim()
		}));
		const dag: ForlobDag = {
			dagNummer: dn,
			uge: ugeForDag(dn),
			lektioner,
			noteFraLinn: ''
		};
		const ref = targetDb.collection('forlob').doc(forlobId).collection('forlobsdage').doc(`dag${dn}`);
		batch.set(ref, dag);
	}
	await batch.commit();
	console.log(`   ✓ ${grupperetPrDag.size} dage gemt`);

	const totalLektioner = rapport.reduce((sum, r) => sum + r.antalLektioner, 0);
	console.log(`   ✓ ${totalLektioner} lektion${totalLektioner === 1 ? '' : 'er'} migreret\n`);
}

migrer()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error('❌ Fejl:', e);
		process.exit(1);
	});
