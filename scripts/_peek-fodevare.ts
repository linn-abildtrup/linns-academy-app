// Find fødevarer hvor 'stk' burde være en option men ikke er det.
//
// Filtrerer skarpt: kun fødevarer hvor navnet starter med eller præcis er
// en hel-enheds-vare (æg, æble, banan osv.) — ikke pølse-/pålægs-/saft-/
// pasta-varianter der bare indeholder samme ord.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

// Mapping fra "navn-præfiks" til standard stk-vægt i gram.
// Kun det DER ER en hel-enheds-vare lægges her.
const STK_KANDIDATER: Record<string, number> = {
	'æg': 58,
	'agurk': 400,
	'citron': 100,
	'lime': 70,
	'æble': 150,
	'pære': 170,
	'banan': 120,
	'avocado': 160,
	'kiwi': 75,
	'appelsin': 150,
	'mandarin': 80,
	'fersken': 130,
	'nektarin': 130,
	'blomme': 60,
	'mango': 250,
	'figen': 60,
	'granatæble': 280,
	'tomat': 100,
	'cherrytomat': 12,
	'peberfrugt': 150,
	'løg': 100,
	'rødløg': 100,
	'hvidløg': 5, // 1 fed
	'forårsløg': 20,
	'radise': 8,
	'gulerod': 80,
	'pastinak': 100,
	'kartoffel': 100,
	'rødbede': 120,
	'tortilla': 50,
	'pita': 60,
	'fuldkornsbolle': 65,
	'bolle': 60,
	'sød kartoffel': 200,
	'persillerod': 100,
	'artiskok': 200
};

// Skip forarbejdede/koncentrerede former — disse købes ikke pr stk
const SKIP_KEYWORDS = [
	'tørret', 'konserves', 'pasteuriseret', 'dybfrost', 'hakkede', 'hakket',
	'ristede', 'ristet', 'syltet', 'soltørret', 'industrifremstillet', 'pulver',
	'saltet', 'syrnet', 'mix', 'pure', 'puré', 'ketchup', 'gele', 'paté',
	'pålæg', 'pølse', 'eddike', 'snaps', 'mel', 'chips', 'tilsat sukker',
	'pasta'
];

function gaetStkVaegt(navn: string): { match: string; g: number } | null {
	const lower = navn.toLowerCase().trim();

	// Filtrer forarbejdede varianter fra
	for (const kw of SKIP_KEYWORDS) {
		if (lower.includes(kw)) return null;
	}

	// Match kun hvis navnet PRÆCIS er kandidaten, eller starter med
	// "{kandidat}, " (fx "Æble, Cox") — så vi undgår "Æbleeddike" osv.
	for (const [kand, g] of Object.entries(STK_KANDIDATER)) {
		if (lower === kand) return { match: kand, g };
		if (lower.startsWith(kand + ',')) return { match: kand, g };
		if (lower.startsWith(kand + ' ')) {
			const efter = lower.slice(kand.length + 1).split(/[\s,]/)[0];
			if (
				['helt', 'hel', 'stor', 'stort', 'lille', 'mellem', 'medium', 'økologisk', 'rød', 'grøn', 'gul', 'moden', 'råt', 'rå'].includes(efter) ||
				efter === ''
			) {
				return { match: kand, g };
			}
		}
	}
	return null;
}

async function main() {
	const snap = await db.collection('fodevarer').get();
	console.log(`📋 ${snap.size} fødevarer i Firestore\n`);

	type Kandidat = {
		id: string;
		name: string;
		kilde: string;
		units: { u: string; g: number }[];
		harStk: boolean;
		matchNavn: string;
		foreslaaetG: number;
	};
	const kandidater: Kandidat[] = [];

	for (const d of snap.docs) {
		const data = d.data();
		const name = data.name || '';
		const units = (data.units ?? []) as { u: string; g: number }[];
		const gaet = gaetStkVaegt(name);
		if (!gaet) continue;
		const harStk = units.some((u) => u.u === 'stk');
		kandidater.push({
			id: d.id,
			name,
			kilde: data.kilde ?? '?',
			units: units.map((u) => ({ u: u.u, g: u.g })),
			harStk,
			matchNavn: gaet.match,
			foreslaaetG: gaet.g
		});
	}

	const manglerStk = kandidater
		.filter((k) => !k.harStk)
		.sort((a, b) => a.name.localeCompare(b.name, 'da'));
	const harStk = kandidater.filter((k) => k.harStk);

	console.log(`❌ ${manglerStk.length} fødevarer der burde have 'stk' som enhed:\n`);
	for (const k of manglerStk) {
		const eksUnits =
			k.units.length === 0 ? '(kun gram)' : k.units.map((u) => `${u.u}=${u.g}g`).join(', ');
		console.log(
			`   ${k.id.padEnd(28)} "${k.name}" [${k.kilde}] → ${eksUnits}  ⇒ forslag: stk=${k.foreslaaetG}g`
		);
	}

	console.log(`\n✅ ${harStk.length} af kandidaterne har allerede 'stk' (uændret).`);
}

main().then(() => process.exit(0));
