import { initializeApp, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa), storageBucket: 'linns-academy-app.firebasestorage.app' });
const bucket = getStorage().bucket();

const [files] = await bucket.getFiles({ prefix: 'exercises/' });
console.log(`${files.length} filer i exercises/ på Firebase Storage:`);
for (const f of files) {
	const [meta] = await f.getMetadata();
	const size = meta.size ? Number(meta.size) : 0;
	const mb = (size / 1024 / 1024).toFixed(2);
	console.log(`  ${f.name} (${mb} MB)`);
}
