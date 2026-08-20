// Indlaesning af opskrifter til 30-30 beregneren i 3.0.
//
// Hvorfor en ny indlaeser: den gamle (hentAlleOpskrifter) folder snack ind
// under andet, saa 15 snack-opskrifter ikke kan findes som snack. Vi maa ikke
// rette den gamle, for den er i drift. Det her er en ny laesning af de samme
// dokumenter, se opskriftKategori3.ts.
//
// Vi laeser hele samlingen én gang. Det er 130 dokumenter og cirka 190 KB,
// hvoraf de 189 KB er TO billeder gemt som base64 inde i dokumenterne. De
// billeder boer flyttes ud i Storage, se SPEC-3.0.md. Indtil da betaler
// listen for dem hver gang cachen er kold.

import type { DocumentData, QuerySnapshot } from 'firebase/firestore';
import { hentSamlingHurtigt3 } from './lokalKopi3';
import { db } from '$lib/firebase';
import { parseOpskriftMakro, type DietTag, type Opskrift } from '$lib/content/opskrifter';
import { visMakro } from '$lib/content/opskriftMakro3';
import { hentBeregninger, type Beregninger } from '$lib/firestore/opskriftBeregning3';
import { kategorier3, type Kategori3 } from '$lib/content/opskriftKategori3';

export interface Opskrift3 {
	id: string;
	titel: string;
	beskrivelse: string;
	/** Den STORE, 1000 px. Bruges af opskrift-arket og af hele den gamle app. */
	billedeUrl: string | null;
	/** Den LILLE, 480 px, til fliserne i gitteret. Se opskriftBillede3.ts. */
	billedeUrlLille: string | null;
	/** Stierne i Storage, saa gamle filer kan ryddes ved skift. */
	billedeSti: string | null;
	billedeStiLille: string | null;
	/** 3.0-kategorierne, hvor snack er sin egen. */
	kategorier3: Kategori3[];
	dietTags: DietTag[];
	ingredienser: { navn: string }[];
	protein: number | null;
	fiber: number | null;
	/** Hele det oprindelige dokument, saa OpskriftArk kan vise det. */
	raa: Opskrift;
}

function fraDoc(
	id: string,
	data: Record<string, unknown>,
	beregninger: Beregninger = {}
): Opskrift3 {
	const raa = { id, ...data } as Opskrift;
	// Beregnet makro foerst, det skrevne som reserve. Overlejringen sker
	// HER og ikke ude i siderne, saa der ikke findes et sted i 3.0 hvor
	// det gamle tal kan slippe igennem. Se SPEC-3.0.md 26.19.
	const makro = visMakro(
		id,
		raa.instruktioner ?? '',
		beregninger,
		parseOpskriftMakro(raa.instruktioner ?? '')
	);
	return {
		id,
		titel: raa.titel ?? '',
		beskrivelse: raa.beskrivelse ?? '',
		billedeUrl: raa.billedeUrl ?? null,
		billedeUrlLille: (data as { billedeUrlLille?: string | null }).billedeUrlLille ?? null,
		billedeSti: (data as { billedeSti?: string | null }).billedeSti ?? null,
		billedeStiLille: (data as { billedeStiLille?: string | null }).billedeStiLille ?? null,
		kategorier3: kategorier3((data as { kategorier?: unknown }).kategorier),
		dietTags: Array.isArray(raa.dietTags) ? raa.dietTags : [],
		ingredienser: Array.isArray(raa.ingredienser)
			? raa.ingredienser.map((i) => ({ navn: i?.navn ?? '' }))
			: [],
		protein: makro.protein,
		fiber: makro.fiber,
		raa
	};
}

// Egen cache pr session. Opskrifter aendres kun naar Linn redigerer dem, saa
// vi henter én gang og deler paa tvaers af alle kald i samme session.
let cache: Opskrift3[] | null = null;
let iGang: Promise<Opskrift3[]> | null = null;

/** Sat naar en side vil vide besked hvis serveren har noget nyere. */
let lytter: ((liste: Opskrift3[]) => void) | null = null;

/**
 * Alle aktive opskrifter, sorteret alfabetisk efter titel.
 *
 * KOPIEN FOERST. Foer ventede vi altid paa serveren, ogsaa naar alle 133
 * laa paa telefonen i forvejen, og saa stod skaermen og hentede noget vi
 * havde. Nu vises kopien med det samme og serveren spoerges stille
 * bagefter. Se firestore/lokalKopi3.
 *
 * `onFriske` kaldes kun hvis serveren har en anden liste end den du fik.
 * Retter Linn en opskrift mens kunden kigger, ser kunden den gamle i et
 * oejeblik. Det er en bevidst pris, se content/lokalKopi3.
 */
export async function hentOpskrifter3(
	onFriske?: (liste: Opskrift3[]) => void
): Promise<Opskrift3[]> {
	lytter = onFriske ?? lytter;
	if (cache) return cache;
	if (iGang) return iGang;
	iGang = (async () => {
		try {
			const beregninger = await hentBeregninger();
			const omdan = (snap: QuerySnapshot<DocumentData>) =>
				snap.docs
					.map((d) => fraDoc(d.id, d.data(), beregninger))
					.filter((o) => (o.raa as { aktiv?: boolean }).aktiv !== false)
					.sort((a, b) => a.titel.localeCompare(b.titel, 'da'));

			const { liste } = await hentSamlingHurtigt3('opskrifter', omdan, (friske) => {
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

/** Toemmer cachen. Bruges naar admin har rettet en opskrift. */
export function ryOpskrifter3Cache(): void {
	cache = null;
	iGang = null;
	lytter = null;
}
