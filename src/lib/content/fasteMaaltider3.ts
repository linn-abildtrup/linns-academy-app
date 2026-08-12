// ============================================================
// Faste maaltider i 30-30 beregneren. Se SPEC-3.0.md afsnit 26.10.
//
// Hun kan gemme det maaltid hun lige har tastet, og laegge det i igen
// med ét tryk. Det den gamle app kalder "byg maaltid" og gemmer i
// samlingen favoritmaaltider.
//
// MAALT PAA RIGTIGE DATA 12. august 2026, alle 616 kunder:
//   2.905 faste maaltider hos 365 kunder, altsaa 59 %
//   median 5 varelinjer, men 33 % har kun ÉN
//   49 % af dem med to linjer eller flere er brugt de sidste 90 dage
//   76 % bruges ALTID til det samme maaltid
//   kun 3 % er nogensinde blevet redigeret
//   48 % af al brug er morgenmad, aftensmad kun 9 %
//
// TRE TING DER FOELGER AF MAALINGERNE:
//   1. maaltidstypen skal med, saa hendes morgenmad ligger oeverst naar
//      hun staar i morgenmad. De 2.905 der findes har den ikke, saa den
//      gaettes ud af hendes egen historik
//   2. mest brugte oeverst. Halvdelen af hylden bliver aldrig roert
//   3. ingen redigér-skaerm. Hun retter det mens hun bruger det, se
//      erAendret nedenfor. Linns beslutning 12. august
//
// DEN VIGTIGSTE REGEL I FILEN:
// En linje uden foodId kan IKKE komme med. Makroen paa et fast maaltid
// regnes ved at slaa hver linje op i foedevare-databasen, og en linje
// uden opslag taeller nul. Det er praecis den fejl der allerede findes
// i drift paa 178 af de 2.905, hvor kunden logger mindre end hun spiste.
// Vi siger det hoejt i stedet, se delLinjer.
// ============================================================

import {
	MAALTIDSTYPE_LABELS,
	type GemtMaaltid,
	type MaaltidsItem,
	type Maaltidstype
} from './kost';

/**
 * Et gemt maaltid hun kan laegge i igen.
 *
 * Ligger i den GAMLE samling users/{uid}/favoritmaaltider, saa et fast
 * maaltid lavet i 3.0 ogsaa virker i den app der er i drift, og de
 * 2.905 der findes virker i 3.0 fra dag ét.
 *
 * `maaltid` er nyt og findes ikke paa de gamle. Den gamle app laeser
 * kun de felter den kender og opdager ingenting.
 */
export interface FastMaaltid {
	id: string;
	navn: string;
	items: MaaltidsItem[];
	maaltid?: Maaltidstype;
}

/** Ét maaltids-dokument fra hendes historik, med dagen paa. */
export interface DagsMaaltid {
	dato: string;
	type: Maaltidstype;
	items: { foodId?: string }[];
}

/** Hvor tit et fast maaltid er brugt, og hvilket maaltid det hoerer til. */
export interface Brug {
	/** Antal dage kombinationen har staaet i maaltidet. */
	antal: number;
	/** Det maaltid hun oftest bruger det til. */
	maaltid?: Maaltidstype;
}

// ============================================================
// Hvad der kan gemmes
// ============================================================

/**
 * En opskrift eller et andet fast maaltid er lagt i som ÉN linje med et
 * navn og ingen foodId. Den kan ikke gemmes videre, for der er intet at
 * slaa op naar makroen skal regnes naeste gang.
 */
export function kanKommeMed(item: MaaltidsItem): boolean {
	return !!item.foodId;
}

/**
 * Deler det hun har i maaltidet i det der kan gemmes og det der ikke kan.
 * `uden` er navnene, saa skaermen kan sige hvad der bliver droppet og
 * hvorfor, i stedet for lydloest at gemme en linje der taeller nul.
 */
