// ============================================================
// Etape 1 af regnemaskinen. Fra husholdningsmaal til gram.
//
// 1105 ingrediens-linjer i de 133 opskrifter. Kun 504 af dem staar i
// gram, dl eller ml. De oevrige 601 staar som stk, spsk, tsk, skive,
// fed, knivspids eller nip, og de kan ikke regnes paa foer vi ved hvad
// én af dem vejer.
//
// Den her fil er KUN oversaettelsen. Den slaar ikke op i
// foedevaredatabasen og den regner ikke makro. Den svarer paa ét
// spoergsmaal: hvor mange gram er "2 spsk olivenolie".
//
// HVOR TALLENE KOMMER FRA
// Rumfanget er fast: 1 spsk er 15 ml og 1 tsk er 5 ml, og det er de
// danske standardmaal. Vaegten afhaenger saa af hvad der ligger i
// skeen, for olie, havregryn og honning vejer vidt forskelligt ved
// samme rumfang. Derfor er tabellen delt i vaeske, toert og fast.
//
// Styk-vaegtene er danske gennemsnit for spiselig maengde, altsaa uden
// skal, sten og kerne. En avocado paa 200 g giver 140 g at spise.
//
// DET VIGTIGE FORBEHOLD
// Et styk er et skoen, ikke en maaling. "1 stk laksefilet" kan vaere
// 125 eller 200 g, og den forskel flytter proteinet 15 g. Tallene her
// er gennemsnit, ikke facit, og de er valgt saa de rammer midten frem
// for at ramme hoejt. Se SPEC-3.0.md 26.19.
// ============================================================

/** 1 spsk er 15 ml, 1 tsk er 5 ml. Danske standardmaal. */
export const SPSK_ML = 15;
export const TSK_ML = 5;

/**
 * Enheder der allerede er vaegt eller rumfang, og som ikke skal slaas op.
 * dl og ml regnes som vand, altsaa 1 ml er 1 g, medmindre linjen selv
 * siger andet.
 */
export const GRAM_ENHEDER = ['g', 'gram', 'kg', 'ml', 'dl', 'l'] as const;

/**
 * Enheder der aldrig bidrager med noget vaerd at regne paa.
 * Linns besked 12. august: se bort fra salt og peber.
 */
export const SPRING_OVER_ENHEDER = ['knivspids', 'nip'] as const;

/**
 * Ingredienser der ikke skal vejes uanset hvad der staar som enhed.
 * Salt bidrager nul kalorier. Peber og de friske urter der bruges som
 * pynt bidrager saa lidt at et skoen paa dem stoejer mere end det
 * gavner.
 */
const UDEN_VAEGT = [
	'salt',
	'havsalt',
	'peber',
	'friskkvaernet peber',
	'salt og peber',
	'salt og friskkvaernet peber',
	'havsalt og friskkvaernet peber',
	'lidt salt og chiliflager',
	'soedemiddel',
	'lidt soedemiddel efter smag',
	'vand'
];

type Vaegttabel = Record<string, number>;

/**
 * Vaegt pr spiseskefuld i gram. Uden traef her falder vi tilbage paa
 * gruppen, se GRUPPE_SPSK.
 */
