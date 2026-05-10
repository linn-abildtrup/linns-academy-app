// Kost-modul — typer og pure-funktioner
//
// Modulet dækker både 30-30-3-beregneren og opskrifter. Begge dele bruger
// samme fødevaredatabase: fodevarer/{id}-collection i Firestore.
//
// Beregneren har to tabs:
//   - Slå op: brugeren søger en fødevare og ser dens protein/fiber pr 100g
//   - Byg måltid: brugeren tilføjer fødevarer med portioner og ser total
//     protein/fiber mod 30g-målet
//
// Opskrifter er separate og kommer i sin egen typer-fil.

// ==============================================
// Typer
// ==============================================

export type Kategori =
	| 'mejeri'
	| 'koed'
	| 'fisk'
	| 'baelg'
	| 'korn'
	| 'gront'
	| 'baer'
	| 'noedder'
	| 'prot'
	| 'drikke'
	| 'andet';

/**
 * En tilgængelig portion-enhed for en fødevare.
 * fx { u: 'spsk', label: 'spsk', g: 15 } betyder 1 spsk = 15g.
 */
export interface Enhed {
	u: string;
	label: string;
	g: number;
}

/**
 * En fødevare i databasen.
 * p og f er pr 100g (protein i gram, fiber i gram).
 * units er valgfrie portion-enheder. Hvis tom: kun 'g' kan bruges.
 * liquid: hvis true, vis dl-enhed som default i UI.
 */
export type Kilde = 'kickstart' | 'frida' | 'custom' | 'community';

export type Maaltidstype = 'morgenmad' | 'frokost' | 'aftensmad' | 'snack';

export const MAALTIDSTYPE_LABELS: Record<Maaltidstype, string> = {
	morgenmad: 'Morgenmad',
	frokost: 'Frokost',
	aftensmad: 'Aftensmad',
	snack: 'Snack'
};

export const MAALTIDSTYPER: Maaltidstype[] = ['morgenmad', 'frokost', 'aftensmad', 'snack'];

/**
 * Sortér-orden så måltider vises morgen → aften i dagbog-visningen.
 */
export function maaltidstypeOrder(type: Maaltidstype): number {
	return MAALTIDSTYPER.indexOf(type);
}

/**
 * Et gemt måltid i dagbogen. Lever på users/{uid}/maaltider/{id}.
 */
export interface GemtMaaltid {
	id: string;
	navn: string;
	type: Maaltidstype;
	dato: string; // YYYY-MM-DD
	items: MaaltidsItem[];
	totalP: number;
	totalF: number;
	totalKh?: number; // udvidet næring
	totalFedt?: number; // udvidet næring
	totalKcal?: number; // udvidet næring
}

/**
 * En favorit-måltidsskabelon brugeren kan genbruge igen.
 * Lever på users/{uid}/favoritmaaltider/{id}.
 *
 * Adskilt fra GemtMaaltid: ingen dato eller måltidstype — det vælges
 * først når favoritten gemmes som faktisk måltid i dagbogen.
 */
export interface FavoritMaaltid {
	id: string;
	navn: string;
	items: MaaltidsItem[];
}

/**
 * Returnerer dato som YYYY-MM-DD i lokal tidszone.
 */
export function formatDatoKey(d: Date = new Date()): string {
	const yr = d.getFullYear();
	const mo = String(d.getMonth() + 1).padStart(2, '0');
	const da = String(d.getDate()).padStart(2, '0');
	return `${yr}-${mo}-${da}`;
}

/**
 * Gætter måltidstype ud fra klokkeslæt (i dag).
 * Bruges som default i Gem-modal.
 */
export function gaetMaaltidstype(d: Date = new Date()): Maaltidstype {
	const t = d.getHours();
	if (t < 10) return 'morgenmad';
	if (t < 14) return 'frokost';
	if (t < 21) return 'aftensmad';
	return 'snack';
}

export interface Fodevare {
	id: string;
	name: string;
	cat: Kategori;
	p: number; // protein g pr 100g
	f: number; // fiber g pr 100g
	kh?: number; // kulhydrater g pr 100g (udvidet næring)
	fedt?: number; // fedt g pr 100g (udvidet næring)
	kcal?: number; // kalorier kcal pr 100g (udvidet næring)
	units?: Enhed[];
	liquid?: boolean;
	kilde?: Kilde;

	// Community-felter — kun udfyldt for kilde='community'
	barcode?: string;
	addedBy?: string; // uid på den der scannede første gang
	addedByName?: string; // fornavn til "tilføjet af"-badge
	okBy?: string[]; // uids der har stemt 'ok'
	ejBy?: string[]; // uids der har stemt 'ej'
	verificeret?: boolean; // sat når okBy.length >= 3
}

