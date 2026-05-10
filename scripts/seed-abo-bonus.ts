// Seed: 50 bonus-spørgsmål til abo-vanetrackeren.
// Lægger samme liste i både basis og premium. Kan altid ændres senere via
// /app/admin/abo-vaner i UI'et.
//
// Konvention: svarmuligheder[0] er det 'positive' svar, [2] det negative.
// Også for negativt formulerede spørgsmål — fx 'Har du følt dig stresset?'
// har svarmuligheder ['Nej', 'Lidt', 'Ja'] så positivt index altid er 0.
//
// Kør:
//   npx tsx scripts/seed-abo-bonus.ts            # dry-run
//   npx tsx scripts/seed-abo-bonus.ts --skriv    # skriv

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const skriv = process.argv.includes('--skriv');

interface BonusForslag {
	id: string;
	label: string;
	kategori: string;
	svarmuligheder: [string, string, string];
}

const KAT_ENERGI = 'Energi og krop';
const KAT_SOEVN = 'Søvn';
const KAT_HUMOER = 'Humør og mental tilstand';
const KAT_SELV = 'Selvomsorg og pauser';
const KAT_RELATIONER = 'Relationer og omverden';
const KAT_PERSPEKTIV = 'Perspektiv og fremgang';

const bonus: BonusForslag[] = [
	// Energi og krop (1-10)
	{ id: 'b_energi', label: 'Hvordan er dit energiniveau i dag?', kategori: KAT_ENERGI, svarmuligheder: ['Godt', 'Okay', 'Lavt'] },
	{ id: 'b_udhvilet', label: 'Har du følt dig udhvilet i dag?', kategori: KAT_ENERGI, svarmuligheder: ['Ja', 'Nogenlunde', 'Nej'] },
	{ id: 'b_krop', label: 'Hvordan føles din krop i dag?', kategori: KAT_ENERGI, svarmuligheder: ['Let', 'Neutral', 'Tung'] },
	{ id: 'b_hovedpine', label: 'Har du haft hovedpine i dag?', kategori: KAT_ENERGI, svarmuligheder: ['Nej', 'Lidt', 'Ja'] },
	{ id: 'b_vand_bonus', label: 'Har du drukket nok vand i dag?', kategori: KAT_ENERGI, svarmuligheder: ['Ja', 'Noget', 'Nej'] },
	{ id: 'b_hedeture', label: 'Har du haft hedeture i dag?', kategori: KAT_ENERGI, svarmuligheder: ['Nej', 'Lidt', 'Ja, meget'] },
	{ id: 'b_oemhed', label: 'Har du mærket ømhed eller spændinger i kroppen?', kategori: KAT_ENERGI, svarmuligheder: ['Nej', 'Lidt', 'Ja, meget'] },
	{ id: 'b_daglig_energi', label: 'Har du haft energi til dine daglige gøremål?', kategori: KAT_ENERGI, svarmuligheder: ['Ja', 'Delvist', 'Nej'] },
	{ id: 'b_udendoers', label: 'Har du bevæget dig udendørs i dag?', kategori: KAT_ENERGI, svarmuligheder: ['Ja', 'Lidt', 'Nej'] },
	{ id: 'b_signaler', label: 'Har du lyttet til din krops signaler i dag?', kategori: KAT_ENERGI, svarmuligheder: ['Ja', 'Lidt', 'Nej'] },

	// Søvn (11-18)
	{ id: 'b_sov', label: 'Hvordan sov du i nat?', kategori: KAT_SOEVN, svarmuligheder: ['Godt', 'Okay', 'Dårligt'] },
	{ id: 'b_vaagnet_udhvilet', label: 'Vågnede du udhvilet?', kategori: KAT_SOEVN, svarmuligheder: ['Ja', 'Nogenlunde', 'Nej'] },
	{ id: 'b_falde_isovn', label: 'Havde du svært ved at falde i søvn?', kategori: KAT_SOEVN, svarmuligheder: ['Nej', 'Lidt', 'Ja'] },
	{ id: 'b_vaagnet_natten', label: 'Vågnede du i løbet af natten?', kategori: KAT_SOEVN, svarmuligheder: ['Nej', 'Én gang', 'Flere gange'] },
	{ id: 'b_nok_soevn_bonus', label: 'Fik du nok søvn?', kategori: KAT_SOEVN, svarmuligheder: ['Ja', 'Næsten', 'Nej'] },
	{ id: 'b_fast_sengetid', label: 'Havde du en fast sengetid i aftes?', kategori: KAT_SOEVN, svarmuligheder: ['Ja', 'Nogenlunde', 'Nej'] },
	{ id: 'b_undgik_skaerm', label: 'Undgik du skærm den sidste time inden sengetid?', kategori: KAT_SOEVN, svarmuligheder: ['Ja', 'Delvist', 'Nej'] },
	{ id: 'b_dyb_soevn', label: 'Føler du at din søvn var dyb?', kategori: KAT_SOEVN, svarmuligheder: ['Ja', 'Nogenlunde', 'Nej'] },

	// Humør og mental tilstand (19-30)
	{ id: 'b_humoer', label: 'Hvordan har dit humør været i dag?', kategori: KAT_HUMOER, svarmuligheder: ['Godt', 'Okay', 'Lavt'] },
	{ id: 'b_stresset', label: 'Har du følt dig stresset i dag?', kategori: KAT_HUMOER, svarmuligheder: ['Nej', 'Lidt', 'Ja, meget'] },
	{ id: 'b_overvaeldet', label: 'Har du følt dig overvældet?', kategori: KAT_HUMOER, svarmuligheder: ['Nej', 'Lidt', 'Ja'] },
	{ id: 'b_ro', label: 'Har du haft ro i hovedet i dag?', kategori: KAT_HUMOER, svarmuligheder: ['Ja', 'Nogenlunde', 'Nej'] },
	{ id: 'b_irritabel', label: 'Har du følt dig irritabel i dag?', kategori: KAT_HUMOER, svarmuligheder: ['Nej', 'Lidt', 'Ja'] },
	{ id: 'b_koncentrere', label: 'Har du haft svært ved at koncentrere dig?', kategori: KAT_HUMOER, svarmuligheder: ['Nej', 'Lidt', 'Ja'] },
	{ id: 'b_taalmodig', label: 'Har du følt dig tålmodig i dag?', kategori: KAT_HUMOER, svarmuligheder: ['Ja', 'Nogenlunde', 'Nej'] },
	{ id: 'b_grinet', label: 'Har du grinet eller smilet i dag?', kategori: KAT_HUMOER, svarmuligheder: ['Ja', 'Lidt', 'Nej'] },
	{ id: 'b_urolig', label: 'Har du følt dig urolig eller rastløs?', kategori: KAT_HUMOER, svarmuligheder: ['Nej', 'Lidt', 'Ja'] },
	{ id: 'b_glad', label: 'Har du følt dig glad i dag?', kategori: KAT_HUMOER, svarmuligheder: ['Ja', 'Nogenlunde', 'Nej'] },
	{ id: 'b_god_dag', label: 'Har du haft en god dag samlet set?', kategori: KAT_HUMOER, svarmuligheder: ['Ja', 'Okay', 'Nej'] },
	{ id: 'b_motiveret', label: 'Har du følt dig motiveret i dag?', kategori: KAT_HUMOER, svarmuligheder: ['Ja', 'Nogenlunde', 'Nej'] },

	// Selvomsorg og pauser (31-40)
	{ id: 'b_tid_selv', label: 'Har du haft tid til dig selv i dag?', kategori: KAT_SELV, svarmuligheder: ['Ja', 'Lidt', 'Nej'] },
	{ id: 'b_rart_selv', label: 'Har du gjort noget rart for dig selv?', kategori: KAT_SELV, svarmuligheder: ['Ja', 'Lidt', 'Nej'] },
	{ id: 'b_pause_afslap', label: 'Har du holdt en pause, hvor du virkelig slappede af?', kategori: KAT_SELV, svarmuligheder: ['Ja', 'Lidt', 'Nej'] },
	{ id: 'b_sagt_nej', label: 'Har du sagt nej til noget du ikke havde overskud til?', kategori: KAT_SELV, svarmuligheder: ['Ja', 'Delvist', 'Nej'] },
	{ id: 'b_frisk_luft', label: 'Har du været udenfor og fået frisk luft?', kategori: KAT_SELV, svarmuligheder: ['Ja', 'Lidt', 'Nej'] },
	{ id: 'b_kreativt', label: 'Har du gjort noget kreativt eller sjovt?', kategori: KAT_SELV, svarmuligheder: ['Ja', 'Lidt', 'Nej'] },
	{ id: 'b_spist_ro', label: 'Har du sat dig ned og spist i ro?', kategori: KAT_SELV, svarmuligheder: ['Ja', 'Delvist', 'Nej'] },
	{ id: 'b_brug_for', label: 'Har du mærket efter hvad du havde brug for?', kategori: KAT_SELV, svarmuligheder: ['Ja', 'Lidt', 'Nej'] },
	{ id: 'b_prioriteret', label: 'Har du prioriteret dig selv i dag?', kategori: KAT_SELV, svarmuligheder: ['Ja', 'Delvist', 'Nej'] },
	{ id: 'b_telefon', label: 'Har du taget en pause fra din telefon?', kategori: KAT_SELV, svarmuligheder: ['Ja', 'Lidt', 'Nej'] },

	// Relationer og omverden (41-46)
	{ id: 'b_samtale', label: 'Har du haft en god samtale med nogen i dag?', kategori: KAT_RELATIONER, svarmuligheder: ['Ja', 'Lidt', 'Nej'] },
	{ id: 'b_set_hoert', label: 'Har du følt dig set eller hørt i dag?', kategori: KAT_RELATIONER, svarmuligheder: ['Ja', 'Nogenlunde', 'Nej'] },
	{ id: 'b_for_andre', label: 'Har du været der for nogen i dag?', kategori: KAT_RELATIONER, svarmuligheder: ['Ja', 'Lidt', 'Nej'] },
	{ id: 'b_hjaelp', label: 'Har du bedt om hjælp da du havde brug for det?', kategori: KAT_RELATIONER, svarmuligheder: ['Ja', 'Delvist', 'Nej'] },
	{ id: 'b_forbundet', label: 'Har du følt dig forbundet med andre?', kategori: KAT_RELATIONER, svarmuligheder: ['Ja', 'Nogenlunde', 'Nej'] },
	{ id: 'b_graense', label: 'Har du sat en grænse i dag?', kategori: KAT_RELATIONER, svarmuligheder: ['Ja', 'Delvist', 'Nej'] },

	// Perspektiv og fremgang (47-50)
	{ id: 'b_stolt', label: 'Har du gjort noget i dag du er stolt af?', kategori: KAT_PERSPEKTIV, svarmuligheder: ['Ja', 'Lidt', 'Nej'] },
	{ id: 'b_positivt', label: 'Har du lagt mærke til noget positivt i dag?', kategori: KAT_PERSPEKTIV, svarmuligheder: ['Ja', 'Lidt', 'Nej'] },
	{ id: 'b_rette_vej', label: 'Føler du at du er på rette vej?', kategori: KAT_PERSPEKTIV, svarmuligheder: ['Ja', 'Nogenlunde', 'Nej'] },
	{ id: 'b_venlig_selv', label: 'Har du været venlig mod dig selv i dag?', kategori: KAT_PERSPEKTIV, svarmuligheder: ['Ja', 'Delvist', 'Nej'] }
];

