// Verificerer at alle oevelser i 84dage_kropsvaegt.csv findes i Firestore
// exercises-collection. Matcher paa navn (case-insensitive, ignorerer L/V/H).

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const CSV_PATH = '/Users/linnabildtrup/Projekter/linns-academy-app/84dage_kropsvægt.csv';

function normaliser(s: string): string {
	return s
		.toLowerCase()
		.replace(/\(v\)/g, '_left')
		.replace(/\(h\)/g, '_right')
		.replace(/\(venstre\)/g, '_left')
		.replace(/\(højre\)/g, '_right')
		.replace(/-/g, ' ')
		.replace(/æ/g, 'ae')
		.replace(/ø/g, 'oe')
		.replace(/å/g, 'aa')
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_|_$/g, '');
}

interface DagRow {
	dag: number;
	fase: string;
	type: string;
	tema: string;
	oevelser: string[];
	noter: string;
}

function parseCsv(tekst: string): DagRow[] {
	const linjer = tekst.split('\n').filter((l) => l.trim());
	const rows: DagRow[] = [];
	for (let i = 1; i < linjer.length; i++) {
		const f = linjer[i].split(',');
		if (f.length < 5) continue;
		const dag = parseInt(f[0], 10);
		if (!Number.isFinite(dag)) continue;
		// Oevelse-felter ligger paa positioner 4, 7, 10, 13, 16, 19, 22 (hver 3. fra index 4)
		const oevelser: string[] = [];
		for (let pos = 4; pos < f.length - 3; pos += 3) {
			const navn = (f[pos] ?? '').trim();
			if (navn) oevelser.push(navn);
		}
		rows.push({
			dag,
			fase: f[1]?.trim() ?? '',
			type: f[2]?.trim() ?? '',
			tema: f[3]?.trim() ?? '',
			oevelser,
			noter: (f[25] ?? '').trim()
		});
	}
	return rows;
}

async function main() {
	const csvTekst = readFileSync(CSV_PATH, 'utf-8');
	const dage = parseCsv(csvTekst);
	console.log(`Parset ${dage.length} dage`);

	// Hent alle Exercise-doks
	const exSnap = await db.collection('exercises').get();
	const idMap = new Map<string, { id: string; name: string }>();
	for (const d of exSnap.docs) {
		const data = d.data() as { name?: string };
		idMap.set(d.id, { id: d.id, name: data.name ?? d.id });
	}
	console.log(`Firestore: ${idMap.size} oevelser ialt`);

	// Byg lookup-map fra normaliseret navn → exercise id
	const navnTilId = new Map<string, string>();
	for (const ex of idMap.values()) {
		navnTilId.set(normaliser(ex.name), ex.id);
		// Ogsaa id selv
		navnTilId.set(ex.id, ex.id);
	}

	const ikkeFundne = new Set<string>();
	const unikkeOevelserBrugt = new Set<string>();

	console.log('\n## Tjek pr dag\n');
	for (const r of dage) {
		const fundne: string[] = [];
		const manglende: string[] = [];
		for (const oev of r.oevelser) {
			const norm = normaliser(oev);
			unikkeOevelserBrugt.add(oev);
			if (navnTilId.has(norm)) {
				fundne.push(navnTilId.get(norm)!);
			} else {
				manglende.push(oev);
				ikkeFundne.add(oev);
			}
		}
		if (manglende.length > 0) {
			console.log(`Dag ${r.dag} [${r.tema}]:`);
			for (const m of manglende) console.log(`  MANGLER: '${m}'`);
		}
	}

	console.log(`\n## Sammenfatning`);
	console.log(`Unikke oevelser brugt i 84 dage: ${unikkeOevelserBrugt.size}`);
	console.log(`Oevelser uden match: ${ikkeFundne.size}`);
	if (ikkeFundne.size > 0) {
		console.log('\nUnikke ikke-fundne navne:');
		for (const n of ikkeFundne) console.log(`  ${n}`);
	}
}
main().then(() => process.exit(0));
