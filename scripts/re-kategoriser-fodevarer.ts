// Re-kategoriserer fødevarer der er endt i 'andet' men hører hjemme et andet sted.
// Bygger på regel-matching mod navnet (case-insensitiv substring).
//
// Kør:
//   npx tsx scripts/re-kategoriser-fodevarer.ts            # dry-run, viser ændringer
//   npx tsx scripts/re-kategoriser-fodevarer.ts --skriv    # skriv til Firestore
//
// Reglerne er ordnet — første match vinder. Tilføj nye mønstre i toppen af
// listen hvis du vil overrule en eksisterende regel.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));

const app = initializeApp({ credential: cert(sa) });
const db = getFirestore(app);

const skriv = process.argv.includes('--skriv');

type Kategori =
	| 'mejeri'
	| 'koed'
	| 'fisk'
	| 'baelg'
	| 'korn'
	| 'gront'
	| 'baer'
	| 'noedder'
	| 'prot'
	| 'drikke'
	| 'andet';

interface Regel {
	kategori: Kategori;
	matchers: (string | RegExp)[];
}

// Reglerne tjekkes oppefra og ned. Første match vinder.
// Brug RegExp når der er behov for præcis ordafgrænsning.
const REGLER: Regel[] = [
	{
		kategori: 'fisk',
		matchers: [
			'aborre',
			'ansjos',
			'brasen',
			'brisling',
			'brosme',
			'bækforel',
			'gaffelbidder',
			'gedde',
			'havkat',
			'helleflynder',
			/^helt,/i,
			'hvalkød',
			'hvilling',
			'ising',
			'kippers',
			/^knude,/i,
			'kulmule',
			/^lange,/i,
			'pighvarre',
			'sandart',
			'skrubbe',
			'sortmund',
			'sperling',
			'østers',
			'vinbjergssnegle',
			'sælkød',
			'reje, dybvands'
		]
	},
	{
		kategori: 'koed',
		matchers: [
			'due, vildt',
			'fasan',
			'fårekød',
			/^gås,/i,
			'gåsefedt',
			'lever, gåse',
			'harekød',
			'hestekød',
			/^høne,/i,
			'kaninkød',
			'poulard',
			/^rype,/i
		]
	},
	{
		kategori: 'mejeri',
		matchers: [
			'danablu',
			/^danbo,/i,
			'havarti',
			/^esrom,/i,
			/^maribo,/i,
			'samsø',
			'svenbo',
			'cheshire',
			'emmentaler',
			'gruyere',
			'roquefort',
			/^elbo,/i,
			/^fynbo,/i,
			/^grana,/i,
			'koldskål',
			'valle',
			'vallepulver',
			'lactose'
		]
	},
	{
		kategori: 'gront',
		matchers: [
			'artiskok',
			'asier',
			'bambusskud',
			'bladbede',
			'brøndkarse',
			'gulerødder',
			'gulerodsuppe',
			'græskar',
			'ingefær',
			'kantarel',
			/^karse,/i,
			'kørvel',
			/oliven,/i,
			'pak choi',
			'peberrod',
			'ræddike',
			'skorzonerrod',
			'tang,',
			/^yams,/i,
			'okra',
			'maniok',
			'tomatsuppe',
			/^dild,/i,
			'oregano',
			'kommen',
			'spidskommen, rå'
		]
	},
	{
		kategori: 'baer',
		matchers: [
			'avocado',
			'cherimoya',
			'daddel',
			'havtorn',
			'hyben',
			'kvæde',
			'litchi',
			'loquat',
			'mandarin',
			'pomelo',
			'papaya',
			/^ribs,/i,
			'ribsgele',
			'sapodille',
			'sveske',
			'tamarind',
			'kokosnød'
		]
	},
	{
		kategori: 'korn',
		matchers: [
			'birkes',
			'grovbolle',
			'hirse',
			'hirseflager',
			'perlespelt',
			'pumpernikkel',
			'rasp',
			'rundstykke',
			'tebirkes',
			'tvebakker',
			'croissant',
			'kammerjunker',
			'risklid',
			'risstivelse',
			'morgenmadsprodukt',
			'tortillachips',
			'kartoffelchips',
			'havreflakes'
		]
	},
	{
		kategori: 'baelg',
		matchers: ['linsespirer', 'lucerne', 'seitan', 'sojanudler', 'mycoprotein']
	},
	{
		kategori: 'noedder',
		matchers: ['pecannød', 'pekannød', 'tahin', 'kokosflager']
	},
	{
		kategori: 'prot',
		matchers: ['protein pulver', 'proteinis', 'næringsgær', 'pizza, proteinberiget']
	},
	{
		kategori: 'drikke',
		matchers: [
			/^ale,/i,
			'bitter,',
			'campari',
			'cognac',
			/^gin\b/i,
			'julebryg',
			/^likør/i,
			/^madeira/i,
			'pilsner',
			'porter/stout',
			/^rom\b/i,
			'sherry',
			/^snaps/i,
			'spirituosa',
			'vermouth',
			'vodka',
			'whisky',
			'frugtnektar'
		]
	}
];

function foreslaaKategori(navn: string): Kategori | null {
	for (const r of REGLER) {
		for (const m of r.matchers) {
			if (typeof m === 'string') {
				if (navn.toLowerCase().includes(m.toLowerCase())) return r.kategori;
			} else if (m.test(navn)) {
				return r.kategori;
			}
		}
	}
	return null; // forbliver i 'andet'
}

async function main() {
	const snap = await db.collection('fodevarer').where('cat', '==', 'andet').get();
	const liste = snap.docs
		.map((d) => ({ id: d.id, name: d.data().name as string }))
		.sort((a, b) => a.name.localeCompare(b.name, 'da'));

	const flytninger: Record<string, { id: string; name: string }[]> = {};
	const beholdes: { id: string; name: string }[] = [];

	for (const f of liste) {
		const ny = foreslaaKategori(f.name);
		if (ny) {
			if (!flytninger[ny]) flytninger[ny] = [];
			flytninger[ny].push(f);
		} else {
			beholdes.push(f);
		}
	}

	console.log(`\nAnalyserer ${liste.length} fødevarer i 'andet'\n`);

	const total = Object.values(flytninger).reduce((s, l) => s + l.length, 0);
	console.log(`Foreslår at flytte ${total} fødevarer:\n`);

	for (const [kat, items] of Object.entries(flytninger).sort()) {
		console.log(`── ${kat.toUpperCase()} (${items.length}) ────`);
		for (const it of items) console.log(`   ${it.name}`);
		console.log();
	}

	console.log(`\nBeholdes i 'andet' (${beholdes.length}):`);
	for (const it of beholdes) console.log(`   ${it.name}`);

	if (!skriv) {
		console.log('\n(dry-run — kør med --skriv for at opdatere Firestore)');
		return;
	}

	console.log(`\nSkriver ${total} ændringer til Firestore...`);
	const CHUNK = 400;
	const flade: { id: string; ny: Kategori }[] = [];
	for (const [kat, items] of Object.entries(flytninger)) {
		for (const it of items) flade.push({ id: it.id, ny: kat as Kategori });
	}
	for (let i = 0; i < flade.length; i += CHUNK) {
		const batch = db.batch();
		for (const op of flade.slice(i, i + CHUNK)) {
			batch.update(db.collection('fodevarer').doc(op.id), { cat: op.ny });
		}
		await batch.commit();
	}
	console.log(`✓ ${flade.length} fødevarer opdateret.\n`);
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e);
		process.exit(1);
	});
