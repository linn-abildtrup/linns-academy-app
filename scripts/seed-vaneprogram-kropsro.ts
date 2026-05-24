// Seed-script til Kropsro-vaneprogrammet (85 dage: baseline + dag 1-84).
//
// Skriver tomme refleksioner — Linn fylder dem ind via admin-UI pr dag.
// Flags sættes automatisk:
//   - dag 0: baseline + slider-checkin + MRS-checkin
//   - dag 28, 56, 84: slider-checkin + MRS-checkin (slut-checkins)
//   - dag 5, 12, 19... (hver uges fredag): isWin
//
// Datamodel matcher Kickstart-vaneprogrammet — samme path:
//   forlob/{forlobId}/vaneprogram/dag{N}
//
// checks og bonus efterlades tomme. Kropsro bruger uge-baserede vaner fra
// forlob/{forlobId}/admintildelteVaner i stedet for per-dag checks.
//
// Kør med:
//   npm run seed:vaneprogram:kropsro              (seeder kropsro_maj_2026)
//   npm run seed:vaneprogram:kropsro -- <forlobId> (anden Kropsro-type forløb)
//
// Idempotent: kører du det igen, overskriver det eksisterende dage.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(
	readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8')
);

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const DEFAULT_FORLOB_ID = 'kropsro_maj_2026';
const ANTAL_DAGE = 84;
const MRS_DAGE = new Set([0, 28, 56, ANTAL_DAGE]);

interface DagSeed {
	dagNummer: number;
	uge: number;
	reflection: string;
	checks: { id: string; label: string }[];
	bonus: { id: string; label: string } | null;
	isCheckin: boolean;
	isBaseline: boolean;
	isWin: boolean;
	isMrsCheckin: boolean;
}

function dagTilUge(dagNummer: number): number {
	if (dagNummer === 0) return 0;
	return Math.ceil(dagNummer / 7);
}

function byggDag(dagNummer: number): DagSeed {
	const uge = dagTilUge(dagNummer);
	const isMrs = MRS_DAGE.has(dagNummer);
	const isBaseline = dagNummer === 0;
	const dagIUge = dagNummer === 0 ? 0 : ((dagNummer - 1) % 7) + 1;
	const isWin = dagNummer > 0 && dagIUge === 5;

	let reflection = '';
	if (isBaseline) {
		reflection = 'Velkommen til Kropsro. Vi starter med et baseline-tjek så du har noget at maale dig mod om 12 uger.';
	}

	return {
		dagNummer,
		uge,
		reflection,
		checks: [],
		bonus: null,
		isCheckin: isMrs,
		isBaseline,
		isWin,
		isMrsCheckin: isMrs
	};
}

async function seed() {
	const forlobId = process.argv[2] ?? DEFAULT_FORLOB_ID;
	const ref = db.collection('forlob').doc(forlobId);
	const snap = await ref.get();
	if (!snap.exists) {
		console.error(`Forløbet '${forlobId}' findes ikke.`);
		process.exit(1);
	}
	const navn = snap.data()?.navn ?? forlobId;
	console.log(`\nSeeder Kropsro-vaneprogram til '${forlobId}' (${navn})...`);

	const batch = db.batch();
	for (let d = 0; d <= ANTAL_DAGE; d++) {
		const dag = byggDag(d);
		batch.set(ref.collection('vaneprogram').doc(`dag${d}`), dag);
	}
	await batch.commit();

	console.log(`   ${ANTAL_DAGE + 1} dage skrevet til forlob/${forlobId}/vaneprogram/`);
	console.log(`   MRS-check-ins: dag ${[...MRS_DAGE].sort((a, b) => a - b).join(', ')}`);
	console.log(`   Win-dage: hver uges dag 5 (fredag) — ${Math.floor(ANTAL_DAGE / 7)} ialt`);
	console.log('\nSeed færdig. Refleksioner er tomme — fyld dem ind via admin.');
}
seed().then(() => process.exit(0));
