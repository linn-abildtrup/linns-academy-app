// Opretter Exercise-doks i Firestore for hver raekke i mapping-resultat.csv.
// Skipper hvis doc'en allerede findes — overskriver INTET.
//
// Mapping:
//   Kategori 'Ben & Baller'              → cat='ben',         catLabel='Ben & Baller'
//   Kategori 'Overkrop – Pres'           → cat='overkrop',    catLabel='Overkrop - Pres'
//   Kategori 'Overkrop – Træk'           → cat='overkrop',    catLabel='Overkrop - Træk'
//   Kategori 'Core'                      → cat='core',        catLabel='Core'
//   Kategori 'Balance'                   → cat='stabilitet',  catLabel='Balance'
//   Kategori 'Stabilitet'                → cat='stabilitet',  catLabel='Stabilitet'
//   Kategori 'Mobilitet & opvarmning'    → cat='stabilitet',  catLabel='Mobilitet & opvarmning'
//
// Udstyr: 'kettlebell' hvis navn eller filnavn indeholder 'kettlebell',
//         'forhojning' hvis 'step' eller 'dips_chair', ellers 'ingen'.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const CSV_PATH =
	'/Users/linnabildtrup/Projekter/linns-academy-app/videos-to-upload/Ny øvelser/mapping-resultat.csv';

type Cat = 'ben' | 'overkrop' | 'core' | 'stabilitet';
type Udstyr = 'ingen' | 'kettlebell' | 'elastik' | 'haandvaegte' | 'forhojning';

interface Row {
	id: string;
	navn: string;
	kategori: string;
	videoFil: string;
	status: string;
	beskrivelse: string;
	trin: string[];
}

function parseCsv(tekst: string): Row[] {
	const linjer: string[] = [];
	let aktuel = '';
	let iKvote = false;
	for (const c of tekst) {
		if (c === '"') iKvote = !iKvote;
		if (c === '\n' && !iKvote) {
			linjer.push(aktuel);
			aktuel = '';
		} else {
			aktuel += c;
		}
	}
	if (aktuel) linjer.push(aktuel);

	const rows: Row[] = [];
	for (let i = 1; i < linjer.length; i++) {
		const linje = linjer[i];
		if (!linje.trim()) continue;
		const felter: string[] = [];
		let f = '';
		let kvote = false;
		for (const c of linje) {
			if (c === '"') {
				kvote = !kvote;
				continue;
			}
			if (c === ',' && !kvote) {
				felter.push(f);
				f = '';
			} else {
				f += c;
			}
		}
		felter.push(f);
		if (felter.length < 5) continue;
		rows.push({
			id: felter[0].trim(),
			navn: felter[1].trim(),
			kategori: felter[2].trim(),
			videoFil: felter[3].trim(),
			status: felter[4].trim(),
			beskrivelse: (felter[5] ?? '').trim(),
			trin: felter.slice(6, 12).map((t) => t.trim()).filter((t) => t.length > 0)
		});
	}
	return rows;
}

function mapKategori(csvKat: string): { cat: Cat; catLabel: string } {
	const k = csvKat.toLowerCase();
	if (k.includes('ben')) return { cat: 'ben', catLabel: csvKat };
	if (k.includes('overkrop')) return { cat: 'overkrop', catLabel: csvKat };
	if (k.includes('core')) return { cat: 'core', catLabel: csvKat };
	// Balance, Stabilitet, Mobilitet → stabilitet
	return { cat: 'stabilitet', catLabel: csvKat };
}

function detekterUdstyr(navn: string, fil: string): Udstyr[] {
	const s = (navn + ' ' + fil).toLowerCase();
	const udstyr: Udstyr[] = [];
	if (s.includes('kettlebell')) udstyr.push('kettlebell');
	if (s.includes('step') || s.includes('dips_chair') || s.includes('dips chair'))
		udstyr.push('forhojning');
	if (udstyr.length === 0) udstyr.push('ingen');
	return udstyr;
}

async function main() {
	const csvTekst = readFileSync(CSV_PATH, 'utf-8');
	const rows = parseCsv(csvTekst);
	console.log(`Raekker i CSV: ${rows.length}\n`);

	let oprettet = 0;
	let sprungetOver = 0;
	let fejlede = 0;

	for (const r of rows) {
		if (!r.id || !r.videoFil || r.videoFil === '(ingen)') {
			console.log(`SKIP   ${r.navn || '(uden navn)'} (mangler id eller video)`);
			sprungetOver++;
			continue;
		}
		const docRef = db.collection('exercises').doc(r.id);
		const snap = await docRef.get();
		if (snap.exists) {
			console.log(`SKIP   ${r.id} (findes allerede)`);
			sprungetOver++;
			continue;
		}
		const { cat, catLabel } = mapKategori(r.kategori);
		const udstyr = detekterUdstyr(r.navn, r.videoFil);
		const data = {
			id: r.id,
			name: r.navn,
			desc: r.beskrivelse,
			how: r.trin,
			cat,
			catLabel,
			tags: [],
			videoPath: r.videoFil,
			treaningsformer: ['mikrotraening' as const],
			udstyr,
			aktiv: true
		};
		try {
			await docRef.set(data);
			console.log(`OK     ${r.id} (${cat}, ${udstyr.join(',')})`);
			oprettet++;
		} catch (e) {
			console.error(`FEJL   ${r.id}: ${(e as Error).message}`);
			fejlede++;
		}
	}

	console.log('');
	console.log(`Oprettet: ${oprettet}`);
	console.log(`Sprunget over: ${sprungetOver}`);
	console.log(`Fejlede: ${fejlede}`);
}
main().then(() => process.exit(0));
