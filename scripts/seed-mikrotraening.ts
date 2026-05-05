// Seed-script til mikrotræningsmodulet
// Kører lokalt på Bo's Mac med admin-rettigheder via service-account-key.json
// Opretter alle nødvendige Firestore-documents på én gang
//
// Kør med: npm run seed:mikrotraening
//
// Scriptet er idempotent: det kan køres flere gange uden at duplikere data.
// Brug 'merge: true' når du opdaterer eksisterende documents.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(
	readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8')
);

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ==============================================
// SEED-DATA — alle dokumenter samlet ét sted
// ==============================================

const MARIA_UID = 'NxqDU9r5VJhDSNP1PnFa5UimntC2';

const exercises = [
	{
		id: 'incline_pushup',
		data: {
			name: 'Incline push-up',
			desc: 'Skånsom variant af klassisk armstrækning med hænderne på en forhøjning. Du kan bruge en bænk, sofakant eller stol.',
			how: [
				'Placer hænderne på en stabil forhøjning i skulderbredde, fingrene peger fremad',
				'Gå tilbage med fødderne, så kroppen danner en lige linje fra hoved til hæl',
				'Spænd i core og baller, hold kroppen som et brædt',
				'Bøj albuerne og sænk brystet kontrolleret ned mod forhøjningen',
				'Pres op igen til armene er strakte, uden at låse albuerne helt',
				'Jo højere forhøjning, jo lettere er øvelsen. Sænk højden når du bliver stærkere'
			],
			cat: 'overkrop',
			catLabel: 'Overkrop – Pres',
			tags: ['Bryst', 'Skuldre', 'Triceps', 'Core'],
			videoPath: 'incline_pushup.mp4',
			treaningsformer: ['mikrotraening'],
			udstyr: ['ingen', 'forhojning'],
			aktiv: true
		}
	}
];

const trainingPrograms = [
	{
		id: 'mikrotraening_kettlebell_21',
		data: {
			navn: 'Mikrotræning med kettlebell',
			beskrivelse: 'Tre minutters daglig styrketræning i 21 dage. Kræver én kettlebell.',
			treaningsform: 'mikrotraening',
			antalDage: 21,
			dagligTid: 180,
			niveau: 'begynder',
			udstyr: ['kettlebell'],
			aktiv: true
		},
		days: [
			{
				id: 'dag1',
				data: {
					dagNummer: 1,
					titel: 'overkrop',
					indledning: 'I dag arbejder vi med overkrop',
					exercises: [
						{ exerciseId: 'incline_pushup', sets: 3, workSec: 30, restSec: 10, bonus: false },
						{ exerciseId: 'incline_pushup', sets: 3, workSec: 30, restSec: 10, bonus: false },
						{ exerciseId: 'incline_pushup', sets: 3, workSec: 30, restSec: 10, bonus: false }
					]
				}
			}
		]
	}
];

const products = [
	{
		id: 'kickstart',
		data: {
			navn: 'Kickstart en sund overgangsalder',
			beskrivelse:
				'21-dages forløb med mikrotræning, kost og vaner — designet til kvinder i overgangsalderen.',
			pris: 1495,
			type: 'forlob',
			varighed: 21,
			indhold: [
				{
					type: 'trainingProgram',
					ref: 'mikrotraening_kettlebell_21',
					alias: 'mikrotraening'
				}
			],
			aktiv: true
		}
	}
];

const userProductAccess = [
	{
		uid: MARIA_UID,
		productId: 'kickstart',
		data: {
			productId: 'kickstart',
			koebt: FieldValue.serverTimestamp(),
			startDato: FieldValue.serverTimestamp(),
			udloberDato: null,
			programValg: {
				mikrotraening: 'mikrotraening_kettlebell_21'
			},
			fremgang: {
				mikrotraening: {
					gennemforte: [],
					feedback: {}
				}
			}
		}
	}
];

// ==============================================
// SEED-LOGIK
// ==============================================

async function seedExercises() {
	console.log('\n📋 Seeder exercises...');
	for (const ex of exercises) {
		await db.collection('exercises').doc(ex.id).set(ex.data, { merge: true });
		console.log(`   ✓ exercises/${ex.id}`);
	}
}

async function seedTrainingPrograms() {
	console.log('\n🏋️  Seeder trainingPrograms...');
	for (const program of trainingPrograms) {
		await db.collection('trainingPrograms').doc(program.id).set(program.data, { merge: true });
		console.log(`   ✓ trainingPrograms/${program.id}`);

		for (const day of program.days) {
			await db
				.collection('trainingPrograms')
				.doc(program.id)
				.collection('days')
				.doc(day.id)
				.set(day.data, { merge: true });
			console.log(`     ✓ trainingPrograms/${program.id}/days/${day.id}`);
		}
	}
}

async function seedProducts() {
	console.log('\n📦 Seeder products...');
	for (const product of products) {
		await db.collection('products').doc(product.id).set(product.data, { merge: true });
		console.log(`   ✓ products/${product.id}`);
	}
}

async function seedUserAccess() {
	console.log('\n👤 Seeder bruger-adgange...');
	for (const access of userProductAccess) {
		await db
			.collection('users')
			.doc(access.uid)
			.collection('products')
			.doc(access.productId)
			.set(access.data, { merge: true });
		console.log(`   ✓ users/${access.uid}/products/${access.productId}`);
	}
}

async function main() {
	console.log('🌱 Starter seed af mikrotræningsmodulet...');
	console.log(`   Projekt: ${serviceAccount.project_id}`);

	try {
		await seedExercises();
		await seedTrainingPrograms();
		await seedProducts();
		await seedUserAccess();

		console.log('\n✅ Seed færdig — alt på plads i Firestore.');
		console.log('\nAntal dokumenter oprettet/opdateret:');
		console.log(`   exercises: ${exercises.length}`);
		console.log(
			`   trainingPrograms: ${trainingPrograms.length} (med ${trainingPrograms.reduce((s, p) => s + p.days.length, 0)} dage)`
		);
		console.log(`   products: ${products.length}`);
		console.log(`   user-adgange: ${userProductAccess.length}`);
	} catch (err) {
		console.error('\n❌ Fejl under seed:', err);
		process.exit(1);
	}

	process.exit(0);
}

main();
