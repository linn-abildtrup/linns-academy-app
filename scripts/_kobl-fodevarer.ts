// ETAPE 1: forslag til kobling mellem vores faelles foedevareliste og
// Den Danske Foedevaredatabase 6.1 (DTU). SKRIVER INTET. Laver kun en rapport.
//
//   npx tsx scripts/_kobl-fodevarer.ts
//
// Reglen er den samme som paa ingrediens-koblingen: hele ord, aldrig gaet,
// og tilstanden (raa/kogt/toerret) er en HAARD graense. Alt hvad der ikke er
// oplagt havner i "skal ses efter" i stedet for at blive valgt i stilhed.
//
// GEMT MED VILJE. Reglen om at slette engangs-scripts gaelder dem der RETTER
// i kundedata. Den her retter intet, og den er opskriften paa hvordan
// koblingen blev lavet 24. august. Skal en foedevare kobles om senere, er det
// den her der skal koeres igen. Se 9.50 i HANDOVER-3.0.md.
//
// KOERER IKKE SOM DEN STAAR. Stien UD nedenfor peger paa en arbejdsmappe fra
// den session hvor scriptet blev skrevet, og den findes ikke naeste gang.
// Ret UD til en mappe der findes, og laeg de to input-filer der foerst:
//   faelles-fodevarer.json   vores egne varer
//   fodevare-brug.json       hvor meget hver vare bruges

import { readFileSync, writeFileSync } from 'fs';
import * as XLSXMod from 'xlsx';
const XLSX = (XLSXMod as { default?: typeof XLSXMod }).default ?? XLSXMod;

const UD = '/private/tmp/claude-501/-Users-linnabildtrup/6b25bf37-c9d9-4022-aa45-4ae0c6a4cd70/scratchpad';

/* ── DTU ── */
interface DtuVare { id: string; navn: string; p: number; f: number; fedt: number; kh: number; kcal: number }

function talAf(v: unknown): number {
	if (typeof v === 'number') return v;
	const s = String(v ?? '').replace(',', '.').replace(/[^\d.-]/g, '');
	const n = parseFloat(s);
	return Number.isFinite(n) ? n : 0;
}

function laesDtu(): DtuVare[] {
	const wb = XLSX.readFile('scripts/FCDB_6.1.xlsx');
	const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['Data_Table'], { header: 1, raw: false });
	const h = (rows[0] as unknown[]).map((c) => String(c ?? '').trim());
	const kol = (navn: string) => h.indexOf(navn);
	const iP = kol('Protein'), iF = kol('Kostfibre'), iFedt = kol('Fedt');
	const iKh = kol('Tilgængelig kulhydrat'), iKcal = kol('Energi (kcal)');
	const ud: DtuVare[] = [];
	for (const r of rows.slice(4)) {
		const navn = String(r[0] ?? '').trim();
		if (!navn) continue;
		ud.push({
			id: String(r[2] ?? '').trim(), navn,
			p: talAf(r[iP]), f: talAf(r[iF]), fedt: talAf(r[iFedt]),
			kh: talAf(r[iKh]), kcal: talAf(r[iKcal])
		});
	}
	return ud;
}

/* ── Ordbehandling ── */
const erTal = (o: string) => /^[\d.,+%]+$/.test(o) || /^\d+([.,]\d+)?$/.test(o);
const FYLDORD = new Set(['og', 'i', 'af', 'med', 'den', 'det', 'en', 'et', 'til', 'uspec', 'uspecificeret', 'ca', 'ell', 'eller', 'alle', 'typer', 'type', 'mv', 'osv']);

// Tilstande. Staar de paa det ene navn og ikke paa det andet, er det ikke samme vare.
const TILSTANDE: Record<string, string[]> = {
	raa: ['rå', 'raa', 'frisk', 'fersk'],
	kogt: ['kogt', 'kogte', 'tilberedt'],
	stegt: ['stegt', 'stegte', 'pandestegt', 'ovnstegt', 'grillstegt', 'grillet'],
	ristet: ['ristet', 'ristede', 'tørristet', 'olieristet'],
	toerret: ['tørret', 'tørrede', 'tør', 'tørre', 'dehydreret'],
	roeget: ['røget', 'røgede', 'koldrøget', 'varmrøget'],
	syltet: ['syltet', 'syltede', 'marineret'],
	daase: ['konserves', 'dåse', 'dåsen', 'afdryppet', 'afdryppede', 'afdrypet'],
	frost: ['dybfrost', 'frossen', 'frosne', 'frost'],
	saltet: ['saltet', 'saltede'],
	past: ['pasteuriseret'],
	friture: ['frituret', 'friturestegt']
};

const FORMORD: Record<string, string[]> = {
	olie: ['olie', 'olien'],
	kerne: ['kerner', 'kerne', 'frø', 'frøene'],
	mel: ['mel', 'melet', 'gryn', 'flager', 'fnug'],
	drik: ['juice', 'most', 'saft', 'drik', 'drikke', 'smoothie'],
	pulver: ['pulver', 'pulveret', 'ekstrakt'],
	sirup: ['sirup', 'marmelade', 'gele', 'kompot'],
	broed: ['brød', 'bolle', 'boller', 'rundstykke', 'rundstykker', 'franskbrød'],
	kiks: ['kiks', 'knækbrød', 'tvebak', 'skorpe'],
	paalaeg: ['pålæg', 'pølse', 'fars', 'postej'],
	is: ['is', 'ispind', 'isvaffel'],
	smoer: ['smør', 'peanutbutter', 'creme']
};

