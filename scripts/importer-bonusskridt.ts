// Erstatter de 50 refleksionsspørgsmål i aboBonusPulje med 90 bonusskridt
// (handlingsorienterede mikro-opgaver). Hver bonusskridt har én svarmulighed
// "Udført" så UI viser én knap i stedet for tre.
//
// Kør: npm run importer:bonusskridt [-- --dry]

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const dryRun = process.argv.includes('--dry');

const SKRIDT: string[] = [
	'Bevæg dig i mindst 5 minutter efter et måltid i dag',
	'Spis din proteinrige morgenmad inden for den første time efter du vågner',
	'Tilføj frø eller kerner til din morgenmad i dag',
	'Prøv at ramme 30g protein til din frokost i dag',
	'Gå udenfor i 10 minutter i løbet af din eftermiddag',
	'Gå en tur i din frokostpause i dag',
	'Prøv at ramme 30g protein til din frokost eller aftensmad med fisk i dag',
	'Gør lidt grønt klar i aften til din frokost i morgen',
	'Spis grøntsager til alle tre måltider i dag',
	'Gør en pose gnavegrønt klar til i morgen',
	'Lav en ekstra mikrotræning i dag',
	'Lav 5 squats mens du venter på noget i dag',
	'Spis et måltid helt uden skærm i dag',
	'Spis minimum 3 forskellige grøntsager til din aftensmad i dag',
	'Gå en tur i dagslys inden for den første time efter du vågner',
	'Lav 10 squats på et tidspunkt i dag',
	'Gå en kort tur efter din frokost i dag',
	'Tag 5 dybe vejrtrækninger inden du spiser frokost',
	'Tilføj to ekstra øvelser til din mikrotræning i dag',
	'Stå på ét ben i 30 sekunder på hvert ben i dag',
	'Bevæg dig lige efter din frokost i dag',
	'Tag en pause inden du er udkørt i dag',
	'Gå i seng 15 minutter tidligere end du plejer i aften',
	'Gå udenfor i dagslys inden du tjekker din telefon i morgen',
	'Spis en grøn forret inden din aftensmad i dag',
	'Prøv en ny proteinkilde du ikke har spist i denne uge',
	'Spis minimum 5 forskellige slags grøntsager i løbet af hele dagen',
	'Spis alle dine måltider uden skærm i dag',
	'Spis mindst 3 forskellige slags grøntsager til din frokost i dag',
	'Tilføj en ekstra øvelse til din mikrotræning i dag',
	'Tag 3 langsomme dybe vejrtrækninger før dit første måltid',
	'Prøv en grøntsag du sjældent spiser',
	'Gør en grøn snack klar du kan tage med ud af døren i morgen',
	'Giv dig selv lov til at gøre ingenting i 5 minutter i dag',
	'Bevæg dig i 10 minutter efter din aftensmad',
	'Sig én pæn ting til dig selv i dag som du ville sige til en veninde',
	'Prøv at ramme 30g protein til din frokost eller aftensmad uden kød i dag',
	'Spis grøntsagerne på din tallerken først til alle måltider i dag',
	'Hav gnavegrønt klar til din frokost i dag',
	'Spis grøntsagerne før dine kulhydrater i dag',
	'Få dagslys så tidligt som muligt på dagen i dag',
	'Gå en tur efter din aftensmad i dag',
	'Bevæg dig lige efter din aftensmad i dag',
	'Hav en proteinrig snack klar i køleskabet til i morgen',
	'Prøv en bælgfrugt du ikke har spist før',
	'Gør en lille god ting for din krop i dag. Det behøver ikke tage mere end 2 minutter',
	'Prøv at ramme 30g protein til din aftensmad i dag',
	'Hav en proteinkilde klar du kan tilføje til alle måltider i morgen',
	'Tilføj en slags bælgfrugt til din frokost eller aftensmad i dag',
	'Lav din mikrotræning to gange i dag',
	'Spis 3 forskellige slags frugt i løbet af dagen',
	'Prioritér dig selv over én opgave på din to-do liste i dag',
	'Spis en håndfuld nødder som snack i dag',
	'Prøv at ramme 30g protein til alle tre måltider i dag',
	'Gør din morgenmad klar i aften så du rammer protein i morgen tidlig',
	'Gå udenfor i 5 minutter uden din telefon',
	'Tilføj en øvelse du ikke plejer at lave til din mikrotræning',
	'Lav en ting langsommere end du plejer i dag',
	'Gør din frokost klar i aften så du rammer 30g protein i morgen',
	'Drop én ting fra din liste i dag uden dårlig samvittighed',
	'Prøv en grøntsag du ikke har spist i denne uge',
	'Sig nej til én ting i dag du egentlig ikke har lyst til',
	'Bevæg dig lige efter et måltid i dag',
	'Tilføj noget ekstra grønt til din frokost i dag',
	'Prøv at ramme 30g protein til din morgenmad i dag',
	'Brug 2 minutter på noget der kun er for dig i dag',
	'Lav din mikrotræning tre gange i dag',
	'Gør noget i dag bare fordi det føles godt',
	'Lav en mikrotræning lige efter et af dine måltider i dag',
	'Vælg den nemme løsning til ét måltid i dag uden dårlig samvittighed',
	'Sørg for at halvdelen af din aftensmad er grøntsager',
	'Læg dig ned i 5 minutter midt på dagen bare fordi du kan',
	'Spis din frokost uden skærm i dag',
	'Tilføj en slags bælgfrugt til et af dine måltider i dag',
	'Spis grøntsager til både frokost og aftensmad i dag',
	'Lad være med at undskylde for noget du har brug for i dag',
	'Anerkend én ting din krop kunne i dag',
	'Spis protein før dine kulhydrater til frokost i dag',
	'Stå på ét ben mens du børster tænder i dag',
	'Gør noget rart for dig selv i dag som ikke involverer mad eller træning',
	'Tilføj protein til din aftensnack i dag',
	'Gå udenfor med en kop kaffe eller te i stedet for at sidde inde',
	'Sørg for at alle dine snacks i dag indeholder protein',
	'Spis grøntsager til din frokost i dag',
	'Tilføj frø eller kerner ovenpå noget du alligevel spiser i dag',
	'Tilføj lidt ekstra fiber til din morgenmad i dag',
	'Spis mindst 2 forskellige slags frugt til din eftermiddagssnack',
	'Tilføj en proteinkilde til din snack i dag',
	'Gør en proteinrig morgenmad klar til to dage i dag',
	'Mærk efter hvad din krop har brug for lige nu og giv den det'
];

const bonus = SKRIDT.map((label, i) => ({
	id: `bs${String(i + 1).padStart(3, '0')}`,
	label,
	kategori: 'Bonusskridt',
	svarmuligheder: ['Udført', '', ''] as [string, string, string]
}));

async function main() {
	console.log(`${dryRun ? '[DRY] ' : ''}Importerer ${bonus.length} bonusskridt → aboBonusPulje\n`);
	for (const b of bonus.slice(0, 5)) console.log(`  ${b.id}: ${b.label}`);
	console.log(`  … og ${bonus.length - 5} mere\n`);

	if (dryRun) {
		console.log('(dry-run — intet skrevet)');
		return;
	}

	for (const produktType of ['basis', 'premium'] as const) {
		await db.collection('aboBonusPulje').doc(produktType).set({ bonus });
		console.log(`  ✓ ${produktType}: ${bonus.length} bonusskridt skrevet`);
	}
}

main().catch((e) => {
	console.error('Fejl:', e);
	process.exit(1);
});
