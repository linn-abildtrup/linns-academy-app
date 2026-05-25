// Uploader alle .mp4-filer fra videos-to-upload/Ny øvelser/ til
// Firebase Storage paa stien /exercises/{filename}. Skipper filer der
// allerede findes — overskriver INTET.
//
// Cache-Control saettes til max-age=31536000 (1 aar) saa browsere kan
// genbruge dem aggressivt (matcher de eksisterende oevelses-videoer).

import { initializeApp, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({
	credential: cert(sa),
	storageBucket: 'linns-academy-app.firebasestorage.app'
});
const bucket = getStorage().bucket();

const VIDEO_DIR = '/Users/linnabildtrup/Projekter/linns-academy-app/videos-to-upload/Ny øvelser';

async function main() {
	const lokaleFiler = readdirSync(VIDEO_DIR).filter((f) => f.endsWith('.mp4'));
	console.log(`Lokale .mp4-filer: ${lokaleFiler.length}\n`);

	// Hent alle eksisterende filer i /exercises/ for at undgaa overskrivning
	const [eksFiler] = await bucket.getFiles({ prefix: 'exercises/' });
	const eksisterendeNavne = new Set(eksFiler.map((f) => f.name.replace('exercises/', '')));
	console.log(`Eksisterende paa Storage: ${eksisterendeNavne.size}\n`);

	let uploaded = 0;
	let skipped = 0;
	let fejlede = 0;

	for (const navn of lokaleFiler) {
		const fjernSti = `exercises/${navn}`;
		if (eksisterendeNavne.has(navn)) {
			console.log(`SKIP   ${navn} (findes allerede)`);
			skipped++;
			continue;
		}
		const lokalSti = join(VIDEO_DIR, navn);
		try {
			await bucket.upload(lokalSti, {
				destination: fjernSti,
				metadata: {
					contentType: 'video/mp4',
					cacheControl: 'public, max-age=31536000'
				}
			});
			const mb = (readFileSync(lokalSti).length / 1024 / 1024).toFixed(2);
			console.log(`OK     ${navn} (${mb} MB)`);
			uploaded++;
		} catch (e) {
			console.error(`FEJL   ${navn}: ${(e as Error).message}`);
			fejlede++;
		}
	}

	console.log('');
	console.log(`Uploadet: ${uploaded}`);
	console.log(`Sprunget over: ${skipped}`);
	console.log(`Fejlede: ${fejlede}`);
}
main().then(() => process.exit(0));
