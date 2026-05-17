// Backfill firstName/lastName på allowedEmails + users ved at parse
// gemte webhookLog-payloads for hver eksisterende abonnent.
//
// Baggrund: Tidligere webhook-handlere gemte ikke kundens navn, så de 56
// basis-abonnenter står som "(uden navn)" på admin-siden. Simplero sender
// `first_names` (med 's') + `last_name` på top-niveau i payload, og som
// fallback findes hele navnet i `purchase.name`. Dette script går igennem
// allowedEmails og users, finder seneste purchase.made / koeb-webhook-entry
// for hver email, parser payload og udfylder manglende navne.
//
// Kør med: npx tsx scripts/backfill-navne-fra-webhooklog.ts        (dry-run)
//          npx tsx scripts/backfill-navne-fra-webhooklog.ts --apply (skriv)

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const APPLY = process.argv.includes('--apply');

interface SimpleroPayload {
	first_names?: string;
	last_name?: string;
	data?: {
		customer?: { first_names?: string; last_name?: string };
		purchase?: { name?: string };
	};
	customer?: { first_names?: string; last_name?: string };
	purchase?: { name?: string };
}

function uddragNavn(payload: SimpleroPayload): { firstName: string; lastName: string } {
	const first =
		payload.first_names?.trim() ??
		payload.data?.customer?.first_names?.trim() ??
		payload.customer?.first_names?.trim() ??
		'';
	const last =
		payload.last_name?.trim() ??
		payload.data?.customer?.last_name?.trim() ??
		payload.customer?.last_name?.trim() ??
		'';
	if (first || last) return { firstName: first, lastName: last };
	const samlet = (payload.purchase?.name ?? payload.data?.purchase?.name ?? '').trim();
	if (samlet) {
		const idx = samlet.indexOf(' ');
		if (idx === -1) return { firstName: samlet, lastName: '' };
		return { firstName: samlet.slice(0, idx).trim(), lastName: samlet.slice(idx + 1).trim() };
	}
	return { firstName: '', lastName: '' };
}

async function findNavnForEmail(
	email: string
): Promise<{ firstName: string; lastName: string } | null> {
	// Uden orderBy for at undgå at skulle oprette composite index. Sorter i memory.
	const snap = await db.collection('webhookLog').where('email', '==', email).get();
	const sorteret = snap.docs
		.map((d) => ({ id: d.id, data: d.data() }))
		.sort((a, b) => (b.data.modtaget ?? 0) - (a.data.modtaget ?? 0));
	for (const doc of sorteret) {
		const d = doc.data;
		if (!d.payload || typeof d.payload !== 'string') continue;
		try {
			const payload = JSON.parse(d.payload) as SimpleroPayload;
			const navn = uddragNavn(payload);
			if (navn.firstName || navn.lastName) return navn;
		} catch {
			// ignorer ugyldig JSON i log
		}
	}
	return null;
}

async function main() {
	console.log(APPLY ? '=== APPLY mode — skriver til Firestore ===' : '=== DRY-RUN ===\n');

	let opdaterede = 0;
	let sprunget = 0;
	let ufundne = 0;

	console.log('\n--- allowedEmails ---');
	const allowedSnap = await db.collection('allowedEmails').get();
	for (const doc of allowedSnap.docs) {
		const d = doc.data();
		if (d.firstName || d.lastName) {
			sprunget++;
			continue;
		}
		const email = (d.email as string | undefined) ?? doc.id.replace(/_/g, '/');
		const navn = await findNavnForEmail(email.toLowerCase());
		if (!navn) {
			ufundne++;
			console.log(`  ${email} — intet navn fundet i webhookLog`);
			continue;
		}
		console.log(`  ${email} → ${navn.firstName} ${navn.lastName}`);
		if (APPLY) {
			const opd: Record<string, string> = {};
			if (navn.firstName) opd.firstName = navn.firstName;
			if (navn.lastName) opd.lastName = navn.lastName;
			await doc.ref.set(opd, { merge: true });
		}
		opdaterede++;
	}

	console.log('\n--- users ---');
	const usersSnap = await db.collection('users').get();
	for (const doc of usersSnap.docs) {
		const d = doc.data();
		if (d.firstName || d.lastName) {
			sprunget++;
			continue;
		}
		const email = d.email as string | undefined;
		if (!email) {
			continue;
		}
		const navn = await findNavnForEmail(email.toLowerCase());
		if (!navn) {
			ufundne++;
			console.log(`  ${email} — intet navn fundet i webhookLog`);
			continue;
		}
		console.log(`  ${email} (uid=${doc.id}) → ${navn.firstName} ${navn.lastName}`);
		if (APPLY) {
			const opd: Record<string, string> = {};
			if (navn.firstName) opd.firstName = navn.firstName;
			if (navn.lastName) opd.lastName = navn.lastName;
			await doc.ref.set(opd, { merge: true });
		}
		opdaterede++;
	}

	console.log(
		`\nResultat: ${opdaterede} opdateret, ${sprunget} sprunget over (havde navn), ${ufundne} uden match i webhookLog`
	);
	if (!APPLY) console.log('\nKør igen med --apply for at skrive til Firestore.');
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e);
		process.exit(1);
	});
