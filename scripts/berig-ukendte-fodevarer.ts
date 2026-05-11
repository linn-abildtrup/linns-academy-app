// Auto-berig de 840 "ukendt"-kilde fødevarer ved at matche dem mod Frida-data
// på navn. Dem der får match får tilføjet kh/fedt/kcal — resten skal håndteres
// manuelt via admin-UI.
//
// Kør:
//   npx tsx scripts/berig-ukendte-fodevarer.ts            # dry-run + rapport
//   npx tsx scripts/berig-ukendte-fodevarer.ts --skriv    # skriv til Firestore

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as XLSXMod from 'xlsx';
const XLSX = (XLSXMod as { default?: typeof XLSXMod }).default ?? XLSXMod;

const __dirname = dirname(fileURLToPath(import.meta.url));
const skriv = process.argv.includes('--skriv');

const FRIDA_PATH = join(__dirname, 'frida.xlsx');
if (!existsSync(FRIDA_PATH)) {
	console.error(`❌ Mangler ${FRIDA_PATH}`);
	process.exit(1);
}

const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

function toNumber(v: unknown): number {
	if (typeof v === 'number') return v;
	if (typeof v !== 'string') return 0;
	const cleaned = v.replace(',', '.').replace(/[^\d.-]/g, '');
	const n = parseFloat(cleaned);
	return Number.isFinite(n) ? n : 0;
}

interface FridaNaering {
	navn: string;
	kh: number;
	fedt: number;
	kcal: number;
}

function laesFrida(): Map<string, FridaNaering> {
	console.log(`📂 Læser ${FRIDA_PATH}...`);
	const wb = XLSX.readFile(FRIDA_PATH);
	const sheet = wb.Sheets['Data_Table'];
	if (!sheet) {
		console.error('❌ Mangler arket Data_Table');
		process.exit(1);
	}
	const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false });
	const headerRow = rows[0];
	const cells = headerRow.map((c) => String(c ?? '').toLowerCase().trim());

	let kh = -1;
	let fedt = -1;
	let kcal = -1;
	for (let i = 0; i < cells.length; i++) {
		const c = cells[i];
		if (
			kh === -1 &&
			(c === 'kulhydrat tilgængelig' ||
				c === 'kulhydrat, tilgængelig' ||
				c === 'kulhydrat' ||
				c === 'tilgængelig kulhydrat')
		)
			kh = i;
		if (fedt === -1 && c === 'fedt') fedt = i;
		if (kcal === -1 && (c === 'energi, kcal' || c === 'energi (kcal)' || c === 'energi kcal'))
			kcal = i;
	}
	if (kh === -1 || fedt === -1 || kcal === -1) {
		console.error('❌ Kunne ikke finde alle nødvendige kolonner');
		process.exit(1);
	}

	const map = new Map<string, FridaNaering>();
	for (const r of rows.slice(4)) {
		const navn = String(r[0] ?? '').trim();
		if (!navn) continue;
		const entry: FridaNaering = {
			navn,
			kh: toNumber(r[kh]),
			fedt: toNumber(r[fedt]),
			kcal: toNumber(r[kcal])
		};
		// Vi indekserer KUN det fulde lowercase navn — så findMatch tager
		// altid ranking-loopet og ikke første-træffer som er tilfældigt
		map.set(navn.toLowerCase(), entry);
	}
	console.log(`   ✓ Læst ${map.size} unikke Frida-navne\n`);
	return map;
}

interface Fodevare {
	id: string;
	navn?: string;
	name?: string;
	kilde?: string;
	kh?: number;
	fedt?: number;
	kcal?: number;
}

/**
 * Rangerer Frida-kandidater så vi foretrækker de mest generiske/rå varianter.
 *
 * Penalize: 'syltet', 'røget', 'tørret', 'frituret', 'stegt', 'kogt',
 *           'pasteuriseret', 'sukker', 'med X' (forarbejdede)
 * Bonus: 'rå', 'uspec.', 'naturel', 'frisk', 'hel', 'helt' eller kort navn
 */
function rankFrida(navn: string): number {
	let score = 0;
	const n = navn.toLowerCase();
	// Højere score = mindre ønsket
	if (n.includes('syltet')) score += 50;
	if (n.includes('røget')) score += 50;
	if (n.includes('tørret')) score += 40;
	if (n.includes('frituret')) score += 60;
	if (n.includes('stegt')) score += 30;
	if (n.includes('kogt')) score += 20;
	if (n.includes('pasteuriseret')) score += 30;
	if (n.includes('saft')) score += 20;
	if (n.includes('koncentrat')) score += 30;
	if (n.includes('puré') || n.includes('pure')) score += 20;
	if (n.includes('med ')) score += 25;
	if (n.includes('tilsat')) score += 15;
	if (n.includes('sukker')) score += 15;
	// Bonus (negativ score = mere ønsket)
	if (n.includes(', rå') || n.endsWith(' rå')) score -= 20;
	if (n.includes('uspec')) score -= 25;
	if (n.includes('naturel')) score -= 20;
	if (n.includes('frisk')) score -= 10;
	if (n.includes(', hel') || n.includes(', helt')) score -= 15;
	// Foretrækker default-arter over eksotiske
	if (n.includes('høne')) score -= 10;
	if (n.includes('and,') || n.includes(', and') || n.includes('gås') || n.includes('vagtel') || n.includes('struds')) score += 30;
	// Foretrækker konventionel drift over speciel ('økologisk', 'burhøns' er for specifik)
	if (n.includes('økologisk')) score += 8;
	if (n.includes('burhøns')) score += 5;
	if (n.includes('frilands')) score += 5;
	if (n.includes('skrabehøns')) score += 5;
	// Undgå isolerede æg-dele når vi leder efter hele æg
	if (n.includes('blomme')) score += 40;
	if (n.includes('æggehvide')) score += 40;
	if (n.includes('æggemasse')) score += 30;
	if (n.includes('røræg')) score += 30;
	// Kortere navn er ofte mere generisk
	score += navn.length / 10;
	return score;
}

