// Finder alle users med mineProgrammer for at se hvor Linns nyligt
// byggede program er endt.
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
	const users = await db.collection('users').get();
	console.log(`Tjekker ${users.size} brugere…\n`);
	let antal = 0;
	for (const u of users.docs) {
		const data = u.data();
		const progs = await db.collection('users').doc(u.id).collection('mineProgrammer').get();
		if (progs.empty) continue;
		antal++;
		console.log(`${data.email ?? '(uden email)'} (uid: ${u.id}) — ${progs.size} program(mer):`);
		for (const p of progs.docs) {
			const pd = p.data();
			const opdateret = pd.opdateret ? new Date(pd.opdateret).toLocaleString('da-DK') : '?';
			console.log(`   - ${p.id} · ${pd.navn ?? '(uden navn)'} · oevelser=${(pd.oevelser ?? []).length} · dage=${pd.dage ? pd.dage.length : 'INGEN'} · opdateret ${opdateret}`);
		}
		console.log('');
	}
	console.log(`\n${antal} brugere har mineProgrammer.`);
}
main().then(() => process.exit(0));
