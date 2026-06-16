// Finder en specifik kunde på tværs af allowedEmails, users og webhookLog
// så vi kan se om webhook'en kom igennem og hvad der skete.
//
// Brug:
//   npx tsx scripts/find-kunde.ts manja
//   npx tsx scripts/find-kunde.ts manja@gmail.com
//
// Søger fuzzy i email, firstName, lastName, og i payload-feltet på webhookLog.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const sog = (process.argv[2] ?? '').trim().toLowerCase();
if (!sog) {
	console.error('Brug: npx tsx scripts/find-kunde.ts <navn-eller-email>');
	process.exit(1);
}

console.log(`Søger efter "${sog}"…\n`);

// ---------------------------------------------------------------------------
// 1. allowedEmails
// ---------------------------------------------------------------------------
console.log('=== allowedEmails ===');
const allowedSnap = await db.collection('allowedEmails').get();
const matchAllowed = allowedSnap.docs
	.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }))
	.filter((r) => {
		const email = String(r.data.email ?? '').toLowerCase();
		const first = String(r.data.firstName ?? '').toLowerCase();
		const last = String(r.data.lastName ?? '').toLowerCase();
		return email.includes(sog) || first.includes(sog) || last.includes(sog);
	});
if (matchAllowed.length === 0) {
	console.log('  Ingen match i allowedEmails.\n');
} else {
	for (const r of matchAllowed) {
		console.log(`  ${r.id}`);
		console.log(`    ${JSON.stringify(r.data, null, 2).replace(/\n/g, '\n    ')}\n`);
	}
}

// ---------------------------------------------------------------------------
// 2. users
// ---------------------------------------------------------------------------
console.log('=== users ===');
const usersSnap = await db.collection('users').get();
const matchUsers = usersSnap.docs
	.map((d) => ({ uid: d.id, data: d.data() as Record<string, unknown> }))
	.filter((r) => {
		const email = String(r.data.email ?? '').toLowerCase();
		const first = String(r.data.firstName ?? '').toLowerCase();
		return email.includes(sog) || first.includes(sog);
	});
if (matchUsers.length === 0) {
	console.log('  Ingen match i users.\n');
} else {
	for (const r of matchUsers) {
		console.log(`  uid=${r.uid}`);
		console.log(
			`    email=${r.data.email} firstName=${r.data.firstName} accessLevel=${r.data.accessLevel} accessSource=${r.data.accessSource} activeProduct=${r.data.activeProduct} activeSubscription=${r.data.activeSubscription} state=${r.data.state}`
		);
		const versionSat = r.data.appVersionSetAt
			? new Date(Number(r.data.appVersionSetAt)).toISOString().replace('T', ' ').slice(0, 19)
			: '?';
		console.log(
			`    appVersion=${r.data.appVersion ?? '— (har ikke åbnet app siden version-sporing blev deployet)'} (sat ${versionSat})\n`
		);
	}
}

// ---------------------------------------------------------------------------
// 3. webhookLog (alle hits, ikke kun seneste)
// ---------------------------------------------------------------------------
console.log('=== webhookLog ===');
const logSnap = await db.collection('webhookLog').get();
const matchLog = logSnap.docs
	.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }))
	.filter((r) => {
		const email = String(r.data.email ?? '').toLowerCase();
		const payload = JSON.stringify(r.data.payload ?? '').toLowerCase();
		return email.includes(sog) || payload.includes(sog);
	})
	.sort((a, b) => Number(b.data.modtaget ?? 0) - Number(a.data.modtaget ?? 0));

if (matchLog.length === 0) {
	console.log('  Ingen match i webhookLog — Simplero har aldrig sendt en webhook for denne kunde.\n');
} else {
	console.log(`  ${matchLog.length} match:\n`);
	for (const r of matchLog) {
		const d = r.data;
		const dato = d.modtaget
			? new Date(Number(d.modtaget)).toISOString().replace('T', ' ').slice(0, 19)
			: '?';
		console.log(`  ${dato}`);
		console.log(`    event:    ${d.event}`);
		console.log(`    status:   ${d.status}`);
		console.log(`    email:    ${d.email}`);
		console.log(`    produkt:  ${d.produktId}`);
		console.log(`    note:     ${d.note}`);
		if (d.payload) {
			const p = typeof d.payload === 'string' ? d.payload : JSON.stringify(d.payload);
			console.log(`    payload:  ${p.slice(0, 600)}${p.length > 600 ? '…' : ''}`);
		}
		console.log();
	}
}

console.log('=== Diagnose ===');
if (matchLog.length === 0 && matchAllowed.length === 0) {
	console.log('❌ Kunden findes IKKE i webhookLog OG IKKE i allowedEmails.');
	console.log('   Sandsynlig årsag: Simplero har aldrig sendt webhook for denne kunde.');
	console.log('   Tjek i Simplero-admin om købet faktisk er gået igennem og om triggeren er aktiv.');
} else if (matchLog.length > 0 && matchAllowed.length === 0) {
	console.log('⚠️  Kunden findes i webhookLog men IKKE i allowedEmails.');
	console.log('   Sandsynlig årsag: webhook blev "skipped" (se status ovenfor) — fx ukendt produkt.');
} else if (matchAllowed.length > 0) {
	const a = matchAllowed[0].data;
	if (a.activeSubscription === false) {
		console.log('⚠️  Kunden er i allowedEmails men markeret som inaktiv.');
		console.log('   Sandsynlig årsag: en senere cancel-event har sat activeSubscription=false.');
	} else if (a.accessLevel !== 'basis') {
		console.log(`⚠️  Kunden har accessLevel="${a.accessLevel}" — ikke 'basis'.`);
		console.log('   Sandsynlig årsag: produkt-ID mapper til en anden type i produkter.ts.');
	} else {
		console.log('✅ Kunden er i allowedEmails som aktiv basis-abo — bør tælle med i admin-tællingen.');
	}
}
