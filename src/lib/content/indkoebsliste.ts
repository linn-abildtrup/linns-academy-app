// Indkøbsliste — typer og pure helpers
//
// Klienten kan vælge X opskrifter med portionsantal og få genereret en
// samlet indkøbsliste hvor ingredienser med samme navn+enhed summeres.
// Listen kan eksporteres som tekst eller PDF.
//
// Designet matcher ref-appens flow (vanetracker), men datatyperne er
// tilpasset den nye apps Opskrift-struktur.

import type { Opskrift, Ingrediens } from './opskrifter';

// ==============================================
// Typer
// ==============================================

export type ButiksGruppe = 'grønt' | 'kød' | 'mejeri' | 'kolonial' | 'frost' | 'andet';

export const BUTIKS_GRUPPER: ButiksGruppe[] = [
	'grønt',
	'kød',
	'mejeri',
	'kolonial',
	'frost',
	'andet'
];

export const BUTIKS_LABELS: Record<ButiksGruppe, string> = {
	grønt: 'Grønt',
	kød: 'Kød & fisk',
	mejeri: 'Mejeri',
	kolonial: 'Kolonial',
	frost: 'Frost',
	andet: 'Andet'
};

export interface IndkoebsItem {
	id: string;
	navn: string;
	maengde: number;
	enhed: string;
	gruppe: ButiksGruppe;
	tjekket: boolean;
	manuel: boolean;
	fraOpskrifter: string[];
}

export type ValgteOpskrifter = Map<string, number>;

// ==============================================
// Skalering og formatering
// ==============================================

/** Skalerer en mængde fra default-portioner til ønskede portioner. */
export function skaler(baseMaengde: number, basePortioner: number, valgtePortioner: number): number {
	if (basePortioner <= 0) return baseMaengde;
	return (baseMaengde / basePortioner) * valgtePortioner;
}

/** Formaterer en mængde pænt: 0 ved tom, heltal uden decimaler, ellers maks 2 decimaler. */
export function formaterMaengde(n: number): string {
	if (!n && n !== 0) return '';
	if (n === Math.round(n)) return String(Math.round(n));
	return String(parseFloat(n.toFixed(2)));
}

function normaliseretNavn(s: string): string {
	return (s || '').toLowerCase().trim();
}

/** Returnerer en nøgle der bruges til at matche identiske ingredienser. */
export function ingrediensKey(navn: string, enhed: string): string {
	return normaliseretNavn(navn) + '__' + (enhed || '');
}

// ==============================================
// Gæt butiksgruppe ud fra ingrediens-navnet
// ==============================================

/**
 * Auto-gæt butiksgruppe ud fra varens navn. Test-rækkefølgen er vigtig —
 * mest specifikke regler først så fx "tomatpuré" ender i kolonial og ikke grønt.
 *
 * Porteret fra ref-appens laPdfGuessGroup. Reglerne er empirisk udviklet
 * over tid baseret på faktiske opskrifts-ingredienser.
 */
