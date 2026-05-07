// Seed-script til Kickstart-vaneprogrammet
// Skriver de 22 dage (baseline + dag 1-21) direkte under hvert aktivt forløb
// på stien forlob/{forlobId}/vaneprogram/dagN. Indholdet er porteret 1:1 fra
// reference/index.html (VT_PROGRAM-arrayet).
//
// Kør med: npm run seed:vaneprogram                  (alle aktive forløb)
//   eller: npm run seed:vaneprogram -- <forlobId>    (specifikt forløb)
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

// Intet hardcoded forløb længere — seed kører på alle aktive forløb
// medmindre der gives et specifikt forlobId som CLI-argument.

const PM = { id: 'pm', label: 'Protein til morgenmad' };
const FI = { id: 'fi', label: '30g fiber i dag' };
const MK = { id: 'mk', label: 'Mikrotræning 3 min' };

const PM_FI_MK = [PM, FI, MK];
const PM_FI = [PM, FI];
const PM_ONLY = [PM];

interface DagSeed {
	dagNummer: number;
	uge: number;
	reflection: string;
	checks: { id: string; label: string }[];
	bonus: { id: string; label: string } | null;
	isCheckin: boolean;
	isBaseline: boolean;
	isWin: boolean;
}

const DAGE: DagSeed[] = [
	{
		dagNummer: 0,
		uge: 0,
		reflection:
			'Velkommen til dit baseline-check-in. Brug et øjeblik på at mærke efter, så du har noget at sammenligne med om 21 dage.',
		checks: [],
		bonus: null,
		isCheckin: true,
		isBaseline: true,
		isWin: false
	},
	{
		dagNummer: 1,
		uge: 1,
		reflection: 'Hvornår på formiddagen mærker jeg min første sultfornemmelse i dag?',
		checks: PM_ONLY,
		bonus: { id: 'b1', label: 'Gå 5 min udenfor' },
		isCheckin: false,
		isBaseline: false,
		isWin: false
	},
	{
		dagNummer: 2,
		uge: 1,
		reflection: 'Hvad fik jeg til morgenmad i dag? Hvad vil jeg gerne tilføje eller ændre i morgen?',
		checks: PM_FI,
		bonus: { id: 'b2', label: 'Læg dig ned på gulvet i 2 min og mærk efter' },
		isCheckin: false,
		isBaseline: false,
		isWin: false
	},
	{
		dagNummer: 3,
		uge: 1,
		reflection: 'Hvordan har min krop det lige nu? Tung, let, stærk, blød, rolig?',
		checks: PM_FI_MK,
		bonus: { id: 'b3', label: 'Træk vejret langsomt i 1 min (udånding længere end indånding)' },
		isCheckin: false,
		isBaseline: false,
		isWin: false
	},
	{
		dagNummer: 4,
		uge: 1,
		reflection: 'Hvor mange timer holdt morgenmaden mig mæt i dag?',
		checks: PM_FI_MK,
		bonus: { id: 'b4', label: 'Dæmp lyset en time før sengetid' },
		isCheckin: false,
		isBaseline: false,
		isWin: false
	},
	{
		dagNummer: 5,
		uge: 1,
		reflection: 'Skriv et #win for i dag. Intet er for stort eller småt.',
		checks: PM_FI_MK,
		bonus: { id: 'b5', label: 'Del din #win med Linn' },
		isCheckin: false,
		isBaseline: false,
		isWin: true
	},
	{
		dagNummer: 6,
		uge: 1,
		reflection: 'Hvordan har min formiddag været i dag, sammenlignet med før jeg startede?',
		checks: PM_FI_MK,
		bonus: { id: 'b6', label: 'Sid ude 5 min med kaffe eller te' },
		isCheckin: false,
		isBaseline: false,
		isWin: false
	},
	{
		dagNummer: 7,
		uge: 1,
		reflection: 'Check-in nedenfor. Plus: Hvad har jeg lært om min morgenmad denne uge?',
		checks: PM_FI_MK,
		bonus: { id: 'b7', label: 'Lav 3 min blide strækøvelser' },
		isCheckin: true,
		isBaseline: false,
		isWin: false
	},
	{
		dagNummer: 8,
		uge: 2,
		reflection: 'Hvad tog jeg med mig fra uge 1? Én ting der føltes godt.',
		checks: PM_FI_MK,
		bonus: { id: 'b8', label: 'Læg protein på tallerkenen til frokost' },
		isCheckin: false,
		isBaseline: false,
		isWin: false
	},
	{
		dagNummer: 9,
		uge: 2,
		reflection: 'Hvordan følte jeg mig kl. 15 i dag i forhold til tidligere?',
		checks: PM_FI_MK,
		bonus: { id: 'b9', label: 'Kom grønt på din frokost' },
		isCheckin: false,
		isBaseline: false,
		isWin: false
	},
	{
		dagNummer: 10,
		uge: 2,
		reflection: 'Hvilke frokoster vil jeg prøve i denne uge?',
		checks: PM_FI_MK,
		bonus: { id: 'b10', label: 'Lav frokost klar til i morgen' },
		isCheckin: false,
		isBaseline: false,
		isWin: false
	},
	{
		dagNummer: 11,
		uge: 2,
		reflection: 'Hvornår har jeg det bedst med min krop i løbet af dagen? Hvad kendetegner de tidspunkter?',
		checks: PM_FI_MK,
		bonus: { id: 'b11', label: 'Spis din frokost uden skærm' },
		isCheckin: false,
		isBaseline: false,
		isWin: false
	},
	{
		dagNummer: 12,
		uge: 2,
		reflection: 'Hvordan føles det når jeg har fået lavet min mikrotræning? Hvad giver det mig?',
		checks: PM_FI_MK,
		bonus: { id: 'b12', label: 'Gå 5 min efter frokost' },
		isCheckin: false,
		isBaseline: false,
		isWin: false
	},
	{
		dagNummer: 13,
		uge: 2,
		reflection:
			'Skriv et #win for i dag. Noget der er bedre end i sidste uge, det kan være i kroppen, med maden eller i humøret.',
		checks: PM_FI_MK,
		bonus: { id: 'b13', label: 'Del din #win med Linn' },
		isCheckin: false,
		isBaseline: false,
		isWin: true
	},
	{
		dagNummer: 14,
		uge: 2,
		reflection: 'Check-in nedenfor. Plus: Hvad har flyttet sig siden uge 1?',
		checks: PM_FI_MK,
		bonus: { id: 'b14', label: 'Spis din frokost i ro' },
		isCheckin: true,
		isBaseline: false,
		isWin: false
	},
	{
		dagNummer: 15,
		uge: 3,
		reflection: 'Hvad føles anderledes i min krop i dag, end for 14 dage siden?',
		checks: PM_FI_MK,
		bonus: { id: 'b15', label: 'Læg protein på tallerkenen til aftensmad' },
		isCheckin: false,
		isBaseline: false,
		isWin: false
	},
	{
		dagNummer: 16,
		uge: 3,
		reflection: 'Hvordan har jeg det om aftenen efter jeg har spist? Mæt, godt tilpas, rolig mave?',
		checks: PM_FI_MK,
		bonus: { id: 'b16', label: 'Lav halvdelen af tallerkenen til grønt' },
		isCheckin: false,
		isBaseline: false,
		isWin: false
	},
	{
		dagNummer: 17,
		uge: 3,
		reflection: 'Hvilken aftensmad vil jeg lave de næste 3 dage?',
		checks: PM_FI_MK,
		bonus: { id: 'b17', label: 'Lav ekstra protein-rester til frokost i morgen' },
		isCheckin: false,
		isBaseline: false,
		isWin: false
	},
	{
		dagNummer: 18,
		uge: 3,
		reflection: 'Hvad er min plan, hvis jeg en dag glipper? Hvordan vender jeg blidt tilbage?',
		checks: PM_FI_MK,
		bonus: { id: 'b18', label: 'Træk vejret 3 gange når du mærker stress' },
		isCheckin: false,
		isBaseline: false,
		isWin: false
	},
	{
		dagNummer: 19,
		uge: 3,
		reflection: 'Hvad har overrasket mig mest ved at leve efter 30-30-3?',
		checks: PM_FI_MK,
		bonus: { id: 'b19', label: 'Spis aftensmad uden at gøre andet samtidigt' },
		isCheckin: false,
		isBaseline: false,
		isWin: false
	},
	{
		dagNummer: 20,
		uge: 3,
		reflection: 'Skriv dit/dine store #win(s) efter 20 dage. Hvad vil jeg tage med mig fremad?',
		checks: PM_FI_MK,
		bonus: { id: 'b20', label: 'Del din store #win med Linn' },
		isCheckin: false,
		isBaseline: false,
		isWin: true
	},
	{
		dagNummer: 21,
		uge: 3,
		reflection: 'Check-in nedenfor. AFSLUTNING: Hvad vil jeg tage med mig fremad?',
		checks: PM_FI_MK,
		bonus: { id: 'b21', label: 'Skriv dig selv et lille kærligt brev' },
		isCheckin: true,
		isBaseline: false,
		isWin: false
	}
];

