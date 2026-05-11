// Beriger de 492 resterende "ukendt"-kilde fødevarer ved at søge i
// Open Food Facts (OFF). For hver fødevare: laver navne-søgning og
// tager bedste match med komplet næringsdata.
//
// OFF har god dækning på dansk-mærkede produkter men ikke 100% — typisk
// virker det bedst for branded varer og forarbejdede produkter. Generiske
// danske termer (fx "Æggeblomme") har ofte ingen match.
//
// Kør:
//   npx tsx scripts/berig-via-openfoodfacts.ts            # dry-run
//   npx tsx scripts/berig-via-openfoodfacts.ts --skriv    # skriv
//   npx tsx scripts/berig-via-openfoodfacts.ts --limit=50 # første 50

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const skriv = process.argv.includes('--skriv');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : 0; // 0 = alle

// Pause mellem OFF-kald så vi ikke blocker. OFF tillader ~1-2 req/sek for
// gæste-brugere. Vi holder os på 350ms = ~3 req/sek for at være sikre.
const PAUSE_MS = 350;

interface Fodevare {
	id: string;
	navn?: string;
	name?: string;
	kilde?: string;
	kh?: number;
	fedt?: number;
	kcal?: number;
}

interface OffMatch {
	produktNavn: string;
	kh: number;
	fedt: number;
	kcal: number;
	score: number;
}

interface OffSearchResult {
	products?: Array<{
		product_name?: string;
		product_name_da?: string;
		generic_name?: string;
		generic_name_da?: string;
		brands?: string;
		nutriments?: {
			'carbohydrates_100g'?: number;
			'carbohydrates'?: number;
			'fat_100g'?: number;
			'fat'?: number;
			'energy-kcal_100g'?: number;
			'energy-kcal'?: number;
			'energy_100g'?: number;
		};
	}>;
}

function sleep(ms: number) {
	return new Promise((r) => setTimeout(r, ms));
}

async function sogOffQuery(query: string): Promise<OffMatch | null> {
	const url = `https://world.openfoodfacts.org/cgi/search.pl?action=process&search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=15`;
	try {
		const res = await fetch(url, {
			headers: {
				Accept: 'application/json',
				'User-Agent': 'LinnsAcademy/1.0 (linn@linnsacademy.dk)'
			}
		});
		if (!res.ok) return null;
		const data = (await res.json()) as OffSearchResult;
		const produkter = data.products ?? [];
		if (produkter.length === 0) return null;

		const q = query.toLowerCase();
		const kandidater: OffMatch[] = [];

		for (const p of produkter) {
			const navn =
				p.product_name_da?.trim() ||
				p.product_name?.trim() ||
				p.generic_name_da?.trim() ||
				p.generic_name?.trim() ||
				'';
			if (!navn) continue;
			const n = p.nutriments ?? {};
			const kh = n['carbohydrates_100g'] ?? n['carbohydrates'] ?? 0;
			const fedt = n['fat_100g'] ?? n['fat'] ?? 0;
			let kcal = n['energy-kcal_100g'] ?? n['energy-kcal'] ?? 0;
			if (!kcal) {
				const energy = n['energy_100g'] ?? 0;
				kcal = energy > 900 ? energy / 4.184 : energy;
			}
			// Spring produkter over uden kalorier (vi vil have komplet data)
			if (!kcal) continue;

			// Score: hvor godt matcher produktnavnet søgetermen?
			let score = 0;
			const navnLower = navn.toLowerCase();
			if (navnLower === q) score += 100;
			else if (navnLower.startsWith(q + ' ') || navnLower.startsWith(q + ',')) score += 60;
			else if (navnLower.startsWith(q)) score += 40;
			else if (navnLower.includes(' ' + q + ' ') || navnLower.includes(' ' + q)) score += 20;
			else if (navnLower.includes(q)) score += 10;
			// Hver søgeord-token der findes giver lille bonus
			for (const ord of q.split(/\s+/)) {
				if (ord.length >= 3 && navnLower.includes(ord)) score += 5;
			}
			// Foretrækker kortere produktnavne (mere generiske)
			score -= navn.length / 20;
			if (score <= 0) continue;
			kandidater.push({
				produktNavn: navn,
				kh: Math.round(kh * 10) / 10,
				fedt: Math.round(fedt * 10) / 10,
				kcal: Math.round(kcal),
				score
			});
		}
		if (kandidater.length === 0) return null;
		kandidater.sort((a, b) => b.score - a.score);
		return kandidater[0];
	} catch (e) {
		console.warn(`OFF-fejl for "${query}":`, e);
		return null;
	}
}

/**
 * Søger med flere variationer af navnet for at maksimere chancen for match.
 *   1. Fulde navn
 *   2. Uden komma-suffix
 *   3. Første ord
 *   4. Hovedord på engelsk (få cases der er kendte)
 */
async function sogOff(navn: string): Promise<OffMatch | null> {
	const variationer = byggSoegevariationer(navn);
	for (const v of variationer) {
		const m = await sogOffQuery(v);
		if (m && m.score >= 15) return m;
		await sleep(PAUSE_MS);
	}
	return null;
}

