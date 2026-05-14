// Importerer HTML-lektioner fra den gamle app til Kickstart maj 2026-forløbet
// i den nye app. Læser:
//   - scripts/gamle-html-lektioner.json     (HTML-indhold)
//   - scripts/gammel-lektioner.json         (mapping: lesson:// → dato + titel)
//
// Pr lesson://-URL:
//   1. Upload HTML-content til Firebase Storage:
//      forlob/kickstart_maj_2026/html/{filnavn}.html
//   2. Find dagnummer ud fra dato
//   3. Append ny LektionItem på forløbsdagen (uden at slette eksisterende)
//
// Kør med:
//   npm run importer:gamle-html-lektioner            (skriver til Firestore + Storage)
//   npm run importer:gamle-html-lektioner -- --dry   (preview, ingen ændringer)

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
const STORAGE_BUCKET = 'linns-academy-app.firebasestorage.app';
const FORLOB_ID = 'kickstart_maj_2026';
const dryRun = process.argv.includes('--dry');

initializeApp({ credential: cert(sa), storageBucket: STORAGE_BUCKET });
const db = getFirestore();
const bucket = getStorage().bucket();

interface HtmlLessonExport {
	title?: string;
	htmlContent?: string;
}

interface GammelLektion {
	title: string;
	url: string;
}

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

function slug(s: string): string {
	return s
		.toLowerCase()
		.replace(/æ/g, 'ae')
		.replace(/ø/g, 'oe')
		.replace(/å/g, 'aa')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60);
}

function ugeForDag(dagNummer: number): number {
	if (dagNummer <= 0) return 0;
	return Math.ceil(dagNummer / 7);
}

function dageImellem(fra: string, til: string): number {
	const f = new Date(fra + 'T12:00:00');
	const t = new Date(til + 'T12:00:00');
	return Math.round((t.getTime() - f.getTime()) / (24 * 60 * 60 * 1000));
}

async function uploadHtmlContent(
	id: string,
	titel: string,
	html: string
): Promise<string> {
	const filnavn = `${id}-${slug(titel) || 'lektion'}.html`;
	const destination = `forlob/${FORLOB_ID}/html/${filnavn}`;
	const token = randomUUID();
	const file = bucket.file(destination);
	await file.save(html, {
		contentType: 'text/html; charset=utf-8',
		metadata: {
			metadata: { firebaseStorageDownloadTokens: token }
		}
	});
	return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(destination)}?alt=media&token=${token}`;
}

async function main() {
	console.log(`${dryRun ? '[DRY] ' : ''}Importerer HTML-lektioner → ${FORLOB_ID}\n`);

	const htmlLessons = JSON.parse(
		readFileSync(join(__dirname, 'gamle-html-lektioner.json'), 'utf-8')
	) as Record<string, HtmlLessonExport>;
	const lektionEksport = JSON.parse(
		readFileSync(join(__dirname, 'gammel-lektioner.json'), 'utf-8')
	) as {
		startDate: string;
		days: Record<string, { lessons: GammelLektion[] }>;
	};

	// Hent forløb-startdato fra den nye app
	const forlobSnap = await db.collection('forlob').doc(FORLOB_ID).get();
	if (!forlobSnap.exists) {
		console.error(`Forløb ${FORLOB_ID} findes ikke.`);
		process.exit(1);
	}
	const forlobData = forlobSnap.data() as { startDato: Timestamp; antalDage: number };
	const nyStart = forlobData.startDato.toDate();
	const nyStartKey = nyStart.toISOString().slice(0, 10);

	console.log(`Ny startdato: ${nyStartKey} (${forlobData.antalDage} dage)`);
	console.log(`HTML-lektioner i alt: ${Object.keys(htmlLessons).length}\n`);

	// Saml alle lesson://-references pr dato fra gammel-lektioner.json
	type ReferenceInfo = { id: string; titel: string; dato: string; dagNummer: number };
	const referencer: ReferenceInfo[] = [];
	for (const dato of Object.keys(lektionEksport.days)) {
		for (const l of lektionEksport.days[dato].lessons || []) {
			if (l.url && l.url.startsWith('lesson://')) {
				const id = l.url.replace('lesson://', '');
				const dagNummer = dageImellem(nyStartKey, dato);
				referencer.push({ id, titel: l.title, dato, dagNummer });
			}
		}
	}

	console.log(`Fundet ${referencer.length} lesson://-references at importere.\n`);

	let opgraderet = 0;
	let oprettet = 0;
	let sprunget = 0;

	for (const ref of referencer) {
		const htmlData = htmlLessons[ref.id];
		if (!htmlData || !htmlData.htmlContent) {
			console.log(`  ✗ ${ref.id} ikke fundet i gamle-html-lektioner.json — springes over`);
			sprunget++;
			continue;
		}
		if (ref.dagNummer < 0 || ref.dagNummer > forlobData.antalDage) {
			console.log(`  ↷ "${ref.titel}" (dag ${ref.dagNummer}) — uden for forløb`);
			sprunget++;
			continue;
		}

		console.log(`  ▸ dag${ref.dagNummer} · "${ref.titel}"`);
		console.log(`      ${htmlData.htmlContent.length} tegn HTML`);

		let url: string;
		if (dryRun) {
			url = `(dry-run-url)`;
		} else {
			url = await uploadHtmlContent(ref.id, ref.titel, htmlData.htmlContent);
		}
		console.log(`      uploaded → ${dryRun ? '(skipped)' : url.slice(0, 80) + '…'}`);

		const nyLektion: LektionItem = {
			id: randomUUID(),
			titel: ref.titel,
			beskrivelse: '',
			varighedMin: 0,
			format: 'Inspiration',
			url
		};

		// Læs eksisterende forløbsdag og append
		const dagRef = db
			.collection('forlob')
			.doc(FORLOB_ID)
			.collection('forlobsdage')
			.doc(`dag${ref.dagNummer}`);
		const dagSnap = await dagRef.get();
		let dag: ForlobDag;
		if (dagSnap.exists) {
			dag = dagSnap.data() as ForlobDag;
			// Hvis lektionen allerede er importeret (samme titel + samme url-start), skip
			const fundet = dag.lektioner.find(
				(l) => l.titel === ref.titel && (l.format === 'Inspiration' || l.format === 'Skriftlig')
			);
			if (fundet) {
				console.log(`      ↷ allerede importeret, springes over`);
				sprunget++;
				continue;
			}
			dag.lektioner = [...dag.lektioner, nyLektion];
			opgraderet++;
			console.log(`      append til eksisterende dag (${dag.lektioner.length} lektioner i alt)`);
		} else {
			dag = {
				dagNummer: ref.dagNummer,
				uge: ugeForDag(ref.dagNummer),
				lektioner: [nyLektion],
				noteFraLinn: ''
			};
			oprettet++;
			console.log(`      opretter ny forløbsdag`);
		}

		if (!dryRun) {
			await dagRef.set(dag);
		}
	}

	console.log(`\n${dryRun ? '[DRY] ' : ''}Resultat:`);
	console.log(`  Forløbsdage opgraderet: ${opgraderet}`);
	console.log(`  Forløbsdage oprettet:   ${oprettet}`);
	console.log(`  Sprunget:               ${sprunget}`);
	if (dryRun) console.log('\n(dry-run — ingen data blev skrevet)');
}

main().catch((e) => {
	console.error('Fejl:', e);
	process.exit(1);
});
