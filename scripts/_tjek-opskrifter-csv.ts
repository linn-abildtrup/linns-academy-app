// Dry-run-tjekker for opskrifter-30-30-3.csv før import til Firestore.
//
// Læser CSV'en, parser hovedingredienser-strengen, mapper til Opskrift-skemaet
// og rapporterer alt der kunne være et problem (duplikat-titler mod
// Firestore, ingredienser uden mængde, ukendte enheder, osv.).
//
// Kør med:
//   npx tsx scripts/_tjek-opskrifter-csv.ts

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const CSV_PATH = '/Users/linnabildtrup/Projekter/linns-academy-app/opskrifter-30-30-3.csv';

type Ingrediens = { navn: string; maengde: number; enhed: string };

type ParsedOpskrift = {
	titel: string;
	beskrivelse: string;
	kategori: 'morgenmad' | 'frokost' | 'aftensmad';
	inspireretAf: string;
	protein: number;
	fiber: number;
	kalorier: number;
	tidMin: number;
	fremgangsmaade: string;
	tip: string;
	hovedingredienserRaw: string;
	ingredienser: Ingrediens[];
	parseWarnings: string[];
};

const KENDTE_ENHEDER = new Set(['g', 'kg', 'ml', 'dl', 'l', 'spsk', 'tsk', 'stk', 'skive', 'skiver', 'håndfuld', 'håndfulde', 'klat', 'tern']);

const BROEK_MAP: Record<string, number> = {
	'½': 0.5,
	'¼': 0.25,
	'¾': 0.75,
	'⅓': 0.333,
	'⅔': 0.667,
	'⅛': 0.125
};

function parseMaengde(s: string): number | null {
	const trimmed = s.trim();
	if (trimmed in BROEK_MAP) return BROEK_MAP[trimmed];
	// "1½" = 1.5
	const blandet = trimmed.match(/^(\d+)([½¼¾⅓⅔⅛])$/);
	if (blandet) {
		const heltal = parseInt(blandet[1], 10);
		const broek = BROEK_MAP[blandet[2]];
		return heltal + broek;
	}
	const n = parseFloat(trimmed.replace(',', '.'));
	if (Number.isFinite(n)) return n;
	return null;
}

function parseIngrediens(raw: string, warnings: string[]): Ingrediens {
	const text = raw.trim();
	if (!text) return { navn: '', maengde: 0, enhed: 'stk' };

	// Pattern 1: "60g havregryn" eller "200g hvide bønner" — tal+enhed klistret sammen
	const klistret = text.match(/^(\d+(?:[,.]\d+)?)\s*(g|kg|ml|dl|l)\b\s*(.+)$/i);
	if (klistret) {
		return {
			navn: klistret[3].trim(),
			maengde: parseFloat(klistret[1].replace(',', '.')),
			enhed: klistret[2].toLowerCase()
		};
	}

	// Pattern 2: "1 spsk knuste hørfrø" — tal + space + enhed-ord + rest
	const tokens = text.split(/\s+/);
	const f = tokens[0];
	const m = parseMaengde(f);
	if (m !== null) {
		// Næste token kunne være en enhed
		if (tokens.length >= 2 && KENDTE_ENHEDER.has(tokens[1].toLowerCase())) {
			return {
				navn: tokens.slice(2).join(' '),
				maengde: m,
				enhed: tokens[1].toLowerCase()
			};
		}
		// Ingen enhed efter tallet → stk
		return {
			navn: tokens.slice(1).join(' '),
			maengde: m,
			enhed: 'stk'
		};
	}

	// Pattern 3: kun beskrivelse uden mængde ("blåbær", "kanel", "frisk timian")
	// Eksisterende konvention: maengde=0, enhed='stk' for smag/topping
	return { navn: text, maengde: 0, enhed: 'stk' };
}

function splitCsvLine(line: string): string[] {
	return line.split(';');
}

function parseCsv(): ParsedOpskrift[] {
	const tekst = readFileSync(CSV_PATH, 'utf-8').replace(/\r/g, '');
	const linjer = tekst.split('\n').filter((l) => l.trim().length > 0);
	const header = splitCsvLine(linjer[0]);
	if (header.length !== 11) {
		throw new Error(`Forventede 11 kolonner, fik ${header.length}`);
	}
	const opskrifter: ParsedOpskrift[] = [];
	for (let i = 1; i < linjer.length; i++) {
		const c = splitCsvLine(linjer[i]);
		if (c.length !== 11) {
			console.warn(`Linje ${i + 1}: ${c.length} kolonner — sprunget over`);
			continue;
		}
		const warnings: string[] = [];
		const maaltid = c[0].trim().toLowerCase();
		let kategori: 'morgenmad' | 'frokost' | 'aftensmad';
		if (maaltid === 'morgenmad') kategori = 'morgenmad';
		else if (maaltid === 'frokost') kategori = 'frokost';
		else if (maaltid === 'aftensmad') kategori = 'aftensmad';
		else {
			warnings.push(`Ukendt måltidstype "${c[0]}"`);
			kategori = 'frokost';
		}
		const hoved = c[4];
		const ingredienser = hoved
			.split(',')
			.map((s) => s.trim())
			.filter((s) => s.length > 0)
			.map((s) => parseIngrediens(s, warnings));
		opskrifter.push({
			titel: c[1].trim(),
			beskrivelse: c[2].trim(),
			kategori,
			inspireretAf: c[3].trim(),
			protein: parseFloat(c[5]) || 0,
			fiber: parseFloat(c[6]) || 0,
			kalorier: parseFloat(c[7]) || 0,
			tidMin: parseFloat(c[8]) || 0,
			fremgangsmaade: c[9].trim(),
			tip: c[10].trim(),
			hovedingredienserRaw: hoved.trim(),
			ingredienser,
			parseWarnings: warnings
		});
	}
	return opskrifter;
}

