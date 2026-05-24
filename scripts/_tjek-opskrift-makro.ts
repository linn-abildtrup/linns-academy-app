// Tjek hvor mange opskrifter har defekt eller manglende makro-data i
// instruktioner-feltet. Klient-side parser bruger regex der kraever
// 'Protein: Xg ... Fiber: Yg ... Kalorier: Z kcal'.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const RX = /Protein:\s*(\d+(?:[.,]\d+)?)\s*g.*?Fiber:\s*(\d+(?:[.,]\d+)?)\s*g.*?Kalorier:\s*(\d+(?:[.,]\d+)?)\s*kcal/i;

async function main() {
	const snap = await db.collection('opskrifter').get();
	console.log(`Total opskrifter: ${snap.size}\n`);

	const ok: { titel: string }[] = [];
	const mangler: { id: string; titel: string; sidsteLinjer: string }[] = [];
	const inaktiv: { titel: string }[] = [];

	for (const d of snap.docs) {
		const data = d.data();
		if (data.aktiv === false) {
			inaktiv.push({ titel: data.titel ?? d.id });
			continue;
		}
		const instr = String(data.instruktioner ?? '');
		if (!RX.test(instr)) {
			// Hent sidste 200 tegn for at vise hvad der faktisk staar
			const sidste = instr.slice(-200).replace(/\n/g, ' | ');
			mangler.push({ id: d.id, titel: data.titel ?? d.id, sidsteLinjer: sidste });
		} else {
			ok.push({ titel: data.titel ?? d.id });
		}
	}

	console.log(`OK (har parsbar makro):  ${ok.length}`);
	console.log(`Inaktive (skipped):       ${inaktiv.length}`);
	console.log(`MANGLER MAKRO:           ${mangler.length}\n`);

	if (mangler.length > 0) {
		console.log('=== Opskrifter der mangler makro ===\n');
		for (const m of mangler) {
			console.log(`  [${m.id}] ${m.titel}`);
			console.log(`    sidste 200 tegn: "${m.sidsteLinjer}"`);
			console.log('');
		}
	}
}
main().then(() => process.exit(0));
