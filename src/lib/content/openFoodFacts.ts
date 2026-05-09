// Open Food Facts (OFF) lookup. Bruges af stregkode-scanneren for at
// finde produkt-data (navn + næringsindhold pr 100g) ud fra en EAN/UPC.
//
// API-doc: https://openfoodfacts.github.io/openfoodfacts-server/api/
// Endpoint: https://world.openfoodfacts.org/api/v2/product/{barcode}.json
//
// OFF har god dækning på dansk-mærkede produkter, men ikke 100%. Når koden
// ikke findes (status:0) returnerer vi null og kalderen skal bede brugeren
// indtaste manuelt.

import type { Kategori } from './kost';

export interface OffResultat {
	barcode: string;
	navn: string;
	protein: number; // pr 100g
	fiber: number; // pr 100g
	kh: number; // kulhydrater pr 100g
	fedt: number; // fedt pr 100g
	kcal: number; // kalorier pr 100g
	katForslag: Kategori;
	billedeUrl?: string;
}

interface OffNutriments {
	proteins_100g?: number;
	fiber_100g?: number;
	carbohydrates_100g?: number;
	fat_100g?: number;
	'energy-kcal_100g'?: number;
	'energy_100g'?: number;
	proteins?: number;
	fiber?: number;
	carbohydrates?: number;
	fat?: number;
	'energy-kcal'?: number;
}

interface OffProduct {
	product_name?: string;
	product_name_da?: string;
	generic_name?: string;
	generic_name_da?: string;
	brands?: string;
	categories_tags?: string[];
	nutriments?: OffNutriments;
	image_front_small_url?: string;
	image_url?: string;
}

interface OffResponse {
	status: number; // 1 = found, 0 = not found
	product?: OffProduct;
}

/**
 * Slår en stregkode op i Open Food Facts. Returnerer null hvis ikke fundet,
 * eller hvis netværket fejler.
 */
export async function lookupBarcode(barcode: string): Promise<OffResultat | null> {
	const ren = barcode.replace(/\D/g, '');
	if (ren.length < 6) return null;
	try {
		const res = await fetch(
			`https://world.openfoodfacts.org/api/v2/product/${ren}.json`,
			{
				headers: {
					Accept: 'application/json'
				}
			}
		);
		if (!res.ok) return null;
		const data = (await res.json()) as OffResponse;
		if (data.status !== 1 || !data.product) return null;
		const p = data.product;
		const navn =
			p.product_name_da?.trim() ||
			p.product_name?.trim() ||
			p.generic_name_da?.trim() ||
			p.generic_name?.trim() ||
			'';
		if (!navn) return null;
		const n = p.nutriments ?? {};
		const protein = n.proteins_100g ?? n.proteins ?? 0;
		const fiber = n.fiber_100g ?? n.fiber ?? 0;
		const kh = n.carbohydrates_100g ?? n.carbohydrates ?? 0;
		const fedt = n.fat_100g ?? n.fat ?? 0;
		// OFF angiver kalorier i 'energy-kcal_100g' (primær). 'energy_100g' er
		// nogle gange kJ — vi bruger kun den hvis kcal-feltet mangler og
		// regner om hvis værdien tydeligvis er kJ (>900 = umuligt for mad).
		let kcal = n['energy-kcal_100g'] ?? n['energy-kcal'] ?? 0;
		if (!kcal) {
			const energy = n.energy_100g ?? 0;
			kcal = energy > 900 ? energy / 4.184 : energy;
		}
		return {
			barcode: ren,
			navn: p.brands ? `${navn} (${p.brands})` : navn,
			protein: Math.round(protein * 10) / 10,
			fiber: Math.round(fiber * 10) / 10,
			kh: Math.round(kh * 10) / 10,
			fedt: Math.round(fedt * 10) / 10,
			kcal: Math.round(kcal),
			katForslag: foreslaaKategori(p.categories_tags ?? []),
			billedeUrl: p.image_front_small_url || p.image_url
		};
	} catch (e) {
		console.warn('OFF-opslag fejlede:', e);
		return null;
	}
}

/**
 * Mapper OFF-kategori-tags til vores 11 kategorier. Returnerer 'andet' hvis
 * ingen match — brugeren kan altid override i UI.
 *
 * OFF tags ser sådan ud: ['en:dairies', 'en:cheeses', 'en:hard-cheeses']
 * — vi tjekker mod alle og første match vinder.
 */
function foreslaaKategori(tags: string[]): Kategori {
	const t = tags.map((s) => s.toLowerCase());

	const matcher = (...keywords: string[]) =>
		t.some((tag) => keywords.some((k) => tag.includes(k)));

	if (matcher('dairy', 'dairies', 'cheese', 'milk', 'yogurt', 'mejeri'))
		return 'mejeri';
	if (matcher('fish', 'seafood', 'fisk')) return 'fisk';
	if (
		matcher(
			'meat',
			'beef',
			'pork',
			'chicken',
			'poultry',
			'lamb',
			'koed',
			'sausage'
		)
	)
		return 'koed';
	if (matcher('legume', 'beans', 'lentils', 'pulse', 'baelg', 'chickpea'))
		return 'baelg';
	if (
		matcher(
			'cereal',
			'bread',
			'pasta',
			'rice',
			'oat',
			'wheat',
			'rye',
			'korn',
			'breakfast-cereal',
			'flour'
		)
	)
		return 'korn';
	if (matcher('vegetable', 'gront', 'gemyse', 'salads')) return 'gront';
	if (matcher('fruit', 'berry', 'baer', 'frugt')) return 'baer';
	if (matcher('nuts', 'seed', 'noedder', 'almond', 'peanut')) return 'noedder';
	if (matcher('protein-supplement', 'whey', 'protein-bar', 'shake'))
		return 'prot';
	if (
		matcher(
			'beverage',
			'drink',
			'water',
			'juice',
			'soda',
			'beer',
			'wine',
			'coffee',
			'tea',
			'drikke'
		)
	)
		return 'drikke';
	return 'andet';
}