const SPSK: Vaegttabel = {
	// Olie og fedtstof. 15 ml gange massefylden 0,92.
	olivenolie: 14,
	olievenolie: 14, // stavefejl i opskrift
	olie: 14,
	sesamolie: 14,
	rapsolie: 14,
	smoer: 14,

	// Noeddesmoer og pasta. Tunge og kaloriestaerke.
	tahini: 16,
	tahin: 16, // stavefejl i opskrift
	peanutbutter: 16,
	'peanutbutter uden tilsat sukker': 16,
	mandelsmoer: 16,
	tomatpure: 16,
	hummus: 15,
	'groen pesto': 15,
	ramsloegspesto: 15,
	pesto: 15,

	// Mejeri og dressing. Taet paa vand.
	yoghurt: 15,
	'graesk yoghurt': 15,
	'graesk yoghurt 10%': 15,
	kefir: 15,
	'creme fraiche': 15,
	'creme fraiche 18%': 15,
	hytteost: 15,
	skyr: 15,
	mayo: 14,
	mayonnaise: 14,
	dressing: 15,
	'let dressing': 15,
	citrondressing: 15,
	sennepsdressing: 15,
	citronvinaigrette: 15,
	'grov sennepsvinaigrette': 15,
	peanutdressing: 16,

	// Vaeske
	citronsaft: 15,
	limesaft: 15,
	eddike: 15,
	sojasauce: 16,
	soja: 16,
	balsamico: 15,
	riseddike: 15,
	honning: 21,
	'brun farin': 12,
	sennep: 15,
	'grov sennep': 15,
	dijonsennep: 15,
	'gul karrypasta': 15,
	yoghurtdressing: 15,

	// Froe og kerner. Lettere end vaeske, tungere end urter.
	sesamfroe: 9,
	'sorte sesamfroe': 9,
	hoerfroe: 10,
	'knuste hoerfroe': 10,
	chiafroe: 12,
	solsikkekerner: 9,
	solsikkefroe: 9,
	graeskarkerner: 9,
	hampefroe: 10,
	mandler: 9,
	'hakkede mandler': 9,
	'ristede, hakkede mandler': 9,
	valnoedder: 8,
	'hakkede valnoedder': 8,
	noeddeblanding: 9,
	granola: 10,

	// Toert
	havregryn: 6,
	'havregryn eller muesli': 6,
	rasp: 6,
	kakao: 6,
	kakaonibs: 8,
	fuldkornsmel: 8,
	kikaertemel: 8,
	kokosmel: 6,
	mel: 8,
	proteinpulver: 8,

	// Friske hakkede urter. Lette og luftige.
	persille: 4,
	'frisk persille': 4,
	'hakket frisk persille': 4,
	dild: 4,
	'frisk dild': 4,
	'dild, hakket': 4,
	'hakket frisk dild': 4,
	koriander: 4,
	'koriander, frisk': 4,
	basilikum: 4,
	'frisk mynte': 4,
	mynte: 4,
	purloeg: 4,
	karse: 2, // meget let, fylder mere end den vejer
	'finthakket loeg': 10,
	'hakket ramsloeg eller hvidloeg': 6,

	// Toerrede krydderier
	kanel: 7,
	spidskommen: 6,
	paprika: 6,
	karry: 6,
	oregano: 3,
	timian: 3,
	rosmarin: 3,

	// Fast
	'moerk chokolade': 8,
	'moerk chokolade 80%': 8,
	salsa: 15
};

/** Vaegt pr teskefuld i gram. Cirka en tredjedel af en spiseskefuld. */
const TSK: Vaegttabel = {
	olivenolie: 5,
	olie: 5,
	sesamolie: 5,
	kokosolie: 5,
	smoer: 5,

	honning: 7,
	sennep: 5,
	dijonsennep: 5,
	'grov sennep': 5,
	mayonnaise: 5,
	mayo: 5,
	citronsaft: 5,
	limesaft: 5,
	eddike: 5,
	'eddike eller citronsaft': 5,
	sojasauce: 5,

	sesamfroe: 3,
	'sorte sesamfroe': 3,
	hoerfroe: 3,
	chiafroe: 4,
	hampefroe: 3,
	'hakkede valnoedder': 3,
	kapers: 5,
	kokosflager: 2,

	// Toerrede krydderier. En teskefuld stoedt krydderi er cirka 2 g,
	// toerrede urter er lettere fordi de fylder mere pr gram.
	spidskommen: 2,
	paprika: 2,
	'roeget paprika': 2,
	karry: 2,
	'gul karrypasta': 5,
	kanel: 2.5,
	chili: 1.5,
	chiliflager: 1.5,
	'stoedt koriander': 2,
	vaniljepulver: 2,
	ingefaer: 2,
	'friskrevet ingefaer': 2,
	'ingefaer, revet': 2,
	oregano: 1,
	timian: 1,
	'frisk timian': 1.5,
	rosmarin: 1,
	salvie: 1,
	gurkemeje: 2,
	kardemomme: 2,
	muskatnoed: 2,
	riseddike: 5,
	kakaonibs: 3,
	'kakaonibs eller hakket moerk chokolade': 3,
	citronzest: 2,
	citronskal: 2
};

