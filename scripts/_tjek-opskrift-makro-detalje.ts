// Detaljeret breakdown: hvilke felter mangler praecis?
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

async function main() {
	const snap = await db.collection('opskrifter').get();

	let aktive = 0;
	let harProtein = 0;
	let harFiber = 0;
	let harKalorier = 0;
	const manglerKunKalorier: string[] = [];
	const manglerProtein: string[] = [];
	const manglerFiber: string[] = [];
	const manglerAlt: string[] = [];

	for (const d of snap.docs) {
		const data = d.data();
		if (data.aktiv === false) continue;
		aktive++;
		const i = String(data.instruktioner ?? '');
		const titel = data.titel ?? d.id;
		const p = /Protein:\s*\d/i.test(i);
		const f = /Fiber:\s*\d/i.test(i);
		const k = /Kalorier:\s*\d/i.test(i);
		if (p) harProtein++;
		if (f) harFiber++;
		if (k) harKalorier++;
		if (p && f && !k) manglerKunKalorier.push(titel);
		else if (!p && !f && !k) manglerAlt.push(titel);
		else if (!p) manglerProtein.push(titel);
		else if (!f) manglerFiber.push(titel);
	}

	console.log(`Aktive opskrifter:    ${aktive}`);
	console.log(`Har Protein:          ${harProtein}`);
	console.log(`Har Fiber:            ${harFiber}`);
	console.log(`Har Kalorier:         ${harKalorier}`);
	console.log('');
	console.log(`Mangler KUN Kalorier (har Protein+Fiber): ${manglerKunKalorier.length}`);
	console.log(`Mangler ALT (intet makro):                ${manglerAlt.length}`);
	console.log(`Mangler kun Protein:                      ${manglerProtein.length}`);
	console.log(`Mangler kun Fiber:                        ${manglerFiber.length}`);

	if (manglerAlt.length > 0) {
		console.log('\n=== Opskrifter helt uden makro ===');
		for (const t of manglerAlt) console.log(`  - ${t}`);
	}
}
main().then(() => process.exit(0));
