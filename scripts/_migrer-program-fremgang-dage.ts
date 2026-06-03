// Migration: tilfoej gennemforteDage til eksisterende programFremgang-docs
// baseret paa traeningHistorik (dato + forlob.startDato -> dag-nummer).
//
// Foer 2026-06-03 hardkodede tildelt-spil-pagen dag 1, og programFremgang
// gemte kun timestamps i 'gennemforte'. Vi har nu fixet spil-pagen til at
// beregne aktuel dag, og gennemforteDage tilfojes ved fremtidige gennemforsler.
// Denne migration bygger gennemforteDage RETROAKTIVT for de kunder der
// allerede har trænet pa tildelt-flowet, saa deres flueben kommer tilbage.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const apply = process.argv.includes('--apply');

// Beregn dag-nummer (1-indekseret) ud fra start-dato og en gennemfort-dato.
// Returnerer null hvis datoen er for forløbet start eller efter slut.
function dagNummerFraDato(
	startDatoISO: string,
	doneDatoISO: string,
	antalDage: number
): number | null {
	const start = new Date(startDatoISO);
	const done = new Date(doneDatoISO);
	const msPerDag = 24 * 60 * 60 * 1000;
	const diff = Math.floor(
		(Date.UTC(done.getFullYear(), done.getMonth(), done.getDate()) -
			Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) /
			msPerDag
	);
	if (diff < 0) return null;
	const dag = diff + 1; // 1-indekseret
	if (dag > antalDage) return null;
	return dag;
}

(async () => {
	console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}\n`);

	// Cache for forloeb-data (startDato, antalDage)
	const forlobCache = new Map<string, { startDato: string; antalDage: number } | null>();
	async function getForlob(id: string) {
		if (forlobCache.has(id)) return forlobCache.get(id) ?? null;
		const snap = await db.collection('forlob').doc(id).get();
		const d = snap.data();
		if (!d) {
			forlobCache.set(id, null);
			return null;
		}
		const startDato = d.startDato?.toDate?.().toISOString().slice(0, 10);
		const antalDage = d.antalDage ?? 84;
		const result = { startDato, antalDage };
		forlobCache.set(id, result);
		return result;
	}

	const users = await db.collection('users').get();
	let kunderMedProgramFremgang = 0;
	let opdateret = 0;
	let intetAtGoere = 0;
	let fejlede = 0;

	for (const u of users.docs) {
		const pfSnap = await db.collection(`users/${u.id}/programFremgang`).get();
		if (pfSnap.empty) continue;

		for (const pf of pfSnap.docs) {
			const pfd = pf.data();
			const kilde = pfd.kilde as 'eget' | 'tildelt';
			const programId = pfd.programId as string;
			const forlobId = pfd.forlobId as string | undefined;
			const allerede: number[] = pfd.gennemforteDage ?? [];

			// Skip eget-programmer — de kraever en anden mapping (custom-program
			// har sine egne dage, ikke koblet til kalender). De faar dag-nummer
			// fra fremover via spil-pagens dagNummer-parameter, men vi migrerer
			// ikke deres gamle data.
			if (kilde !== 'tildelt') continue;
			if (!forlobId) continue;

			kunderMedProgramFremgang++;

			const forlob = await getForlob(forlobId);
			if (!forlob) {
				console.log(`  [SKIP] ${u.data().email ?? u.id}: forlob ${forlobId} ikke fundet`);
				fejlede++;
				continue;
			}

			// Hent traeningHistorik for det specifikke program
			const histSnap = await db
				.collection(`users/${u.id}/traeningHistorik`)
				.where('kilde', '==', 'tildelt')
				.where('programId', '==', programId)
				.where('forlobId', '==', forlobId)
				.get();

			const dageSet = new Set<number>(allerede);
			for (const h of histSnap.docs) {
				const hd = h.data();
				const dato = hd.dato as string;
				const dag = dagNummerFraDato(forlob.startDato, dato, forlob.antalDage);
				if (dag !== null) dageSet.add(dag);
			}
			const dage = [...dageSet].sort((a, b) => a - b);

			// Spring over hvis intet aendret
			if (
				dage.length === allerede.length &&
				dage.every((d, i) => d === allerede[i])
			) {
				intetAtGoere++;
				continue;
			}

			opdateret++;
			console.log(
				`  ${u.data().email ?? u.id} | ${programId} | dage: ${JSON.stringify(allerede)} -> ${JSON.stringify(dage)}`
			);

			if (apply) {
				await pf.ref.update({ gennemforteDage: dage });
			}
		}
	}

	console.log(`\n=== Samlet ===`);
	console.log(`programFremgang-docs (tildelt) gennemset: ${kunderMedProgramFremgang}`);
	console.log(`Allerede synkroniseret: ${intetAtGoere}`);
	console.log(`Fejlede (forlob ikke fundet): ${fejlede}`);
	console.log(`${apply ? 'Opdateret' : 'Ville blive opdateret'}: ${opdateret}`);
	if (!apply) console.log(`\nKoer med --apply for at gemme.`);
	process.exit(0);
})();
