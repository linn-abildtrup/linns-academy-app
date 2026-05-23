import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
const sa = JSON.parse(readFileSync('/Users/linnabildtrup/Projekter/linns-academy-app/scripts/service-account-key.json', 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
async function main() {
  const d = await db.collection('forlob').doc('kropsro_maj_2026').get();
  const data = d.data();
  console.log('navn:', data?.navn);
  console.log('type:', data?.type);
  console.log('startDato:', data?.startDato?.toDate?.()?.toISOString?.());
  console.log('antalDage:', data?.antalDage);
}
main().then(() => process.exit(0));
