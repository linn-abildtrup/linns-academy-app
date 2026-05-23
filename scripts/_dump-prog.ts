import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
const sa = JSON.parse(readFileSync('/Users/linnabildtrup/Projekter/linns-academy-app/scripts/service-account-key.json', 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
async function main() {
  const d = await db.collection('users').doc('YJwILtdiExYQQhIY3zFrCvQwMzf2').collection('mineProgrammer').doc('IFUhzWvLiiJ5xbBkLsC9').get();
  console.log(JSON.stringify(d.data(), null, 2));
}
main().then(() => process.exit(0));