export function gaetGruppe(navn: string): ButiksGruppe {
	const n = (navn || '').toLowerCase();

	// Frost
	if (/(^|\s)(frost|frosne|frossen|fryser)/.test(n)) return 'frost';

	// Forarbejdede grøntsagsprodukter — kolonial selvom navnet indeholder grøntsagsord
	if (/(tomatpure|tomatpuré|tomatpasta|hakkede tomater|tomater på dåse|tomater i dåse|passata|ketchup)/.test(n))
		return 'kolonial';
	if (
		/(løgpulver|hvidløgspulver|chiliflager|chilipulver|paprikapulver|ingefærpulver|hvidløg på glas)/.test(n)
	)
		return 'kolonial';
	if (/(soltørr|sundtørr|tørrede tomater|tørret tomat)/.test(n)) return 'kolonial';

	// Grønt — friske krydderurter
	if (
		/(persille|dild|basilikum|koriander|mynte|frisk timian|frisk rosmarin|frisk oregano|estragon|salvie|purløg|ramsløg|frisk krydderurt)/.test(
			n
		) &&
		!/tørret/.test(n)
	)
		return 'grønt';

	// Grønt — grøntsager
	if (
		/(salat|spinat|tomat|cherrytomat|agurk|peberfrugt|snackpeber|gulerod|løg|hvidløg|forårsløg|rødløg|skalotteløg|ingefær|chili$|broccoli|blomkål|spidskål|hvidkål|rødkål|grønkål|aubergine|squash|zucchini|champignon|svamp|kartoff|sød kartoffel|avocado|avokado|mango|appelsin|citron|lime|banan|æble|pære|drue|melon|fersken|nektarin|granatæble|kiwi|sukkerært|asparges|edamame|grønne bønner|bønnespirer|rucola|bladselleri|stangselleri|fennikel|rødbede|pastinak|persillerod|jordskok|porre|peberrod|radise)/.test(
			n
		)
	)
		return 'grønt';

	// Grønt — bær og frugt
	if (/(hindbær|jordbær|blåbær|brombær|kirsebær|stikkelsbær|solbær|tranebær|bær$|blandede bær)/.test(n))
		return 'grønt';

	// Kolonial — nøddesmør først så "smør" i mejeri-reglen ikke fanger den
	if (/(nøddesmør|peanutbutter|peanut butter)/.test(n)) return 'kolonial';

	// Kød & fisk
	if (
		/(kylling|kalkun|oksekød|flæsk|bacon|pølse|skinke|lam\b|laks|torsk|tun|reje|makrel|sild|fiskefilet|kotelet|frikadelle|spegepølse|salami|svinekød|kalvekød|hellefisk|rødspætte|gravad|røget laks|rejer|kødfars|fiskefars|kalvefars|svinefars|oksefars)/.test(
			n
		)
	)
		return 'kød';
	if (/(^|\s)(hakket|fars)(\s|$)/.test(n)) return 'kød';
	if (/\bfisk\b/.test(n) && !/fiske(\s|$)/.test(n)) return 'kød';

	// Mejeri (æg placeres her som det normalt er i butikken)
	if (
		/(yoghurt|skyr|kefir|mælk|fløde|smør(\b|e)|ost|feta|hytteost|parmesan|cheddar|mozzarella|cremefraiche|mascarpone|kvark|valle|hyrdeost)/.test(
			n
		)
	)
		return 'mejeri';
	if (/(^|\s)(æg|æggehvide|æggeblomme|aeg)(\s|$|,)/.test(n)) return 'mejeri';

	// Kolonial — frø, nødder, kerner
	if (
		/(mandel|mandler|valnød|hasselnød|cashew|pistacie|pekan|peanut|jordnød|nødde|nød$|kerne|frø|chiafrø|hørfrø|græskarkerne|solsikkekerne|hampefrø|sesam|proteinpulver)/.test(
			n
		)
	)
		return 'kolonial';

	// Kolonial — kornprodukter
	if (
		/(havregryn|müsli|musli|granola|knækbrød|rugbrød|pasta|nudler|spaghetti|tagliatelle|ris\b|risengryn|quinoa|bulgur|couscous|mel\b|hvedemel|rugmel|kikærtemel|kokosmel|mandelmel|havremel|kikært|linse|bønne|sorte bønner|røde bønner|hvide bønner|kikærter)/.test(
			n
		)
	)
		return 'kolonial';

	// Kolonial — olier, eddike, sukker, krydderier
	if (
		/(olie|olivenolie|sesamolie|kokosolie|rapsolie|smørolie|eddike|balsamico|soja|tamari|honning|sirup|sukker|farin|stevia|kokossukker|salt(\b|et)|peber\b|peberkorn)/.test(
			n
		)
	)
		return 'kolonial';
	if (
		/(kanel|kardemomme|spidskommen|paprika|gurkemeje|allehånde|nelliker|stødt|chiliflager|chilipulver|hvidløgspulver|løgpulver|oregano|timian|basilikum tørret|merian|estragon tørret)/.test(
			n
		)
	)
		return 'kolonial';

	// Kolonial — andre tørvarer/dåser
	if (/(bouillon|fond|pesto|tahin|tahini|chokolade|kakao|vanilje|kokosflage|dåse|passat)/.test(n))
		return 'kolonial';
	if (/(rugbrød|brød$|brødskive|toast)/.test(n)) return 'kolonial';

	return 'andet';
}

// ==============================================
// Bygger indkøbsliste fra valgte opskrifter
// ==============================================