export function delLinjer(poster: GemtMaaltid[]): { med: MaaltidsItem[]; uden: string[] } {
	const med: MaaltidsItem[] = [];
	const uden: string[] = [];
	for (const p of poster) {
		for (const it of p.items ?? []) {
			if (kanKommeMed(it)) med.push(it);
			else uden.push(it.manuel?.navn?.trim() || p.navn);
		}
	}
	return { med, uden };
}

/**
 * Navnet vi foreslaar i gem-arket, saa hun kan trykke gem uden at skrive.
 *
 * Én madvare faar madvarens eget navn, fx Skyr. Flere faar maaltidets
 * navn, fx Morgenmad. Samme regel som den gamle app bruger, saa de to
 * apper foreslaar det samme.
 */
export function foreslaaNavn(poster: GemtMaaltid[], type: Maaltidstype): string {
	const brugbare = poster.filter((p) => (p.items ?? []).some(kanKommeMed));
	if (brugbare.length === 1) {
		const p = brugbare[0];
		const linjer = (p.items ?? []).filter(kanKommeMed);
		if (linjer.length === 1) return p.navn;
	}
	return MAALTIDSTYPE_LABELS[type];
}

export function rensNavn(navn: string): string {
	return navn.trim().replace(/\s+/g, ' ');
}

export function navnDuger(navn: string): boolean {
	return rensNavn(navn).length > 0;
}

// ============================================================
// Fingeraftryk. To stykker, og de maa ikke byttes om
// ============================================================

/**
 * KUN madvarerne. Bruges til at taelle hvor tit noget er brugt, hvor
 * maengden godt maa svinge. 40 g havregryn den ene dag og 60 den anden
 * er stadig den samme morgenmad.
 */
export function vareAftryk(items: { foodId?: string }[] | undefined): string {
	return (items ?? [])
		.map((i) => i.foodId ?? '')
		.filter(Boolean)
		.sort()
		.join('|');
}

/**
 * Madvarerne MED maengde og enhed. Bruges til at se om hun har aendret
 * noget, hvor maengden netop betyder noget. Fjerner hun 50 g blaabaer
 * og laegger 100 i, er det en aendring.
 */
export function linjeAftryk(items: MaaltidsItem[] | undefined): string {
	return (items ?? [])
		.filter(kanKommeMed)
		.map((i) => `${i.foodId}:${i.portion ?? 0}:${i.enhedId ?? 'g'}`)
		.sort()
		.join('|');
}

// ============================================================
// Hvor tit bruges det, og til hvilket maaltid
// ============================================================

/**
 * Taeller hvor mange dage hvert fast maaltid har staaet i maaltidet, og
 * gaetter hvilket maaltid det hoerer til.
 *
 * VIGTIGT om formen: den gamle app skriver ét dokument med alle
 * varelinjerne i, mens 3.0 skriver ét dokument pr madvare. Derfor kan
 * vi ikke sammenligne dokument for dokument. Vi laegger foerst hele
 * dagens maaltid sammen, og et fast maaltid taeller med hvis ALLE dets
 * madvarer staar der. At der ogsaa staar en banan ved siden af goer
 * ikke at hun ikke brugte det.
 */
export function brugsstatistik(
	historik: DagsMaaltid[],
	faste: FastMaaltid[]
): Map<string, Brug> {
	// Dagens maaltid samlet: alle madvarer paa tvaers af dokumenterne.
	const pladser = new Map<string, { type: Maaltidstype; varer: Set<string> }>();
	for (const m of historik) {
		const noegle = `${m.dato}|${m.type}`;
		const p = pladser.get(noegle) ?? { type: m.type, varer: new Set<string>() };
		for (const it of m.items ?? []) if (it.foodId) p.varer.add(it.foodId);
		pladser.set(noegle, p);
	}

	const ud = new Map<string, Brug>();
	for (const f of faste) {
		const varer = [...new Set((f.items ?? []).map((i) => i.foodId).filter(Boolean))] as string[];
		if (varer.length === 0) {
			ud.set(f.id, { antal: 0 });
			continue;
		}
		let antal = 0;
		const typer = new Map<Maaltidstype, number>();
		for (const p of pladser.values()) {
			if (!varer.every((v) => p.varer.has(v))) continue;
			antal++;
			typer.set(p.type, (typer.get(p.type) ?? 0) + 1);
		}
		const hyppigste = [...typer.entries()].sort((a, b) => b[1] - a[1])[0];
		ud.set(f.id, { antal, maaltid: hyppigste?.[0] });
	}
	return ud;
}

