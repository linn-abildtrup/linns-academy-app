// Tjek om en (eller flere) app-kunders adgang er udløbet efter deres abo-slutdato.
// Brug: npx tsx scripts/tjek-abo-udloeb.ts <email> [<email> ...]
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url'; import { dirname, join } from 'path';
import { effektivState } from '../src/lib/utils/userAdgang';
const __dirname=dirname(fileURLToPath(import.meta.url));
const sa=JSON.parse(readFileSync(join(__dirname,'service-account-key.json'),'utf-8'));
initializeApp({credential:cert(sa)}); const db=getFirestore();
(async()=>{
  const emails=process.argv.slice(2);
  if(emails.length===0){ console.log('Angiv mindst én email.'); process.exit(1); }
  const nu=Date.now();
  for(const email of emails){
    const s=await db.collection('users').where('email','==',email.toLowerCase()).get();
    if(s.empty){ console.log(`${email}: findes ikke`); continue; }
    const x=s.docs[0].data() as any;
    const st=effektivState(x as any);
    const slut=x.aboSlutterAt?new Date(x.aboSlutterAt).toISOString().slice(0,10):'-';
    const passeret=x.aboSlutterAt? x.aboSlutterAt<nu : false;
    console.log(`${email}: effektivState=${st} | aboSlutterAt=${slut} ${passeret?'(passeret)':'(fremtid)'} | accessSource=${x.accessSource} activeProduct=${x.activeProduct}`);
    if(st==='udlobet') console.log('  -> MISTET ADGANG (korrekt håndhævet)');
    else if(passeret) console.log('  -> OBS: slutdato passeret men IKKE udlobet — undersøg');
    else console.log('  -> stadig aktiv (evt. fornyet — aboSlutterAt skubbet frem)');
  }
  process.exit(0);
})();