// Ord der udelukker hinanden. Staar det ene paa vores navn og det andet paa
// DTU-navnet, er det ikke den samme vare, uanset hvor meget resten ligner.
const MODSAETNINGER: string[][] = [
	['grov', 'grove', 'groft', 'fuldkorn', 'fuldkorns'],
	['lys', 'lyst', 'lyse', 'fin', 'fint', 'finvalsede', 'sigtet', 'hvid', 'hvidt'],
	['mager', 'magert', 'light', 'skummet', 'mini', 'usødet', 'usukret', 'nul'],
	['fed', 'fede', 'sod', 'sød', 'sødet', 'sukker', 'sukret', 'sødmælk', 'flode', 'fløde']
];

// Varer hvor toer/kogt-forskellen er stor nok til at et gaet er farligt
const FARLIGE = ['linse', 'linser', 'kikært', 'kikærter', 'bønne', 'bønner', 'ært', 'ærter', 'ris', 'pasta', 'bulgur', 'quinoa', 'couscous', 'gryn', 'havre', 'byg', 'hvede', 'spelt', 'nudler'];

// Danske uregelmaessige flertalsformer. Eksplicit liste, ikke et gaet.
const UREGELMAESSIGE: Record<string, string> = {
	mandler: 'mandel', mandel: 'mandel',
	noedder: 'noed', nødder: 'nød', nød: 'nød',
	gulerødder: 'gulerod', gulerod: 'gulerod',
	kartofler: 'kartoffel', kartoffel: 'kartoffel',
	ærter: 'ært', ært: 'ært',
	bønner: 'bønne', bønne: 'bønne',
	tænder: 'tand',
	fødder: 'fod',
	blomme: 'blomme', blommer: 'blomme',
	dadler: 'daddel', daddel: 'daddel',
	nudler: 'nudel', nudel: 'nudel',
	skiver: 'skive', skive: 'skive',
	bøffer: 'bøf', bøf: 'bøf',
	tomater: 'tomat', tomat: 'tomat',
	agurker: 'agurk', agurk: 'agurk',
	løg: 'løg',
	æg: 'æg',
	fisk: 'fisk',
	ris: 'ris',
	oliven: 'oliven',
	kerner: 'kerne', kerne: 'kerne',
	frø: 'frø',
	rødder: 'rod', rod: 'rod'
};

function stam(o: string): string {
	if (UREGELMAESSIGE[o]) return UREGELMAESSIGE[o];
	if (o.length <= 4) return o;
	for (const e of ['erne', 'ene', 'er', 'en', 'et', 'ne', 'e', 'r']) {
		if (o.length - e.length >= 4 && o.endsWith(e)) {
			let r = o.slice(0, o.length - e.length);
			// dansk flertal fordobler tit konsonanten: cashewnoedder -> cashewnoedd -> cashewnoed
			if (r.length >= 4 && r[r.length - 1] === r[r.length - 2] && !'aeiouyæøå'.includes(r[r.length - 1])) {
				r = r.slice(0, -1);
			}
			return r;
		}
	}
	return o;
}

const NAVNE_RETTELSER: [RegExp, string][] = [
	[/svinek(ø|oe)d/gi, 'grisekød'],
	[/svine/gi, 'grise'],
	[/\bsvin\b/gi, 'gris']
];
function retNavn(navn: string): string {
	let n = navn;
	for (const [fra, til] of NAVNE_RETTELSER) n = n.replace(fra, til);
	return n;
}

function ord(navn: string): string[] {
	navn = retNavn(navn);
	return navn
		.toLowerCase()
		.replace(/[()]/g, ' ')
		.replace(/%/g, ' % ')
		.replace(/[.,;:/]/g, ' ')
		.split(/[\s-]+/)
		.map((o) => o.trim())
		.filter((o) => o.length > 0 && !FYLDORD.has(o));
}

function gruppeI(ordliste: string[], tabel: Record<string, string[]>, endelser = false): Set<string> {
	const ud = new Set<string>();
	for (const [navn, varianter] of Object.entries(tabel)) {
		const traf = ordliste.some((o) => varianter.some((va) =>
			o === va || (endelser && va.length >= 3 && o.length >= va.length + 3 && o.endsWith(va))
		));
		if (traf) ud.add(navn);
	}
	return ud;
}
const tilstandeI = (o: string[]) => gruppeI(o, TILSTANDE);
const formerI = (o: string[]) => gruppeI(o, FORMORD, true);

// Procenter i navnet, fx "10% fedt" eller "45+"
function procenterI(navn: string): string[] {
	const ud: string[] = [];
	for (const m of navn.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:%|\+)/g)) ud.push(m[1].replace(',', '.'));
	return ud;
}

