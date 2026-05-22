// Importerer opskrifter-30-30-3.csv til Firestore opskrifter-collection.
//
// Sammenfletter CSV's mængde-angivne ingredienser med estimaterne fra
// estimater-opskrifter-mangder.json, og bygger fulde Opskrift-dokumenter.
//
// Inspireret af + Tip + næringsfakta klistres på som tekstblokke i bunden af
// instruktioner-feltet (matcher konventionen i de 59 eksisterende opskrifter).
//
// Brug:
//   npx tsx scripts/_importer-opskrifter-csv.ts           # dry-run (viser 3 første + total)
//   npx tsx scripts/_importer-opskrifter-csv.ts --apply   # skriver til Firestore

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const CSV_PATH = '/Users/linnabildtrup/Projekter/linns-academy-app/opskrifter-30-30-3.csv';
const EST_PATH = '/Users/linnabildtrup/Projekter/linns-academy-app/estimater-opskrifter-mangder.json';

const APPLY = process.argv.includes('--apply');

const KENDTE = new Set(['g', 'kg', 'ml', 'dl', 'l', 'spsk', 'tsk', 'stk', 'skive', 'skiver']);
const BROEK: Record<string, number> = {
	'½': 0.5,
	'¼': 0.25,
	'¾': 0.75,
	'⅓': 0.333,
	'⅔': 0.667,
	'⅛': 0.125
};

type Ingrediens = { navn: string; maengde: number; enhed: string };
type Estimat = { maengde: number; enhed: string };
type Estimater = Record<string, Record<string, Estimat>>;

function parseMaengde(s: string): number | null {
	const t = s.trim();
	if (t in BROEK) return BROEK[t];
	const blandet = t.match(/^(\d+)([½¼¾⅓⅔⅛])$/);
	if (blandet) return parseInt(blandet[1], 10) + BROEK[blandet[2]];
	const n = parseFloat(t.replace(',', '.'));
	return Number.isFinite(n) ? n : null;
}

function parseIngrediensFraCsv(raw: string): Ingrediens | null {
	const t = raw.trim();
	const klistret = t.match(/^(\d+(?:[,.]\d+)?)\s*(g|kg|ml|dl|l)\b\s*(.+)$/i);
	if (klistret) {
		return {
			navn: klistret[3].trim(),
			maengde: parseFloat(klistret[1].replace(',', '.')),
			enhed: klistret[2].toLowerCase()
		};
	}
	const tokens = t.split(/\s+/);
	const m = parseMaengde(tokens[0]);
	if (m !== null) {
		if (tokens.length >= 2 && KENDTE.has(tokens[1].toLowerCase())) {
			return {
				navn: tokens.slice(2).join(' '),
				maengde: m,
				enhed: tokens[1].toLowerCase() === 'skiver' ? 'skive' : tokens[1].toLowerCase()
			};
		}
		return { navn: tokens.slice(1).join(' '), maengde: m, enhed: 'stk' };
	}
	return null;
}

type ParsetOpskrift = {
	titel: string;
	kategori: 'morgenmad' | 'frokost' | 'aftensmad';
	beskrivelse: string;
	inspireretAf: string;
	protein: number;
	fiber: number;
	kalorier: number;
	tidMin: number;
	fremgangsmaade: string;
	tip: string;
	ingredienser: Ingrediens[];
};

function laesCsv(estimater: Estimater): ParsetOpskrift[] {
	const tekst = readFileSync(CSV_PATH, 'utf-8').replace(/\r/g, '');
	const linjer = tekst.split('\n').filter((l) => l.trim().length > 0);
	const ud: ParsetOpskrift[] = [];
	for (let i = 1; i < linjer.length; i++) {
		const c = linjer[i].split(';');
		if (c.length !== 11) continue;
		const titel = c[1].trim();
		const maaltid = c[0].trim().toLowerCase();
		let kategori: 'morgenmad' | 'frokost' | 'aftensmad';
		if (maaltid === 'morgenmad') kategori = 'morgenmad';
		else if (maaltid === 'frokost') kategori = 'frokost';
		else if (maaltid === 'aftensmad') kategori = 'aftensmad';
		else continue;

		const hoved = c[4].split(',').map((s) => s.trim()).filter((s) => s.length > 0);
		const ings: Ingrediens[] = [];
		const est = estimater[titel] || {};
		for (const raw of hoved) {
			const parsed = parseIngrediensFraCsv(raw);
			if (parsed) {
				ings.push(parsed);
			} else {
				const e = est[raw];
				if (e) {
					ings.push({ navn: raw, maengde: e.maengde, enhed: e.enhed });
				} else {
					ings.push({ navn: raw, maengde: 0, enhed: 'stk' });
				}
			}
		}

		ud.push({
			titel,
			kategori,
			beskrivelse: c[2].trim(),
			inspireretAf: c[3].trim(),
			protein: parseFloat(c[5]) || 0,
			fiber: parseFloat(c[6]) || 0,
			kalorier: parseFloat(c[7]) || 0,
			tidMin: parseFloat(c[8]) || 0,
			fremgangsmaade: c[9].trim(),
			tip: c[10].trim(),
			ingredienser: ings
		});
	}
	return ud;
}