async function seedProdukt(produktType: 'basis' | 'premium') {
	const ref = db.collection('aboBonusPulje').doc(produktType);
	const eksisterende = await ref.get();
	if (eksisterende.exists) {
		const data = eksisterende.data();
		const antal = (data?.bonus as BonusForslag[] | undefined)?.length ?? 0;
		console.log(`  ${produktType}: eksisterer med ${antal} bonus — overskrives med ${bonus.length}`);
	} else {
		console.log(`  ${produktType}: ny doc med ${bonus.length} bonus`);
	}
	if (skriv) {
		await ref.set({ bonus });
	}
}

async function main() {
	console.log(`\n--- Seed abo-bonus (${skriv ? 'skriv' : 'dry-run'}) ---`);
	console.log(`Antal bonus: ${bonus.length}`);
	const kategorier = [...new Set(bonus.map((b) => b.kategori))];
	for (const kat of kategorier) {
		const i = bonus.filter((b) => b.kategori === kat).length;
		console.log(`  ${kat}: ${i}`);
	}

	const ids = bonus.map((b) => b.id);
	const dubletter = ids.filter((id, i) => ids.indexOf(id) !== i);
	if (dubletter.length > 0) {
		console.error('\nFEJL: dublet-id\'er fundet:', dubletter);
		process.exit(1);
	}

	console.log('\nSkriver til:');
	await seedProdukt('basis');
	await seedProdukt('premium');
	console.log('\nFærdig.');
	if (!skriv) {
		console.log('\nKør med --skriv for at skrive rigtigt.');
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