// Finder hovedordet i et navn. Reglen: tag det der staar foer foerste komma,
// klip ved med/uden/til, og tag saa det SIDSTE ord. Paa dansk staar
// tillaegsordet foran navneordet, saa "Grove havregryn" handler om havregryn.
function hovedOrd(navn: string): string {
	const foerste = retNavn(navn).replace(/\([^)]*\)/g, ' ').split(',')[0];
	const ord0 = foerste
		.toLowerCase()
		.replace(/[()]/g, ' ')
		.replace(/%/g, ' ')
		.split(/[\s-]+/)
		.map((o) => o.trim())
		.filter(Boolean);
	const klip = ord0.findIndex((o) => ['med', 'uden', 'til', 'i', 'af', 'og'].includes(o));
	const del = klip > 0 ? ord0.slice(0, klip) : ord0;
	const alleTil = new Set([...Object.values(TILSTANDE).flat()]);
	const rest = del.filter((o) => !alleTil.has(o) && !/^[\d.,+]+$/.test(o) && o.length > 1);
	return rest.length ? rest[rest.length - 1] : (del[del.length - 1] ?? '');
}

// Sammenligner to ord. Ingen stavefejls-tolerance: enten er det det samme ord,
// eller ogsaa staar det ene inde i det andet som en sammensaetning.
// Sammensaetninger er ALTID kun et forslag, aldrig et sikkert traef.
function matchOrd(a: string, b: string): { vaegt: number; sammensat: boolean } | null {
	if (a === b) return { vaegt: 1, sammensat: false };
	const sa = stam(a), sb = stam(b);
	if (sa === sb) return { vaegt: 1, sammensat: false };
	// Sammensaetning: kefir i letmaelkskefir, kylling i kyllingebryst.
	// Det korte ord skal fylde noget, og det lange skal vaere maerkbart laengere,
	// saa graesk ikke rammer graeskar.
	for (const [x, y] of [[sa, sb], [a, b]] as [string, string][]) {
		const [kort, lang] = x.length <= y.length ? [x, y] : [y, x];
		if (lang.length - kort.length < 3) continue;
		if (kort.length >= 3 && lang.endsWith(kort)) return { vaegt: 0.8, sammensat: true };
		if (kort.length >= 5 && lang.includes(kort)) return { vaegt: 0.55, sammensat: true };
	}
	// Faelles forstavelse: solsikkekerner og solsikkefroe
	const kortest = sa.length <= sb.length ? sa : sb;
	const laengst = sa.length <= sb.length ? sb : sa;
	let i = 0;
	while (i < kortest.length && kortest[i] === laengst[i]) i++;
	if (i >= 7) return { vaegt: 0.5, sammensat: true };
	return null;
}

/* ── Selve matchningen ── */
interface Vores { id: string; name: string; p: number; f: number; fedt?: number; kh?: number; kcal?: number; kilde?: string; cat?: string }
interface Bud { dtu: DtuVare; score: number; grund: string; sammensat: boolean }

function byggIdf(dtu: DtuVare[]): Map<string, number> {
	const tael = new Map<string, number>();
	for (const d of dtu) for (const o of new Set(ord(d.navn).map(stam))) tael.set(o, (tael.get(o) ?? 0) + 1);
	const idf = new Map<string, number>();
	for (const [o, n] of tael) idf.set(o, Math.log(dtu.length / n));
	return idf;
}

