// Tjek om et specifikt htmlLessons-dokument findes i den gamle app.
// Kør med: node scripts/tjek-gammel-html-lektion.mjs <email> <password> <id>

const API_KEY = 'AIzaSyCpaasDNGvRrCMeg3ArH1TLeXMtO3erCII';
const PROJECT_ID = 'vanetracker';

const [, , email, password, id] = process.argv;
if (!email || !password || !id) {
	console.error('Brug: node scripts/tjek-gammel-html-lektion.mjs <email> <password> <id>');
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
	if (v.timestampValue !== undefined) return v.timestampValue;
	if (v.mapValue !== undefined) {
		const o = {};
		for (const k of Object.keys(v.mapValue.fields || {})) o[k] = fra(v.mapValue.fields[k]);
		return o;
	}
	return null;
}

const token = await login();
const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/htmlLessons/${id}`;
const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

if (res.status === 404) {
	console.log(`Dokumentet htmlLessons/${id} findes IKKE (404).`);
	process.exit(0);
}
if (!res.ok) {
	console.error(`Fejl: ${res.status} ${await res.text()}`);
	process.exit(1);
}
const data = await res.json();
const fields = data.fields || {};
const out = {};
for (const k of Object.keys(fields)) out[k] = fra(fields[k]);
console.log(`Fundet htmlLessons/${id}:`);
console.log(`  title: ${out.title}`);
console.log(`  htmlContent: ${(out.htmlContent || '').length} tegn`);
console.log(`  createdAt: ${out.createdAt}`);
