// Diagnose: hvor mange Linn AI-svar er klippet af paa vej ud?
// Sikkerheds-markoeren staar ALLERSIDST i svaret, saa et klippet svar
// mangler den altid. Vi ser paa dem der mangler den.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
const sa = JSON.parse(
	readFileSync('/Users/linnabildtrup/Projekter/linns-academy-app/scripts/service-account-key.json', 'utf-8')
);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

async function main() {
	const grupper = await db.collectionGroup('linnAiSamtaler').get();
	let svar = 0;
	const laengder: number[] = [];
	const utal: Array<{ len: number; slut: string }> = [];

	for (const d of grupper.docs) {
		const beskeder = (d.data().beskeder ?? []) as Array<{
			rolle?: string;
			indhold?: string;
			sikkerhed?: number | null;
		}>;
		for (const b of beskeder) {
			if (b.rolle !== 'assistant') continue;
			const tekst = (b.indhold ?? '').trim();
			if (!tekst) continue;
			svar++;
			laengder.push(tekst.length);
			if (b.sikkerhed === null || b.sikkerhed === undefined) {
				utal.push({ len: tekst.length, slut: tekst.slice(-120).replace(/\n/g, ' ') });
			}
		}
	}
	laengder.sort((a, b) => a - b);
	const p = (n: number) => laengder[Math.floor((laengder.length - 1) * n)] ?? 0;
	console.log('assistant-svar i alt:', svar);
	console.log('laengde median/p90/max tegn:', p(0.5), p(0.9), laengder[laengder.length - 1]);
	console.log('groft skoen i tokens (tegn/3.3): median', Math.round(p(0.5) / 3.3), 'max', Math.round(laengder[laengder.length - 1] / 3.3));
	console.log('\nsvar uden sikkerheds-tal:', utal.length);
	for (const u of utal) console.log(`  [${u.len} tegn] ...${u.slut}`);
}
main().then(() => process.exit(0));