function findBud(v: Vores, dtu: DtuVare[], idf: Map<string, number>): Bud[] {
	const vOrd = ord(v.name);
	let vTil = tilstandeI(vOrd);
	// Raa vaegt er udgangspunktet. Paa alt der IKKE suger vand er
	// tilberedningen stoej, saa stegt kylling maa gerne kobles til raa.
	const sugerVand = SUGER_VAND.test(v.name);
	const raaErUdgangspunkt = !sugerVand;
	if (raaErUdgangspunkt) {
		vTil = new Set([...vTil].filter((t) => !['kogt', 'stegt', 'ristet', 'friture'].includes(t)));
	}
	const alleTilstandsord = new Set(Object.values(TILSTANDE).flat());
	const vVigtige = vOrd.filter((o) => !alleTilstandsord.has(o) && !erTal(o));
	if (vVigtige.length === 0) return [];
	const vHoved = hovedOrd(v.name) || vVigtige[0];
	const vVaegt = vVigtige.reduce((s, o) => s + (idf.get(stam(o)) ?? 3), 0);
	if (vVaegt === 0) return [];

	const bud: Bud[] = [];
	for (const d of dtu) {
		const dOrd = ord(d.navn);
		const dTil = tilstandeI(dOrd);
		const dVigtige = dOrd.filter((o) => !alleTilstandsord.has(o) && !erTal(o));
		if (dVigtige.length === 0) continue;
		const dHoved = hovedOrd(d.navn) || dVigtige[0];

		// HOVEDREGEL: begge navnes foerste ord skal kunne genfindes i det andet navn.
		// Uden den blev "AEg, helt" til fisken "Helt, raa".
		const hovedA = dVigtige.some((o) => matchOrd(o, vHoved));
		const hovedB = vVigtige.some((o) => matchOrd(o, dHoved));
		if (!hovedA || !hovedB) continue;
		// Er hovedordene det SAMME ord, er det den samme slags mad. Er det ene
		// kun en del af det andet, er det en anden vare: smoer og jordnoeddesmoer,
		// ost og smelteost, aeble og paradisaeble.
		const hovedEns = matchOrd(vHoved, dHoved);
		const hovedPraecist = !!hovedEns && !hovedEns.sammensat;

		let traf = 0;
		let sammensat = false;
		for (const o of vVigtige) {
			let bedst: { vaegt: number; sammensat: boolean } | null = null;
			for (const x of dVigtige) {
				const m = matchOrd(x, o);
				if (m && (!bedst || m.vaegt > bedst.vaegt)) bedst = m;
			}
			if (bedst) {
				traf += (idf.get(stam(o)) ?? 3) * bedst.vaegt;
				if (bedst.sammensat) sammensat = true;
			}
		}
		if (traf === 0) continue;
		let score = traf / vVaegt;

		// DTU-ord vi ikke har braendt for: straf, saa "Tun i tomat" ikke vinder over "Tun"
		const ekstra = dVigtige.filter((o) => !vVigtige.some((x) => matchOrd(x, o)));
		const ekstraVaegt = ekstra.reduce((s, o) => s + (idf.get(stam(o)) ?? 3), 0);
		score -= 0.3 * (ekstraVaegt / vVaegt);

		// Formen er en haard graense: graeskarkerner er ikke graeskar
		let grund = '';
		const vTilRaa = tilstandeI(vOrd);
		if (vTilRaa.size > 0 && dTil.size > 0 && [...vTilRaa].every((t) => dTil.has(t)) && [...dTil].every((t) => vTilRaa.has(t))) {
			score += 0.28;
		}
		const vForm = formerI(vOrd), dForm = formerI(dOrd);
		const formKunHos = [...vForm].filter((f) => !dForm.has(f));
		const formKunDer = [...dForm].filter((f) => !vForm.has(f));
		if (formKunHos.length || formKunDer.length) {
			score -= 0.75;
			grund = formKunDer.length
				? `DTU-varen er ${formKunDer.join(' og ')}, det er vores ikke`
				: `vores vare er ${formKunHos.join(' og ')}, DTU-varens er ikke`;
		}

		// Modsaetninger: groft rugbroed er ikke lyst rugbroed
		const gruppeFor = (liste: string[]) => {
			const ud = new Set<number>();
			liste.forEach((o) => MODSAETNINGER.forEach((g, i) => { if (g.includes(o)) ud.add(i); }));
			return ud;
		};
		const vG = gruppeFor(vOrd), dG = gruppeFor(dOrd);
		const par: [number, number][] = [[0, 1], [2, 3]];
		for (const [a2, b2] of par) {
			if ((vG.has(a2) && dG.has(b2)) || (vG.has(b2) && dG.has(a2))) {
				score -= 0.7;
				grund = grund || 'det ene navn siger groft eller fedt, det andet det modsatte';
			}
		}

		// Staar der en procent begge steder, skal den passe
		const vPct = procenterI(v.name), dPct = procenterI(d.navn);
		if (vPct.length && dPct.length) {
			if (vPct.some((x) => dPct.includes(x))) score += 0.15;
			else {
				const p1 = parseFloat(vPct[0]), p2 = parseFloat(dPct[0]);
				const taet = Number.isFinite(p1) && Number.isFinite(p2) && Math.abs(p1 - p2) <= Math.max(0.6, 0.2 * Math.max(p1, p2));
				score -= taet ? 0.15 : 0.5;
				grund = grund || `vi skriver ${vPct[0]} %, DTU skriver ${dPct[0]} %`;
			}
		}

		const kunHos = [...vTil].filter((t) => !dTil.has(t));
		const kunDer = [...dTil].filter((t) => !vTil.has(t));
		if (kunHos.length) { score -= 0.42; grund = `vi skriver ${kunHos.join(' ')}, DTU goer ikke`; }
		if (kunDer.length) {
			if (vTil.size === 0 && kunDer.every((t) => t === 'raa')) score += raaErUdgangspunkt ? 0.2 : 0.12;
			else { score -= 0.32; grund = `DTU skriver ${kunDer.join(' ')}, det goer vi ikke`; }
		}
		score += hovedPraecist ? 0.22 : -0.18;

		if (score > 0.05) bud.push({ dtu: d, score, grund, sammensat });
	}
	bud.sort((a, b) => b.score - a.score);
	return bud.slice(0, 5);
}

/* ── Haandsatte koblinger ──
   Det Linn har rettet i gennemgangen. Navnet skal staa praecis som i DTU.
   Et navn her vinder altid over det automatiske forslag. */
