// ============================================================
// Foedevare-databasen til 3.0, kopi foerst.
//
// HVORFOR DEN FINDES SOM EGEN FIL. Den samme liste hentes af firestore/
// kost.ts, men den fil bruges af den GAMLE app seks steder og maa derfor
// ikke aendres. Se regel 2 i CLAUDE.md. Den her er 3.0's egen indgang og
// henter praecis den samme samling.
//
// HVORFOR DET BETYDER NOGET LIGE HER. Listen er 2.268 raekker, langt den
// stoerste i hele appen. Foer ventede skaermen paa serveren hver gang, og
// imens saa mad-modulet tomt ud, ogsaa naar alle 2.268 laa paa telefonen
// i forvejen. Det var den ene ting i appen hvor kopi-foerst virkelig
// kunne maerkes.
//
// Det er ogsaa det ene sted hvor det betyder noget paa regningen. 2.268
// laesninger hver gang mad-modulet aabnes, gange antallet af kunder, er
// den eneste post i databasen der kan loebe op. Kopien koster nul.
//
// Naar admin retter en foedevare, skal BEGGE cacher ryddes: den her og
// kost.ts's egen. Se ryFodevarer3Cache.
// ============================================================

import type { DocumentData, QuerySnapshot } from 'firebase/firestore';
import type { Fodevare } from '$lib/content/kost';
import { hentSamlingHurtigt3 } from './lokalKopi3';
import { ryAlleFodevarerCache } from './kost';

let cache: Fodevare[] | null = null;
let iGang: Promise<Fodevare[]> | null = null;
let lytter: ((liste: Fodevare[]) => void) | null = null;

/** Samme sortering som den gamle indgang, saa de to giver samme liste. */
function omdan(snap: QuerySnapshot<DocumentData>): Fodevare[] {
	return snap.docs
		.map((d) => ({ id: d.id, ...d.data() }) as Fodevare)
		.sort((a, b) => a.name.localeCompare(b.name, 'da'));
}

/**
 * Hele foedevare-databasen, sorteret alfabetisk.
 *
 * `onFriske` kaldes kun hvis serveren har en anden liste end den du fik.
 * Tilfoejer Linn en foedevare mens kunden soeger, dukker den op naar det
 * stille tjek naar frem. Retter hun et TAL inde i en raekke, opdages det
 * foerst naeste gang listen hentes forfra, se erAendret3.
 */
export async function hentFodevarer3(onFriske?: (liste: Fodevare[]) => void): Promise<Fodevare[]> {
	lytter = onFriske ?? lytter;
	if (cache) return cache;
	if (iGang) return iGang;
	iGang = (async () => {
		try {
			const { liste } = await hentSamlingHurtigt3('fodevarer', omdan, (friske) => {
				cache = friske;
				lytter?.(friske);
			});
			cache = liste;
			return liste;
		} finally {
			iGang = null;
		}
	})();
	return iGang;
}

/**
 * Toemmer BEGGE cacher. Bruges naar admin har rettet en foedevare.
 *
 * Den gamle apps cache ryddes med, fordi de to indgange henter den samme
 * samling og ellers ville vise forskellige lister i den samme browser.
 */
export function ryFodevarer3Cache(): void {
	cache = null;
	iGang = null;
	lytter = null;
	ryAlleFodevarerCache();
}
