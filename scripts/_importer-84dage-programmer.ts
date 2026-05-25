// Opretter to nye 84-dages traeningsprogrammer under forlob/kropsro_maj_2026:
//  - kropsro_84_uden_kb (84 dage uden kettlebell)
//  - kropsro_84_med_kb (84 dage med kettlebell)
//
// Hver med 84 day-docs der referer til exercise-id'er fra Firestore.
// Skipper ikke — hvis programmer findes allerede, overskrives de (samme
// id giver setDoc-merge=true semantik for selve programmet, men day-docs
// overskrives helt for at undgaa rester).

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const FORLOB_ID = 'kropsro_maj_2026';

interface ProgramConfig {
	id: string;
	navn: string;
	beskrivelse: string;
	csvPath: string;
	udstyr: ('ingen' | 'kettlebell')[];
}

const PROGRAMMER: ProgramConfig[] = [
	{
		id: 'kropsro_84_uden_kb',
		navn: '84 dage uden kettlebell',
		beskrivelse: '84 dages kropsvaegt-program over 12 uger. Kort, daglig traening uden udstyr.',
		csvPath: '/Users/linnabildtrup/Projekter/linns-academy-app/84dage_kropsvægt.csv',
		udstyr: ['ingen']
	},
	{
		id: 'kropsro_84_med_kb',
		navn: '84 dage med kettlebell',
		beskrivelse: '84 dages program over 12 uger med kettlebell-progression.',
		csvPath: '/Users/linnabildtrup/Projekter/linns-academy-app/84dage_kettlebell.csv',
		udstyr: ['kettlebell']
	}
];

function normaliser(s: string): string {
	return s
		.toLowerCase()
		.replace(/\(v\)/g, '_left')
		.replace(/\(h\)/g, '_right')
		.replace(/\(venstre\)/g, '_left')
		.replace(/\(højre\)/g, '_right')
		.replace(/-/g, ' ')
		.replace(/æ/g, 'ae')
		.replace(/ø/g, 'oe')
		.replace(/å/g, 'aa')
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_|_$/g, '');
}

interface DagRow {
	dag: number;
	fase: string;
	type: string;
	tema: string;
	noter: string;
	oevelser: { navn: string; arbSec: number; pauseSec: number }[];
}

function parseCsv(tekst: string): DagRow[] {
	const linjer = tekst.split('\n').filter((l) => l.trim());
	const rows: DagRow[] = [];
	for (let i = 1; i < linjer.length; i++) {
		const f = linjer[i].split(',');
		if (f.length < 5) continue;
		const dag = parseInt(f[0], 10);
		if (!Number.isFinite(dag)) continue;
		const oevelser: DagRow['oevelser'] = [];
		for (let pos = 4; pos + 2 < f.length - 3; pos += 3) {
			const navn = (f[pos] ?? '').trim();
			if (!navn) continue;
			oevelser.push({
				navn,
				arbSec: parseInt(f[pos + 1] ?? '0', 10) || 0,
				pauseSec: parseInt(f[pos + 2] ?? '0', 10) || 0
			});
		}
		rows.push({
			dag,
			fase: f[1]?.trim() ?? '',
			type: f[2]?.trim() ?? '',
			tema: f[3]?.trim() ?? '',
			oevelser,
			noter: (f[25] ?? '').trim()
		});
	}
	return rows;
}

async function main() {
	// Hent alle exercises og lav navn→id-lookup
	const exSnap = await db.collection('exercises').get();
	const navnTilId = new Map<string, string>();
	for (const d of exSnap.docs) {
		const data = d.data() as { name?: string };
		navnTilId.set(normaliser(data.name ?? d.id), d.id);
		navnTilId.set(d.id, d.id);
	}

	for (const prog of PROGRAMMER) {
		console.log(`\n## ${prog.navn}`);
		const csvTekst = readFileSync(prog.csvPath, 'utf-8');
		const dage = parseCsv(csvTekst);
		console.log(`  ${dage.length} dage parset`);

		const programRef = db.collection('forlob').doc(FORLOB_ID).collection('mikrotraeningProgrammer').doc(prog.id);

		// 1. Skriv selve TrainingProgram-doc
		await programRef.set({
			id: prog.id,
			navn: prog.navn,
			beskrivelse: prog.beskrivelse,
			treaningsform: 'mikrotraening',
			antalDage: 84,
			dagligTid: 4,
			niveau: 'let_oevet',
			udstyr: prog.udstyr,
			aktiv: true
		});
		console.log(`  TrainingProgram-doc skrevet til ${programRef.path}`);

		// 2. Slet eksisterende dage (for at undgaa rester)
		const eksDage = await programRef.collection('days').get();
		if (eksDage.size > 0) {
			const batch = db.batch();
			for (const d of eksDage.docs) batch.delete(d.ref);
			await batch.commit();
			console.log(`  Slettede ${eksDage.size} eksisterende day-docs`);
		}

		// 3. Skriv 84 TrainingDay-docs
		const batch = db.batch();
		let manglendeOevelser = 0;
		for (const r of dage) {
			const exercises = r.oevelser
				.map((o) => {
					const id = navnTilId.get(normaliser(o.navn));
					if (!id) {
						manglendeOevelser++;
						return null;
					}
					return {
						exerciseId: id,
						sets: 1,
						workSec: o.arbSec,
						restSec: o.pauseSec,
						bonus: false
					};
				})
				.filter((e): e is NonNullable<typeof e> => e !== null);

			const titel = r.tema ? `${r.type} · ${r.tema}` : r.type || `Dag ${r.dag}`;
			const indledning = r.noter || '';

			const dayRef = programRef.collection('days').doc(String(r.dag));
			batch.set(dayRef, {
				dagNummer: r.dag,
				titel,
				indledning,
				exercises
			});
		}
		await batch.commit();
		console.log(`  ${dage.length} day-docs skrevet`);
		if (manglendeOevelser > 0) {
			console.warn(`  ⚠ ${manglendeOevelser} oevelses-referencer kunne ikke matches`);
		}
	}
	console.log('\nFaerdig.');
}
main().then(() => process.exit(0));
