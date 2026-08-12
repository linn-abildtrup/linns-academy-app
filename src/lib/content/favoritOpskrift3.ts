// ============================================================
// Favorit-opskrifter i 3.0.
//
// HVAD EN FAVORIT ER HER: et BOGMAERKE, ikke et gemt maaltid. Vi husker kun
// hvilke opskrifter hun har markeret, altsaa en liste af opskrift-id'er.
//
// Hvorfor det er vigtigt: Linn besluttede 12. august at et tryk paa en
// favorit skal AABNE opskriften som i dag, saa hun kan saette portioner, og
// ikke lægge den direkte i. Dermed skal vi ikke kopiere protein og fiber
// nogen steder hen. Makroen laeses fra opskriften i det oejeblik hun trykker
// "Laeg i", praecis som den kode der allerede koerer. Havde vi i stedet gemt
// et faerdigt maaltid, ville makroen skulle med, og en favorit uden makro
// ville stille og roligt logge 0 g protein. Se SPEC-3.0.md.
//
// HVOR DE LIGGER: userDoc.favoritOpskrifter, et array af id'er. Det er samme
// moenster som favoritFodevarer, der allerede findes i den gamle app, saa der
// er ikke opfundet noget nyt. Feltet er additivt, og den gamle app laeser det
// ikke, saa den opdager ingenting.
//
// Bemaerk at feltet med vilje IKKE er skrevet ind i lib/types.ts. Den fil er
// delt med den app der er i drift og maa ikke aendres, se CLAUDE.md regel 2.
// Derfor laeses feltet gennem favoritterFra() her, saa castet ligger ét sted
// og kan testes.
// ============================================================

/** Navnet paa feltet paa kundens dokument. */
export const FAVORIT_FELT = 'favoritOpskrifter';

/**
 * Kundens favorit-opskrifter, laest sikkert af hendes dokument.
 *
 * Taaler at feltet mangler helt, hvilket er tilstanden for alle kunder indtil
 * de markerer deres foerste. Taaler ogsaa at der skulle ligge noget maerkeligt
 * i feltet, for vi kan ikke vide hvad et gammelt dokument indeholder. Alt der
 * ikke er en ikke-tom tekst, sorteres fra.
 */
export function favoritterFra(userDoc: unknown): string[] {
	const raa = (userDoc as Record<string, unknown> | null | undefined)?.[FAVORIT_FELT];
	if (!Array.isArray(raa)) return [];
	const ud: string[] = [];
	for (const x of raa) {
		if (typeof x !== 'string') continue;
		const t = x.trim();
		// Dubletter kan ikke opstaa via skiftFavorit, men et gammelt eller
		// haandredigeret dokument kunne have dem, og saa ville fanen taelle
		// forkert.
		if (t && !ud.includes(t)) ud.push(t);
	}
	return ud;
}

/** Er den her opskrift markeret? */
export function erFavorit(favoritter: readonly string[], opskriftId: string): boolean {
	if (!opskriftId) return false;
	return favoritter.includes(opskriftId);
}

/**
 * Slaar favoritten til eller fra og giver den nye liste tilbage.
 *
 * Rører aldrig den liste der kom ind, saa den kan bruges direkte som ny
 * tilstand i en komponent uden at noget aendrer sig bag ryggen paa Svelte.
 *
 * Nye laegges bagest, saa raekkefoelgen fortaeller hvornaar hun markerede dem.
 */
export function skiftFavorit(favoritter: readonly string[], opskriftId: string): string[] {
	if (!opskriftId) return [...favoritter];
	return erFavorit(favoritter, opskriftId)
		? favoritter.filter((id) => id !== opskriftId)
		: [...favoritter, opskriftId];
}

/**
 * Navnet paa hjerte-knappen, til skaermlaesere. Knappen har kun et ikon, saa
 * uden den her ville den blive laest op som "knap" og ikke andet.
 *
 * Navnet skifter MED VILJE ikke naar hun trykker. Knappen er en kontakt, og
 * tilstanden meldes af aria-pressed, saa VoiceOver siger "Favorit, til" og
 * "Favorit, fra". Skiftede navnet ogsaa, ville hun faa begge dele paa én
 * gang, fx "Fjern fra favoritter, til", og saa er det uklart om det er
 * tilstanden eller handlingen der bliver laest op.
 */
export const HJERTE_ETIKET = 'Favorit';