/**
 * Vaegt pr styk i gram, SPISELIG maengde. Uden skal, sten og kerne.
 *
 * KILDE: DTU Foedevareinstituttet, "Maal og vaegt", fooddata.dk.
 * Den officielle danske tabel. Den opgiver lille, mellem og stor, og
 * hvor der staar to tal er det netto og brutto. Vi bruger MELLEM og
 * NETTO, altsaa den spiselige del af en almindelig stoerrelse.
 *
 * Foer 13. august var tallene her mit eget skoen. Otte af dem var
 * forkerte, og en tomat stod til 120 g hvor tabellen siger 75.
 * Linns regel: staar der en maengde i opskriften, gaelder den. Staar
 * der kun et stykke, skal vaegten slaas op og ikke gaettes.
 */
const STK: Vaegttabel = {
	// AEg. Et dansk M-aeg vejer 58 g med skal og cirka 55 g uden.
	// NB: rensNavn oversaetter aa til a, saa noeglen er hardkogte og
	// ikke haardkogte. Samme for dase og ikke daase.
	aeg: 55,
	'hardkogte aeg': 55,
	'hardkogt aeg': 55,
	'hardkogt aeg fra koeleskabet': 55,
	'bloedkogte aeg': 55,
	'aeg roert i': 55,

	// Loeg og hvidloeg
	'fed hvidloeg': 4,
	hvidloeg: 4,
	'fed hvidloeg (til tzatziki)': 4,
	loeg: 100,
	'lille loeg': 55,
	'lille loeg, finthakket': 55,
	roedloeg: 135,
	'roedloeg i tynde skiver': 135,
	forarsloeg: 19,
	'forarsloeg, i skiver': 19,
	'bundt forarsloeg': 60,

	// Frugt og groent
	citron: 65,
	lime: 50,
	tomat: 75,
	cherrytomat: 15,
	cherrytomater: 15,
	'handfuld cherrytomater': 90,
	agurk: 285,
	'agurk, revet': 285,
	'agurk, i tern': 285,
	peberfrugt: 180,
	'roed peber': 180,
	'stor roed peberfrugt': 270,
	jalapeno: 15,
	roedbede: 130,
	'lille roedbede': 35,
	pastinak: 100,
	'pastinak eller kartoffel': 100,
	kartoffel: 60,
	appelsin: 140,
	bladselleri: 40,
	'stang bladselleri': 40,
	snackpeber: 30,
	'snackpeber, i skiver': 30,
	gulerod: 65,
	guleroedder: 65,
	'store guleroedder': 145,
	'guleroedder, fintrevne': 65,
	avocado: 145,
	avokado: 145,
	avocadoer: 145,
	'modne avocadoer': 145,
	'moden avokado': 145,
	'modne tomater': 75,
	banan: 110,
	'frossen banan': 110,
	'moset banan': 110,
	aeble: 110,
	'revet aeble': 110,
	'aeble i tern': 110,
	mango: 205,
	'moden mango': 205,
	radiser: 10,
	radise: 10,
	squash: 285,
	'squash i skiver': 285,
	spidskal: 800,
	'lille spidskal': 560,
	'handfuld spidskal, snittet': 40,
	'handfuld ra blomkal': 40,
	'sma kogte kartofler': 35,
	'roed chili': 10,

	// Broed og kerneprodukter
	rugbroed: 45,
	'skiver groft fuldkornsrugbroed': 40,
	'groft fuldkornsrugbroed': 40,
	fuldkornstortilla: 40,
	fuldkornspita: 80,
	fuldkornsbolle: 70,
	'grov bolle eller froebroed': 70,
	rugbroedskiks: 10,
	// Tilfoejet 4. september 2026, efter oprydningen i opskrifterne.
	// Uden dem regnes et ukendt styk som 100 g, og saa blev én maaleske
	// fibertilskud til 76 g fiber. Vaegtene foelger tabellens egne
	// naboer: et knaekbroed som en rugbroedskiks, en grov bolle som en
	// fuldkornsbolle, en frisk chili som en roed chili. Maaleskeen paa
	// 9 g staar paa selve varen i foedevaredatabasen.
	rugknaekbroed: 10,
	'bellwell gut balance': 9,
	'grov bolle': 70,
	'chili, frisk': 10,

	// Koed og fisk
	laksefilet: 150,
	torskefilet: 150,
	oerredfilet: 150,
	kyllingebryst: 110,

	// Diverse. En daase baelgfrugter giver cirka 240 g afdryppet.
	'dase roede eller sorte boenner': 240,
	'dase sorte boenner': 240,
	'dase kikaerter': 240,
	dase: 240,
	mandler: 1.2,
	scoop: 30,
	'stykker moerk chokolade 80%': 5,

	// Handfulde. Det groveste skoen i hele tabellen.
	handfuld: 30,
	'handfuld baer': 40,
	'handfuld frisk basilikum': 10,
	'handfuld frisk persille': 10,
	'handfuld frisk koriander': 10,
	'lille bundt frisk koriander': 15,
	'handfuld groen salat': 25
};

