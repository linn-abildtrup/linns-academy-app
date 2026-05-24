// Diagnose en Kropsro-brugers data — printer alle relevante felter
// fra userDoc + allowedEmail + forløb + userProducts og udleder hvilken
// UserState effektivState() vil returnere. Flagger felter der ser forkerte ud.
//
// Brug: npx tsx scripts/_diagnose-kropsro-bruger.ts <email>

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const KROPSRO_FORLOB_ID = 'kropsro_maj_2026';
const KICKSTART_FORLOB_ID = 'kickstart_maj_2026';

function formatDato(ms: number | null | undefined): string {
	if (ms === null || ms === undefined) return '(ikke sat)';
	const d = new Date(ms);
	const iDag = Date.now();
	const dageDiff = Math.round((ms - iDag) / 86400000);
	const retning = dageDiff < 0 ? `${Math.abs(dageDiff)} dage SIDEN` : `om ${dageDiff} dage`;
	return `${d.toISOString().slice(0, 10)} (${retning})`;
}

function flag(label: string, vaerdi: unknown, forventet: unknown, kommentar = ''): void {
	const ok = JSON.stringify(vaerdi) === JSON.stringify(forventet);
	const ikon = ok ? 'OK  ' : 'FEJL';
	const kom = kommentar ? `  ← ${kommentar}` : '';
	console.log(`  ${ikon}  ${label}: ${JSON.stringify(vaerdi)}${kom}`);
}

async function main() {
	const email = process.argv[2];
	if (!email) {
		console.error('Brug: npx tsx scripts/_diagnose-kropsro-bruger.ts <email>');
		process.exit(1);
	}

	console.log(`\n===== Diagnose for ${email} =====\n`);

	// 1) allowedEmails
	const allowedSnap = await db.collection('allowedEmails').doc(email).get();
	if (!allowedSnap.exists) {
		console.log('allowedEmails: INGEN dokument fundet for denne email');
	} else {
		const a = allowedSnap.data() ?? {};
		console.log('--- allowedEmails ---');
		flag('forlobId', a.forlobId, KROPSRO_FORLOB_ID);
		flag('activeProduct', a.activeProduct, 'premiumforløb');
		flag('accessLevel', a.accessLevel, 'premium');
		flag('accessSource', a.accessSource, 'forløb');
		flag('activeSubscription', a.activeSubscription, false);
		console.log(`  ..  status: ${a.status ?? '(ikke sat)'}`);
		console.log(`  ..  updatedAt: ${formatDato(a.updatedAt)}`);
	}

	// 2) userDoc
	const uSnap = await db.collection('users').where('email', '==', email).limit(1).get();
	if (uSnap.empty) {
		console.log('\nuserDoc: INGEN bruger fundet (status=invited eller email-mismatch)');
		process.exit(0);
	}
	const uDoc = uSnap.docs[0];
	const u = uDoc.data();
	console.log(`\n--- userDoc (${uDoc.id}) ---`);
	flag('accessLevel', u.accessLevel, 'premium');
	flag('accessSource', u.accessSource, 'forløb');
	flag('activeProduct', u.activeProduct, 'premiumforløb');
	flag('activeSubscription', u.activeSubscription, false);
	flag(
		'forlobIds inkluderer kropsro',
		Array.isArray(u.forlobIds) && u.forlobIds.includes(KROPSRO_FORLOB_ID),
		true
	);
	console.log(`  ..  forlobIds: ${JSON.stringify(u.forlobIds ?? [])}`);
	console.log(`  ..  state (legacy): ${u.state ?? '(ikke sat)'}`);
	console.log(`  ..  expiresAt: ${formatDato(u.expiresAt)}`);
	console.log(`  ..  bonusPeriodEndsAt: ${formatDato(u.bonusPeriodEndsAt)}`);

	// 3) forløb-doc — beregn forventet slutdato
	const fSnap = await db.collection('forlob').doc(KROPSRO_FORLOB_ID).get();
	let forventetSlutMs: number | null = null;
	if (fSnap.exists) {
		const f = fSnap.data() ?? {};
		const startMs = f.startDato?.toMillis?.() ?? null;
		const antalDage = f.antalDage ?? null;
		console.log(`\n--- forlob/${KROPSRO_FORLOB_ID} ---`);
		console.log(`  ..  startDato: ${formatDato(startMs)}`);
		console.log(`  ..  antalDage: ${antalDage}`);
		if (startMs && antalDage) {
			forventetSlutMs = startMs + antalDage * 86400000;
			console.log(`  ..  forventet slutdato: ${formatDato(forventetSlutMs)}`);
		}
	}

	// 4) userProducts
	const productsSnap = await uDoc.ref.collection('products').get();
	console.log(`\n--- users/${uDoc.id}/products (${productsSnap.size} dok) ---`);
	for (const p of productsSnap.docs) {
		const pd = p.data();
		console.log(`  ${p.id}:`);
		console.log(`    forlobId: ${pd.forlobId ?? '(ikke sat)'}`);
		console.log(`    programValg: ${JSON.stringify(pd.programValg ?? null)}`);
		if (pd.nulDage) console.log(`    nulDage.intervaller: ${pd.nulDage.intervaller?.length ?? 0}`);
	}

	// 5) Udlede hvad effektivState() returnerer i dag
	console.log('\n--- effektivState() simulation ---');
	const nu = Date.now();
	const erAktivAbonnent = u.accessSource === 'abonnement' && u.activeSubscription === true;
	const udloebet = !erAktivAbonnent && !!(u.expiresAt && u.expiresAt < nu);
	let resultat = 'udlobet';
	if (u.accessLevel !== undefined) {
		if (u.accessLevel === 'none' || udloebet) resultat = 'udlobet';
		else if (u.accessSource === 'forløb') resultat = 'forlobskunde';
		else resultat = 'modulbruger';
	} else if (udloebet) {
		resultat = 'udlobet';
	} else {
		resultat = String(u.state ?? 'null');
	}
	console.log(`  erAktivAbonnent: ${erAktivAbonnent}`);
	console.log(`  udloebet (expiresAt < nu): ${udloebet}`);
	console.log(`  → effektivState() = '${resultat}'`);
	if (resultat !== 'forlobskunde') {
		console.log(`  FEJL: forventet 'forlobskunde' for aktiv Kropsro-kunde`);
	}

	// 6) Anbefalet fix
	if (forventetSlutMs && (u.expiresAt ?? 0) < forventetSlutMs) {
		console.log('\n--- Anbefalet fix ---');
		console.log(`  Sæt expiresAt fra ${formatDato(u.expiresAt)}`);
		console.log(`              til  ${formatDato(forventetSlutMs)}`);
	}

	console.log('');
}
main().then(() => process.exit(0));
