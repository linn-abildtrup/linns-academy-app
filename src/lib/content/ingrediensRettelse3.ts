// ============================================================
// Naar Linn retter en foedevares naeringstal.
//
// LINNS REGEL 1. SEPTEMBER 2026, og hele filen hviler paa den:
// der findes ét saet tal, og det er vores. Databasens officielle tal som
// udgangspunkt, og har Linn rettet et, er det hendes der gaelder. Baade
// naar opskrifterne regnes OG naar en kunde taster varen ind selv.
//
// DERFOR SKRIVES DER PAA SELVE FOEDEVAREN og ikke i en ny samling ved
// siden af. Begge apper laeser allerede foedevarerne det sted, saa
// rettelsen virker begge steder uden at der skal aendres én linje i det
// kunderne bruger. Alternativet var at laere begge apper at kigge to
// steder, og det ville betyde aendringer i noget 925 kunder er
// afhaengige af. Se regel 10 i CLAUDE.md: den mindst risikable loesning
// frem for den paeneste.
//
// DET OPRINDELIGE TAL GEMMES, én gang og aldrig igen. Retter Linn den
// samme vare to gange, peger `foerRettelse` stadig paa det DTU sagde.
// Ellers ville anden rettelse goere den foerste permanent, og fortryd
// ville foere tilbage til et mellemtrin ingen har valgt.
//
// KUNDEN SER INGEN FORSKEL. Hun ser tallet, og ikke hvor det kommer fra.
// Linns besked 1. september. Noten er Linns egen og staar kun i admin.
//
// OG OPSKRIFTERNE SKAL REGNES OM I SAMME OEJEBLIK. De 133 opskrifters
// makro er regnet ud paa forhaand og gemt. De regner sig ikke om af sig
// selv. Det skete 24. august, hvor de to kilder i elleve minutter sagde
// forskellige ting om den samme mad. Se opgoerAendringer nedenfor.
// ============================================================

import type { Fodevare } from './kost';
import type { KildeFelter } from './fodevareKilde3';
import { tjekNaering } from './openFoodFacts';

/** De fem tal, pr 100 g, som de staar i felterne paa skaermen. */
export interface RettedeTal {
	p: number | null;
	f: number | null;
	kh: number | null;
	fedt: number | null;
	kcal: number | null;
}

/** Det oprindelige tal, gemt saa en rettelse altid kan fortrydes. */
export interface FoerRettelse {
	p: number;
	f: number;
	kh?: number;
	fedt?: number;
	kcal?: number;
	kildeType?: 'dtu' | 'linn' | 'scannet';
}

/** Felterne en rettelse laegger paa foedevaren. Alle er additive. */
export interface RettelseFelter {
	linnRettet?: boolean;
	/** Linns egen begrundelse. KUN admin ser den. */
	linnNote?: string;
	foerRettelse?: FoerRettelse;
}

export type RettbarVare = Fodevare & KildeFelter & RettelseFelter;

export interface Fejl {
	felt: keyof RettedeTal | 'note' | 'alle';
	tekst: string;
}

/**
 * Er tallene til at gemme?
 *
 * Protein og fiber SKAL vaere der. De to er hele konceptet i 30-30, og
 * en vare uden dem er ubrugelig i praecis det modul.
 *
 * De tre andre maa gerne staa tomme. Saa staar varen som foer, altsaa
 * uden udvidet naering, i stedet for at faa et nul der ligner et tal.
 */
export function valider(tal: RettedeTal, note: string): Fejl[] {
	const fejl: Fejl[] = [];
	const felter: (keyof RettedeTal)[] = ['p', 'f', 'kh', 'fedt', 'kcal'];

	for (const felt of felter) {
		const v = tal[felt];
		if (v === null) continue;
		if (!Number.isFinite(v)) {
			fejl.push({ felt, tekst: 'Skriv et tal' });
		} else if (v < 0) {
			fejl.push({ felt, tekst: 'Kan ikke være under nul' });
		} else if (felt !== 'kcal' && v > 100) {
			// Tallene er pr 100 gram, saa mere end 100 g af noget i 100 g
			// er umuligt. Det fanger den klassiske fejl hvor hele pakkens
			// tal bliver tastet i stedet for tallene pr 100 g.
			fejl.push({ felt, tekst: 'Kan ikke være over 100 g pr 100 g' });
		} else if (felt === 'kcal' && v > 900) {
			// Rent fedt er 900. Mere findes ikke.
			fejl.push({ felt, tekst: 'Over 900 kcal pr 100 g er ikke muligt' });
		}
	}

	if (tal.p === null) fejl.push({ felt: 'p', tekst: 'Protein skal udfyldes' });
	if (tal.f === null) fejl.push({ felt: 'f', tekst: 'Fiber skal udfyldes' });

	// Noten er ikke pynt. Om et halvt aar er den det eneste der forklarer
	// hvorfor varen staar til noget andet end databasen siger.
	if (!note.trim()) fejl.push({ felt: 'note', tekst: 'Skriv kort hvorfor du retter tallet' });

	return fejl;
}

/**
 * Advarsler der IKKE spaerrer for at gemme.
 *
 * Der bruges den samme kontrol som scanneren, `tjekNaering`. To steder
 * der doemmer naeringstal forskelligt er vaerre end ét sted der doemmer
 * dem lidt for haardt. Bemaerk at et rent fiberprodukt giver falsk alarm,
 * og at det er accepteret, se noten i openFoodFacts.
 */
