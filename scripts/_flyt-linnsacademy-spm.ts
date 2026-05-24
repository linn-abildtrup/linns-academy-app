import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
const sa = JSON.parse(readFileSync('/Users/linnabildtrup/Projekter/linns-academy-app/scripts/service-account-key.json', 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const f = await db.collection('forlob').doc('kropsro_maj_2026').get();
const navn = f.data()?.navn;
await db.collection('klientspoergsmaal').doc('YcHENcz1mJCdW417FIiA').update({
	forlobId: 'kropsro_maj_2026',
	forlobNavn: navn
});
console.log(`Flyttet til ${navn}`);
process.exit(0);
