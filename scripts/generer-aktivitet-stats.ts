// Genererer "manglende kundeaktivitet"-snapshot: adminStats/aktivitet.
// Overvåger KUN kunder i et igangværende forløb (startDato ≤ i dag ≤ startDato
// + antalDage). Aktivitet = måltid (oprettet) / vanedag/abo (savedAt) / træning
// (gennemfoertAt) — login-tid bruges IKKE.
//
// Koer manuelt:  npx tsx scripts/generer-aktivitet-stats.ts
// (Eller via "Opdater liste"-knappen på Manglende aktivitet-fanen.)
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
	byggAktivitetSnapshot,
	type AktivitetInput,
	type ForlobType
} from '../src/lib/stats/aktivitetBeregning.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const naa = Date.now();
const DAG = 86400000;

// 1. Igangværende forløb (navn + type).
const ongoing = new Map<string, { navn: string; type: ForlobType }>();
for (const d of (await db.collection('forlob').get()).docs) {
	const f = d.data() as { navn?: string; type?: string; startDato?: Timestamp; antalDage?: number };
	const start = f.startDato?.toMillis?.();
	if (!start) continue;
	const slut = start + (f.antalDage ?? 0) * DAG;
	if (naa >= start && naa <= slut) {
		ongoing.set(d.id, {
			navn: f.navn ?? d.id,
			type: f.type === 'kropsro' ? 'kropsro' : 'kickstart'
		});
	}
}

// 2. Overvågede kunder = har et produkt knyttet til et igangværende forløb.
const monit = new Map<string, { forlobNavn: string; forlobType: ForlobType }>();
for (const d of (await db.collectionGroup('products').get()).docs) {
	const fid = d.data().forlobId as string | undefined;
	const uid = d.ref.parent.parent?.id;
	if (fid && uid && ongoing.has(fid))
		monit.set(uid, {
			forlobNavn: ongoing.get(fid)!.navn,
			forlobType: ongoing.get(fid)!.type
		});
}

// 3. Aktivitets-tal pr overvåget kunde (maxT + tæl i to 7-dages-vinduer).
const akt = new Map<string, { maxT: number | null; c7: number; c14: number }>();
for (const uid of monit.keys()) akt.set(uid, { maxT: null, c7: 0, c14: 0 });
function reg(uid: string | undefined, t: number | null) {
	if (!uid || t === null || !akt.has(uid)) return;
	const a = akt.get(uid)!;
	if (a.maxT === null || t > a.maxT) a.maxT = t;
	if (t > naa - 7 * DAG) a.c7++;
	else if (t > naa - 14 * DAG) a.c14++;
}
const ts = (v: unknown) => (v instanceof Timestamp ? v.toMillis() : null);
for (const d of (await db.collectionGroup('maaltider').get()).docs)
	reg(d.ref.parent.parent?.id, ts(d.data().oprettet));
for (const d of (await db.collectionGroup('vanedage').get()).docs)
	reg(d.ref.parent.parent?.parent?.parent?.id, ts(d.data().savedAt));
for (const d of (await db.collectionGroup('aboVanedage').get()).docs)
	reg(d.ref.parent.parent?.id, ts(d.data().savedAt));
for (const d of (await db.collectionGroup('traeningHistorik').get()).docs) {
	const g = d.data().gennemfoertAt;
	reg(d.ref.parent.parent?.id, typeof g === 'number' ? g : null);
}

// 4. Bruger-info (fornavn + email) + byg input.
const kunder: AktivitetInput[] = [];
for (const uid of monit.keys()) {
	const u = (await db.collection('users').doc(uid).get()).data() as
		| { firstName?: string; email?: string }
		| undefined;
	const a = akt.get(uid)!;
	const m = monit.get(uid)!;
	kunder.push({
		uid,
		fornavn: u?.firstName ?? '',
		email: u?.email ?? '',
		forlobNavn: m.forlobNavn,
		forlobType: m.forlobType,
		sidstAktiv: a.maxT,
		sidste7: a.c7,
		forrige7: a.c14
	});
}

const snapshot = byggAktivitetSnapshot(kunder, naa);
await db.collection('adminStats').doc('aktivitet').set(snapshot);

console.log('✓ adminStats/aktivitet opdateret');
console.log(`  Igangværende forløb: ${[...ongoing.values()].map((o) => o.navn).join(' · ')}`);
console.log(`  Overvåget: ${snapshot.antalOvervaaget} kunder`);
console.log(
	`  Inaktive (≥3 dage): ${snapshot.inaktive.length} · Faldende: ${snapshot.faldende.length}`
);