function nyId(): string {
	return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Bygger en indkøbsliste ud fra et sæt valgte opskrifter med portionsantal.
 * Identiske ingredienser (samme navn + enhed) summeres til én post.
 * Manuelle varer fra en tidligere liste bevares.
 */
export function byggIndkoebsliste(
	opskrifter: Opskrift[],
	valgte: ValgteOpskrifter,
	tidligereManuelle: IndkoebsItem[] = []
): IndkoebsItem[] {
	const opskriftMap = new Map(opskrifter.map((o) => [o.id, o]));
	const aggregeret = new Map<string, IndkoebsItem>();

	for (const [opskriftId, valgtePortioner] of valgte.entries()) {
		const o = opskriftMap.get(opskriftId);
		if (!o) continue;

		for (const ing of o.ingredienser) {
			const skaleret = skaler(ing.maengde, o.defaultPortioner, valgtePortioner);
			const key = ingrediensKey(ing.navn, ing.enhed);
			const eksisterende = aggregeret.get(key);

			if (eksisterende) {
				eksisterende.maengde += skaleret;
				if (!eksisterende.fraOpskrifter.includes(opskriftId)) {
					eksisterende.fraOpskrifter.push(opskriftId);
				}
			} else {
				aggregeret.set(key, {
					id: nyId(),
					navn: ing.navn,
					maengde: skaleret,
					enhed: ing.enhed,
					gruppe: gaetGruppe(ing.navn),
					tjekket: false,
					manuel: false,
					fraOpskrifter: [opskriftId]
				});
			}
		}
	}

	return [...aggregeret.values(), ...tidligereManuelle.filter((i) => i.manuel)];
}

/**
 * Grupperer indkøbslisten efter butikssektion. Returnerer et objekt med
 * en liste pr gruppe i fast rækkefølge.
 */
export function grupperIndkoebsliste(items: IndkoebsItem[]): Record<ButiksGruppe, IndkoebsItem[]> {
	const grupper: Record<ButiksGruppe, IndkoebsItem[]> = {
		grønt: [],
		kød: [],
		mejeri: [],
		kolonial: [],
		frost: [],
		andet: []
	};
	for (const item of items) {
		grupper[item.gruppe].push(item);
	}
	return grupper;
}

/**
 * Tilføjer en manuel vare til listen. Hvis en eksisterende ikke-manuel post
 * matcher (samme navn + enhed) summeres mængden i stedet.
 */
export function tilfoejManuel(
	liste: IndkoebsItem[],
	navn: string,
	maengde: number,
	enhed: string
): IndkoebsItem[] {
	const trimmet = navn.trim();
	if (!trimmet) return liste;

	const key = ingrediensKey(trimmet, enhed);
	const ny: IndkoebsItem[] = [];
	let summeret = false;

	for (const item of liste) {
		if (!summeret && !item.manuel && ingrediensKey(item.navn, item.enhed) === key) {
			ny.push({ ...item, maengde: item.maengde + (maengde || 0) });
			summeret = true;
		} else {
			ny.push(item);
		}
	}

	if (!summeret) {
		ny.push({
			id: nyId(),
			navn: trimmet,
			maengde: maengde || 0,
			enhed,
			gruppe: gaetGruppe(trimmet),
			tjekket: false,
			manuel: true,
			fraOpskrifter: []
		});
	}

	return ny;
}

/** Bygger tekst-eksport af indkøbslisten (uden tjekkede varer). */
export function teksteksport(items: IndkoebsItem[]): string {
	const aktive = items.filter((i) => !i.tjekket);
	if (!aktive.length) return '';

	const grupper = grupperIndkoebsliste(aktive);
	const linjer: string[] = ['INDKØBSLISTE', ''];

	for (const g of BUTIKS_GRUPPER) {
		if (!grupper[g].length) continue;
		linjer.push(BUTIKS_LABELS[g].toUpperCase());
		for (const item of grupper[g]) {
			const m = formaterMaengde(item.maengde);
			const enhed = item.enhed ? ' ' + item.enhed : '';
			linjer.push(`• ${m}${enhed} ${item.navn}`);
		}
		linjer.push('');
	}

	return linjer.join('\n').trim();
}