/**
 * Returnerer 'ok' hvis brugeren allerede har stemt op, 'ej' hvis ned, ellers null.
 */
export function brugerStemme(f: Fodevare, uid: string): 'ok' | 'ej' | null {
	if (f.okBy?.includes(uid)) return 'ok';
	if (f.ejBy?.includes(uid)) return 'ej';
	return null;
}

/**
 * Returnerer en tilstand til UI-visning af community-fødevarer.
 * 'verificeret' = officielt godkendt (≥3 ok-stemmer)
 * 'mistaenkelig' = flere ej end ok
 * 'ny' = community uden flueben endnu
 * null = ikke en community-fødevare (Frida)
 */
export function communityStatus(
	f: Fodevare
): 'verificeret' | 'mistaenkelig' | 'ny' | null {
	if (f.kilde !== 'community') return null;
	if (f.verificeret) return 'verificeret';
	const ok = f.okBy?.length ?? 0;
	const ej = f.ejBy?.length ?? 0;
	if (ej > ok) return 'mistaenkelig';
	return 'ny';
}

/**
 * Et item i et byggemåltid: hvilken fødevare og hvor stor portion.
 *
 * To tilstande:
 *   1. KOBLET — foodId peger på en gyldig fødevare. portion + enhedId
 *      bruges til at beregne protein/fiber.
 *   2. MANUEL — foodId er tom streng og manuel-objektet har navn + enhed.
 *      Bruges når en opskrift-ingrediens ikke kunne auto-matches mod
 *      databasen. Item vises på listen, men bidrager ikke til protein/
 *      fiber-totalerne. Brugeren kan klikke for at erstatte med en
 *      koblet fødevare.
 */
export interface MaaltidsItem {
	foodId: string;
	portion: number;
	enhedId?: string;
	manuel?: { navn: string; enhed: string };
}

/**
 * Returnerer true hvis item ikke er koblet til en fødevare i databasen.
 */
export function erManueltItem(item: MaaltidsItem): boolean {
	return !item.foodId || !!item.manuel;
}

// ==============================================
// Konstanter
// ==============================================

export const PROTEIN_MAALTIDS_MAAL = 30;
export const FIBER_DAGS_MAAL = 30;

export const KATEGORI_LABELS: Record<Kategori, string> = {
	mejeri: 'Mejeri & æg',
	koed: 'Kød & fjerkræ',
	fisk: 'Fisk & skaldyr',
	baelg: 'Bælgfrugter',
	korn: 'Fuldkorn & brød',
	gront: 'Grøntsager',
	baer: 'Bær & frugt',
	noedder: 'Nødder & kerner',
	prot: 'Protein-tilskud',
	drikke: 'Drikke',
	andet: 'Andet'
};

// ==============================================
// Beregninger
// ==============================================

/**
 * Slår en enhed op for en fødevare og returnerer hvor mange gram den vejer.
 * Returnerer 1 hvis enhedId er undefined, 'g' eller ikke matcher noget —
 * så portion-tallet selv er gram-tallet.
 */
export function gramForEnhed(food: Fodevare | undefined, enhedId?: string): number {
	if (!enhedId || enhedId === 'g') return 1;
	const enhed = food?.units?.find((u) => u.u === enhedId);
	return enhed?.g ?? 1;
}

/**
 * Beregner protein og fiber for ét måltidsitem.
 * Returnerer 0 for begge hvis itemet er manuelt (ingen fødevare-kobling)
 * eller hvis fødevaren ikke findes (defensiv mod stale data).
 */
export interface ItemBeregning {
	protein: number;
	fiber: number;
	kh: number;
	fedt: number;
	kcal: number;
	gram: number;
}

export interface MaaltidBeregning {
	protein: number;
	fiber: number;
	kh: number;
	fedt: number;
	kcal: number;
}

export function beregnItem(
	item: MaaltidsItem,
	food: Fodevare | undefined
): ItemBeregning {
	if (erManueltItem(item) || !food) {
		return { protein: 0, fiber: 0, kh: 0, fedt: 0, kcal: 0, gram: 0 };
	}
	const gramPrEnhed = gramForEnhed(food, item.enhedId);
	const totalGram = item.portion * gramPrEnhed;
	const f = totalGram / 100;
	return {
		protein: food.p * f,
		fiber: food.f * f,
		kh: (food.kh ?? 0) * f,
		fedt: (food.fedt ?? 0) * f,
		kcal: (food.kcal ?? 0) * f,
		gram: totalGram
	};
}