const HAANDSAT: Record<string, string> = {
	aeg: 'Æg, høne, skrabehøns, rå',
	aeg_kogt: 'Æg, høne, skrabehøns, rå',
	aeg_stort: 'Æg, høne, skrabehøns, rå',
	aeg_lille: 'Æg, høne, skrabehøns, rå',
	aeg_hvide: 'Æg, høne, æggehvide, rå',
	aeg_blomme: 'Æg, høne, blomme, rå',
	cherrytomat: 'Tomat, dansk, rå',
	graeskarkerner: 'Græskarkerner, tørret',
	graesk_yog: 'Flødeyoghurt naturel, 2% fedt (Græsk og Tyrkisk stil)',
	graesk_yog_10: 'Flødeyoghurt naturel, 10% fedt (Græsk og Tyrkisk stil)',
	valnoedder: 'Valnød, tørret',
	hyttost: 'Hytteost, 20+',
	hyttost_light: 'Hytteost, 5+',
	bolle_fuldk: 'Hvedebrød, bolle, grov, industrifremstillet',
	rosin: 'Rosin uden kerner',
	druer: 'Vindrue, rå',
	zucchini: 'Squash, rå',
	salat_iceberg: 'Salat, Iceberg, rå',
	salat_romaine: 'Salat, Romaine, romersk, rå',
	salat_bla: 'Salat, hovedsalat, rå',
	plantemaelk_ma: 'Mandeldrik, ikke beriget',
	plantemaelk_havre: 'Havredrik, ikke beriget',
	peanutbutter: 'Jordnøddesmør',
	cottage_c: 'Hytteost, 20+',
	edamame: 'Edamamebønner (Sojabønner), pillede, frosne',
	kyl_bryst_r: 'Kylling, bryst, kød og skind, rå',
	kyl_inderfilet: 'Kylling, bryst, kød og skind, rå',
	kyl_inderfilet_p: 'Kylling, bryst, kød og skind, rå',
	svin_mork: 'Grisekød, mørbrad, afpudset, rå',
	boef_mork: 'Oksekød, mørbrad, afpudset, rå',
	groft_rugbrod: 'Rugbrød, kun groft rugmel, detailbageri',
	kartoffel_k: 'Kartoffel, kogt',
	aronia: 'Surbær (Aroniabær)',
	ymer: 'Ymer naturel',
	havregryn_fin: 'Havregryn, uspec.',
	havregryn_grov: 'Havregryn, uspec.',
	roedloeg: 'Løg, rå',
	dadler: 'Daddel, tørret',
	remoulade: 'Remoulade',
	burgerbolle: 'Hvedebrød, bolle, fin, industrifremstillet',
	burgerbolle_fk: 'Hvedebrød, bolle, grov, industrifremstillet',
	svinekoteletter: 'Grisekød, kam uden svær, ca. 3 mm spæk, rå',
	gouda: 'Ost, fast, 45+, alle typer',
	okse_filet: 'Oksekød, tykstegsfilet uden kappe, rå',
	kefir: 'Letmælkskefir',
	kefir_drik: 'Letmælkskefir',
	skyr_natur: 'Skyr, 0.2 % fedt',
	knoldselleri: 'Selleri, rod, rå',
	blaaost: 'Ost, blå- og hvidskimmel, 70+',
	rejer: 'Reje, dybvands-, kogt, dybfrost',
	frankf_polse: 'Wienerpølse',
	kalvefilet: 'Kalvekød, magert, råt',
	chili_frisk: 'Peber, chili, rå',
	cashew_salt: 'Cashewnød, olieristet',
	kyl_hakket: 'Kyllingekød, hakket, 3-10% fedt, rå',
	kyl_hakket_r: 'Kyllingekød, hakket, 3-10% fedt, rå',
	smor: 'Smør, saltet',
	aeble: 'Æble, uspec., råt',
	ost45: 'Ost, fast, 45+, alle typer',
	ost30: 'Ost, fast, 30+, alle typer',
	cashewnod: 'Cashewnød, tørristet',
	letmaelk: 'Letmælk, konventionel (ikke-økologisk)',
	sodmaelk: 'Sødmælk, konventionel (ikke-økologisk)',
	kyl_paalaeg: 'Kylling, bryst (filet), kogt, pålæg',
	kikaerter_dryp: 'Kikærter, lyse, kogte, konserves',
	hakket_okse_3: 'Oksekød, hakket, 5-10% fedt, rå',
	sod_kart_baad: 'Batat, sød kartoffel, rå',
	skinke_kogt: 'Skinke, kogt, skiveskåret',
	rugbrod_kerne: 'Rugbrød, kun groft rugmel, med hele kerner, detailbageri',
	basmati_k: 'Ris, kogte',
	hamburgerryg: 'Hamburgerryg, kogt',
	cf_manual_1779255177912: 'Æg, høne, skrabehøns, rå',
	cf_manual_1779522726739: 'Æg, høne, skrabehøns, rå',
	cf_manual_1779522283218: 'Æg, høne, skrabehøns, rå',
	solsikkefro: 'Solsikkefrø, afskallede, tørrede'
};

/* ── Varer DTU ikke har ──
   Slaaet op og bekraeftet at der ikke findes en tilsvarende vare. De skal have
   Linns egne tal i etape 2 i stedet for at faa et forslag der ligner noget. */
// Linn har gennemgaaet og sagt god for alle 33 tal den 24. august 2026.
// De staar dermed fast som hendes, med hende som kilde.
const LINNS_TAL: Record<string, string> = {
	skyr_vanilje: 'DTU har kun naturel skyr. Vaniljeskyr har tilsat sukker',
	skyr_blaabaer: 'DTU har kun naturel skyr',
	fuldk_pasta_k: 'DTU har ingen fuldkornspasta',
	havreris_k: 'DTU har ingen havreris',
	kanel: 'DTU har kun kanelstang',
	kyl_bryst_s: 'DTU har kun kyllingebryst MED skind',
	kyl_bryst_r: 'DTU har kun kyllingebryst MED skind',
	kyl_laar: 'DTU har kun kyllingelaar MED skind',
	parmaskinke: 'DTU har kun kogt og konserveret skinke',
	kyl_overlaar: 'DTU har kun kyllingelaar MED skind',
	gojibaer: 'Findes ikke i DTU',
	macadamia: 'Findes ikke i DTU',
	gurkemeje: 'DTU har ingen frisk gurkemeje',
	basilikum: 'DTU har ingen frisk basilikum',
	burrata: 'Findes ikke i DTU',
	feldsalat: 'Findes ikke i DTU',
	plantemaelk_ko: 'DTU har ingen kokosdrik',
	kapers: 'Findes ikke i DTU',
	hampfro: 'Findes ikke i DTU',
	hampefro: 'Findes ikke i DTU',
	broed_topping: 'En blanding, ikke en enkelt foedevare',
	maelkechok: 'DTU har ingen ren maelkechokolade',
	bellwell_gut: 'Dit eget valg. Alle kunder ser den, og tallet er dit',
	kimchi: 'Findes ikke i DTU',
	noddemix: 'DTU har ingen noeddeblanding',
	noddeblanding: 'DTU har ingen noeddeblanding',
	tortilla_hvede: 'Findes ikke i DTU',
	fuldk_brod: 'DTU har ingen fuldkornsbroed af hvede',
	pita_fuldkorn: 'DTU har kun pitasandwich som fastfood',
	naan: 'Findes ikke i DTU',
	surdej: 'DTU har intet surdejsbroed',
	kartoffel_skin: 'DTU har ingen kartoffel med skind',
	kart_baad: 'DTU har ingen ovnbagte kartofler'
};