/**
 * Hvilket maaltid et fast maaltid hoerer til.
 *
 * Feltet vinder, for det er hendes eget valg. Findes det ikke, og det
 * goer det ikke paa de 2.905 fra den gamle app, gaetter vi ud af hendes
 * historik. Tre ud af fire bruges altid til det samme maaltid, saa
 * gaettet rammer som regel.
 */
export function maaltidFor(fast: FastMaaltid, brug: Brug | undefined): Maaltidstype | undefined {
	return fast.maaltid ?? brug?.maaltid;
}

// ============================================================
// Hylden
// ============================================================

export interface Hylde {
	/** Dem der hoerer til det maaltid hun staar i. */
	tilMaaltidet: FastMaaltid[];
	/** Resten. De skjules ikke, for saa ville tallet paa hylden lyve. */
	andre: FastMaaltid[];
}

/**
 * Deler hylden i to og saetter mest brugte oeverst i begge.
 * Halvdelen af hylden bliver aldrig roert, saa den der er brugt tolv
 * gange skal ikke ligge under den der blev lavet én gang i maj.
 */
export function sorterTilHylde(
	faste: FastMaaltid[],
	brug: Map<string, Brug>,
	aktuelt: Maaltidstype
): Hylde {
	const tilMaaltidet: FastMaaltid[] = [];
	const andre: FastMaaltid[] = [];
	for (const f of faste) {
		if (maaltidFor(f, brug.get(f.id)) === aktuelt) tilMaaltidet.push(f);
		else andre.push(f);
	}
	const orden = (a: FastMaaltid, b: FastMaaltid) =>
		(brug.get(b.id)?.antal ?? 0) - (brug.get(a.id)?.antal ?? 0) ||
		a.navn.localeCompare(b.navn, 'da');
	return { tilMaaltidet: tilMaaltidet.sort(orden), andre: andre.sort(orden) };
}

// ============================================================
// Naar hun retter i det bagefter
// ============================================================

/**
 * De linjer der ER det faste maaltid lige nu.
 *
 * `foerIds` er de dokumenter der laa i maaltidet FOER hun lagde det
 * faste maaltid i. Uden dem ville en aeggemad hun tastede i forvejen
 * blive regnet som en del af hendes morgengroed.
 */
export function nyeLinjer(poster: GemtMaaltid[], foerIds: string[]): MaaltidsItem[] {
	const foer = new Set(foerIds);
	const ud: MaaltidsItem[] = [];
	for (const p of poster) {
		if (foer.has(p.id)) continue;
		for (const it of p.items ?? []) if (kanKommeMed(it)) ud.push(it);
	}
	return ud;
}

/**
 * Har hun aendret noget, saa baandet skal spoerge om det faste maaltid
 * skal opdateres.
 *
 * Er der intet tilbage, har hun fjernet det hele, og saa spoerger vi
 * ikke. Et tomt fast maaltid giver ingen mening, og hun er formentlig i
 * gang med at fortryde.
 */
export function erAendret(fast: FastMaaltid, linjer: MaaltidsItem[]): boolean {
	if (linjer.length === 0) return false;
	return linjeAftryk(linjer) !== linjeAftryk(fast.items);
}

/** "5 ting" under navnet paa hylden. */
export function antalTing(fast: FastMaaltid): number {
	return (fast.items ?? []).filter(kanKommeMed).length;
}
