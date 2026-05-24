// Fix: opgrader-scriptet (scripts/_opgrader-kropsro-til-premiumforlob.ts)
// glemte at opdatere expiresAt + bonusPeriodEndsAt da kunderne blev
// flyttet fra Kickstart/basisabo til Kropsro. Resultat: effektivState()
// returnerer 'udlobet' fordi expiresAt stadig peger på Kickstart-slut
// (17. maj 2026) — så Kropsro-kunder ser udlobet-forsiden i stedet for
// deres aktive forløb.
//
// Dette script genberegner begge felter ud fra forlob/kropsro_maj_2026's
// startDato + antalDage og opdaterer alle ramte userDocs.
//
// Brug:
//   npx tsx scripts/_fix-kropsro-expiresAt.ts          # dry-run (læser, skriver intet)
//   npx tsx scripts/_fix-kropsro-expiresAt.ts --apply  # skriver til Firestore

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const KROPSRO_FORLOB_ID = 'kropsro_maj_2026';
const SKIP_EMAILS = new Set(['linnsacademy@gmail.com']);
const BIBLIOTEK_BONUS_DAGE = 90;
const MS_PER_DAG = 86_400_000;

const apply = process.argv.includes('--apply');

function formatDato(ms: number | null | undefined): string {
	if (ms === null || ms === undefined) return '(ikke sat)';
	return new Date(ms).toISOString().slice(0, 10);
}

async function main() {
	console.log(`Mode: ${apply ? 'APPLY (skriver til Firestore)' : 'DRY-RUN (ingen skrivninger)'}\n`);

	// 1) Hent forløbets startDato + antalDage → beregn slutdato + bonus-slut
	const fSnap = await db.collection('forlob').doc(KROPSRO_FORLOB_ID).get();
	if (!fSnap.exists) {
		console.error(`Forløb ${KROPSRO_FORLOB_ID} findes ikke.`);
		process.exit(1);
	}
	const f = fSnap.data() ?? {};
	const startMs = f.startDato?.toMillis?.();
	const antalDage = f.antalDage;
	if (!startMs || !antalDage) {
		console.error('forlob-doc mangler startDato eller antalDage.');
		process.exit(1);
	}
	const forlobSlutMs = startMs + antalDage * MS_PER_DAG;
	const bonusSlutMs = forlobSlutMs + BIBLIOTEK_BONUS_DAGE * MS_PER_DAG;

	console.log(`Forløb: ${KROPSRO_FORLOB_ID}`);
	console.log(`  startDato:           ${formatDato(startMs)}`);
	console.log(`  antalDage:           ${antalDage}`);
	console.log(`  → forlobSlutMs:      ${formatDato(forlobSlutMs)}`);
	console.log(`  → bonusSlutMs (+${BIBLIOTEK_BONUS_DAGE}d): ${formatDato(bonusSlutMs)}\n`);

	// 2) Find alle userDocs med kropsro i forlobIds
	const uSnap = await db.collection('users').where('forlobIds', 'array-contains', KROPSRO_FORLOB_ID).get();
	console.log(`Fandt ${uSnap.size} userDocs med ${KROPSRO_FORLOB_ID} i forlobIds:\n`);

	let opdateres = 0;
	let sprungetOver = 0;
	let allerede = 0;

	for (const d of uSnap.docs) {
		const u = d.data();
		const email = u.email ?? '(ingen email)';

		if (SKIP_EMAILS.has(email)) {
			console.log(`SKIP  ${email} (på skip-listen)`);
			sprungetOver++;
			continue;
		}

		const expFor = u.expiresAt ?? null;
		const bonFor = u.bonusPeriodEndsAt ?? null;
		const expOk = expFor === forlobSlutMs;
		const bonOk = bonFor === bonusSlutMs;

		if (expOk && bonOk) {
			console.log(`OK    ${email} (allerede korrekt)`);
			allerede++;
			continue;
		}

		console.log(`FIX   ${email}`);
		console.log(`        expiresAt:          ${formatDato(expFor)} → ${formatDato(forlobSlutMs)}${expOk ? ' (uændret)' : ''}`);
		console.log(`        bonusPeriodEndsAt:  ${formatDato(bonFor)} → ${formatDato(bonusSlutMs)}${bonOk ? ' (uændret)' : ''}`);

		if (apply) {
			await d.ref.update({
				expiresAt: forlobSlutMs,
				bonusPeriodEndsAt: bonusSlutMs
			});
		}
		opdateres++;
	}

	console.log('');
	console.log(`Resultat:`);
	console.log(`  ${apply ? 'Opdateret' : 'Ville opdatere'}: ${opdateres}`);
	console.log(`  Allerede korrekt:                ${allerede}`);
	console.log(`  Sprunget over:                   ${sprungetOver}`);
	if (!apply && opdateres > 0) {
		console.log(`\nKør med --apply for at skrive ændringerne.`);
	}
}
main().then(() => process.exit(0));