function byggInstruktioner(o: ParsetOpskrift): string {
	const dele = [o.fremgangsmaade];
	if (o.inspireretAf) dele.push(`Inspireret af: ${o.inspireretAf}`);
	if (o.tip) dele.push(`Tip: ${o.tip}`);
	dele.push(
		`Protein: ${o.protein} g | Fiber: ${o.fiber} g | Kalorier: ${o.kalorier} kcal | Tid: ${o.tidMin} minutter`
	);
	return dele.join('\n\n');
}

async function main() {
	console.log(APPLY ? '=== APPLY mode ===\n' : '=== DRY-RUN ===\n');
	const estimater = JSON.parse(readFileSync(EST_PATH, 'utf-8')) as Estimater;
	const opskrifter = laesCsv(estimater);
	console.log(`📋 Parset ${opskrifter.length} opskrifter\n`);

	// Tjek duplikater mod Firestore
	const eks = await db.collection('opskrifter').get();
	const eksTitler = new Map<string, string>();
	for (const d of eks.docs) {
		const t = (d.data().titel || '').toLowerCase().trim();
		if (t) eksTitler.set(t, d.id);
	}
	const dupl = opskrifter.filter((o) => eksTitler.has(o.titel.toLowerCase()));
	if (dupl.length > 0) {
		console.log(`⚠️  ${dupl.length} duplikat-titler — disse springes over:`);
		for (const o of dupl) console.log(`   - "${o.titel}"`);
		console.log('');
	}
	const tilImport = opskrifter.filter((o) => !eksTitler.has(o.titel.toLowerCase()));
	console.log(`📋 ${tilImport.length} nye opskrifter at importere\n`);

	// Vis 3 første i dry-run
	if (!APPLY) {
		const sample = tilImport.slice(0, 3);
		for (const o of sample) {
			console.log(`\n=== "${o.titel}" (${o.kategori}) ===`);
			console.log(`Beskrivelse: ${o.beskrivelse.slice(0, 100)}...`);
			console.log(`${o.ingredienser.length} ingredienser:`);
			for (const ing of o.ingredienser) {
				console.log(`   ${ing.maengde} ${ing.enhed.padEnd(6)} ${ing.navn}`);
			}
			const inst = byggInstruktioner(o);
			console.log(`Instruktioner (${inst.length} tegn, sidste linje):`);
			const linjer = inst.split('\n').filter((l) => l.trim().length > 0);
			console.log(`   "${linjer[linjer.length - 1]}"`);
		}
		console.log(`\n(${tilImport.length - sample.length} mere ikke vist)\n`);
		console.log('Kør med --apply for at skrive til Firestore.');
		return;
	}

	// Apply: skriv batch-vis
	const batchSize = 400;
	let skrevet = 0;
	for (let start = 0; start < tilImport.length; start += batchSize) {
		const batch = db.batch();
		const sub = tilImport.slice(start, start + batchSize);
		for (const o of sub) {
			const ref = db.collection('opskrifter').doc();
			const doc = {
				titel: o.titel,
				beskrivelse: o.beskrivelse,
				billedeUrl: null,
				kategorier: [o.kategori],
				dietTags: [],
				defaultPortioner: 1,
				ingredienser: o.ingredienser,
				instruktioner: byggInstruktioner(o),
				aktiv: true,
				oprettet: FieldValue.serverTimestamp(),
				opdateret: FieldValue.serverTimestamp()
			};
			batch.set(ref, doc);
		}
		await batch.commit();
		skrevet += sub.length;
		console.log(`   ✓ Skrev ${skrevet}/${tilImport.length}`);
	}
	console.log(`\n✅ Færdig. ${skrevet} opskrifter skrevet til Firestore.`);
}

main().then(() => process.exit(0));