/** Én skive. Bruges kun til rugbroed i de her opskrifter. */
const SKIVE: Vaegttabel = {
	rugbroed: 45,
	'rugbroed til': 35,
	'groft fuldkornsrugbroed': 40,
	franskbroed: 30
};

/**
 * Vaegt i gram pr 100 ml, altsaa pr deciliter, for TOERRE varer.
 *
 * Vaeske vejer det samme som vand, saa 1 dl er 100 g. Toerre varer gor
 * ikke. 2 dl havregryn blev regnet som 200 g og gav 732 kalorier i
 * Winnis morgengroed. De rigtige 70 g giver 256. Den ene linje stod for
 * hele afvigelsen paa 146 procent. Fundet 13. august.
 *
 * Kun ét af de 37 dl-linjer i opskrifterne er en toer vare, saa
 * tabellen er kort med vilje.
 */
const DL_VAEGT: Vaegttabel = {
	havregryn: 35,
	'havregryn eller muesli': 35,
	muesli: 40,
	granola: 45,
	mel: 55,
	fuldkornsmel: 55,
	hvedemel: 55,
	rugmel: 50,
	kokosmel: 40,
	kikaertemel: 55,
	sukker: 85,
	'brun farin': 80,
	kakao: 45,
	ris: 85,
	quinoa: 85,
	bulgur: 80,
	linser: 85,
	baer: 60,
	blabaer: 60,
	hindbaer: 55,
	jordbaer: 55,
	noedder: 55,
	mandler: 60,
	valnoedder: 45,
	graeskarkerner: 60,
	solsikkekerner: 60,
	sesamfroe: 60,
	hoerfroe: 60,
	chiafroe: 65
};

/**
 * Naar navnet ikke staar i tabellen, gaettes ud fra hvad slags vare det
 * ligner. Det er sidste udvej og daekker den lange hale af navne der kun
 * optraeder én gang.
 */
const GRUPPE_SPSK = {
	vaeske: 15,
	olie: 14,
	toert: 8,
	urt: 4
} as const;

const GRUPPE_TSK = {
	vaeske: 5,
	olie: 5,
	toert: 2.5,
	urt: 1
} as const;

/**
 * Renser et ingrediensnavn saa det kan slaas op. Fjerner accenter,
 * aeoeaa og alt i parentes, og skaerer de tilfoejelser af der beskriver
 * tilberedning frem for varen selv.
 */
export function rensNavn(navn: string): string {
	let s = (navn ?? '')
		.toLowerCase()
		.replace(/æ/g, 'ae')
		.replace(/ø/g, 'oe')
		.replace(/å/g, 'a')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/\([^)]*\)/g, ' ')
		.replace(/[^a-z0-9%\s,]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	// "olivenolie til stegning" og "rugbroed til" er stadig olie og rugbroed.
	s = s.replace(/\s+til\s+(stegning|topping|pynt|servering|tzatziki|dressing)\b.*$/, '');
	s = s.replace(/\s+til\s*$/, '');
	return s;
}

