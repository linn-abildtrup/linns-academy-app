// Seed-script til mikrotræningsmodulet
// Kører lokalt på Bo's Mac med admin-rettigheder via service-account-key.json
// Opretter alle nødvendige Firestore-documents på én gang
//
// Kør med: npm run seed:mikrotraening
//
// Scriptet er idempotent: det kan køres flere gange uden at duplikere data.
// Brug 'merge: true' når du opdaterer eksisterende documents.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(
	readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8')
);

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ==============================================
// SEED-DATA — alle dokumenter samlet ét sted
// ==============================================

const MARIA_UID = 'NxqDU9r5VJhDSNP1PnFa5UimntC2';

// Træningsbiblioteket — alle øvelser defineret ét sted.
// ID matcher videofilnavn uden .mp4, så det er nemt at finde igen.
// Alle programmer (mikrotræning, fremtidige) refererer til disse via exerciseId.
const exercises = [
	{
		id: 'bodyweight_squat',
		data: {
			name: 'Bodyweight squat',
			desc: 'Klassisk squat uden vægt. Grundstenen i al benstræning.',
			how: [
				'Stå med fødderne lidt bredere end hofterne, tæer let udad',
				'Hold armene strakt frem for balance eller saml hænderne foran brystet',
				'Skub bagdelen bagud og bøj i knæene',
				'Sænk dig så dybt du kan med ret ryg, mål cirka 90 grader i knæene',
				'Pres op gennem hælene og stå helt op',
				'Hold brystet oppe og se ligeud'
			],
			cat: 'ben',
			catLabel: 'Ben & Baller',
			tags: ['Baller', 'Forlår', 'Baglår', 'Core'],
			videoPath: 'bodyweight_squat.mp4',
			treaningsformer: ['mikrotraening'],
			udstyr: ['ingen'],
			aktiv: true
		}
	},
	{
		id: 'sumo_squat',
		data: {
			name: 'Bodyweight Sumo squat',
			desc: 'Squat med bred fodstilling. Aktiverer indvendige lår og baller ekstra.',
			how: [
				'Stå bredt, cirka to skulderbredder, tæer peger udad',
				'Saml hænderne foran brystet for balance',
				'Sænk dig lige ned mellem fødderne med ret ryg',
				'Pres knæene lidt udad så de følger tæernes retning',
				'Gå så dybt du kan og pres op gennem hælene',
				'Stå helt op og knib ballerne sammen i toppen'
			],
			cat: 'ben',
			catLabel: 'Ben & Baller',
			tags: ['Baller', 'Indvendige lår', 'Forlår', 'Baglår'],
			videoPath: 'sumo_squat.mp4',
			treaningsformer: ['mikrotraening'],
			udstyr: ['ingen'],
			aktiv: true
		}
	},
	{
		id: 'goblet_squat',
		data: {
			name: 'Goblet squat',
			desc: 'Klassisk squat med vægten holdt tæt mod brystet. Rammer baller, lår og core.',
			how: [
				'Stå med fødderne lidt bredere end hofterne, tæer let udad',
				'Hold kettlebellen med begge hænder tæt mod brystet, albuerne peger nedad',
				'Sænk dig ned ved at skubbe bagdelen bagud og bøje i knæene',
				'Gå så dybt du kan med ret ryg, mål cirka 90 grader i knæene',
				'Pres op gennem hælene og stå helt op',
				'Hold brystet oppe gennem hele bevægelsen'
			],
			cat: 'ben',
			catLabel: 'Ben & Baller',
			tags: ['Baller', 'Forlår', 'Baglår', 'Core'],
			videoPath: 'goblet_squat.mp4',
			treaningsformer: ['mikrotraening'],
			udstyr: ['kettlebell'],
			aktiv: true
		}
	},
	{
		id: 'sumo_dodloft',
		data: {
			name: 'Sumo dødløft',
			desc: 'Dødløft med bred fodstilling. Skånsom for lænden og god til baller og baglår.',
			how: [
				'Stå bredt, cirka to skulderbredder, tæer peger udad',
				'Placer kettlebellen på gulvet mellem fødderne',
				'Bøj i knæ og hofter, tag fat i kettlebellen med begge hænder',
				'Træk skulderbladene lidt sammen og hold ryggen lang',
				'Pres ned gennem hælene og rejs dig op ved at strække knæ og hofter samtidig',
				'Sænk kontrolleret tilbage ned mellem benene'
			],
			cat: 'ben',
			catLabel: 'Ben & Baller',
			tags: ['Baller', 'Baglår', 'Indvendige lår', 'Lænd'],
			videoPath: 'sumo_dodloft.mp4',
			treaningsformer: ['mikrotraening'],
			udstyr: ['kettlebell'],
			aktiv: true
		}
	},
	{
		id: 'dodloft_kettlebell',
		data: {
			name: 'Dødløft med kettlebell',
			desc: 'Klassisk dødløft fra gulv med kettlebellen mellem fødderne. Træner hele den bagerste kæde og lærer dig at løfte korrekt fra gulvet.',
			how: [
				'Stå med fødderne i hoftebredde, kettlebellen placeret på gulvet mellem fødderne',
				'Skub bagdelen bagud og bøj i knæ og hofter til du kan nå håndtaget',
				'Tag fat i kettlebellen med begge hænder, ryggen lang, brystet åbent',
				'Træk skulderbladene lidt sammen og spænd i core',
				'Pres ned gennem hælene og rejs dig op ved at strække knæ og hofter samtidig',
				'Sænk kontrolleret ned igen ved at skubbe bagdelen bagud først'
			],
			cat: 'ben',
			catLabel: 'Ben & Baller',
			tags: ['Baller', 'Baglår', 'Lænd', 'Øvre ryg', 'Core'],
			videoPath: 'dodloft_kettlebell.mp4',
			treaningsformer: ['mikrotraening'],
			udstyr: ['kettlebell'],
			aktiv: true
		}
	},
	{
		id: 'reverse_lunge_nv',
		data: {
			name: 'Reverse lunge',
			desc: 'Udfaldsskridt bagud uden vægt. Træner balance og ben et ad gangen.',
			how: [
				'Stå med fødderne i hoftebredde, hænderne ved hofterne eller foran brystet',
				'Tag et langt skridt bagud med højre fod',
				'Sænk det bagerste knæ ned mod gulvet, forreste knæ i cirka 90 grader',
				'Pres op gennem forreste fod og saml fødderne igen',
				'Skift ben og gentag',
				'Hold overkroppen rank hele vejen'
			],
			cat: 'ben',
			catLabel: 'Ben & Baller',
			tags: ['Baller', 'Forlår', 'Baglår', 'Core', 'Balance'],
			videoPath: 'reverse_lunge_nv.mp4',
			treaningsformer: ['mikrotraening'],
			udstyr: ['ingen'],
			aktiv: true
		}
	},
	{
		id: 'reverse_lunge',
		data: {
			name: 'Reverse lunge med vægt',
			desc: 'Udfaldsskridt bagud med vægten i goblet-position. Træner balance og ben et ad gangen.',
			how: [
				'Stå med fødderne i hoftebredde, hold kettlebellen tæt mod brystet',
				'Tag et langt skridt bagud med højre fod',
				'Sænk det bagerste knæ ned mod gulvet, forreste knæ i cirka 90 grader',
				'Pres op gennem forreste fod og saml fødderne igen',
				'Skift ben og gentag',
				'Hold overkroppen rank hele vejen'
			],
			cat: 'ben',
			catLabel: 'Ben & Baller',
			tags: ['Baller', 'Forlår', 'Baglår', 'Core', 'Balance'],
			videoPath: 'reverse_lunge.mp4',
			treaningsformer: ['mikrotraening'],
			udstyr: ['kettlebell'],
			aktiv: true
		}
	},
	{
		id: 'step_up_nv',
		data: {
			name: 'Step-up',
			desc: 'Funktionel benøvelse op på en forhøjning. Alle kan være med.',
			how: [
				'Find en stabil forhøjning, for eksempel en lav skammel, trappetrin eller stol',
				'Stå foran forhøjningen med hænderne ved siden af kroppen',
				'Sæt højre fod fladt op på forhøjningen',
				'Pres op gennem højre hæl og stå helt op',
				'Sænk venstre fod kontrolleret ned igen',
				'Skift ben efter halvdelen af tiden'
			],
			cat: 'ben',
			catLabel: 'Ben & Baller',
			tags: ['Baller', 'Forlår', 'Baglår', 'Lægge', 'Balance'],
			videoPath: 'step_up_nv.mp4',
			treaningsformer: ['mikrotraening'],
			udstyr: ['forhojning'],
			aktiv: true
		}
	},
	{
		id: 'step_up',
		data: {
			name: 'Step-up med vægt',
			desc: 'Funktionel benøvelse op på en forhøjning. Overføres direkte til trappegang.',
			how: [
				'Find en stabil forhøjning, for eksempel en lav skammel, trappetrin eller stol',
				'Hold kettlebellen i goblet-position eller i én hånd',
				'Sæt højre fod fladt op på forhøjningen',
				'Pres op gennem højre hæl og stå helt op',
				'Sænk venstre fod kontrolleret ned igen',
				'Skift ben efter halvdelen af tiden'
			],
			cat: 'ben',
			catLabel: 'Ben & Baller',
			tags: ['Baller', 'Forlår', 'Baglår', 'Lægge', 'Balance'],
			videoPath: 'step_up.mp4',
			treaningsformer: ['mikrotraening'],
			udstyr: ['kettlebell', 'forhojning'],
			aktiv: true
		}
	},
	{
		id: 'glute_bridge_nv',
		data: {
			name: 'Glute bridge',
			desc: 'Hofteløft der isolerer ballerne. Skånsom og effektiv.',
			how: [
				'Læg dig på ryggen med bøjede knæ og fødderne fladt i gulvet',
				'Læg armene langs siden, håndflader nedad',
				'Pres hælene ned i gulvet og løft hoften op mod loftet',
				'Knib ballerne sammen i toppen, krop i lige linje fra knæ til skulder',
				'Sænk kontrolleret tilbage ned uden at røre gulvet helt',
				'Gentag roligt'
			],
			cat: 'ben',
			catLabel: 'Ben & Baller',
			tags: ['Baller', 'Baglår', 'Core'],
			videoPath: 'glute_bridge_nv.mp4',
			treaningsformer: ['mikrotraening'],
			udstyr: ['ingen'],
			aktiv: true
		}
	},
	{
		id: 'glute_bridge',
		data: {
			name: 'Glute bridge med vægt',
			desc: 'Hofteløft med vægten på hoften. Isolerer ballerne og skåner ryggen.',
			how: [
				'Læg dig på ryggen med bøjede knæ og fødderne fladt i gulvet',
				'Placer kettlebellen forsigtigt på hoftebenene, hold fast med begge hænder',
				'Pres hælene ned i gulvet og løft hoften op mod loftet',
				'Knib ballerne sammen i toppen, krop i lige linje fra knæ til skulder',
				'Sænk kontrolleret tilbage ned uden at røre gulvet helt',
				'Gentag roligt'
			],
			cat: 'ben',
			catLabel: 'Ben & Baller',
			tags: ['Baller', 'Baglår', 'Core'],
			videoPath: 'glute_bridge.mp4',
			treaningsformer: ['mikrotraening'],
			udstyr: ['kettlebell'],
			aktiv: true
		}
	},
	{
		id: 'wall_sit',
		data: {
			name: 'Wall sit',
			desc: 'Statisk benøvelse hvor du sidder lænet op ad en væg som på en usynlig stol. Skånsom og stærkt brændende i lårene.',
			how: [
				'Stil dig med ryggen mod en væg, fødderne i hoftebredde og cirka en halv meter fra væggen',
				'Glid langsomt ned ad væggen til knæene er bøjet i cirka 90 grader',
				'Sørg for at knæene er lige over anklerne, ikke skubbet ud over tæerne',
				'Pres hele ryggen og baghovedet fladt mod væggen',
				'Hold armene afslappede langs siden eller strakt frem for lidt ekstra udfordring',
				'Træk vejret roligt og hold positionen. Kan du ikke holde 90 grader, så gå lidt højere op'
			],
			cat: 'ben',
			catLabel: 'Ben & Baller',
			tags: ['Forlår', 'Baller', 'Baglår', 'Core'],
			videoPath: 'wall_sit.mp4',
			treaningsformer: ['mikrotraening'],
			udstyr: ['ingen'],
			aktiv: true
		}
	},
	{
		id: 'shoulder_press',
		data: {
			name: 'Shoulder press',
			desc: 'Pres over hovedet. Styrker skuldre og overarme, aktiverer core.',
			how: [
				'Stå med fødderne i hoftebredde, spænd lidt i maven',
				'Hold kettlebellen i højre hånd ved skulderhøjde, albuen peger nedad',
				'Pres kettlebellen lige op over hovedet til armen er strakt',
				'Hold kroppen rank, undgå at læne dig bagover',
				'Sænk kontrolleret ned til skulderhøjde igen',
				'Skift side efter halvdelen af tiden'
			],
			cat: 'overkrop',
			catLabel: 'Overkrop – Pres',
			tags: ['Skuldre', 'Triceps', 'Øvre ryg', 'Core'],
			videoPath: 'shoulder_press.mp4',
			treaningsformer: ['mikrotraening'],
			udstyr: ['kettlebell'],
			aktiv: true
		}
	},
	{
		id: 'incline_pushup',
		data: {
			name: 'Incline push-up',
			desc: 'Armstrækning med hænderne på en forhøjning, for eksempel en bænk, sofakant eller stol. Skånsom variant af klassisk armstrækning.',
			how: [
				'Placer hænderne på en stabil forhøjning i skulderbredde, fingrene peger fremad',
				'Gå tilbage med fødderne, så kroppen danner en lige linje fra hoved til hæl',
				'Spænd i core og baller, hold kroppen som et brædt',
				'Bøj albuerne og sænk brystet kontrolleret ned mod forhøjningen',
				'Pres op igen til armene er strakte, uden at låse albuerne helt',
				'Jo højere forhøjning, jo lettere er øvelsen. Sænk højden når du bliver stærkere'
			],
			cat: 'overkrop',
			catLabel: 'Overkrop – Pres',
			tags: ['Bryst', 'Skuldre', 'Triceps', 'Core'],
			videoPath: 'incline_pushup.mp4',
			treaningsformer: ['mikrotraening'],
			udstyr: ['forhojning'],
			aktiv: true
		}
	},
	{
		id: 'bent_over_row',
		data: {
			name: 'Bent-over row',
			desc: 'Roning med vægten trukket op mod maven. Styrker øvre ryg og modvirker foroverbøjet holdning.',
			how: [
				'Stå med fødderne i hoftebredde, knæ let bøjede',
				'Hold kettlebellen i højre hånd, venstre arm hviler på venstre lår for støtte',
				'Bøj fremover i hoften, ryggen lang og parallel med gulvet',
				'Træk kettlebellen op mod hoften, albuen tæt på kroppen',
				'Knib skulderbladet ind mod rygsøjlen i toppen',
				'Sænk kontrolleret ned og skift side efter halvdelen'
			],
			cat: 'overkrop',
			catLabel: 'Overkrop – Træk',
			tags: ['Øvre ryg', 'Latissimus', 'Bagerste skulder', 'Biceps', 'Core'],
			videoPath: 'bent_over_row.mp4',
			treaningsformer: ['mikrotraening'],
			udstyr: ['kettlebell'],
			aktiv: true
		}
	},
	{
		id: 'superman',
		data: {
			name: 'Superman',
			desc: 'Liggende rygøvelse hvor arme og ben løftes. Styrker hele rygkæden.',
			how: [
				'Læg dig på maven med armene strakt frem over hovedet',
				'Benene strakte og samlede',
				'Løft samtidig arme, bryst og ben nogle få centimeter fra gulvet',
				'Knib ballerne og træk skulderbladene lidt sammen',
				'Hold positionen roligt og træk vejret',
				'Sænk kontrolleret ned og gentag'
			],
			cat: 'overkrop',
			catLabel: 'Overkrop – Træk',
			tags: ['Lænd', 'Øvre ryg', 'Baller', 'Bagerste skulder'],
			videoPath: 'superman.mp4',
			treaningsformer: ['mikrotraening'],
			udstyr: ['ingen'],
			aktiv: true
		}
	},
	{
		id: 'thruster',
		data: {
			name: 'Thruster med kettlebell',
			desc: 'Squat kombineret med pres over hovedet i én flydende bevægelse. Helkropsøvelse der både styrker og løfter pulsen.',
			how: [
				'Stå med fødderne lidt bredere end hofterne, tæer let udad',
				'Hold kettlebellen med begge hænder tæt mod brystet, albuerne peger nedad',
				'Sænk dig ned i en squat ved at skubbe bagdelen bagud og bøje i knæene',
				'Pres op gennem hælene og brug farten fra squatten til at presse kettlebellen op over hovedet',
				'Stræk armene helt ud i toppen og hold kroppen rank',
				'Sænk kettlebellen kontrolleret tilbage til brystet og gå direkte ned i næste squat'
			],
			cat: 'stabilitet',
			catLabel: 'Stabilitet',
			tags: ['Baller', 'Forlår', 'Baglår', 'Skuldre', 'Triceps', 'Core'],
			videoPath: 'thruster.mp4',
			treaningsformer: ['mikrotraening'],
			udstyr: ['kettlebell'],
			aktiv: true
		}
	},
	{
		id: 'inchworm',
		data: {
			name: 'Inchworm',
			desc: 'Dynamisk øvelse hvor du vandrer hænderne ud til planke-position og tilbage. Mobiliserer baglår og ryg, samtidig med at den aktiverer skuldre og core.',
			how: [
				'Stå oprejst med fødderne samlede eller i hoftebredde',
				'Bøj dig forover i hoften og sæt hænderne i gulvet foran fødderne, bøj knæene hvis du ikke kan nå',
				'Vandre hænderne frem en ad gangen til du står i høj planke med strakte arme og krop i lige linje',
				'Hold kort, spænd i core og knib ballerne',
				'Vandre hænderne tilbage mod fødderne, en ad gangen',
				'Rejs dig roligt op til stående og start forfra'
			],
			cat: 'stabilitet',
			catLabel: 'Stabilitet',
			tags: ['Core', 'Skuldre', 'Bryst', 'Baglår', 'Lægge', 'Mobilitet'],
			videoPath: 'inchworm.mp4',
			treaningsformer: ['mikrotraening'],
			udstyr: ['ingen'],
			aktiv: true
		}
	},
	{
		id: 'cat_cow',
		data: {
			name: 'Cat-cow',
			desc: 'Blid mobilitetsøvelse i firefods-position hvor ryggen veksler mellem at blive rundet og strakt. Åbner ryg, hofter og skuldre.',
			how: [
				'Gå ned på alle fire med hænderne under skuldrene og knæene under hofterne',
				'Træk vejret ind og sænk maven mod gulvet, løft brystet og blikket let opad (cow)',
				'Lad skulderbladene glide ned mod hoften og åbn brystet',
				'Pust ud og rund ryggen op mod loftet som en vred kat, sænk hagen mod brystet (cat)',
				'Pres gulvet fra dig med hænderne og mærk at skulderbladene spreder sig',
				'Veksl roligt mellem de to positioner i takt med vejrtrækningen'
			],
			cat: 'stabilitet',
			catLabel: 'Stabilitet',
			tags: ['Ryg', 'Core', 'Skuldre', 'Hofter', 'Mobilitet'],
			videoPath: 'cat_cow.mp4',
			treaningsformer: ['mikrotraening'],
			udstyr: ['ingen'],
			aktiv: true
		}
	},
	{
		id: 'mini_hops',
		data: {
			name: 'Mini hops',
			desc: 'Små hop på stedet med samlede fødder. Blide impact-hop der styrker knogler og aktiverer lægge og core.',
			how: [
				'Stå med fødderne samlede eller i hoftebredde, armene afslappet langs siden',
				'Spænd let i core og hold brystet oppe',
				'Lav små hop lige op og ned, cirka fem til ti centimeter fra gulvet',
				'Land blødt på forreste del af foden og rul ned gennem hælen',
				'Hold knæene let bøjede hele vejen, så landingen bliver fjedrende',
				'Hold en rolig rytme og træk vejret frit. Har du ondt i knæ eller ankler, så tag mindre hop eller lav heel raises i stedet'
			],
			cat: 'stabilitet',
			catLabel: 'Stabilitet',
			tags: ['Lægge', 'Forlår', 'Baller', 'Core', 'Knoglesundhed'],
			videoPath: 'mini_hops.mp4',
			treaningsformer: ['mikrotraening'],
			udstyr: ['ingen'],
			aktiv: true
		}
	},
	{
		id: 'good_morning',
		data: {
			name: 'Good morning',
			desc: 'Hoftehængsel med hænderne bag hovedet. Træner baglår og baller, lærer dig at bruge hoften korrekt.',
			how: [
				'Stå med fødderne i hoftebredde, knæene let bøjede',
				'Placer hænderne let bag hovedet eller ved tindingerne',
				'Skub bagdelen bagud og bøj fremover i hoften',
				'Hold ryggen lang, som en brædt der tipper',
				'Gå ned til cirka parallel med gulvet eller så langt du kan',
				'Pres hoften frem og rejs dig op igen'
			],
			cat: 'stabilitet',
			catLabel: 'Stabilitet',
			tags: ['Baglår', 'Baller', 'Lænd', 'Core'],
			videoPath: 'good_morning.mp4',
			treaningsformer: ['mikrotraening'],
			udstyr: ['ingen'],
			aktiv: true
		}
	},
	{
		id: 'planke',
		data: {
			name: 'Planke',
			desc: 'Statisk øvelse hvor kroppen holdes lige som et brædt på underarmene. Kernestyrke der også aktiverer baller og ryg.',
			how: [
				'Placer underarmene på gulvet, albuerne under skuldrene, håndfladerne ned eller saml hænderne',
				'Stræk benene ud bag dig og placer tæerne i gulvet',
				'Løft kroppen op, så den danner en lige linje fra hoved til hæl',
				'Spænd i core og knib ballerne sammen, undgå at hænge i lænden eller skyde bagdelen op',
				'Hold blikket ned i gulvet, så nakken er i forlængelse af ryggen',
				'Træk vejret roligt og hold positionen. Kan du ikke holde den fulde planke, så sænk knæene til gulvet og hold samme lige linje fra hoved til knæ'
			],
			cat: 'core',
			catLabel: 'Core',
			tags: ['Core', 'Mave', 'Lænd', 'Baller', 'Skuldre'],
			videoPath: 'planke.mp4',
			treaningsformer: ['mikrotraening'],
			udstyr: ['ingen'],
			aktiv: true
		}
	},
	{
		id: 'bird_dog',
		data: {
			name: 'Bird dog',
			desc: 'Firefods-position hvor modsat arm og ben løftes samtidig. Træner core, balance og ryg-stabilitet.',
			how: [
				'Gå ned på alle fire med hænderne under skuldrene og knæene under hofterne',
				'Spænd let i maven og hold ryggen lang og neutral',
				'Stræk højre arm frem og venstre ben bagud samtidig, til de er i lige linje med kroppen',
				'Hold kort og undgå at hoften falder til siden',
				'Før kontrolleret tilbage til startposition',
				'Skift side og gentag med venstre arm og højre ben'
			],
			cat: 'core',
			catLabel: 'Core',
			tags: ['Core', 'Lænd', 'Baller', 'Øvre ryg', 'Skuldre', 'Balance'],
			videoPath: 'bird_dog.mp4',
			treaningsformer: ['mikrotraening'],
			udstyr: ['ingen'],
			aktiv: true
		}
	}
];

