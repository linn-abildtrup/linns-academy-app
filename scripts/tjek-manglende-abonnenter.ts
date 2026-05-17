// Diagnostik: find ud af hvorfor admin-siden viser 61 aktive basis-abonnenter
// når der burde være flere. Sammenligner webhookLog (granted-events for basis-abo
// produkter) med allowedEmails for at finde kunder hvor webhook'en
// kom igennem, men allowedEmail ikke er korrekt opdateret.
//
// Brug:
//   npx tsx scripts/tjek-manglende-abonnenter.ts

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

interface AllowedEmail {
	email: string;
	accessLevel?: string;
	accessSource?: string;
	activeProduct?: string;
	activeSubscription?: boolean;
	simpleroCustomerId?: string;
	updatedAt?: number;
	status?: string;
}

interface WebhookLog {
	modtaget?: number;
	event?: string;
	email?: string;
	produktId?: string;
	status?: string;
	note?: string;
	payload?: unknown;
}

console.log('========================================');
console.log('Diagnostik: aktive basis-abonnenter');
console.log('========================================\n');

// ---------------------------------------------------------------------------
// 1. Hent alle allowedEmails og grupperer
// ---------------------------------------------------------------------------
const allowedSnap = await db.collection('allowedEmails').get();
const allowed: AllowedEmail[] = allowedSnap.docs.map((d) => d.data() as AllowedEmail);
console.log(`Total i allowedEmails: ${allowed.length}\n`);

const grupper = {
	basisAktiv: [] as AllowedEmail[],
	basisInaktiv: [] as AllowedEmail[],
	premiumAktiv: [] as AllowedEmail[],
	premiumInaktiv: [] as AllowedEmail[],
	forlob: [] as AllowedEmail[],
	andet: [] as AllowedEmail[]
};

for (const a of allowed) {
	if (a.accessSource === 'abonnement' && a.accessLevel === 'basis') {
		(a.activeSubscription ? grupper.basisAktiv : grupper.basisInaktiv).push(a);
	} else if (a.accessSource === 'abonnement' && a.accessLevel === 'premium') {
		(a.activeSubscription ? grupper.premiumAktiv : grupper.premiumInaktiv).push(a);
	} else if (a.accessSource === 'forløb') {
		grupper.forlob.push(a);
	} else {
		grupper.andet.push(a);
	}
}

console.log('Fordeling i allowedEmails:');
console.log(`  Basis aktive:    ${grupper.basisAktiv.length}  (← admin viser dette tal)`);
console.log(`  Basis inaktive:  ${grupper.basisInaktiv.length}`);
console.log(`  Premium aktive:  ${grupper.premiumAktiv.length}`);
console.log(`  Premium inaktive:${grupper.premiumInaktiv.length}`);
console.log(`  Forløbskunder:   ${grupper.forlob.length}`);
console.log(`  Andet/ukendt:    ${grupper.andet.length}`);
console.log();

// ---------------------------------------------------------------------------
// 2. Hent alle webhookLog-events (granted med basis-produkt)
// ---------------------------------------------------------------------------
const logSnap = await db.collection('webhookLog').get();
const log: WebhookLog[] = logSnap.docs.map((d) => d.data() as WebhookLog);
console.log(`Total events i webhookLog: ${log.length}\n`);

// Tæl granted-events pr email (basis-abo produktet er id 255519)
const BASIS_PRODUKT_ID = '255519';
const grantedBasisEmails = new Set<string>();
const skippedEvents: WebhookLog[] = [];

for (const l of log) {
	if (l.status === 'granted' && l.produktId === BASIS_PRODUKT_ID && l.email) {
		grantedBasisEmails.add(l.email.toLowerCase());
	} else if (l.status === 'skipped') {
		skippedEvents.push(l);
	}
}

console.log(`Unikke emails der har fået 'granted' for basis-abo (255519): ${grantedBasisEmails.size}`);
console.log(`Skipped events i webhookLog: ${skippedEvents.length}\n`);

// ---------------------------------------------------------------------------
// 3. Find emails der har fået granted men IKKE er aktive basis i allowedEmails
// ---------------------------------------------------------------------------
const aktiveBasisEmails = new Set(grupper.basisAktiv.map((a) => a.email.toLowerCase()));
const manglendeIAllowed: string[] = [];
const grantedMenInaktiv: AllowedEmail[] = [];

for (const email of grantedBasisEmails) {
	if (!aktiveBasisEmails.has(email)) {
		// Findes den overhovedet i allowedEmails?
		const entry = allowed.find((a) => a.email.toLowerCase() === email);
		if (!entry) {
			manglendeIAllowed.push(email);
		} else {
			grantedMenInaktiv.push(entry);
		}
	}
}

if (manglendeIAllowed.length > 0) {
	console.log('❌ Emails der har fået granted-event men IKKE er i allowedEmails:');
	for (const e of manglendeIAllowed) console.log(`     ${e}`);
	console.log();
}

if (grantedMenInaktiv.length > 0) {
	console.log('⚠️  Emails der har fået granted-event men ikke er aktive basis nu:');
	for (const a of grantedMenInaktiv) {
		console.log(
			`     ${a.email}  → accessLevel=${a.accessLevel ?? '-'} accessSource=${a.accessSource ?? '-'} activeSub=${a.activeSubscription ?? '-'}`
		);
	}
	console.log();
}

// ---------------------------------------------------------------------------
// 4. Vis seneste 20 skipped-events (mulige fejl)
// ---------------------------------------------------------------------------
if (skippedEvents.length > 0) {
	console.log('Seneste 20 skipped-events (kan indikere webhook-fejl):');
	const sorted = skippedEvents
		.filter((e) => e.modtaget)
		.sort((a, b) => (b.modtaget ?? 0) - (a.modtaget ?? 0))
		.slice(0, 20);
	for (const e of sorted) {
		const dato = new Date(e.modtaget!).toISOString().replace('T', ' ').slice(0, 16);
		console.log(`     ${dato} · ${e.email ?? '-'} · ${e.produktId ?? '-'} · ${e.note ?? '-'}`);
	}
	console.log();
}

// ---------------------------------------------------------------------------
// 5. Sanity: list de 5 nyeste basis-aktive
// ---------------------------------------------------------------------------
console.log('De 5 nyeste basis-aktive i allowedEmails:');
const nyeste = [...grupper.basisAktiv].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)).slice(0, 5);
for (const a of nyeste) {
	const dato = a.updatedAt ? new Date(a.updatedAt).toISOString().slice(0, 10) : '-';
	console.log(`     ${dato} · ${a.email} · simpleroId=${a.simpleroCustomerId ?? '-'}`);
}
