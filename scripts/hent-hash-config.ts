// Henter SCRYPT signer-key + salt-separator for vanetracker-projektet
// via Identity Toolkit REST API. Nødvendigt for at kunne re-importere
// password-hashes til ny app.
//
// Kør med: npx tsx scripts/hent-hash-config.ts

import { GoogleAuth } from 'google-auth-library';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = join(__dirname, 'vanetracker-key.json');
const key = JSON.parse(readFileSync(keyPath, 'utf-8'));

const auth = new GoogleAuth({
	keyFile: keyPath,
	scopes: ['https://www.googleapis.com/auth/cloud-platform']
});

async function main() {
	const client = await auth.getClient();
	const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/${key.project_id}/config`;
	const res = await client.request<Record<string, unknown>>({ url });
	const cfg = res.data as { signIn?: { hashConfig?: Record<string, unknown> } };
	const hash = cfg.signIn?.hashConfig;
	if (!hash) {
		console.log('Fuld config (uddrag):');
		console.log(JSON.stringify(cfg, null, 2).slice(0, 2000));
		throw new Error('Hash-config ikke fundet i response');
	}
	console.log('=== SCRYPT hash-config for vanetracker ===');
	console.log(JSON.stringify(hash, null, 2));
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error('Fejl:', e.message ?? e);
		if (e.response?.data) console.error(JSON.stringify(e.response.data, null, 2));
		process.exit(1);
	});