async function main() {
	const opskrifter = parseCsv();
	console.log(`📋 Parset ${opskrifter.length} opskrifter fra CSV\n`);

	// 1) Tjek duplikat-titler mod Firestore
	const snap = await db.collection('opskrifter').get();
	const eksTitler = new Map<string, string>(); // titel(lower) → docId
	for (const d of snap.docs) {
		const t = (d.data().titel || '').toLowerCase().trim();
		if (t) eksTitler.set(t, d.id);
	}
	console.log(`📋 Firestore har ${eksTitler.size} eksisterende opskrifter\n`);

	const duplikater: { csvTitel: string; firestoreId: string }[] = [];
	for (const o of opskrifter) {
		const hit = eksTitler.get(o.titel.toLowerCase());
		if (hit) duplikater.push({ csvTitel: o.titel, firestoreId: hit });
	}

	if (duplikater.length > 0) {
		console.log(`⚠️  ${duplikater.length} titler findes allerede i Firestore:`);
		for (const d of duplikater) {
			console.log(`   - "${d.csvTitel}" → ${d.firestoreId}`);
		}
		console.log('');
	} else {
		console.log(`✅ Ingen duplikat-titler\n`);
	}

	// 2) Ingrediens-parsing-statistik
	let antalIngTotal = 0;
	let antalUdenMaengde = 0;
	let antalUkendteEnheder = 0;
	const ukendteEnheder = new Set<string>();
	for (const o of opskrifter) {
		for (const ing of o.ingredienser) {
			antalIngTotal++;
			if (ing.maengde === 0) antalUdenMaengde++;
			if (!KENDTE_ENHEDER.has(ing.enhed)) {
				antalUkendteEnheder++;
				ukendteEnheder.add(ing.enhed);
			}
		}
	}
	console.log(`📋 Ingrediens-parsing:`);
	console.log(`   Total ingredienser: ${antalIngTotal}`);
	console.log(`   Uden mængde (smag/topping → maengde=0): ${antalUdenMaengde}`);
	console.log(`   Ukendte enheder: ${antalUkendteEnheder}`);
	if (ukendteEnheder.size > 0) {
		console.log(`   Enheder ikke i kendt liste: ${[...ukendteEnheder].join(', ')}`);
	}
	console.log('');

	// 3) Sample-output for første opskrift
	console.log('=== SAMPLE: første opskrift parset ===');
	const o = opskrifter[0];
	console.log(`Titel: ${o.titel}`);
	console.log(`Kategori: ${o.kategori}`);
	console.log(`Beskrivelse: ${o.beskrivelse}`);
	console.log(`Inspireret af: ${o.inspireretAf}`);
	console.log(`Protein/Fiber/Kcal/Tid: ${o.protein}g / ${o.fiber}g / ${o.kalorier} kcal / ${o.tidMin} min`);
	console.log(`Hovedingredienser (raw): ${o.hovedingredienserRaw}`);
	console.log(`Ingredienser parset:`);
	for (const ing of o.ingredienser) {
		console.log(`   - ${ing.maengde} ${ing.enhed} ${ing.navn}`);
	}
	console.log(`\nFremgangsmåde: ${o.fremgangsmaade.slice(0, 200)}...`);
	console.log(`\nTip: ${o.tip.slice(0, 150)}...`);

	// 4) Vis warnings
	const medWarnings = opskrifter.filter((o) => o.parseWarnings.length > 0);
	if (medWarnings.length > 0) {
		console.log(`\n⚠️  ${medWarnings.length} opskrifter med parse-warnings:`);
		for (const o of medWarnings) {
			console.log(`   - "${o.titel}": ${o.parseWarnings.join('; ')}`);
		}
	}

	// 5) Vis et par eksempler på ingrediens-parsing der måske ser mærkelig ud
	console.log('\n=== STIKPRØVE: ingredienser uden mængde (maengde=0) ===');
	let vist = 0;
	for (const o of opskrifter) {
		for (const ing of o.ingredienser) {
			if (ing.maengde === 0 && vist < 10) {
				console.log(`   "${o.titel}": ${ing.navn}`);
				vist++;
			}
		}
		if (vist >= 10) break;
	}
}
main().then(() => process.exit(0));
