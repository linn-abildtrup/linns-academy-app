// Proxy til OpenFoodFacts search-a-licious. Vi kalder OFF server-side
// fordi deres preflight-respons mangler Access-Control-Allow-Origin
// header, hvilket faar browseren til at blokere direkte POST-kald fra
// klient-side.

import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

const OFF_FIELDS = [
	'code',
	'product_name',
	'product_name_da',
	'generic_name',
	'generic_name_da',
	'brands',
	'categories_tags',
	'nutriments',
	'image_front_small_url'
];

export const GET: RequestHandler = async ({ url, fetch }) => {
	const q = url.searchParams.get('q')?.trim() ?? '';
	if (q.length < 3) return json({ hits: [] });

	try {
		const res = await fetch('https://search.openfoodfacts.org/search', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json'
			},
			body: JSON.stringify({
				q,
				countries_tags: 'en:denmark',
				page_size: 20,
				fields: OFF_FIELDS
			})
		});
		if (!res.ok) {
			return json({ hits: [] }, { status: 200 });
		}
		const data = await res.json();
		return json({ hits: data.hits ?? [] });
	} catch (e) {
		console.warn('OFF proxy fejlede:', e);
		return json({ hits: [] }, { status: 200 });
	}
};
