// Seed: kurateret vaneliste til abo-vanetrackeren.
// Lægger samme liste i både basis og premium. Kan altid ændres senere via
// /app/admin/abo-vaner i UI'et.
//
// Kør:
//   npx tsx scripts/seed-abo-vaneliste.ts            # dry-run
//   npx tsx scripts/seed-abo-vaneliste.ts --skriv    # skriv

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const skriv = process.argv.includes('--skriv');

interface VaneForslag {
	id: string;
	label: string;
	kategori: string;
}

const vaner: VaneForslag[] = [
	// Krop og bevægelse
	{ id: 'krop_traening', label: 'Jeg har trænet i dag', kategori: 'Krop og bevægelse' },
	{ id: 'krop_gaatur', label: 'Jeg har gået en tur', kategori: 'Krop og bevægelse' },
	{ id: 'krop_straek', label: 'Jeg har lavet strækøvelser eller mobilitet', kategori: 'Krop og bevægelse' },

	// Mad og næring
	{ id: 'mad_protein', label: 'Jeg har spist protein til alle måltider', kategori: 'Mad og næring' },
	{ id: 'mad_groent', label: 'Jeg har spist grøntsager til mindst ét måltid', kategori: 'Mad og næring' },
	{ id: 'mad_vand', label: 'Jeg har drukket nok vand', kategori: 'Mad og næring' },
	{ id: 'mad_fiber', label: 'Jeg har spist fiberrigt i dag', kategori: 'Mad og næring' },

	// Søvn og restitution
	{ id: 'soevn_nok', label: 'Jeg har fået nok søvn', kategori: 'Søvn og restitution' },
	{ id: 'soevn_fast_tid', label: 'Jeg har haft en fast sengetid', kategori: 'Søvn og restitution' },
	{ id: 'soevn_skaerm', label: 'Jeg har undgået skærm inden sengetid', kategori: 'Søvn og restitution' },

	// Mental sundhed og ro
	{ id: 'mental_pause', label: 'Jeg har holdt en pause for mig selv', kategori: 'Mental sundhed og ro' },
	{ id: 'mental_energi', label: 'Jeg har gjort noget der gav mig energi', kategori: 'Mental sundhed og ro' },
	{ id: 'mental_maerke', label: 'Jeg har mærket efter hvordan jeg har det', kategori: 'Mental sundhed og ro' },
	{ id: 'mental_nej', label: 'Jeg har sagt nej til noget jeg ikke havde overskud til', kategori: 'Mental sundhed og ro' }
];

async function seedProdukt(produktType: 'basis' | 'premium') {
	const ref = db.collection('aboVaneskabelon').doc(produktType);
	const eksisterende = await ref.get();
	if (eksisterende.exists) {
		const data = eksisterende.data();
		const antal = (data?.vaner as VaneForslag[] | undefined)?.length ?? 0;
		console.log(`  ${produktType}: eksisterer med ${antal} vaner — overskrives med ${vaner.length}`);
	} else {
		console.log(`  ${produktType}: ny doc med ${vaner.length} vaner`);
	}
	if (skriv) {
		await ref.set({ vaner });
	}
}

async function main() {
	console.log(`\n--- Seed abo-vaneliste (${skriv ? 'skriv' : 'dry-run'}) ---`);
	console.log(`Antal vaner: ${vaner.length}`);
	for (const kat of [...new Set(vaner.map((v) => v.kategori))]) {
		const i = vaner.filter((v) => v.kategori === kat).length;
		console.log(`  ${kat}: ${i} vaner`);
	}
	console.log('\nSkriver til:');
	await seedProdukt('basis');
	await seedProdukt('premium');
	console.log('\nFærdig.');
	if (!skriv) {
		console.log('\nKør med --skriv for at skrive rigtigt.');
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
