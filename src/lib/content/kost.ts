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
export interface Fodevare {
	id: string;
	name: string;
	cat: Kategori;
	p: number;
	f: number;
	units?: Enhed[];
	liquid?: boolean;
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
export function beregnItem(
	item: MaaltidsItem,
	food: Fodevare | undefined
): { protein: number; fiber: number; gram: number } {
	if (erManueltItem(item) || !food) return { protein: 0, fiber: 0, gram: 0 };
	const gramPrEnhed = gramForEnhed(food, item.enhedId);
	const totalGram = item.portion * gramPrEnhed;
	return {
		protein: (food.p * totalGram) / 100,
		fiber: (food.f * totalGram) / 100,
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
): { protein: number; fiber: number } {
	let protein = 0;
	let fiber = 0;
	for (const item of items) {
		const r = beregnItem(item, foods.get(item.foodId));
		protein += r.protein;
		fiber += r.fiber;
	}
	return { protein, fiber };
}

/**
 * Procentvis fremgang mod et mål, cappet på 100.
 */
export function procentMod(maal: number, vaerdi: number): number {
	if (maal <= 0) return 0;
	return Math.min(100, Math.round((vaerdi / maal) * 100));
}

/**
 * Formaterer et gram-tal med højst én decimal og 'g'-suffix.
 * Fjerner unødvendigt '.0'.
 */
export function formatGram(g: number): string {
	if (g === 0) return '0g';
	const rundet = Math.round(g * 10) / 10;
	if (rundet === Math.round(rundet)) return `${Math.round(rundet)}g`;
	return `${rundet}g`;
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
 * Finder den bedst matchende fødevare for en ingrediens-streng.
 *
 * Strategi (i prioritet):
 *   1. Eksakt match på lower-cased navn
 *   2. Fødevare-navn starter med ingrediens-navnet (efter lower-case)
 *   3. Ingrediens-navnet er indeholdt i fødevare-navnet
 *
 * Hvis flere matches, foretrækkes den med det korteste navn (mest generel).
 */
export function findFodevareForIngrediens(
	ingrediensNavn: string,
	foods: Fodevare[]
): Fodevare | null {
	const q = ingrediensNavn.toLowerCase().trim();
	if (!q) return null;

	const eksakt = foods.find((f) => f.name.toLowerCase() === q);
	if (eksakt) return eksakt;

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