// Hjælpe-funktion: opretter tomme 21-dages skelet til et program.
// Hver dag har tomt exercises-array — Linn fylder dem ud via admin-siden.
function tommeDageSkelet(antal: number) {
	return Array.from({ length: antal }, (_, i) => ({
		id: `dag${i + 1}`,
		data: {
			dagNummer: i + 1,
			titel: '',
			indledning: '',
			exercises: [] as Array<{
				exerciseId: string;
				sets: number;
				workSec: number;
				restSec: number;
				bonus: boolean;
			}>
		}
	}));
}

const trainingPrograms = [
	{
		id: 'mikrotraening_kettlebell',
		data: {
			navn: 'Mikrotræning med kettlebell',
			beskrivelse: 'Tre minutters daglig styrketræning i 21 dage. Kræver én kettlebell.',
			treaningsform: 'mikrotraening',
			antalDage: 21,
			dagligTid: 180,
			niveau: 'begynder',
			udstyr: ['kettlebell'],
			aktiv: true
		},
		days: tommeDageSkelet(21)
	},
	{
		id: 'mikrotraening_no_kettlebell',
		data: {
			navn: 'Mikrotræning uden udstyr',
			beskrivelse: 'Tre minutters daglig styrketræning i 21 dage. Kræver intet udstyr.',
			treaningsform: 'mikrotraening',
			antalDage: 21,
			dagligTid: 180,
			niveau: 'begynder',
			udstyr: ['ingen'],
			aktiv: true
		},
		days: tommeDageSkelet(21)
	}
];

