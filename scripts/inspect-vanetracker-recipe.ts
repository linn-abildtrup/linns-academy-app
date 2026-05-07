// Hjælpe-script: print en opskrift fra vanetracker og statistik over felter.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'vanetracker-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

async function main() {
	const all = await db.collection('recipes').get();

	const dietTagSet = new Set<string>();
	const billedeURLs: string[] = [];
	const statusVaerdier = new Set<string>();
	for (const d of all.docs) {
		const data = d.data() as Record<string, unknown>;
		const dt = data.dietTags;
		if (Array.isArray(dt)) {
			for (const t of dt) dietTagSet.add(String(t));
		}
		if (data.imageUrl) billedeURLs.push(data.imageUrl as string);
		if (data.status) statusVaerdier.add(String(data.status));
	}
	console.log('Diet tags i brug:', [...dietTagSet].sort().join(', '));
	console.log('\nStatus-værdier:', [...statusVaerdier].sort().join(', '));
	console.log('\n3 første billede-URLs:');
	for (const u of billedeURLs.slice(0, 3)) console.log('  ', u);
	console.log(`\nTotal billede-URLs: ${billedeURLs.length}`);
}

main().then(() => process.exit(0));
