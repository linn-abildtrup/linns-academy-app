// Migrerer fremgang.mikrotraening fra products/kickstart -> products/premiumforloeb
// for premium-Kickstart-kunder. F0r vores fix gemte spil-page til
// products/premiumforloeb (via hentAktivProduktType), mens forsiden laeste
// fra products/kickstart (via f.type === 'kropsro'). Resultatet var
// dobbelt-data: nyere fremgang i premiumforloeb, gamle gennemforte i
// kickstart. Vi flettr gennemforte fra begge docs over i premiumforloeb
// (union af set), saa intet flueben gaar tabt.

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

type Fremgang = { gennemforte?: number[]; feedback?: Record<string, string> };

(async () => {
	console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}\n`);

	// Hent alle premium-Kickstart-forloeb (adgangsNiveau='premium' OG type='kickstart')
	const forlobSnap = await db.collection('forlob').get();
	const premiumKickstartIds = new Set<string>();
	for (const f of forlobSnap.docs) {
		const d = f.data();
		if (d.adgangsNiveau === 'premium' && d.type === 'kickstart') {
			premiumKickstartIds.add(f.id);
		}
	}
	console.log(`Premium-Kickstart-forloeb: ${[...premiumKickstartIds].join(', ')}\n`);

	const users = await db.collection('users').get();
	let ramt = 0;
	let migreret = 0;
	let intetAtGoere = 0;

	for (const u of users.docs) {
		const ud = u.data();
		const forlobIds: string[] = ud.forlobIds ?? [];
		const erPaaPremiumKickstart = forlobIds.some((id) => premiumKickstartIds.has(id));
		if (!erPaaPremiumKickstart) continue;
		ramt++;

		const kickstartRef = db.collection(`users/${u.id}/products`).doc('kickstart');
		const premiumRef = db.collection(`users/${u.id}/products`).doc('premiumforløb');
		const [kickstartSnap, premiumSnap] = await Promise.all([kickstartRef.get(), premiumRef.get()]);
		const kickstartData = kickstartSnap.data();
		const premiumData = premiumSnap.data();

		const kickstartFremgang: Fremgang | undefined = kickstartData?.fremgang?.mikrotraening;
		const premiumFremgang: Fremgang | undefined = premiumData?.fremgang?.mikrotraening;

		const kickstartGennemforte = kickstartFremgang?.gennemforte ?? [];
		const premiumGennemforte = premiumFremgang?.gennemforte ?? [];

		// Union af de to lister (set)
		const flettet = [...new Set([...kickstartGennemforte, ...premiumGennemforte])].sort(
			(a, b) => a - b
		);

		// Skip hvis premiumforloeb allerede har alt det kickstart har
		const skalOpdatere =
			kickstartGennemforte.length > 0 &&
			!kickstartGennemforte.every((d) => premiumGennemforte.includes(d));

		if (!skalOpdatere) {
			intetAtGoere++;
			continue;
		}

		migreret++;
		console.log(`\n--- ${ud.email ?? u.id} ---`);
		console.log(`  kickstart.gennemforte: ${JSON.stringify(kickstartGennemforte)}`);
		console.log(`  premiumforloeb.gennemforte (foer): ${JSON.stringify(premiumGennemforte)}`);
		console.log(`  premiumforloeb.gennemforte (efter): ${JSON.stringify(flettet)}`);

		// Flet ogsaa feedback
		const flettetFeedback = {
			...(kickstartFremgang?.feedback ?? {}),
			...(premiumFremgang?.feedback ?? {}) // premium har forrang ved konflikt
		};

		if (apply) {
			// Brug update naar premiumforloeb-doc'en findes, ellers set med merge
			const opdatering = {
				'fremgang.mikrotraening': {
					gennemforte: flettet,
					feedback: flettetFeedback
				}
			};
			if (premiumSnap.exists) {
				await premiumRef.update(opdatering);
			} else {
				// Doc findes ikke endnu — set med merge (bevarer eventuelle felter)
				await premiumRef.set(
					{ fremgang: { mikrotraening: { gennemforte: flettet, feedback: flettetFeedback } } },
					{ merge: true }
				);
			}
		}
	}

	console.log(`\n=== Samlet ===`);
	console.log(`Kunder paa premium-Kickstart: ${ramt}`);
	console.log(`Allerede synkroniserede (ingen action): ${intetAtGoere}`);
	console.log(`${apply ? 'Migreret' : 'Ville blive migreret'}: ${migreret}`);
	if (!apply) console.log(`\nKoer med --apply for at gemme.`);
	process.exit(0);
})();
