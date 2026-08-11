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

import { collection, getDocs } from 'firebase/firestore';
import { db } from '$lib/firebase';
import { parseOpskriftMakro, type DietTag, type Opskrift } from '$lib/content/opskrifter';
import { kategorier3, type Kategori3 } from '$lib/content/opskriftKategori3';

export interface Opskrift3 {
	id: string;
	titel: string;
	beskrivelse: string;
	billedeUrl: string | null;
	/** 3.0-kategorierne, hvor snack er sin egen. */
	kategorier3: Kategori3[];
	dietTags: DietTag[];
	ingredienser: { navn: string }[];
	protein: number | null;
	fiber: number | null;
	/** Hele det oprindelige dokument, saa OpskriftArk kan vise det. */
	raa: Opskrift;
}

function fraDoc(id: string, data: Record<string, unknown>): Opskrift3 {
	const raa = { id, ...data } as Opskrift;
	const makro = parseOpskriftMakro(raa.instruktioner ?? '');
	return {
		id,
		titel: raa.titel ?? '',
		beskrivelse: raa.beskrivelse ?? '',
		billedeUrl: raa.billedeUrl ?? null,
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

/** Alle aktive opskrifter, sorteret alfabetisk efter titel. */
export async function hentOpskrifter3(): Promise<Opskrift3[]> {
	if (cache) return cache;
	if (iGang) return iGang;
	iGang = (async () => {
		try {
			const snap = await getDocs(collection(db, 'opskrifter'));
			const liste = snap.docs
				.map((d) => fraDoc(d.id, d.data()))
				.filter((o) => (o.raa as { aktiv?: boolean }).aktiv !== false)
				.sort((a, b) => a.titel.localeCompare(b.titel, 'da'));
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
}