/**
 * Slaar op i en tabel. Proever hele navnet foerst, derefter navnet uden
 * det der staar efter et komma, og til sidst om et af tabellens navne
 * staar som et helt ord i ingrediensen.
 */
function slaaOp(tabel: Vaegttabel, navn: string): number | null {
	if (navn in tabel) return tabel[navn];
	const foerKomma = navn.split(',')[0].trim();
	if (foerKomma in tabel) return tabel[foerKomma];
	// Laengste traef vinder, saa "fed hvidloeg" slaar "hvidloeg".
	let bedst: string | null = null;
	for (const noegle of Object.keys(tabel)) {
		const rx = new RegExp(`(^|\\s)${noegle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|\\s|,)`);
		if (rx.test(navn) && (bedst === null || noegle.length > bedst.length)) bedst = noegle;
	}
	return bedst === null ? null : tabel[bedst];
}

/** Gaetter hvilken gruppe en ukendt vare hoerer til. */
function gaetGruppe(navn: string): 'vaeske' | 'olie' | 'toert' | 'urt' {
	if (/olie|smoer\b|fedt/.test(navn)) return 'olie';
	if (
		/saft|sauce|dressing|eddike|yoghurt|kefir|fraiche|maelk|sirup|honning|pesto|hummus|pure/.test(
			navn
		)
	)
		return 'vaeske';
	if (/frisk|hakket|persille|dild|koriander|basilikum|purloeg|mynte|urt/.test(navn)) return 'urt';
	return 'toert';
}

/**
 * Om en ingrediens ALDRIG bidrager med noget, uanset maengde og enhed.
 *
 * Salt, peber og vand. De skal ikke kobles til en foedevare, for de
 * ganges alligevel med nul gram. Uden det her stod salt oeverst i
 * admin-listen med 28 linjer, og Linn skulle tage stilling til fem bud
 * paa noget der ikke kan aendre et eneste tal. Set 13. august.
 */
export function bidragerIkke(navn: string): boolean {
	const n = rensNavn(navn);
	return UDEN_VAEGT.some((u) => n === u || n.startsWith(u + ' '));
}

export interface Vaegtsvar {
	/** Vaegten i gram for hele linjen, altsaa maengden ganget med styk-vaegten. */
	gram: number;
	/**
	 * Hvor sikkert tallet er.
	 * tabel  varen staar i tabellen med en kendt vaegt
	 * gruppe varen er ukendt og vaegten er gaettet ud fra varetypen
	 * ingen  varen bidrager ikke, fx salt eller en linje uden maengde
	 */
	sikkerhed: 'tabel' | 'gruppe' | 'ingen';
	/** Kort forklaring paa dansk. Vises i admin saa Linn kan se hvorfor. */
	forklaring: string;
}

/**
 * Regner en ingrediens-linje om til gram.
 *
 * Returnerer altid et svar. Er varen ukendt, gaettes der ud fra
 * varetypen og sikkerheden saettes til gruppe, saa admin kan vise hvilke
 * linjer der hviler paa et skoen.
 */
