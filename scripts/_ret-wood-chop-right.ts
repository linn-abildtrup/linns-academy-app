// Wood chop venstre/hoejre: navnet refererer til STARTPOSITIONEN
// (hvilken hofte kettlebellen starter ved). Bevaegelsen gaar diagonalt
// op til MODSATTE skulder, og haelen pa STARTPOSITIONS-foden loftes.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

async function main() {
	await db.collection('exercises').doc('wood_chop_right').update({
		name: 'Standing kettlebell wood chop (højre)',
		how: [
			'Stå med fødderne lidt bredere end hofterne og hold kettlebellen med begge hænder',
			'Start med kettlebellen nede ved højre hofteled med let bøjede knæ',
			'Før kettlebellen diagonalt op over venstre skulder i en flydende bevægelse',
			'Drej let i hoften og løft hælen på højre fod i toppen',
			'Før kettlebellen kontrolleret tilbage den samme vej ned'
		]
	});
	console.log('OK wood_chop_right opdateret');

	await db.collection('exercises').doc('wood_chop_left').update({
		how: [
			'Stå med fødderne lidt bredere end hofterne og hold kettlebellen med begge hænder',
			'Start med kettlebellen nede ved venstre hofteled med let bøjede knæ',
			'Før kettlebellen diagonalt op over højre skulder i en flydende bevægelse',
			'Drej let i hoften og løft hælen på venstre fod i toppen',
			'Før kettlebellen kontrolleret tilbage den samme vej ned'
		]
	});
	console.log('OK wood_chop_left opdateret');
}
main().then(() => process.exit(0));