/* ── Sorteringen ──
   Tre slags, og de skal behandles helt forskelligt:
   maerkevare  = har en pakke. Ud af den faelles liste, kunden scanner den selv
   tilberedt   = kogt, stegt eller sammensat mad. Foedevaredatabasen er raavarer
   raavare     = almindelig mad. Skal kobles til databasen */

// LINNS UDVALG: maerkevarer hun bevidst laegger i den faelles liste, fordi de
// er en del af programmet. De ser ALLE kunder, ogsaa nye. Tallene er hendes,
// for databasen har dem ikke. Linns beslutning 24. august.
const LINNS_UDVALG = new Set(['bellwell_gut']);
const MAERKE_ORD = [
	'protein', 'kollagen', 'kreatin', 'pulver', 'shake', 'whey', 'granola', 'mysli', 'müsli',
	'nutella', 'philadelphia', 'bellwell', 'riegel', 'smoothie', 'energidrik',
	'kosttilskud', 'tilskud', 'drikkeyoghurt', 'proteinbar'
];
const TILBEREDT_ORD = [
	'kogt', 'kogte', 'stegt', 'stegte', 'ovnbagt', 'bagt', 'bagte', 'tilberedt', 'ristet', 'ristede',
	'dampet', 'dampede', 'grillet', 'pocheret', 'friturestegt', 'paneret', 'panerede', 'grød'
];
const RET_ORD = [
	'pizza', 'lasagne', 'falafel', 'coleslaw', 'kødsovs', 'tzatziki', 'hummus', 'pandekage',
	'frikadelle', 'frikadeller', 'kanelsnegl', 'gryderet', 'suppe', 'sandwich', 'wrap', 'burger',
	'salatblanding', 'smoothiebowl', 'lagkage', 'tærte', 'gratin', 'salat med',
	'boller i karry', 'risalamande', 'æggekage', 'omelet', 'æggesalat', 'kartoffelsalat',
	'tunmousse', 'paté', 'postej', 'karrysalat', 'guacamole'
];

const SUGER_VAND = /ris\b|pasta|spaghetti|nudler|nudel|linser|kikært|bønner|ærter|bulgur|quinoa|couscous|gryn|havre|byg\b|spelt|grød|perle|risotto|polenta/i;

function slagsAf(navn: string, fraDtu = false): 'maerkevare' | 'tilberedt' | 'ret' | 'raavare' {
	const lav = navn.toLowerCase();
	const ordliste = ord(navn);
	if (MAERKE_ORD.some((m) => lav.includes(m))) return 'maerkevare';
	if (ordliste.some((o) => ['bar', 'barre', 'bars'].includes(o))) return 'maerkevare';
	// Et stort begyndelsesbogstav midt i navnet er som regel et maerke:
	// "Bellwell Gut Balance", "Hindbaer Clear Whey"
	const stumper = navn.replace(/\([^)]*\)/g, ' ').replace(/[,]/g, ' ').split(/\s+/).filter(Boolean);
	if (!fraDtu && stumper.length > 1 && stumper.slice(1).filter((o) => /^[A-ZÆØÅ]/.test(o) && o.length > 2).length >= 1
		&& !/^(rå|kogt|stegt)/i.test(stumper[1] ?? '')) return 'maerkevare';
	const erBroed = /burgerbolle|pizzabund|wrapbrød|^wrap,|tortilla|pitabrød|hotdogbrød|pølsebrød/i.test(navn);
	const retEndelser = /frikadell|boller i karry|con carne|dressing|salat\b/i;
	if (!erBroed && (RET_ORD.some((t2) => new RegExp('(^|[^a-zæøå])' + t2, 'i').test(lav)) || retEndelser.test(lav))) return 'ret';
	if (TILBEREDT_ORD.some((t2) => ordliste.includes(t2) || lav.includes(t2))) return 'tilberedt';
	return 'raavare';
}

/* ── Nye navne ──
   Tilberedningen ryger ud af navnet paa de varer der bruger raavarens tal.
   Ellers lover navnet noget tallet ikke holder. */
const OMDOEB: Record<string, string> = {
	kyl_bryst_s: 'Kyllingebryst',
	sod_kart_baad: 'Sød kartoffel',
	rodbede_k: 'Rødbede',
	havregryn_fin: 'Havregryn'
};