/**
 * Lægger alle items i et måltid sammen.
 * foods er et map fra foodId til Fodevare så opslag er O(1).
 */
export function beregnMaaltid(
	items: MaaltidsItem[],
	foods: Map<string, Fodevare>
): MaaltidBeregning {
	let protein = 0;
	let fiber = 0;
	let kh = 0;
	let fedt = 0;
	let kcal = 0;
	for (const item of items) {
		const r = beregnItem(item, foods.get(item.foodId));
		protein += r.protein;
		fiber += r.fiber;
		kh += r.kh;
		fedt += r.fedt;
		kcal += r.kcal;
	}
	return { protein, fiber, kh, fedt, kcal };
}

/**
 * Procentvis fremgang mod et mål, cappet på 100.
 */
export function procentMod(maal: number, vaerdi: number): number {
	if (maal <= 0) return 0;
	return Math.min(100, Math.round((vaerdi / maal) * 100));
}

/**
 * Formaterer et gram-tal med højst én decimal og 'gram'-suffix.
 * Fjerner unødvendigt '.0'.
 */
export function formatGram(g: number): string {
	if (g === 0) return '0 gram';
	const rundet = Math.round(g * 10) / 10;
	if (rundet === Math.round(rundet)) return `${Math.round(rundet)} gram`;
	return `${rundet} gram`;
}

/**
 * Filtrerer en liste fødevarer ud fra søgeord og kategori.
 * Søgning er case-insensitiv og matcher mod navnet.
 * Kategori 'all' returnerer alle.
 */
export function filtrerFodevarer(
	foods: Fodevare[],
	soegeord: string,
	kategori: Kategori | 'all'
): Fodevare[] {
	const q = soegeord.trim().toLowerCase();
	return foods.filter((f) => {
		if (kategori !== 'all' && f.cat !== kategori) return false;
		if (q && !f.name.toLowerCase().includes(q)) return false;
		return true;
	});
}

/**
 * Sorterer fødevarer alfabetisk eller efter mest protein/fiber.
 */
export type SortMode = 'alpha' | 'protein' | 'fiber';

export function sorterFodevarer(foods: Fodevare[], mode: SortMode): Fodevare[] {
	const kopi = [...foods];
	if (mode === 'alpha') {
		kopi.sort((a, b) => a.name.localeCompare(b.name, 'da'));
	} else if (mode === 'protein') {
		kopi.sort((a, b) => b.p - a.p);
	} else {
		kopi.sort((a, b) => b.f - a.f);
	}
	return kopi;
}

// ==============================================
// Match opskrift-ingredienser mod fødevaredatabase
// ==============================================

export interface OpskriftsIngrediens {
	navn: string;
	maengde: number;
	enhed: string;
}

/**
 * Renser et ingrediens-navn for tilberedning- og portioneringsbeskrivelser
 * så det matcher bedre mod fødevaredatabasen.
 *
 * Eksempler:
 *   "agurk, i tern"     → "agurk"
 *   "kylling, kogt"     → "kylling"
 *   "frisk persille"    → "persille"
 *   "1 stor gulerod"    → "gulerod"
 *   "2 spsk olivenolie" → "olivenolie"
 */
export function renseIngrediensNavn(navn: string): string {
	let n = navn.toLowerCase().trim();
	// "saft fra 1/2 citron" → "citron"
	n = n.replace(/^saft\s+fra\s+(\d+([.,/]\d+)?\s+)?/, '');
	// Fjern alt efter første komma (typisk "X, i tern" / "X, kogt" / "X, rå")
	const kommaIdx = n.indexOf(',');
	if (kommaIdx > 0) n = n.slice(0, kommaIdx).trim();
	// Fjern indledende mængde- og portioneringsord ("2 spsk", "1 stor", "ca. 100g")
	n = n
		.replace(/^(ca\.?\s+)?\d+([.,/]\d+)?\s*(g|kg|ml|dl|l|stk|spsk|tsk|knsp|knivspids|håndfuld|skive|skiver|kop|kopper|glas|dåse|dåser|pose|poser|fed|fede|klove|stang|stænger|bundt|bundter|stilk|stilke)\s+/i, '')
		.replace(/^(ca\.?\s+)?\d+([.,/]\d+)?\s+/i, '')
		.replace(/^(en|et|to|tre|fire|fem|seks|syv|otte|ni|ti|halv|halvt|en halv|et halvt)\s+/i, '')
		.replace(/^(stor|stort|store|lille|lillebitte|små|mellem|mellemstor|halv|halvt|kvart|håndfuld|en\s+håndfuld|et\s+nip)\s+/i, '')
		.replace(/^(fed|fede|klove)\s+/i, '')
		.replace(/^(stang|stænger|bundt|bundter|stilk|stilke|dåse|dåser|pose|poser)\s+/i, '');
	// Fjern indledende tilberedningsord
	n = n.replace(/^(frisk|friske|tørret|tørrede|kogt|kogte|stegt|stegte|bagt|bagte|røget|rå|rene|skåret|hakket|finthakket|revet|passeret|passerede|stødt|hel|hele)\s+/i, '');
	// Fjern beskrivende suffix uden komma
	n = n
		.replace(/\s+i\s+(tern|skiver|strimler|staver|halve|kvarte|stykker|små stykker)$/i, '')
		.replace(/\s+(til\s+stegning|til\s+pynt|til\s+servering)$/i, '')
		.replace(/\s+uden\s+tilsat\s+\w+$/i, '');
	return n.trim();
}

