// Finder kunder der "stoppe på forløbet" (udløbet expiresAt) men ikke
// har bonusPeriodEndsAt sat korrekt — dvs. de har INGEN adgang i appen
// selvom de burde have biblioteks-bonus.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const now = Date.now();

interface UserData {
	email?: string;
	firstName?: string;
	accessLevel?: string;
	accessSource?: string;
	state?: string;
	activeSubscription?: boolean;
	expiresAt?: number | null;
	bonusPeriodEndsAt?: number | null;
	forlobIds?: string[];
}

const snap = await db.collection('users').get();
let total = 0;
let ingenAdgang = 0;
let medBonus = 0;
let stadigAktivAdgang = 0;
const problemkunder: { email: string; navn: string; aarsag: string; data: UserData }[] = [];

for (const d of snap.docs) {
	const u = d.data() as UserData;
	total++;
	const harForlobsHistorik2 = (u.forlobIds?.length ?? 0) > 0;
	if (!u.accessLevel || u.accessLevel === 'none') {
		// Disse kunder kan ha bibliotek-bonus pga forlobIds — tjek
		if (harForlobsHistorik2) {
			const iBonus = !!u.bonusPeriodEndsAt && u.bonusPeriodEndsAt > now;
			if (!iBonus) {
				ingenAdgang++;
				problemkunder.push({
					email: u.email ?? '?',
					navn: u.firstName ?? '?',
					aarsag: 'accessLevel=none + ingen aktiv bonus, men har gennemført forløb',
					data: u
				});
			}
		}
		continue;
	}

	const erAktivAbonnent = u.accessSource === 'abonnement' && u.activeSubscription === true;
	const erUdloebet = !erAktivAbonnent && !!u.expiresAt && u.expiresAt < now;
	const iBonus = !!u.bonusPeriodEndsAt && u.bonusPeriodEndsAt > now;
	const harForlobsHistorik = (u.forlobIds?.length ?? 0) > 0;

	if (erUdloebet && !iBonus) {
		// Hun har INGEN adgang — udløbet uden bonus
		ingenAdgang++;
		problemkunder.push({
			email: u.email ?? '?',
			navn: u.firstName ?? '?',
			aarsag: u.bonusPeriodEndsAt
				? `bonusPeriodEndsAt udløbet ${new Date(u.bonusPeriodEndsAt).toLocaleDateString('da-DK')}`
				: 'bonusPeriodEndsAt mangler — har været på forløb men ingen bonus-periode sat',
			data: u
		});
	} else if (erUdloebet && iBonus) {
		medBonus++;
	} else {
		stadigAktivAdgang++;
	}
	void harForlobsHistorik;
}

console.log(`Total brugere med access: ${total}`);
console.log(`  Stadig aktiv adgang (abo/aktiv forløb): ${stadigAktivAdgang}`);
console.log(`  Udløbet med bonus-periode aktiv:        ${medBonus}`);
console.log(`  INGEN ADGANG (problem):                  ${ingenAdgang}\n`);

if (problemkunder.length > 0) {
	console.log('Kunder UDEN bibliotek-adgang:');
	for (const p of problemkunder.slice(0, 40)) {
		const eks = p.data.expiresAt ? new Date(p.data.expiresAt).toLocaleDateString('da-DK') : '-';
		const forlob = (p.data.forlobIds?.length ?? 0) > 0 ? 'JA' : 'NEJ';
		console.log(`  ${p.email} (${p.navn})`);
		console.log(`     accessSource=${p.data.accessSource}, expiresAt=${eks}, forlobIds=${forlob}`);
		console.log(`     årsag: ${p.aarsag}`);
	}
	if (problemkunder.length > 40) console.log(`  … og ${problemkunder.length - 40} flere`);
}