async function seedForlob(forlobId: string, navn: string) {
	console.log(`\n🌱 Seeder vaneprogram til '${forlobId}' (${navn})...`);
	const forlobRef = db.collection('forlob').doc(forlobId);
	const batch = db.batch();
	for (const dag of DAGE) {
		const ref = forlobRef.collection('vaneprogram').doc(`dag${dag.dagNummer}`);
		batch.set(ref, dag);
	}
	await batch.commit();
	console.log(`   ✓ ${DAGE.length} dage skrevet til forlob/${forlobId}/vaneprogram/`);
}

async function seed() {
	const argForlobId = process.argv[2];
	if (argForlobId) {
		const ref = db.collection('forlob').doc(argForlobId);
		const snap = await ref.get();
		if (!snap.exists) {
			console.error(`❌ Forløbet '${argForlobId}' findes ikke.`);
			process.exit(1);
		}
		await seedForlob(argForlobId, snap.data()?.navn ?? argForlobId);
	} else {
		const snap = await db.collection('forlob').where('aktiv', '==', true).get();
		if (snap.empty) {
			console.error('❌ Ingen aktive forløb fundet. Kør npm run seed:forlob først.');
			process.exit(1);
		}
		console.log(`📋 Fandt ${snap.size} aktive forløb`);
		for (const d of snap.docs) {
			await seedForlob(d.id, d.data().navn ?? d.id);
		}
	}
	console.log('\n✅ Seed færdig.');
}

seed().then(() => process.exit(0));