const products = [
	{
		id: 'kickstart',
		data: {
			navn: 'Kickstart en sund overgangsalder',
			beskrivelse:
				'21-dages forløb med mikrotræning, kost og vaner — designet til kvinder i overgangsalderen.',
			pris: 1495,
			type: 'forlob',
			varighed: 21,
			indhold: [
				{
					type: 'trainingProgram',
					ref: 'mikrotraening_kettlebell',
					alias: 'mikrotraening'
				}
			],
			aktiv: true
		}
	}
];

const userProductAccess = [
	{
		uid: MARIA_UID,
		productId: 'kickstart',
		data: {
			productId: 'kickstart',
			koebt: FieldValue.serverTimestamp(),
			startDato: FieldValue.serverTimestamp(),
			udloberDato: null,
			programValg: {
				mikrotraening: 'mikrotraening_kettlebell'
			},
			fremgang: {
				mikrotraening: {
					gennemforte: [],
					feedback: {}
				}
			}
		}
	}
];

// ==============================================
// SEED-LOGIK
// ==============================================

async function seedExercises() {
	console.log('\n📋 Seeder exercises...');
	for (const ex of exercises) {
		await db.collection('exercises').doc(ex.id).set(ex.data, { merge: true });
		console.log(`   ✓ exercises/${ex.id}`);
	}
}

