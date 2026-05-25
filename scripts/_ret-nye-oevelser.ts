// Anvender Linns rettelser paa de 19 nye oevelser efter foerste review.
// - Stavefejl: 'hoejre' → 'højre' i navne
// - Trin der ikke matcher videoen er omskrevet
// - 'Skift side efter halvdelen'-trin fjernet fra L/R-doks (giver ikke
//   mening naar hver side er sit eget doc)
// - Byt L/R i tekster saa de matcher overskriften
// Kun specifikke felter opdateres (merge: true) — resten af doc'en er urort.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

interface Rettelse {
	id: string;
	name?: string;
	desc?: string;
	how?: string[];
}

const RETTELSER: Rettelse[] = [
	{
		id: 'ankelstraek_left',
		how: [
			'Stå oprejst med fødderne i hoftebredde',
			'Placer venstre fod ca. 10 cm fra dig — dit faste støtte-ben',
			'Før knæet fremad over tåen uden at løfte hælen',
			'Hold positionen med knæet ude over foden og pres hoften frem',
			'Hold strækket i hele intervallet uden at rocke frem og tilbage',
			'Flyt foden lidt længere væk efterhånden som bevægeligheden øges'
		]
	},
	{
		id: 'ankelstraek_right',
		name: 'Ankelstræk (højre)',
		how: [
			'Stå oprejst med fødderne i hoftebredde',
			'Placer højre fod ca. 10 cm fra dig — dit faste støtte-ben',
			'Før knæet fremad over tåen uden at løfte hælen',
			'Hold positionen med knæet ude over foden og pres hoften frem',
			'Hold strækket i hele intervallet uden at rocke frem og tilbage',
			'Flyt foden lidt længere væk efterhånden som bevægeligheden øges'
		]
	},
	{
		id: 'floor_press_kettlebell',
		desc: 'Liggende pres med begge hænder på kettlebellen — skånsomt for skuldrene fordi gulvet stopper albuerne.',
		how: [
			'Læg dig på ryggen med knæene bøjet og fødderne i gulvet',
			'Hold kettlebellen med begge hænder over brystet, albuerne hviler på gulvet',
			'Pres kettlebellen op mod loftet til armene er strakte',
			'Sænk roligt ned til albuerne hviler på gulvet igen',
			'Hold håndleddene strakte og kettlebellen over brystet hele vejen',
			'Gentag i et roligt tempo gennem hele intervallet'
		]
	},
	{
		id: 'lunges_rotation',
		desc: 'Udfald fremad med rotation af overkroppen ud over det forreste ben. Træner hofte, core og mobilitet i brystryggen.'
	},
	{
		id: 'side_plank_right',
		name: 'Side plank (højre)'
	},
	{
		id: 'single_arm_row_kettlebell_left',
		how: [
			'Stå ved siden af en stol og placer højre hånd på ryglænet for støtte',
			'Hold kettlebellen i venstre hånd med armen strakt ned',
			'Bøj let fremover i hoften med lang og neutral ryg',
			'Træk albuen op langs siden til kettlebellen er ved hoften',
			'Knib skulderbladet ind mod rygsøjlen i toppen',
			'Sænk kontrolleret ned og gentag gennem hele intervallet'
		]
	},
	{
		id: 'single_arm_row_kettlebell_right',
		name: 'Single-arm row med kettlebell (højre)',
		how: [
			'Stå ved siden af en stol og placer venstre hånd på ryglænet for støtte',
			'Hold kettlebellen i højre hånd med armen strakt ned',
			'Bøj let fremover i hoften med lang og neutral ryg',
			'Træk albuen op langs siden til kettlebellen er ved hoften',
			'Knib skulderbladet ind mod rygsøjlen i toppen',
			'Sænk kontrolleret ned og gentag gennem hele intervallet'
		]
	},
	{
		id: 'single_leg_deadlift_kettlebell_left',
		how: [
			'Stå på venstre ben og hold kettlebellen i venstre hånd',
			'Hæng overkroppen fremad fra hoften mens højre ben strækkes bagud',
			'Lad kettlebellen hænge ned langs benet mod gulvet',
			'Hold hofterne parallelle og ryggen lang',
			'Pres gennem venstre hæl og rejs dig op igen'
		]
	},
	{
		id: 'single_leg_deadlift_kettlebell_right',
		name: 'Single-leg deadlift med kettlebell (højre)',
		how: [
			'Stå på højre ben og hold kettlebellen i højre hånd',
			'Hæng overkroppen fremad fra hoften mens venstre ben strækkes bagud',
			'Lad kettlebellen hænge ned langs benet mod gulvet',
			'Hold hofterne parallelle og ryggen lang',
			'Pres gennem højre hæl og rejs dig op igen'
		]
	},
	{
		id: 'single_leg_deadlift_left',
		how: [
			'Stå på venstre ben med let bøjet knæ',
			'Hæng overkroppen fremad fra hoften mens højre ben strækkes bagud',
			'Hold ryggen lang og hofterne parallelle med gulvet',
			'Gå ned til overkroppen er ca. parallel med gulvet',
			'Pres gennem venstre hæl og rejs dig op igen'
		]
	},
	{
		id: 'single_leg_deadlift_right',
		name: 'Single-leg deadlift (højre)',
		how: [
			'Stå på højre ben med let bøjet knæ',
			'Hæng overkroppen fremad fra hoften mens venstre ben strækkes bagud',
			'Hold ryggen lang og hofterne parallelle med gulvet',
			'Gå ned til overkroppen er ca. parallel med gulvet',
			'Pres gennem højre hæl og rejs dig op igen'
		]
	},
	{
		id: 'single_leg_glute_bridge_left',
		how: [
			'Læg dig på ryggen med bøjede knæ og fødderne fladt i gulvet',
			'Stræk det højre ben op mod loftet eller hold det parallelt med det venstre lår',
			'Pres venstre hæl ned i gulvet og løft hoften op',
			'Krop i lige linje fra skulder til knæ på det stående ben',
			'Sænk hoften kontrolleret ned uden at røre gulvet helt'
		]
	},
	{
		id: 'single_leg_glute_bridge_right',
		name: 'Single-leg glute bridge (højre)',
		how: [
			'Læg dig på ryggen med bøjede knæ og fødderne fladt i gulvet',
			'Stræk det venstre ben op mod loftet eller hold det parallelt med det højre lår',
			'Pres højre hæl ned i gulvet og løft hoften op',
			'Krop i lige linje fra skulder til knæ på det stående ben',
			'Sænk hoften kontrolleret ned uden at røre gulvet helt'
		]
	},
	{
		id: 'single_leg_stand_left',
		how: [
			'Stå oprejst med fødderne samlet — evt. ved en stol eller væg',
			'Løft det højre ben let fra gulvet med bøjet knæ',
			'Hold blikket fast på et punkt foran dig',
			'Hold positionen og byg tiden op gradvist',
			'Brug stolen med fingerspids til start og slip når du er klar'
		]
	},
	{
		id: 'single_leg_stand_right',
		name: 'Single-leg stand (højre)',
		how: [
			'Stå oprejst med fødderne samlet — evt. ved en stol eller væg',
			'Løft det venstre ben let fra gulvet med bøjet knæ',
			'Hold blikket fast på et punkt foran dig',
			'Hold positionen og byg tiden op gradvist',
			'Brug stolen med fingerspids til start og slip når du er klar'
		]
	},
	{
		id: 'split_squat_left',
		how: [
			'Stå oprejst med fødderne i hoftebredde',
			'Tag et langt skridt bagud med højre fod og bliv stående',
			'Sænk det bagerste knæ mod gulvet — stop lige inden det rører',
			'Hold overkroppen oprejst og brystet fremad',
			'Pres op gennem forreste hæl og rejs dig tilbage'
		]
	},
	{
		id: 'split_squat_right',
		name: 'Split squat (højre)',
		how: [
			'Stå oprejst med fødderne i hoftebredde',
			'Tag et langt skridt bagud med venstre fod og bliv stående',
			'Sænk det bagerste knæ mod gulvet — stop lige inden det rører',
			'Hold overkroppen oprejst og brystet fremad',
			'Pres op gennem forreste hæl og rejs dig tilbage'
		]
	},
	{
		id: 'suitcase_deadlift_left',
		how: [
			'Placer kettlebellen mellem fødderne',
			'Stå med fødderne i hoftebredde og hoftehængsel ned til kettlebellen',
			'Grib kettlebellen i venstre hånd og hold højre arm langs siden',
			'Hold skuldrene i vater og undgå at læne til venstre',
			'Pres op gennem hælene og rejs dig til fuld oprejst stilling',
			'Sænk kontrolleret ned og gentag gennem hele intervallet'
		]
	},
	{
		id: 'suitcase_deadlift_right',
		name: 'Suitcase deadlift (højre)',
		how: [
			'Placer kettlebellen mellem fødderne',
			'Stå med fødderne i hoftebredde og hoftehængsel ned til kettlebellen',
			'Grib kettlebellen i højre hånd og hold venstre arm langs siden',
			'Hold skuldrene i vater og undgå at læne til højre',
			'Pres op gennem hælene og rejs dig til fuld oprejst stilling',
			'Sænk kontrolleret ned og gentag gennem hele intervallet'
		]
	},
	{
		id: 'wood_chop_left',
		how: [
			'Stå med fødderne lidt bredere end hofterne og hold kettlebellen med begge hænder',
			'Start med kettlebellen nede ved højre hofteled med let bøjede knæ',
			'Før kettlebellen diagonalt op over venstre skulder i en flydende bevægelse',
			'Drej let i hoften og løft hælen på højre fod i toppen',
			'Før kettlebellen kontrolleret tilbage den samme vej ned'
		]
	}
];

async function main() {
	let opdateret = 0;
	let fejlede = 0;
	for (const r of RETTELSER) {
		const ref = db.collection('exercises').doc(r.id);
		const snap = await ref.get();
		if (!snap.exists) {
			console.log(`SKIP   ${r.id} (findes ikke)`);
			continue;
		}
		const opdateringer: Record<string, unknown> = {};
		if (r.name !== undefined) opdateringer.name = r.name;
		if (r.desc !== undefined) opdateringer.desc = r.desc;
		if (r.how !== undefined) opdateringer.how = r.how;
		try {
			await ref.update(opdateringer);
			console.log(`OK     ${r.id} (${Object.keys(opdateringer).join(', ')})`);
			opdateret++;
		} catch (e) {
			console.error(`FEJL   ${r.id}: ${(e as Error).message}`);
			fejlede++;
		}
	}
	console.log('');
	console.log(`Opdateret: ${opdateret}`);
	console.log(`Fejlede: ${fejlede}`);
}
main().then(() => process.exit(0));
