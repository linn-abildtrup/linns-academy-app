import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const snap = await db.collection('users').get();
console.log(`Gennemgår ${snap.size} brugere — sorteret efter senest opdateret\n`);

interface UserData {
	email?: string;
	firstName?: string;
	accessLevel?: string;
	accessSource?: string;
	activeProduct?: string;
	state?: string;
	expiresAt?: number;
	bonusPeriodEndsAt?: number;
	createdAt?: number;
	updatedAt?: number;
	simpleroCustomerId?: string;
}

const brugere = snap.docs
	.map((d) => ({ uid: d.id, data: d.data() as UserData }))
	.sort((a, b) => {
		const at = a.data.updatedAt ?? a.data.createdAt ?? 0;
		const bt = b.data.updatedAt ?? b.data.createdAt ?? 0;
		return bt - at;
	});

for (const u of brugere) {
	const d = u.data;
	const t = d.updatedAt ?? d.createdAt;
	let dato = '(ukendt)';
	if (t) {
		try {
			dato = new Date(Number(t)).toISOString().slice(0, 16).replace('T', ' ');
		} catch {
			dato = `(invalid: ${String(t)})`;
		}
	}
	const lvl = d.accessLevel ?? '(ingen)';
	const src = d.accessSource ?? '-';
	const prod = d.activeProduct ?? '-';
	const simpId = d.simpleroCustomerId ? `simp:${d.simpleroCustomerId}` : '';
	console.log(
		`  ${dato} · ${d.email ?? u.uid} · ${lvl}/${src}/${prod} ${simpId}`
	);
}
