import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
const sa = JSON.parse(readFileSync('/Users/linnabildtrup/Projekter/linns-academy-app/scripts/service-account-key.json', 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const ref = db.collection('opskrifter').doc('HagF4D1NoC5V0FKhZlqW');
const snap = await ref.get();
const instr = snap.data()?.instruktioner ?? '';
// Erstat 'Fiber: 8 til 9 g' med 'Fiber: 9 g'
const ny = instr.replace(/Fiber:\s*\d+\s*til\s*(\d+)\s*g/i, 'Fiber: $1 g');
console.log('Foer:', instr.slice(-200));
console.log('---');
console.log('Efter:', ny.slice(-200));
await ref.update({ instruktioner: ny });
console.log('\nGemt.');
process.exit(0);
