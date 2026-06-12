// Genererer MRS-KPI-snapshot til admin-dashboardet og gemmer det som ÉT
// dokument: adminStats/mrs. Dashboardet (/app/admin/dashboard) laeser kun det
// dokument — saa siden er lynhurtig uanset hvor mange kunder der er.
//
// Koer manuelt naar tallene skal opdateres:  npx tsx scripts/generer-mrs-stats.ts
// Dette er den FULDE genberegning (laeser alle kunder). "Opdater tal"-knappen i
// dashboardet kalder i stedet et server-endpoint der KUN henter nye maalinger.
// Begge bruger den samme beregnings-logik i src/lib/stats/mrsBeregning.ts.
//
// Scriptet skriver OGSAA mrsCache/{uid}: én cache-doc pr kunde med hendes
// faerdig-destillerede bidrag. Server-endpointet laeser cachen og opdaterer kun
// de kunder der har nye maalinger — saa det slipper for at hente alt igen.
//
// MRS = Menopause Rating Scale. LAVERE total = faerre symptomer = bedre.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
	distillerKunde,
	byggSnapshot,
	type MrsDoc,
	type KundeMrs,
	type KundeForlobBidrag
} from '../src/lib/stats/mrsBeregning.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
// KundeMrs har optional felter (subBaseline, alder, ...) der kan vaere undefined.
// Uden dette ville cache-skrivningen fejle med "Unsupported field value: undefined".
db.settings({ ignoreUndefinedProperties: true });

// Forloeb-navne + start-tidspunkt (til pr-forloeb-tilskrivning).
const forlobSnap = await db.collection('forlob').get();
const forlobNavn = new Map<string, string>();
const forlobStart = new Map<string, number>();
for (const d of forlobSnap.docs) {
	const f = d.data() as { navn?: string; startDato?: { toDate?: () => Date } };
	forlobNavn.set(d.id, f.navn ?? d.id);
	const start = f.startDato?.toDate?.()?.getTime();
	if (start) forlobStart.set(d.id, start);
}

const alleKunder: KundeMrs[] = [];
const prForlobKunder = new Map<string, KundeMrs[]>();
// Per-kunde bidrag der caches (mrsCache/{uid}.entries) til hurtig genberegning.
const cachePerBruger = new Map<string, KundeForlobBidrag[]>();

const users = await db.collection('users').get();
let kunderTjekket = 0;

for (const d of users.docs) {
	kunderTjekket++;
	const mrsSnap = await db.collection('users').doc(d.id).collection('mrs_scores').get();
	if (mrsSnap.empty) continue;

	const maalinger = mrsSnap.docs.map((m) => m.data() as MrsDoc);
	const u = d.data() as {
		forlobIds?: string[];
		brugerProfil?: { alder?: number; menopaus?: string };
	};

	// Ét KundeMrs-bidrag pr forloeb kunden har maalinger i (tilskrivning +
	// destillering ligger i den delte beregnings-modul).
	const bidrag = distillerKunde(maalinger, u.forlobIds ?? [], forlobStart, {
		alder: u.brugerProfil?.alder,
		menopaus: u.brugerProfil?.menopaus
	});
	if (bidrag.length === 0) continue;
	cachePerBruger.set(d.id, bidrag);
	for (const { forlobId, kunde } of bidrag) {
		alleKunder.push(kunde);
		if (!prForlobKunder.has(forlobId)) prForlobKunder.set(forlobId, []);
		prForlobKunder.get(forlobId)!.push(kunde);
	}
}

const snapshot = byggSnapshot(alleKunder, prForlobKunder, forlobNavn, Date.now(), kunderTjekket);

await db.collection('adminStats').doc('mrs').set(snapshot);

// Skriv per-kunde cachen (mrsCache/{uid}) + ryd stale docs (kunder der ikke
// laengere har data). Endpointet laeser hele cachen og genberegner derfra, saa
// den skal vaere autoritativ efter en fuld genberegning.
const cacheCol = db.collection('mrsCache');
const eksisterende = await cacheCol.select().get(); // kun doc-ids
const nyeIds = new Set(cachePerBruger.keys());

let batch = db.batch();
let ops = 0;
const commitHvisFuld = async () => {
	if (ops >= 450) {
		await batch.commit();
		batch = db.batch();
		ops = 0;
	}
};
for (const [uid, entries] of cachePerBruger) {
	batch.set(cacheCol.doc(uid), { entries });
	ops++;
	await commitHvisFuld();
}
let slettede = 0;
for (const doc of eksisterende.docs) {
	if (!nyeIds.has(doc.id)) {
		batch.delete(cacheCol.doc(doc.id));
		slettede++;
		ops++;
		await commitHvisFuld();
	}
}
if (ops > 0) await batch.commit();

console.log('✓ adminStats/mrs opdateret');
console.log(`  Cache: ${cachePerBruger.size} kunder skrevet, ${slettede} stale slettet`);
console.log(`  Kunder tjekket: ${kunderTjekket}`);
console.log(
	`  Med MRS-data: ${snapshot.samlet.antalMedData}, med udvikling: ${snapshot.samlet.antalMedUdvikling}`
);
console.log(
	`  Gns ${snapshot.samlet.gnsBaseline} -> ${snapshot.samlet.gnsSeneste} (${snapshot.samlet.gnsAendring}), ${snapshot.samlet.andelForbedret}% forbedret`
);
console.log(
	`  Rejse-punkter: ${snapshot.samlet.rejse.map((p) => `${p.gns}(n=${p.antal})`).join(' -> ')}`
);
console.log(
	`  Svaergrad: ${(['mild', 'moderat', 'svaer'] as const).map((g) => `${g} ${snapshot.samlet.baselineSvaergrad[g].antal}st/${snapshot.samlet.baselineSvaergrad[g].gnsAendring}`).join(', ')}`
);
console.log(`  Fordeling: ${JSON.stringify(snapshot.samlet.forbedringsFordeling)}`);
console.log(
	`  Velvaere check-ins: ${snapshot.samlet.velvaereCheckIns.map((c) => `ci${c.checkin} comp ${c.composite.gnsBaseline}->${c.composite.gnsCheckin} (${c.composite.delta}, ${c.composite.forbedretPct}% forbedret, n=${c.antalMatchede})`).join(' | ')}`
);
console.log(`  Forloebs-grupper: ${snapshot.prForlob.length}`);