/* ── Koer ── */
const dtu = laesDtu();
const idf = byggIdf(dtu);
const vores: Vores[] = JSON.parse(readFileSync(`${UD}/faelles-fodevarer.json`, 'utf-8'));
const brug: Record<string, number> = JSON.parse(readFileSync(`${UD}/fodevare-brug.json`, 'utf-8'));

console.log(`DTU 6.1: ${dtu.length} foedevarer. Vores faelles liste: ${vores.length} varer.`);

interface Raekke {
	id: string; navn: string; brug: number; kilde: string;
	vores: { p: number; f: number; fedt?: number; kh?: number; kcal?: number };
	bud: { navn: string; dtuId: string; p: number; f: number; fedt: number; kh: number; kcal: number; score: number; grund: string } | null;
	alternativer: { navn: string; score: number }[];
	spand: 'sikker' | 'forslag' | 'intet';
	flag: string[];
	nytNavn?: string;
	skjules?: boolean;
	pegerPaa?: string;
	pegerPaaNavn?: string;
}

const raekker: Raekke[] = [];
for (const v of vores) {
	// Frida-varerne ER DTU-varer i forvejen. De kobles paa deres nummer og
	// skal ikke gennem navne-matchningen overhovedet.
	const paaNummer = v.id.startsWith('frida_') ? dtu.find((d) => d.id === v.id.slice(6)) : undefined;
	const linnsTal = LINNS_TAL[v.id];
	let bud = paaNummer || linnsTal ? [] : findBud(v, dtu, idf);
	const haand = paaNummer ?? (HAANDSAT[v.id] ? dtu.find((d) => d.navn === HAANDSAT[v.id]) : undefined);
	if (HAANDSAT[v.id] && !haand) console.warn(`  ADVARSEL: "${HAANDSAT[v.id]}" findes ikke i DTU`);
	if (haand) bud = [{ dtu: haand, score: 1, grund: '', sammensat: false }, ...bud.filter((b) => b.dtu.navn !== haand.navn)];
	const bedste = bud[0] ?? null;
	const naeste = bud[1]?.score ?? 0;
	const margin = bedste ? bedste.score - naeste : 0;
	const farlig = FARLIGE.some((f) => ord(v.name).some((o) => matchOrd(o, f) !== null));

	let spand: Raekke['spand'] = 'intet';
	if (linnsTal) spand = 'intet';
	else if (haand) spand = 'sikker';
	else if (bedste) {
		if (bedste.score >= 0.85 && margin >= 0.12 && !bedste.grund && !farlig && !bedste.sammensat) spand = 'sikker';
		else if (bedste.score >= 0.4) spand = 'forslag';
	}

	const flag: string[] = [];
	if (linnsTal) flag.push('DU SAETTER TALLET: ' + linnsTal);
	else if (paaNummer) flag.push('kobles paa DTU-nummeret');
	else if (haand) flag.push('sat i haanden af Linn');
	if (farlig && bedste) flag.push('toer eller kogt betyder meget her');
	if (bedste?.sammensat) flag.push('sammensat ord, se navnet efter');
	if (bedste && (/[\d]/.test(v.name) || /[\d]/.test(bedste.dtu.navn))) flag.push('der staar tal i navnet, tjek procenten');
	if (bedste) {
		const dP = bedste.dtu.p - (v.p ?? 0);
		const dF = bedste.dtu.f - (v.f ?? 0);
		if (Math.abs(dP) > Math.max(1.5, 0.25 * (v.p ?? 0))) flag.push('protein flytter sig meget');
		if (Math.abs(dF) > Math.max(1.5, 0.25 * (v.f ?? 0))) flag.push('fiber flytter sig meget');
	}

	raekker.push({
		id: v.id, navn: v.name, brug: brug[v.id] ?? 0, kilde: v.kilde ?? 'egen liste', slags: LINNS_UDVALG.has(v.id) ? 'raavare' : slagsAf(v.name, v.id.startsWith('frida_')),
		vores: { p: v.p, f: v.f, fedt: v.fedt, kh: v.kh, kcal: v.kcal },
		bud: bedste ? {
			navn: bedste.dtu.navn, dtuId: bedste.dtu.id, p: bedste.dtu.p, f: bedste.dtu.f,
			fedt: bedste.dtu.fedt, kh: bedste.dtu.kh, kcal: bedste.dtu.kcal,
			score: Math.round(bedste.score * 100) / 100, grund: bedste.grund
		} : null,
		alternativer: bud.slice(1, 4).map((b) => ({ navn: b.dtu.navn, score: Math.round(b.score * 100) / 100 })),
		spand, flag, nytNavn: OMDOEB[v.id]
	});
}

for (const r of raekker) {
	if (r.spand !== 'forslag' || !r.bud) continue;
	const p1 = r.vores.p, k1 = r.vores.kcal;
	const naerVed = p1 != null && k1 != null &&
		Math.abs(r.bud.p - p1) <= Math.max(0.8, 0.15 * p1) &&
		Math.abs(r.bud.kcal - k1) <= Math.max(12, 0.15 * k1);
	if (naerVed) { r.spand = 'sikker'; r.flag.push('lukket automatisk, tallene flytter sig knap noget'); }
	else { r.spand = 'intet'; r.bud = null; r.flag.push('ikke koblet, ses kun af dem der bruger den'); }
}

raekker.sort((a, b) => b.brug - a.brug);

