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
	let harKh = 0;
	let harFedt = 0;
	const eksKh: string[] = [];
	const eksFedt: string[] = [];

	for (const d of snap.docs) {
		const data = d.data();
		if (data.aktiv === false) continue;
		aktive++;
		const i = String(data.instruktioner ?? '');
		const titel = String(data.titel ?? d.id);
		const kh = /(?:Kulhydrat(?:er)?|Kh):\s*\d/i.test(i);
		const fedt = /Fedt:\s*\d/i.test(i);
		if (kh) {
			harKh++;
			if (eksKh.length < 3) eksKh.push(titel + ' → ' + (i.match(/(?:Kulhydrat(?:er)?|Kh):[^|]+/i)?.[0] ?? ''));
		}
		if (fedt) {
			harFedt++;
			if (eksFedt.length < 3) eksFedt.push(titel + ' → ' + (i.match(/Fedt:[^|]+/i)?.[0] ?? ''));
		}
	}

	console.log(`Aktive opskrifter:    ${aktive}`);
	console.log(`Har Kulhydrater:      ${harKh}`);
	console.log(`Har Fedt:             ${harFedt}`);
	if (eksKh.length) {
		console.log('\nEksempler kh:');
		for (const e of eksKh) console.log(`  ${e}`);
	}
	if (eksFedt.length) {
		console.log('\nEksempler fedt:');
		for (const e of eksFedt) console.log(`  ${e}`);
	}
}
main().then(() => process.exit(0));