export function tilGram(navn: string, maengde: number, enhed: string): Vaegtsvar {
	const e = (enhed ?? '').trim().toLowerCase();
	const n = rensNavn(navn);
	const m = Number(maengde);

	if (!Number.isFinite(m) || m === 0) {
		return { gram: 0, sikkerhed: 'ingen', forklaring: 'Ingen maengde angivet, altsaa efter smag.' };
	}

	if ((SPRING_OVER_ENHEDER as readonly string[]).includes(e)) {
		return { gram: 0, sikkerhed: 'ingen', forklaring: 'Knivspids regnes ikke med.' };
	}

	if (UDEN_VAEGT.some((u) => n === u || n.startsWith(u + ' '))) {
		return { gram: 0, sikkerhed: 'ingen', forklaring: 'Salt, peber og vand bidrager ikke.' };
	}

	// Allerede vaegt eller rumfang.
	if (e === 'g' || e === 'gram')
		return { gram: m, sikkerhed: 'tabel', forklaring: 'Staar allerede i gram.' };
	if (e === 'kg')
		return { gram: m * 1000, sikkerhed: 'tabel', forklaring: 'Kilo regnet om til gram.' };
	// Rumfang. Vaeske vejer som vand, toerre varer vejer mindre.
	if (e === 'ml' || e === 'dl' || e === 'l') {
		const ml = e === 'ml' ? m : e === 'dl' ? m * 100 : m * 1000;
		const toer = slaaOp(DL_VAEGT, n);
		if (toer !== null) {
			return {
				gram: (ml / 100) * toer,
				sikkerhed: 'tabel',
				forklaring: `1 dl vejer ${toer} g, for det er en toer vare.`
			};
		}
		return { gram: ml, sikkerhed: 'tabel', forklaring: 'Rumfang regnet som vand.' };
	}

	if (e === 'spsk') {
		const t = slaaOp(SPSK, n);
		if (t !== null) return { gram: m * t, sikkerhed: 'tabel', forklaring: `1 spsk vejer ${t} g.` };
		const g = gaetGruppe(n);
		return {
			gram: m * GRUPPE_SPSK[g],
			sikkerhed: 'gruppe',
			forklaring: `Ukendt vare, regnet som ${g}, ${GRUPPE_SPSK[g]} g pr spsk.`
		};
	}

	if (e === 'tsk') {
		const t = slaaOp(TSK, n);
		if (t !== null) return { gram: m * t, sikkerhed: 'tabel', forklaring: `1 tsk vejer ${t} g.` };
		const g = gaetGruppe(n);
		return {
			gram: m * GRUPPE_TSK[g],
			sikkerhed: 'gruppe',
			forklaring: `Ukendt vare, regnet som ${g}, ${GRUPPE_TSK[g]} g pr tsk.`
		};
	}

	if (e === 'skive') {
		const t = slaaOp(SKIVE, n);
		if (t !== null) return { gram: m * t, sikkerhed: 'tabel', forklaring: `1 skive vejer ${t} g.` };
		return { gram: m * 35, sikkerhed: 'gruppe', forklaring: 'Ukendt skive, regnet som 35 g.' };
	}

	if (e === 'fed') {
		return { gram: m * 4, sikkerhed: 'tabel', forklaring: '1 fed hvidloeg vejer 4 g.' };
	}

	// Tre enheder der kom paa listen 2. september 2026. Uden dem her faldt de
	// ned i styk-grenen nederst og blev gaettet som 100 g, altsaa en daase
	// tomater regnet som en fjerdedel af sig selv.
	if (e === 'daase' || e === 'dåse') {
		return { gram: m * 400, sikkerhed: 'gruppe', forklaring: 'En almindelig daase vejer 400 g.' };
	}

	if (e === 'haandfuld' || e === 'håndfuld') {
		return { gram: m * 30, sikkerhed: 'gruppe', forklaring: 'En haandfuld regnet som 30 g.' };
	}

	if (e === 'bundt') {
		return {
			gram: m * 25,
			sikkerhed: 'gruppe',
			forklaring: 'Et bundt krydderurter regnet som 25 g.'
		};
	}

	// stk og tom enhed. Tom enhed sker naar maengden staar i navnet.
	const t = slaaOp(STK, n);
	if (t !== null)
		return { gram: m * t, sikkerhed: 'tabel', forklaring: `1 stk vejer ${t} g spiselig.` };
	return {
		gram: m * 100,
		sikkerhed: 'gruppe',
		forklaring: 'Ukendt styk, regnet som 100 g. Skal bekraeftes.'
	};
}

/**
 * Hvor mange navne tabellen kender. Bruges i admin til at vise hvor
 * daekkende den er blevet.
 */
export function tabelStoerrelse(): { spsk: number; tsk: number; stk: number; skive: number } {
	return {
		spsk: Object.keys(SPSK).length,
		tsk: Object.keys(TSK).length,
		stk: Object.keys(STK).length,
		skive: Object.keys(SKIVE).length
	};
}
