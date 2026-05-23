// Eksporterer lektioner fra den gamle app (vanetracker-Firebase-projektet)
// til en JSON-fil. Bruger Firestore REST API + email/password-login.
//
// Kør med:
//   node scripts/eksporter-gammel-lektioner.mjs <email> <password>
//
// Output: scripts/gammel-lektioner.json (kan derefter importeres via
// scripts/import-gammel-lektioner.mjs).

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Den gamle apps Firebase-config (fundet i index.html linje 3954)
const API_KEY = 'AIzaSyCpaasDNGvRrCMeg3ArH1TLeXMtO3erCII';
const PROJECT_ID = 'vanetracker';

const [, , email, password] = process.argv;
if (!email || !password) {
	console.error('Brug: node scripts/eksporter-gammel-lektioner.mjs <email> <password>');
	console.error('Eksempel: node scripts/eksporter-gammel-lektioner.mjs kontakt@linnsacademy.dk MitPassword');
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

async function hentDokument(idToken) {
	const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/programConfig/global`;
	const res = await fetch(url, {
		headers: { Authorization: `Bearer ${idToken}` }
	});
	if (!res.ok) {
		const errText = await res.text();
		throw new Error(`Kunne ikke hente dokument: ${res.status} ${errText}`);
	}
	return res.json();
}

// Firestore REST returnerer data som typed values. Konverter til almindelig JS.
function fraFirestoreValue(v) {
	if (v.stringValue !== undefined) return v.stringValue;
	if (v.integerValue !== undefined) return Number(v.integerValue);
	if (v.doubleValue !== undefined) return Number(v.doubleValue);
	if (v.booleanValue !== undefined) return v.booleanValue;
	if (v.nullValue !== undefined) return null;
	if (v.timestampValue !== undefined) return v.timestampValue;
	if (v.arrayValue !== undefined) {
		return (v.arrayValue.values || []).map(fraFirestoreValue);
	}
	if (v.mapValue !== undefined) {
		const out = {};
		const fields = v.mapValue.fields || {};
		for (const k of Object.keys(fields)) out[k] = fraFirestoreValue(fields[k]);
		return out;
	}
	return null;
}

async function main() {
	console.log('Logger ind som', email, '…');
	const idToken = await login();
	console.log('Login OK. Henter programConfig/global …');
	const doc = await hentDokument(idToken);
	const fields = doc.fields || {};
	const out = {};
	for (const k of Object.keys(fields)) out[k] = fraFirestoreValue(fields[k]);

	const days = out.days || {};
	const datoer = Object.keys(days).sort();
	console.log(`Fundet ${datoer.length} datoer:`, datoer.slice(0, 3).join(', '), '...');

	const fil = join(__dirname, 'gammel-lektioner.json');
	writeFileSync(fil, JSON.stringify({ startDate: out.startDate, days }, null, 2));
	console.log(`\nSkrev ${fil}`);
	console.log('Næste skridt: send mig denne fil eller paste indholdet i chatten.');
}

main().catch((e) => {
	console.error('Fejl:', e.message);
	process.exit(1);
});
