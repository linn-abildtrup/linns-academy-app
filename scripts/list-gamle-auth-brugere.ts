// Lister alle Firebase Auth-brugere i den gamle app (vanetracker)
// og krydsrefererer med den nye app, så vi kan se hvilke der vil
// kollidere ved en auth-import. KUN læsning — ændrer intet.
//
// Kør med: npx tsx scripts/list-gamle-auth-brugere.ts

import { initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const gammelKey = JSON.parse(readFileSync(join(__dirname, 'vanetracker-key.json'), 'utf-8'));
const nyKey = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));

const gammelApp: App = initializeApp({ credential: cert(gammelKey) }, 'gammel');
const nyApp: App = initializeApp({ credential: cert(nyKey) }, 'ny');

interface BrugerOversigt {
	uid: string;
	email: string;
	displayName: string;
	createdAt: string;
	lastSignIn: string;
	disabled: boolean;
	hasPassword: boolean;
	provider: string;
	role?: string;
}

async function hentAlleAuthBrugere(app: App): Promise<BrugerOversigt[]> {
	const auth = getAuth(app);
	const brugere: BrugerOversigt[] = [];
	let pageToken: string | undefined;
	do {
		const res = await auth.listUsers(1000, pageToken);
		for (const u of res.users) {
			brugere.push({
				uid: u.uid,
				email: (u.email ?? '').toLowerCase(),
				displayName: u.displayName ?? '',
				createdAt: u.metadata.creationTime,
				lastSignIn: u.metadata.lastSignInTime ?? '',
				disabled: u.disabled,
				hasPassword: !!u.passwordHash,
				provider: u.providerData.map((p) => p.providerId).join(',') || 'password'
			});
		}
		pageToken = res.pageToken;
	} while (pageToken);
	return brugere;
}

async function hentRoller(app: App, uids: string[]): Promise<Map<string, string>> {
	const db = getFirestore(app);
	const map = new Map<string, string>();
	const batchSize = 30;
	for (let i = 0; i < uids.length; i += batchSize) {
		const slice = uids.slice(i, i + batchSize);
		const docs = await Promise.all(
			slice.map((uid) => db.collection('userProfiles').doc(uid).get())
		);
		for (let j = 0; j < docs.length; j++) {
			const d = docs[j];
			if (d.exists) {
				const data = d.data() as { role?: string; name?: string };
				map.set(slice[j], data.role ?? '');
			}
		}
	}
	return map;
}

async function main() {
	console.log('Henter Auth-brugere fra GAMMEL app (vanetracker)…');
	const gamle = await hentAlleAuthBrugere(gammelApp);
	console.log(`  → ${gamle.length} brugere i den gamle app`);

	console.log('Henter roller fra userProfiles…');
	const gamleUids = gamle.map((b) => b.uid);
	const roller = await hentRoller(gammelApp, gamleUids);
	for (const b of gamle) b.role = roller.get(b.uid) ?? '';

	console.log('\nHenter Auth-brugere fra NY app (linns-academy-app)…');
	const nye = await hentAlleAuthBrugere(nyApp);
	console.log(`  → ${nye.length} brugere i den nye app`);

	const nyEmails = new Set(nye.map((b) => b.email).filter(Boolean));
	const kolliderende = gamle.filter((g) => g.email && nyEmails.has(g.email));

	console.log(`\n=== Kollisioner (samme email i begge apps): ${kolliderende.length} ===`);
	for (const k of kolliderende) {
		const ny = nye.find((n) => n.email === k.email)!;
		console.log(
			`  ${k.email}  | gammel uid=${k.uid.slice(0, 8)}… role=${k.role || '-'} | ny uid=${ny.uid.slice(0, 8)}…`
		);
	}

	console.log(`\n=== Rolle-fordeling i gammel app ===`);
	const rollFordeling = new Map<string, number>();
	for (const b of gamle) {
		const r = b.role || '(uden role)';
		rollFordeling.set(r, (rollFordeling.get(r) ?? 0) + 1);
	}
	for (const [r, n] of [...rollFordeling.entries()].sort((a, b) => b[1] - a[1])) {
		console.log(`  ${r.padEnd(20)} ${n}`);
	}

	console.log(`\n=== Provider-fordeling i gammel app ===`);
	const provFordeling = new Map<string, number>();
	for (const b of gamle) {
		provFordeling.set(b.provider, (provFordeling.get(b.provider) ?? 0) + 1);
	}
	for (const [p, n] of [...provFordeling.entries()].sort((a, b) => b[1] - a[1])) {
		console.log(`  ${p.padEnd(30)} ${n}`);
	}

	const ingenLogin = gamle.filter((b) => !b.lastSignIn).length;
	const aldrigBrugt = gamle.filter((b) => {
		if (!b.lastSignIn) return true;
		const dage = (Date.now() - new Date(b.lastSignIn).getTime()) / (1000 * 60 * 60 * 24);
		return dage > 730; // mere end 2 år siden
	}).length;
	console.log(`\n=== Aktivitet ===`);
	console.log(`  Aldrig logget ind: ${ingenLogin}`);
	console.log(`  Ikke logget ind i 2+ år: ${aldrigBrugt}`);

	const csvSti = join(__dirname, 'gamle-brugere.csv');
	const csvLinjer = [
		'email,uid,displayName,role,provider,disabled,hasPassword,createdAt,lastSignIn,kolliderer_med_ny',
		...gamle.map((b) => {
			const koll = nyEmails.has(b.email) ? 'JA' : '';
			const safe = (s: string) => `"${(s ?? '').replace(/"/g, '""')}"`;
			return [
				safe(b.email),
				safe(b.uid),
				safe(b.displayName),
				safe(b.role ?? ''),
				safe(b.provider),
				b.disabled ? 'JA' : '',
				b.hasPassword ? 'JA' : '',
				safe(b.createdAt),
				safe(b.lastSignIn),
				koll
			].join(',');
		})
	];
	writeFileSync(csvSti, csvLinjer.join('\n'), 'utf-8');
	console.log(`\n=== Skrevet til ${csvSti} ===`);
	console.log('Åbn den i Numbers/Excel — marker testbrugere i en kolonne så du kan filtrere.');
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e);
		process.exit(1);
	});