/* ── Dubletter ──
   Flere af vores varer peger tit paa den samme foedevare i databasen. AEg staar
   fem gange, mandler fem gange. Det er den samme mad, og forskellen er kun hvor
   stort et stykke der ligger paa tallerkenen. Vi beholder den kunderne bruger
   mest og skjuler resten fra soegningen.
   INTET SLETTES. De skjulte kan stadig laeses, saa registrerede maaltider og
   faste maaltider bliver ved med at virke. */
const grupper = new Map<string, Raekke[]>();
for (const r of raekker) {
	if (r.spand !== 'sikker' || !r.bud) continue;
	const n = r.bud.navn;
	(grupper.get(n) ?? grupper.set(n, []).get(n)!).push(r);
}
let skjult = 0;
const dubletter: { beholdt: Raekke; skjulte: Raekke[] }[] = [];
// Staar der forskellige procenter i navnene, er det IKKE den samme vare.
// Moerk chokolade 70 % og 85 % koblede til den samme DTU-vare, men de er
// to forskellige slags chokolade.
const procentIN = (n: string) => [...n.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:%|\+)/g)].map((m2) => m2[1].replace(',', '.')).join('/');

for (const [, gruppe] of grupper) {
	if (gruppe.length < 2) continue;
	const sorteret = [...gruppe].sort((a, b) => b.brug - a.brug);
	const [beholdt, ...alle2] = sorteret;
	const pB = procentIN(beholdt.navn);
	const resten = alle2.filter((r) => {
		const pR = procentIN(r.navn);
		return !(pB && pR && pB !== pR) && !(pB !== pR && (pB || pR) && /\d/.test(beholdt.navn + r.navn) && pB !== '' && pR !== '');
	});
	for (const r of resten) {
		r.skjules = true;
		r.pegerPaa = beholdt.id;
		r.pegerPaaNavn = beholdt.navn;
		skjult++;
	}
	dubletter.push({ beholdt, skjulte: resten });
}

// Tilberedningsord i navnet paa en vare der bruger det RAA tal er nu
// misvisende. Kunden faar raa tal under et navn der siger stegt.
const SUGER = /ris\b|pasta|nudler|linser|kikært|bønner|ærter|bulgur|quinoa|couscous|gryn|havre|byg\b|spelt|grød/i;
const misvisende = raekker.filter((r) =>
	!r.skjules && r.spand === 'sikker' && r.bud &&
	/\b(stegt|stegte|kogt|kogte|bagt|ovnbagt|ristet)\b/i.test(r.navn) &&
	/\brå|råt|råd?e\b/i.test(r.bud.navn) && !SUGER.test(r.navn));

console.log(`\nDubletter: ${dubletter.length} grupper, ${skjult} varer skjules fra soegningen`);
console.log(`Tilbage i soegningen: ${raekker.filter((r) => !r.skjules && r.slags !== 'maerkevare').length} varer`);
console.log(`\nDe stoerste dublet-grupper:`);
for (const g of dubletter.sort((a, b) => b.skjulte.reduce((s2, r) => s2 + r.brug, 0) - a.skjulte.reduce((s2, r) => s2 + r.brug, 0)).slice(0, 10)) {
	console.log(`   beholder "${g.beholdt.navn}" (${g.beholdt.brug}) og skjuler ${g.skjulte.map((r) => `${r.navn} (${r.brug})`).join(', ')}`);
}
console.log(`\n${misvisende.length} varer har et tilberedningsord i navnet men bruger nu det raa tal:`);
for (const r of misvisende.slice(0, 12)) console.log(`   ${r.navn} (${r.brug}) -> ${r.bud!.navn}`);

writeFileSync(`${UD}/kobling-forslag.json`, JSON.stringify(raekker, null, 1));

const iAlt = raekker.reduce((s, r) => s + r.brug, 0);
const del = (s: string) => raekker.filter((r) => r.spand === s);
console.log('\nResultat:');
for (const s of ['sikker', 'forslag', 'intet'] as const) {
	const d = del(s);
	const b = d.reduce((x, r) => x + r.brug, 0);
	console.log(`  ${s.padEnd(9)} ${String(d.length).padStart(5)} varer   ${(100 * b / iAlt).toFixed(1)} % af al brug`);
}
console.log(`\nAf de 300 mest brugte: ${raekker.slice(0, 300).filter((r) => r.spand === 'sikker').length} sikre, ${raekker.slice(0, 300).filter((r) => r.spand === 'forslag').length} til gennemsyn, ${raekker.slice(0, 300).filter((r) => r.spand === 'intet').length} uden bud.`);
const iAlt2 = raekker.reduce((s2, r) => s2 + r.brug, 0);
console.log('\nSorteringen:');
for (const sl of ['raavare', 'tilberedt', 'ret', 'maerkevare'] as const) {
	const l = raekker.filter((r) => r.slags === sl);
	const uden = l.filter((r) => r.spand === 'intet');
	console.log(`  ${sl.padEnd(11)} ${String(l.length).padStart(5)} varer  ${(100 * l.reduce((x, r) => x + r.brug, 0) / iAlt2).toFixed(1)} % af brug   heraf ${uden.length} uden bud`);
}
console.log('\nDe 25 mest brugte:');
for (const r of raekker.slice(0, 25)) {
	console.log(`  ${String(r.brug).padStart(5)}x ${r.navn.padEnd(24)} -> [${r.spand}] ${r.bud ? r.bud.navn : '(intet bud)'}`);
}
