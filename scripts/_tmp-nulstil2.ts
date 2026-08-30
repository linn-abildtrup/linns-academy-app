// Sletter maale-brugeren saa vi kan oprette forfra og maale igen.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';
initializeApp({ credential: cert(JSON.parse(readFileSync('./scripts/service-account-key.json','utf-8'))) });
const db = getFirestore(); const auth = getAuth();
const MAIL='opstart-maaling@linnsacademy.dk';
const s = await db.collection('users').where('email','==',MAIL).get();
for (const d of s.docs) { await d.ref.delete(); console.log('slettet users-doc'); }
try { const u = await auth.getUserByEmail(MAIL); await auth.deleteUser(u.uid); console.log('slettet auth-konto'); } catch { console.log('ingen auth-konto'); }
await db.collection('allowedEmails').doc(MAIL).update({ status: 'invited' });
console.log('koebs-linjen sat tilbage til invited');
