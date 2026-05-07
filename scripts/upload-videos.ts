// Upload-script til træningsvideoer
// Kører lokalt på Bo's Mac med admin-rettigheder via service-account-key.json
// Uploader alle .mp4-filer fra videos-to-upload/ til Firebase Storage på path /exercises/{filnavn}
//
// Kør med: npm run upload:videos
//
// Scriptet er idempotent: kører du det igen, overskriver det blot eksisterende filer
// med samme indhold (samme størrelse → samme generation).

import { initializeApp, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { readFileSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(
	readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8')
);

const STORAGE_BUCKET = 'linns-academy-app.firebasestorage.app';
const VIDEOS_DIR = resolve(__dirname, '..', 'videos-to-upload');
const STORAGE_FOLDER = 'exercises';

initializeApp({
	credential: cert(serviceAccount),
	storageBucket: STORAGE_BUCKET
});

const bucket = getStorage().bucket();

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function uploadVideo(filename: string, localPath: string): Promise<void> {
	const destination = `${STORAGE_FOLDER}/${filename}`;
	await bucket.upload(localPath, {
		destination,
		metadata: {
			contentType: 'video/mp4',
			cacheControl: 'public, max-age=31536000'
		}
	});
}

async function main() {
	console.log('🎬 Starter upload af træningsvideoer...');
	console.log(`   Projekt: ${serviceAccount.project_id}`);
	console.log(`   Bucket:  ${STORAGE_BUCKET}`);
	console.log(`   Mappe:   ${VIDEOS_DIR}`);

	let files: string[];
	try {
		files = readdirSync(VIDEOS_DIR).filter((f) => f.toLowerCase().endsWith('.mp4'));
	} catch (err) {
		console.error(`\n❌ Kunne ikke læse mappen ${VIDEOS_DIR}:`, err);
		process.exit(1);
	}

	if (files.length === 0) {
		console.log('\n⚠️  Ingen .mp4-filer fundet i videos-to-upload/. Intet at uploade.');
		process.exit(0);
	}

	console.log(`\n📋 Fandt ${files.length} videoer der skal uploades.\n`);

	let uploaded = 0;
	let totalBytes = 0;

	for (const filename of files) {
		const localPath = join(VIDEOS_DIR, filename);
		const size = statSync(localPath).size;
		const sizeStr = formatBytes(size);

		process.stdout.write(`   ⬆️  ${filename} (${sizeStr})... `);
		try {
			await uploadVideo(filename, localPath);
			uploaded++;
			totalBytes += size;
			console.log('✓');
		} catch (err) {
			console.log('✗');
			console.error(`      Fejl: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	console.log(`\n✅ Upload færdig.`);
	console.log(`   Uploadede: ${uploaded} af ${files.length} filer`);
	console.log(`   Total størrelse: ${formatBytes(totalBytes)}`);
	console.log(`   Sti i Storage: gs://${STORAGE_BUCKET}/${STORAGE_FOLDER}/`);

	process.exit(uploaded === files.length ? 0 : 1);
}

main();