/**
 * Finder den bedst matchende fødevare for en ingrediens-streng.
 *
 * Forsøger først eksakt/start-match med det rå navn. Hvis intet match,
 * renser navnet (fjerner ", i tern", tilberedning, mængder) og prøver igen.
 * Endeligt fallback er substring-match.
 *
 * Hvis flere matches, foretrækkes den med det korteste navn (mest generel).
 */
export function findFodevareForIngrediens(
	ingrediensNavn: string,
	foods: Fodevare[]
): Fodevare | null {
	const raa = ingrediensNavn.toLowerCase().trim();
	if (!raa) return null;

	function findMatch(q: string): Fodevare | null {
		if (!q) return null;
		const eksakt = foods.find((f) => f.name.toLowerCase() === q);
		if (eksakt) return eksakt;
		// Prioritér 'rent' match: fødevare-navn = q fulgt af komma eller mellemrum
		// — fx 'Laks, fersk' matcher 'laks' bedre end 'Laksetatar' gør.
		const startMedOrdgraense = foods
			.filter((f) => {
				const navn = f.name.toLowerCase();
				return navn.startsWith(q + ',') || navn.startsWith(q + ' ');
			})
			.sort((a, b) => a.name.length - b.name.length);
		if (startMedOrdgraense.length > 0) return startMedOrdgraense[0];
		// Compound-match: fødevare-navn starter med q som del af længere ord
		// — fx 'Cherrytomat' matcher 'cherrytomat'.
		const starter = foods
			.filter((f) => f.name.toLowerCase().startsWith(q))
			.sort((a, b) => a.name.length - b.name.length);
		if (starter.length > 0) return starter[0];
		const indeholder = foods
			.filter((f) => f.name.toLowerCase().includes(q))
			.sort((a, b) => a.name.length - b.name.length);
		if (indeholder.length > 0) return indeholder[0];
		return null;
	}

	const direkte = findMatch(raa);
	if (direkte) return direkte;

	const renset = renseIngrediensNavn(ingrediensNavn);
	if (renset && renset !== raa) {
		const viaRenset = findMatch(renset);
		if (viaRenset) return viaRenset;
	}

	// Sidste fallback: prøv hvert af de længste ord i den rensede streng
	// — fanger sammensatte navne som "fed hvidløg" → "hvidløg" når
	// renseIngrediensNavn ikke har fjernet 'fed'.
	const baseString = renset || raa;
	const ord = baseString.split(/\s+/).filter((w) => w.length >= 4);
	const sorteret = [...ord].sort((a, b) => b.length - a.length);
	for (const o of sorteret) {
		const m = findMatch(o);
		if (m) return m;
		// Prøv stemming: fjern almindelige danske flertals-endelser og
		// sammensatte suffikser som '-filet', '-skive', '-kerne'
		for (const variant of stemVarianter(o)) {
			const m2 = findMatch(variant);
			if (m2) return m2;
		}
	}

	return null;
}

/**
 * Liste af kendte suffikser/præfikser på sammensatte danske fødevareord.
 * Bruges af stemVarianter til at "spalte" sammensatte ord til forsøg på
 * match mod databasen.
 */
const COMPOUND_SUFFIKSER = [
	'filet',
	'fileter',
	'skive',
	'skiver',
	'kerne',
	'kerner',
	'pulver',
	'flager',
	'flage',
	'kiks',
	'plader',
	'plade',
	'ris',
	'bønner',
	'tortilla',
	'lasagne',
	'pasta',
	'sennep',
	'mayonnaise',
	'dressing',
	'sauce',
	'olie',
	'eddike',
	'mælk',
	'yoghurt',
	'ost'
];

const COMPOUND_PREFIKSER = [
	'fuldkorns',
	'fuldkorn',
	'snack',
	'øko',
	'bio',
	'økologisk',
	'dijon'
];