function findMatch(
	navn: string,
	fridaMap: Map<string, FridaNaering>
): FridaNaering | null {
	if (!navn) return null;
	const lower = navn.toLowerCase().trim();

	// 1. Eksakt match
	let m = fridaMap.get(lower);
	if (m) return m;

	// 2. Uden komma-suffix ("Æg, helt" → "æg")
	const udenKomma = lower.split(',')[0].trim();
	if (udenKomma !== lower) {
		m = fridaMap.get(udenKomma);
		if (m) return m;
	}

	// 3. Find ALLE Frida-kandidater og vælg den bedst rangerede
	const forsteOrd = udenKomma.split(/\s+/)[0];
	if (forsteOrd && forsteOrd.length >= 2) {
		const kandidater: FridaNaering[] = [];
		for (const [key, entry] of fridaMap) {
			if (
				key === forsteOrd ||
				key.startsWith(forsteOrd + ',') ||
				key.startsWith(forsteOrd + ' ')
			) {
				kandidater.push(entry);
			}
		}
		if (kandidater.length === 0) return null;
		// Dedup på navn så vi ikke ranker samme entry flere gange
		const set = new Map<string, FridaNaering>();
		for (const k of kandidater) set.set(k.navn, k);
		const unik = Array.from(set.values());
		unik.sort((a, b) => rankFrida(a.navn) - rankFrida(b.navn));
		return unik[0];
	}

	return null;
}

async function main() {
	const fridaMap = laesFrida();

	console.log(`📊 Henter ufuldstændige fødevarer fra Firestore...`);
	const snap = await db.collection('fodevarer').get();
	const alle: Fodevare[] = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Fodevare);
	const ufuldstaendige = alle.filter((f) => {
		const manglerKh = f.kh === undefined || f.kh === null;
		const manglerFedt = f.fedt === undefined || f.fedt === null;
		const manglerKcal = f.kcal === undefined || f.kcal === null;
		// Spring rene community-uden-data over — dem er det meningsløst at auto-berige
		if (f.kilde === 'community') return false;
		return manglerKh || manglerFedt || manglerKcal;
	});

	console.log(`   Fundet ${ufuldstaendige.length} ufuldstændige fødevarer\n`);

	const matchede: Array<{ id: string; navn: string; frida: FridaNaering }> = [];
	const ikkeMatchede: Fodevare[] = [];

	for (const f of ufuldstaendige) {
		const navn = f.navn ?? f.name ?? '';
		const match = findMatch(navn, fridaMap);
		if (match) {
			matchede.push({ id: f.id, navn, frida: match });
		} else {
			ikkeMatchede.push(f);
		}
	}

	console.log(`✓ Matchet: ${matchede.length}`);
	console.log(`✗ Ikke matchet: ${ikkeMatchede.length}\n`);

	console.log(`=== Første 15 matches: ===`);
	for (const m of matchede.slice(0, 15)) {
		console.log(
			`  ${m.id.padEnd(35)} "${m.navn}" → "${m.frida.navn}"  (${m.frida.kh}g kh, ${m.frida.fedt}g fedt, ${m.frida.kcal} kcal)`
		);
	}

	console.log(`\n=== Første 15 IKKE-matchede: ===`);
	for (const f of ikkeMatchede.slice(0, 15)) {
		console.log(`  ${f.id.padEnd(35)} "${f.navn ?? f.name ?? '?'}"`);
	}

	if (!skriv) {
		console.log(`\n(dry-run — kør med --skriv for at opdatere Firestore)`);
		return;
	}

	console.log(`\n📝 Skriver ${matchede.length} berigelser til Firestore...`);
	const CHUNK = 400;
	for (let i = 0; i < matchede.length; i += CHUNK) {
		const batch = db.batch();
		for (const m of matchede.slice(i, i + CHUNK)) {
			batch.set(
				db.collection('fodevarer').doc(m.id),
				{ kh: m.frida.kh, fedt: m.frida.fedt, kcal: m.frida.kcal },
				{ merge: true }
			);
		}
		await batch.commit();
		console.log(`   ✓ ${Math.min(i + CHUNK, matchede.length)} / ${matchede.length}`);
	}
	console.log(`\n✓ ${matchede.length} fødevarer beriget. ${ikkeMatchede.length} mangler stadig — kør de igennem manuelt eller skriv dem til via admin-UI.`);
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e);
		process.exit(1);
	});
