// Eksporterer den gamle apps to træningsprogrammer (kettlebell + no_kettlebell)
// fra mtLevelPrograms-collection.
// Kør: node scripts/eksporter-gamle-traeningsprogrammer.mjs <email> <password>

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_KEY = 'AIzaSyCpaasDNGvRrCMeg3ArH1TLeXMtO3erCII';
const PROJECT_ID = 'vanetracker';

const [, , email, password] = process.argv;
if (!email || !password) {
	console.error('Brug: node scripts/eksporter-gamle-traeningsprogrammer.mjs <email> <password>');
	process.exit(1);
}

async function login() {
	const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password, returnSecureToken: true })
	});
	if (!res.ok) throw new Error(`Login: ${res.status} ${await res.text()}`);
	return (await res.json()).idToken;
}

function fra(v) {
	if (v.stringValue !== undefined) return v.stringValue;
	if (v.integerValue !== undefined) return Number(v.integerValue);
	if (v.doubleValue !== undefined) return Number(v.doubleValue);
	if (v.booleanValue !== undefined) return v.booleanValue;
	if (v.nullValue !== undefined) return null;
	if (v.timestampValue !== undefined) return v.timestampValue;
	if (v.arrayValue !== undefined) return (v.arrayValue.values || []).map(fra);
	if (v.mapValue !== undefined) {
		const o = {};
		for (const k of Object.keys(v.mapValue.fields || {})) o[k] = fra(v.mapValue.fields[k]);
		return o;
	}
	return null;
}

async function hentDage(token, level) {
	const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/mtLevelPrograms/${level}/days`;
	const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
	if (!res.ok) {
		console.error(`Kunne ikke hente ${level}: ${res.status}`);
		return [];
	}
	const data = await res.json();
	const docs = data.documents || [];
	return docs.map((doc) => {
		const id = doc.name.split('/').pop();
		const fields = doc.fields || {};
		const dat = { _id: id };
		for (const k of Object.keys(fields)) dat[k] = fra(fields[k]);
		return dat;
	});
}

const token = await login();
const programmer = {};
for (const level of ['kettlebell', 'no_kettlebell']) {
	const dage = await hentDage(token, level);
	const sorteret = dage.sort((a, b) => (a.day ?? 0) - (b.day ?? 0));
	programmer[level] = sorteret;
	console.log(`\n=== ${level}: ${sorteret.length} dage ===`);
	for (const d of sorteret) {
		const ex = (d.exercises || []).map((e) => e.id).join(', ');
		console.log(`  Dag ${d.day}: ${ex || '(ingen øvelser)'}`);
	}
}

const fil = join(__dirname, 'gamle-traeningsprogrammer.json');
writeFileSync(fil, JSON.stringify(programmer, null, 2));
console.log(`\nSkrev ${fil}`);