/**
 * Returnerer kandidat-stems for et ord — bruges som sidste fallback i
 * matching. Fanger fx 'cherrytomater' → 'cherrytomat',
 * 'laksefilet' → 'laks', 'kyllingebryster' → 'kyllingebryst'.
 */
function stemVarianter(ord: string): string[] {
	const ud: string[] = [];
	// Flertal-endelser
	if (ord.endsWith('erne')) ud.push(ord.slice(0, -4));
	if (ord.endsWith('ene')) ud.push(ord.slice(0, -3));
	if (ord.endsWith('ler') && ord.length > 5) ud.push(ord.slice(0, -3) + 'el');
	if (ord.endsWith('er') && ord.length > 4) ud.push(ord.slice(0, -2));
	if (ord.endsWith('e') && ord.length > 4) ud.push(ord.slice(0, -1));
	// Sammensatte suffix på fx 'laksefilet', 'rugbrødskiks', 'chiliflager'
	for (const suffix of COMPOUND_SUFFIKSER) {
		const idx = ord.lastIndexOf(suffix);
		if (idx > 1 && idx + suffix.length === ord.length) {
			let stamme = ord.slice(0, idx);
			if (stamme.endsWith('e') || stamme.endsWith('s')) stamme = stamme.slice(0, -1);
			if (stamme.length >= 3) ud.push(stamme);
			// Også prøv selve suffikset som standalone ord
			// — fx 'rugbrødskiks' → 'kiks'
			ud.push(suffix);
		}
	}
	// Sammensatte præfiks: 'fuldkornstortilla' → 'tortilla',
	// 'snackpeber' → 'peber'
	for (const prefix of COMPOUND_PREFIKSER) {
		if (ord.startsWith(prefix) && ord.length > prefix.length + 2) {
			let rest = ord.slice(prefix.length);
			if (rest.startsWith('s')) rest = rest.slice(1);
			if (rest.length >= 3) {
				ud.push(rest);
				// Rekursiv: hvis 'rest' har en compound suffix også
				// — fx 'fuldkornslasagneplader' → 'lasagneplader' → 'lasagne'
				for (const suffix of COMPOUND_SUFFIKSER) {
					const idx = rest.lastIndexOf(suffix);
					if (idx > 1 && idx + suffix.length === rest.length) {
						let stamme = rest.slice(0, idx);
						if (stamme.endsWith('e') || stamme.endsWith('s')) stamme = stamme.slice(0, -1);
						if (stamme.length >= 3) ud.push(stamme);
					}
				}
			}
		}
	}
	return ud;
}

/**
 * Forsøger at vælge den bedste enhed på fødevaren ud fra ingrediens-enhedens
 * navn (fx 'spsk', 'g', 'dl'). Falder tilbage til ingen enhed (= gram-portion).
 */
function vaelgEnhed(food: Fodevare, ingrediensEnhed: string): string | undefined {
	const e = ingrediensEnhed.toLowerCase().trim();
	if (!e || e === 'g') return undefined;
	const match = food.units?.find((u) => u.u.toLowerCase() === e);
	return match?.u;
}

/**
 * Matcher en liste af opskrift-ingredienser mod fødevaredatabasen.
 *
 * Returnerer en komplet liste af måltidsitems — både koblede og manuelle —
 * så ingen ingrediens "forsvinder". Manuelle items har foodId='' og bevarer
 * det oprindelige navn + enhed fra opskriften, så brugeren kan erstatte
 * dem med en koblet fødevare senere.
 *
 * ikkeMatchede returneres separat så kalderen kan vise en kvit-besked.
 *
 * Ingredienser med 0 mængde og uden navn springes helt over.
 */
export function matchIngredienserMaltid(
	ingredienser: OpskriftsIngrediens[],
	foods: Fodevare[]
): { items: MaaltidsItem[]; ikkeMatchede: OpskriftsIngrediens[] } {
	const items: MaaltidsItem[] = [];
	const ikkeMatchede: OpskriftsIngrediens[] = [];

	for (const ing of ingredienser) {
		if (!ing.navn) continue;
		const food = ing.maengde > 0 ? findFodevareForIngrediens(ing.navn, foods) : null;
		if (!food) {
			ikkeMatchede.push(ing);
			items.push({
				foodId: '',
				portion: ing.maengde,
				manuel: { navn: ing.navn, enhed: ing.enhed }
			});
			continue;
		}
		const enhedId = vaelgEnhed(food, ing.enhed);
		items.push({
			foodId: food.id,
			portion: ing.maengde,
			enhedId
		});
	}

	return { items, ikkeMatchede };
}