async function seedTrainingPrograms() {
	console.log('\n🏋️  Seeder trainingPrograms...');
	for (const program of trainingPrograms) {
		await db.collection('trainingPrograms').doc(program.id).set(program.data, { merge: true });
		console.log(`   ✓ trainingPrograms/${program.id}`);

		for (const day of program.days) {
			await db
				.collection('trainingPrograms')
				.doc(program.id)
				.collection('days')
				.doc(day.id)
				.set(day.data, { merge: true });
			console.log(`     ✓ trainingPrograms/${program.id}/days/${day.id}`);
		}
	}
}

async function seedProducts() {
	console.log('\n📦 Seeder products...');
	for (const product of products) {
		await db.collection('products').doc(product.id).set(product.data, { merge: true });
		console.log(`   ✓ products/${product.id}`);
	}
}

async function seedUserAccess() {
	console.log('\n👤 Seeder bruger-adgange...');
	for (const access of userProductAccess) {
		await db
			.collection('users')
			.doc(access.uid)
			.collection('products')
			.doc(access.productId)
			.set(access.data, { merge: true });
		console.log(`   ✓ users/${access.uid}/products/${access.productId}`);
	}
}

async function main() {
	console.log('🌱 Starter seed af mikrotræningsmodulet...');
	console.log(`   Projekt: ${serviceAccount.project_id}`);

	try {
		await seedExercises();
		await seedTrainingPrograms();
		await seedProducts();
		await seedUserAccess();

		console.log('\n✅ Seed færdig — alt på plads i Firestore.');
		console.log('\nAntal dokumenter oprettet/opdateret:');
		console.log(`   exercises: ${exercises.length}`);
		console.log(
			`   trainingPrograms: ${trainingPrograms.length} (med ${trainingPrograms.reduce((s, p) => s + p.days.length, 0)} dage)`
		);
		console.log(`   products: ${products.length}`);
		console.log(`   user-adgange: ${userProductAccess.length}`);
	} catch (err) {
		console.error('\n❌ Fejl under seed:', err);
		process.exit(1);
	}

	process.exit(0);
}

main();
