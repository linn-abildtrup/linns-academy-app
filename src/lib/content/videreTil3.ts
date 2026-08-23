// ============================================================
// Hvor var hun paa vej hen.
//
// HVORFOR DEN FINDES. Trykker hun paa en besked mens hun er logget ud,
// bliver hun sendt til login. Uden det her lander hun paa forsiden
// bagefter, og saa har beskeden reelt ikke virket: hun blev lovet et
// svar og fik en forside. Linns valg 23. august, se HANDOVER 9.41.
//
// DEN ER OGSAA EN LAAS. Adressen kommer fra en besked udefra, og den
// maa aldrig kunne sende hende ud af appen. Derfor accepteres KUN stier
// der begynder med /ny, og aldrig noget der peger paa et andet sted paa
// nettet. Se reneVidere3, hvor faelderne staar navngivet.
// ============================================================

/** Navnet paa adressen i webadressen. Ét sted, saa de tre skaerme er enige. */
export const VIDERE_NOEGLE3 = 'videre';

/**
 * Den sti vi tør sende hende videre til, eller null.
 *
 * FAELDERNE, og de er alle sammen rigtige angreb:
 *
 *  - "https://andetsted.dk" ville sende hende ud af appen
 *  - "//andetsted.dk" goer det samme, bare uden at ligne det
 *  - "/app/admin" ville sende hende ind i den gamle app
 *  - "javascript:" behoever ingen forklaring
 *
 * Alt der ikke begynder med /ny bliver til null, og saa lander hun paa
 * forsiden. Det er den kedelige og rigtige opfoersel.
 */
export function reneVidere3(raa: string | null | undefined): string | null {
	if (!raa) return null;
	const s = raa.trim();
	if (!s.startsWith('/')) return null;
	// To skraastreger i traek er en adresse ud af huset, ogsaa uden http.
	if (s.startsWith('//')) return null;
	if (s !== '/ny' && !s.startsWith('/ny/') && !s.startsWith('/ny?')) return null;
	// Ingen linjeskift eller mellemrum. De bruges til at snyde laesningen.
	if (/[\s\\]/.test(s)) return null;
	return s;
}

/** Login-adressen med den sti hun skal videre til bagefter. */
export function loginMedVidere3(sti: string): string {
	const ren = reneVidere3(sti);
	if (!ren || ren === '/ny') return '/ny/login';
	return `/ny/login?${VIDERE_NOEGLE3}=${encodeURIComponent(ren)}`;
}
