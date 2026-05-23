// Henter ét specifikt htmlLessons-dokument fra den gamle app og importerer
// det til en specifik dag på Kickstart maj 2026.
//
// Kør med:
//   node scripts/importer-enkelt-html-lektion.mjs <email> <password> <htmlLessonId> <dagNummer>
//
// Eksempel:
//   node scripts/importer-enkelt-html-lektion.mjs kontakt@linnsacademy.dk 'pass' dX0iII0tnhELsDNN5eQS 6

import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const __dirname = dirname(fileURLToPath(import.meta.url));

const OLD_API_KEY = 'AIzaSyCpaasDNGvRrCMeg3ArH1TLeXMtO3erCII';
const OLD_PROJECT = 'vanetracker';
const NEW_BUCKET = 'linns-academy-app.firebasestorage.app';
const FORLOB_ID = 'kickstart_maj_2026';

const [, , email, password, lessonId, dagNummerStr] = process.argv;
if (!email || !password || !lessonId || !dagNummerStr) {
	console.error(
		'Brug: node scripts/importer-enkelt-html-lektion.mjs <email> <password> <htmlLessonId> <dagNummer>'
	);
	process.exit(1);
}
const dagNummer = Number(dagNummerStr);
if (!Number.isFinite(dagNummer)) {
	console.error('dagNummer skal være et tal');
	process.exit(1);
}

// Init Firebase Admin (ny app)
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa), storageBucket: NEW_BUCKET });
const db = getFirestore();
const bucket = getStorage().bucket();

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

function slug(s) {
	return s
		.toLowerCase()
		.replace(/æ/g, 'ae')
		.replace(/ø/g, 'oe')
		.replace(/å/g, 'aa')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60);
}

function ugeForDag(n) {
	return n <= 0 ? 0 : Math.ceil(n / 7);
}

async function login() {
	const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${OLD_API_KEY}`;
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password, returnSecureToken: true })
	});
	if (!res.ok) throw new Error(`Login: ${res.status} ${await res.text()}`);
	return (await res.json()).idToken;
}

async function main() {
	console.log(`Logger ind i gammel app …`);
	const token = await login();

	console.log(`Henter htmlLessons/${lessonId} …`);
	const url = `https://firestore.googleapis.com/v1/projects/${OLD_PROJECT}/databases/(default)/documents/htmlLessons/${lessonId}`;
	const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
	if (!res.ok) {
		console.error(`Kunne ikke hente: ${res.status} ${await res.text()}`);
		process.exit(1);
	}
	const doc = await res.json();
	const fields = doc.fields || {};
	const data = {};
	for (const k of Object.keys(fields)) data[k] = fra(fields[k]);
	const titel = data.title || `Lektion ${lessonId}`;
	const html = data.htmlContent || '';
	console.log(`  Titel: ${titel}`);
	console.log(`  ${html.length} tegn HTML\n`);

	// Upload til Firebase Storage (ny app)
	const filnavn = `${lessonId}-${slug(titel) || 'lektion'}.html`;
	const destination = `forlob/${FORLOB_ID}/html/${filnavn}`;
	const downloadToken = randomUUID();
	console.log(`Uploader til ${destination} …`);
	const file = bucket.file(destination);
	await file.save(html, {
		contentType: 'text/html; charset=utf-8',
		metadata: {
			metadata: { firebaseStorageDownloadTokens: downloadToken }
		}
	});
	const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${NEW_BUCKET}/o/${encodeURIComponent(destination)}?alt=media&token=${downloadToken}`;
	console.log(`  → ${uploadUrl.slice(0, 90)}…\n`);

	// Append lektion til forløbsdag
	const dagRef = db.collection('forlob').doc(FORLOB_ID).collection('forlobsdage').doc(`dag${dagNummer}`);
	const dagSnap = await dagRef.get();
	const nyLektion = {
		id: randomUUID(),
		titel,
		beskrivelse: '',
		varighedMin: 0,
		format: 'Inspiration',
		url: uploadUrl
	};

	if (dagSnap.exists) {
		const dag = dagSnap.data();
		const fundet = (dag.lektioner || []).find((l) => l.titel === titel);
		if (fundet) {
			console.log(`Lektionen med titel "${titel}" findes allerede på dag${dagNummer}. Springer over.`);
			return;
		}
		await dagRef.update({ lektioner: [...(dag.lektioner || []), nyLektion] });
		console.log(`✓ Appendet til eksisterende dag${dagNummer} (${(dag.lektioner || []).length + 1} lektioner i alt)`);
	} else {
		await dagRef.set({
			dagNummer,
			uge: ugeForDag(dagNummer),
			lektioner: [nyLektion],
			noteFraLinn: ''
		});
		console.log(`✓ Oprettet ny dag${dagNummer} med lektionen`);
	}
}

main().catch((e) => {
	console.error('Fejl:', e);
	process.exit(1);
});
