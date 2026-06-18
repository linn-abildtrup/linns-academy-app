// Fælles, fleksibelt søge-match for klient-søgefelter i admin.
//
// Mål (besluttet med Linn 18/6 2026):
//  - flere ord i vilkårlig rækkefølge ("jensen anna" finder "Anna Jensen")
//  - delsøgning ("jen" finder "Jensen")
//  - ignorér danske bogstaver + accenter ("soren" finder "Søren")
//  - tolerér små stavefejl ("jensn" finder "Jensen")
//  - søg på tværs af navn OG email
//
// Brug klientSoegeMatch(haystack, query) hvor haystack typisk er
// `${fornavn} ${efternavn} ${email}`.

/**
 * Normaliserer en streng til søgning: små bogstaver, danske bogstaver foldet
 * (æ/ø/å → a/o/a) og diakritik fjernet (é → e), så man slipper for at skrive
 * tegnene præcist.
 */
export function normaliserSoeg(s: string): string {
	return (s ?? '')
		.toLowerCase()
		.replace(/æ/g, 'a')
		.replace(/ø/g, 'o')
		.replace(/å/g, 'a')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '');
}

/**
 * Mindste redigeringsafstand (Levenshtein) mellem `needle` og ET VILKÅRLIGT
 * delstykke af `hay`. Bruges til at finde et fuzzy delstrengs-match: 0 = needle
 * findes som delstreng, 1 = ét forkert/manglende/ekstra tegn, osv.
 */
export function fuzzySubstringDist(needle: string, hay: string): number {
	const n = needle.length;
	const m = hay.length;
	if (n === 0) return 0;
	// Første række = 0 overalt: et match må starte hvor som helst i hay.
	let prev = new Array(m + 1).fill(0);
	for (let i = 1; i <= n; i++) {
		const cur = new Array(m + 1).fill(0);
		cur[0] = i; // de første i tegn af needle slettet
		for (let j = 1; j <= m; j++) {
			const cost = needle[i - 1] === hay[j - 1] ? 0 : 1;
			cur[j] = Math.min(prev[j - 1] + cost, prev[j] + 1, cur[j - 1] + 1);
		}
		prev = cur;
	}
	// Et match må slutte hvor som helst → tag minimum i sidste række.
	let best = n;
	for (let j = 0; j <= m; j++) best = Math.min(best, prev[j]);
	return best;
}

/**
 * Er `haystack` et træf for `query`? Hvert ord i query skal findes (som
 * delstreng eller med små stavefejl) et sted i haystack. Tom query = træf.
 * Stavefejls-tolerancen skaleres med ordlængden, så korte ord ikke giver
 * falske træf: ≤3 tegn = præcis delsøgning, 4-6 tegn = 1 fejl, 7+ = 2 fejl.
 */
export function klientSoegeMatch(haystack: string, query: string): boolean {
	const nq = normaliserSoeg(query).trim();
	if (!nq) return true;
	const nh = normaliserSoeg(haystack);
	const ord = nq.split(/\s+/).filter(Boolean);
	return ord.every((o) => {
		if (nh.includes(o)) return true;
		const maxDist = o.length <= 3 ? 0 : o.length <= 6 ? 1 : 2;
		if (maxDist === 0) return false;
		return fuzzySubstringDist(o, nh) <= maxDist;
	});
}