const DK_TIL_EN: Record<string, string> = {
	æble: 'apple',
	abrikos: 'apricot',
	agurk: 'cucumber',
	and: 'duck',
	ananas: 'pineapple',
	avokado: 'avocado',
	banan: 'banana',
	blåbær: 'blueberry',
	blomkål: 'cauliflower',
	broccoli: 'broccoli',
	brød: 'bread',
	citron: 'lemon',
	gulerod: 'carrot',
	hindbær: 'raspberry',
	hvidløg: 'garlic',
	ingefær: 'ginger',
	jordbær: 'strawberry',
	kartoffel: 'potato',
	kål: 'cabbage',
	kylling: 'chicken',
	laks: 'salmon',
	løg: 'onion',
	mandel: 'almond',
	mango: 'mango',
	mælk: 'milk',
	ost: 'cheese',
	pasta: 'pasta',
	peberfrugt: 'bell pepper',
	persille: 'parsley',
	porre: 'leek',
	radise: 'radish',
	rødbede: 'beetroot',
	rødkål: 'red cabbage',
	salat: 'lettuce',
	skinke: 'ham',
	spinat: 'spinach',
	svampe: 'mushroom',
	sødmælk: 'whole milk',
	tomat: 'tomato',
	tun: 'tuna',
	ærter: 'peas',
	ært: 'pea',
	æg: 'egg'
};

function byggSoegevariationer(navn: string): string[] {
	const v = new Set<string>();
	const lower = navn.toLowerCase().trim();
	v.add(lower);
	// Uden komma-suffix
	const udenKomma = lower.split(',')[0].trim();
	if (udenKomma !== lower) v.add(udenKomma);
	// Første ord
	const forsteOrd = udenKomma.split(/[\s,]+/)[0];
	if (forsteOrd && forsteOrd.length >= 4 && forsteOrd !== udenKomma) v.add(forsteOrd);
	// Engelsk oversættelse hvis kendt
	for (const [dk, en] of Object.entries(DK_TIL_EN)) {
		if (lower.includes(dk)) {
			v.add(en);
			break; // kun første match
		}
	}
	return Array.from(v);
}

async function main() {
	console.log(`📊 Henter ufuldstændige fødevarer fra Firestore...`);
	const snap = await db.collection('fodevarer').get();
	const alle: Fodevare[] = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Fodevare);
	const ufuldstaendige = alle.filter((f) => {
		if (f.kilde === 'community') return false;
		const manglerKh = f.kh === undefined || f.kh === null;
		const manglerFedt = f.fedt === undefined || f.fedt === null;
		const manglerKcal = f.kcal === undefined || f.kcal === null;
		return manglerKh || manglerFedt || manglerKcal;
	});

	const total = LIMIT > 0 ? Math.min(LIMIT, ufuldstaendige.length) : ufuldstaendige.length;
	console.log(`   Behandler ${total} af ${ufuldstaendige.length} ufuldstændige\n`);

	const matchede: Array<{ id: string; navn: string; match: OffMatch }> = [];
	const ikkeMatchede: string[] = [];

	for (let i = 0; i < total; i++) {
		const f = ufuldstaendige[i];
		const navn = (f.navn ?? f.name ?? '').trim();
		if (!navn) {
			ikkeMatchede.push(f.id);
			continue;
		}
		const match = await sogOff(navn);
		if (match) {
			matchede.push({ id: f.id, navn, match });
			console.log(
				`  [${(i + 1).toString().padStart(3)}/${total}] ${f.id.padEnd(30)} "${navn}" → "${match.produktNavn.slice(0, 40)}" (${match.kh}kh, ${match.fedt}fedt, ${match.kcal}kcal)`
			);
		} else {
			ikkeMatchede.push(f.id);
			console.log(
				`  [${(i + 1).toString().padStart(3)}/${total}] ${f.id.padEnd(30)} "${navn}" → INGEN MATCH`
			);
		}
		await sleep(PAUSE_MS);
	}

	console.log(`\n✓ Matchet: ${matchede.length}`);
	console.log(`✗ Ikke matchet: ${ikkeMatchede.length}\n`);

	if (!skriv) {
		console.log('(dry-run — kør med --skriv for at opdatere Firestore)');
		return;
	}

	console.log(`📝 Skriver ${matchede.length} berigelser til Firestore...`);
	const CHUNK = 400;
	for (let i = 0; i < matchede.length; i += CHUNK) {
		const batch = db.batch();
		for (const m of matchede.slice(i, i + CHUNK)) {
			batch.set(
				db.collection('fodevarer').doc(m.id),
				{ kh: m.match.kh, fedt: m.match.fedt, kcal: m.match.kcal },
				{ merge: true }
			);
		}
		await batch.commit();
		console.log(`   ✓ ${Math.min(i + CHUNK, matchede.length)} / ${matchede.length}`);
	}
	console.log(`\n✓ ${matchede.length} fødevarer beriget fra Open Food Facts.`);
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e);
		process.exit(1);
	});
