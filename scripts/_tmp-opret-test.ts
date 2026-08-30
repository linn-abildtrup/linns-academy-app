// Laver en midlertidig koebs-linje saa vi kan oprette os som ny kunde og
// maale opstarten. Slettes bagefter.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
initializeApp({ credential: cert(JSON.parse(readFileSync('./scripts/service-account-key.json','utf-8'))) });
const db = getFirestore();
const MAIL = 'opstart-maaling@linnsacademy.dk';
const kilde:any = (await db.collection('allowedEmails').doc('test7@test.dk').get()).data();
if (!kilde) { console.log('mangler forlaeg'); process.exit(1); }
const ny = { ...kilde, email: MAIL, firstName: 'Måling', status: 'invited' };
delete ny.registreret;
await db.collection('allowedEmails').doc(MAIL).set(ny);
console.log('oprettet koebs-linje for', MAIL);
console.log('  forlobId:', ny.forlobId, '| produkt:', ny.activeProduct);
