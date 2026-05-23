// Eksporterer HTML-lektioner fra den gamle app (vanetracker.htmlLessons)
// til scripts/gamle-html-lektioner.json. Det er KILDEN — selve uploaden +
// indsættelse på dage håndteres af importer-gamle-html-lektioner.ts.
//
// Kør med:
//   node scripts/eksporter-gamle-html-lektioner.mjs <email> <password>

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const API_KEY = 'AIzaSyCpaasDNGvRrCMeg3ArH1TLeXMtO3erCII';
const PROJECT_ID = 'vanetracker';

const [, , email, password] = process.argv;
if (!email || !password) {
	console.error('Brug: node scripts/eksporter-gamle-html-lektioner.mjs <email> <password>');
	process.exit(1);
}

async function login() {
	const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password, returnSecureToken: true })
	});
	if (!res.ok) {
		const errText = await res.text();
		throw new Error(`Login fejlede: ${res.status} ${errText}`);
	}
	const data = await res.json();
	return data.idToken;
}

async function hentCollection(idToken) {
	const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/htmlLessons`;
	const res = await fetch(url, {
		headers: { Authorization: `Bearer ${idToken}` }
	});
	if (!res.ok) {
		const errText = await res.text();
		throw new Error(`Kunne ikke hente htmlLessons: ${res.status} ${errText}`);
	}
	return res.json();
}

function fraFirestoreValue(v) {
	if (v.stringValue !== undefined) return v.stringValue;
	if (v.integerValue !== undefined) return Number(v.integerValue);
	if (v.doubleValue !== undefined) return Number(v.doubleValue);
	if (v.booleanValue !== undefined) return v.booleanValue;
	if (v.nullValue !== undefined) return null;
	if (v.timestampValue !== undefined) return v.timestampValue;
	if (v.arrayValue !== undefined)
		return (v.arrayValue.values || []).map(fraFirestoreValue);
	if (v.mapValue !== undefined) {
		const out = {};
		const fields = v.mapValue.fields || {};
		for (const k of Object.keys(fields)) out[k] = fraFirestoreValue(fields[k]);
		return out;
	}
	return null;
}

async function main() {
	console.log('Logger ind …');
	const idToken = await login();
	console.log('Henter htmlLessons …');
	const liste = await hentCollection(idToken);
	const docs = liste.documents || [];
	const out = {};
	for (const doc of docs) {
		const id = doc.name.split('/').pop();
		const fields = doc.fields || {};
		const dat = {};
		for (const k of Object.keys(fields)) dat[k] = fraFirestoreValue(fields[k]);
		out[id] = dat;
	}
	const ids = Object.keys(out);
	console.log(`Fundet ${ids.length} HTML-lektioner:`);
	for (const id of ids) {
		const titel = out[id].title || '(uden titel)';
		const tegn = (out[id].htmlContent || '').length;
		console.log(`  · ${id} → "${titel}" (${tegn} tegn)`);
	}
	const fil = join(__dirname, 'gamle-html-lektioner.json');
	writeFileSync(fil, JSON.stringify(out, null, 2));
	console.log(`\nSkrev ${fil}`);
	console.log('Næste skridt: kør "npm run importer:gamle-html-lektioner"');
}

main().catch((e) => {
	console.error('Fejl:', e.message);
	process.exit(1);
});
