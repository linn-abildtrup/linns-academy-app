// Importerer lektioner eksporteret fra den gamle app
// (scripts/gammel-lektioner.json) ind på Kickstart maj 2026-forløbet i den
// nye app. Springer 'lesson://'-URL'er over (HTML-lektioner — håndteres
// senere).
//
// Kør med:
//   npm run importer:gammel-lektioner            (skriver til Firestore)
//   npm run importer:gammel-lektioner -- --dry   (preview, ingen ændringer)

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const dryRun = process.argv.includes('--dry');
const FORLOB_ID = 'kickstart_maj_2026';

interface GammelLektion {
	title: string;
	url: string;
}

interface GammelDag {
	lessons: GammelLektion[];
}

interface GammelEksport {
	startDate: string;
	days: Record<string, GammelDag>;
}

interface LektionItem {
	id: string;
	titel: string;
	beskrivelse: string;
	varighedMin: number;
	format: string;
	url: string;
}

function udledFormat(url: string): string {
	const u = url.toLowerCase();
	if (/\.(mp3|m4a|wav|aac|ogg)(\?|$)/.test(u)) return 'Lyd';
	if (u.includes('youtube.com') || u.includes('youtu.be')) return 'Video';
	if (u.includes('vimeo.com')) return 'Video';
	if (u.includes('zoom.us/j/') || u.includes('zoom.us/meeting')) return 'Live';
	if (u.includes('zoom.us/rec/')) return 'Video';
	if (/\.mp4(\?|$)/.test(u)) return 'Video';
	if (/\.pdf(\?|$)/.test(u)) return 'PDF';
	return 'Link';
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

async function main() {
	console.log(`${dryRun ? '[DRY] ' : ''}Importerer gammel-lektioner.json → ${FORLOB_ID}\n`);

	const filsti = join(__dirname, 'gammel-lektioner.json');
	const data = JSON.parse(readFileSync(filsti, 'utf-8')) as GammelEksport;

	// Hent forløb-startdato fra den nye app
	const forlobSnap = await db.collection('forlob').doc(FORLOB_ID).get();
	if (!forlobSnap.exists) {
		console.error(`Forløb ${FORLOB_ID} findes ikke i den nye app.`);
		process.exit(1);
	}
	const forlobData = forlobSnap.data() as { startDato: Timestamp; antalDage: number };
	const nyStart = forlobData.startDato.toDate();
	const nyStartKey = nyStart.toISOString().slice(0, 10);
	console.log(`Ny forløbs startdato: ${nyStartKey} (${forlobData.antalDage} dage)`);
	console.log(`Gammel startdato: ${data.startDate}\n`);

	// Slet alle eksisterende forløbsdage så vi starter på en clean slate.
	const eksDageSnap = await db
		.collection('forlob')
		.doc(FORLOB_ID)
		.collection('forlobsdage')
		.get();
	if (eksDageSnap.size > 0) {
		console.log(
			`${dryRun ? '[DRY] ' : ''}Sletter ${eksDageSnap.size} eksisterende forløbsdag${eksDageSnap.size === 1 ? '' : 'e'} først…`
		);
		if (!dryRun) {
			const batch = db.batch();
			for (const d of eksDageSnap.docs) batch.delete(d.ref);
			await batch.commit();
		}
		console.log('');
	}

	const datoer = Object.keys(data.days).sort();
	let oprettet = 0;
	let sprunget = 0;
	let lektionerImporteret = 0;
	let lektionerSprunget = 0;

	for (const dato of datoer) {
		const dagNummer = dageImellem(nyStartKey, dato);
		if (dagNummer < 0 || dagNummer > forlobData.antalDage) {
			console.log(`  ↷ ${dato} (dag ${dagNummer}) — uden for forløb (0-${forlobData.antalDage}), springes over`);
			sprunget++;
			continue;
		}

		const lessons = data.days[dato]?.lessons ?? [];
		const filtered = lessons.filter((l) => !l.url.startsWith('lesson://'));
		const html = lessons.length - filtered.length;

		if (filtered.length === 0) {
			console.log(`  ↷ ${dato} (dag ${dagNummer}) — kun lesson://-URL'er (${html}), springes over`);
			lektionerSprunget += html;
			continue;
		}

		const lektioner: LektionItem[] = filtered.map((l) => ({
			id: randomUUID(),
			titel: l.title,
			beskrivelse: '',
			varighedMin: 0,
			format: udledFormat(l.url),
			url: l.url
		}));

		const dagDoc = {
			dagNummer,
			uge: ugeForDag(dagNummer),
			lektioner,
			noteFraLinn: ''
		};

		console.log(
			`  ✓ ${dato} → dag${dagNummer} (uge ${dagDoc.uge}) — ${filtered.length} lektion${filtered.length === 1 ? '' : 'er'}` +
				(html > 0 ? ` (sprunget ${html} HTML-lektion${html === 1 ? '' : 'er'})` : '')
		);
		for (const l of lektioner) {
			console.log(`     · ${l.format}: ${l.titel}`);
		}

		if (!dryRun) {
			await db
				.collection('forlob')
				.doc(FORLOB_ID)
				.collection('forlobsdage')
				.doc(`dag${dagNummer}`)
				.set(dagDoc);
		}

		oprettet++;
		lektionerImporteret += filtered.length;
		lektionerSprunget += html;
	}

	console.log(`\n${dryRun ? '[DRY] ' : ''}Resultat:`);
	console.log(`  Forløbsdage skrevet:   ${oprettet}`);
	console.log(`  Lektioner importeret:  ${lektionerImporteret}`);
	console.log(`  HTML-lektioner sprunget: ${lektionerSprunget}`);
	console.log(`  Datoer uden for forløb: ${sprunget}`);
	if (dryRun) console.log('\n(dry-run — ingen data blev skrevet)');
}

main().catch((e) => {
	console.error('Fejl:', e);
	process.exit(1);
});