export function advarsler(tal: RettedeTal): string[] {
	if (tal.p === null || tal.f === null) return [];
	const t = tjekNaering({
		kcal: tal.kcal ?? undefined,
		protein: tal.p,
		fiber: tal.f,
		kh: tal.kh ?? undefined,
		fedt: tal.fedt ?? undefined
	});
	return t.advarsler ?? [];
}

/** Tallene som de staar paa varen i dag, klar til felterne. */
export function talFra(v: RettbarVare): RettedeTal {
	return {
		p: typeof v.p === 'number' ? v.p : null,
		f: typeof v.f === 'number' ? v.f : null,
		kh: typeof v.kh === 'number' ? v.kh : null,
		fedt: typeof v.fedt === 'number' ? v.fedt : null,
		kcal: typeof v.kcal === 'number' ? v.kcal : null
	};
}

/** Har et af de fem tal flyttet sig? Uden det gemmer vi for ingenting. */
export function noget(gamle: RettedeTal, nye: RettedeTal): boolean {
	return (
		gamle.p !== nye.p ||
		gamle.f !== nye.f ||
		gamle.kh !== nye.kh ||
		gamle.fedt !== nye.fedt ||
		gamle.kcal !== nye.kcal
	);
}

/**
 * Det oprindelige tal, som det skal gemmes.
 *
 * SKRIVES KUN FOERSTE GANG. Findes der allerede et, er det dét der
 * gaelder, ellers ville anden rettelse goere den foerste permanent.
 */
export function foerRettelseAf(v: RettbarVare): FoerRettelse {
	if (v.foerRettelse) return v.foerRettelse;
	const ud: FoerRettelse = { p: Number(v.p) || 0, f: Number(v.f) || 0 };
	if (typeof v.kh === 'number') ud.kh = v.kh;
	if (typeof v.fedt === 'number') ud.fedt = v.fedt;
	if (typeof v.kcal === 'number') ud.kcal = v.kcal;
	if (v.kildeType) ud.kildeType = v.kildeType;
	return ud;
}

/**
 * Felterne der skal skrives paa foedevaren.
 *
 * Kilden saettes til 'linn', for tallet er ikke laengere databasens, og
 * vi maa ikke skrive DTU paa noget vi selv har aendret. Kunden ser den
 * samme maerkat som foer, se kildeAf i fodevareKilde3, saa der sker
 * ingen synlig aendring for hende.
 *
 * Et tomt felt skrives som null, ikke som nul. Nul ville betyde at varen
 * ikke indeholder noget, og det er ikke det samme som at vi ikke ved det.
 */
export function skrivefelter(
	v: RettbarVare,
	tal: RettedeTal,
	note: string
): Record<string, unknown> {
	return {
		p: tal.p,
		f: tal.f,
		kh: tal.kh,
		fedt: tal.fedt,
		kcal: tal.kcal,
		kildeType: 'linn',
		linnRettet: true,
		linnNote: note.trim(),
		foerRettelse: foerRettelseAf(v)
	};
}

/**
 * Felterne der saetter varen tilbage.
 *
 * Kilden gaar tilbage til det den var, altsaa som regel 'dtu'. Uden det
 * ville en fortrudt rettelse efterlade varen med databasens tal og Linns
 * navn paa.
 */
export function fortrydFelter(v: RettbarVare): Record<string, unknown> | null {
	const f = v.foerRettelse;
	if (!f) return null;
	return {
		p: f.p,
		f: f.f,
		kh: f.kh ?? null,
		fedt: f.fedt ?? null,
		kcal: f.kcal ?? null,
		kildeType: f.kildeType ?? null,
		linnRettet: false,
		linnNote: null
	};
}

/** Én opskrift hvis tal flyttede sig, saa Linn kan se hvad rettelsen gjorde. */
export interface Aendring {
	opskriftId: string;
	titel: string;
	foerProtein: number;
	efterProtein: number;
	foerKalorier: number;
	efterKalorier: number;
}

/**
 * Hvilke opskrifter flyttede sig, da tallene blev regnet om?
 *
 * Der sammenlignes paa protein og kalorier. Flytter ingen af de to sig,
 * er der ikke noget Linn skal forholde sig til.
 *
 * Der rundes til én decimal foer sammenligningen. Uden det ville
 * 32,299999999 mod 32,3 taelle som en aendring, og saa ville listen
 * vaere fuld af opskrifter der ikke har flyttet sig.
 */
export function opgoerAendringer(
	foer: Record<string, { protein: number; kalorier: number }>,
	efter: Record<string, { protein: number; kalorier: number }>,
	titler: Record<string, string>
): Aendring[] {
	const en = (x: number) => Math.round(x * 10) / 10;
	const ud: Aendring[] = [];
	for (const [id, e] of Object.entries(efter)) {
		const f = foer[id];
		if (!f) continue;
		if (en(f.protein) === en(e.protein) && en(f.kalorier) === en(e.kalorier)) continue;
		ud.push({
			opskriftId: id,
			titel: titler[id] ?? id,
			foerProtein: en(f.protein),
			efterProtein: en(e.protein),
			foerKalorier: en(f.kalorier),
			efterKalorier: en(e.kalorier)
		});
	}
	return ud.sort((a, b) => a.titel.localeCompare(b.titel, 'da'));
}
