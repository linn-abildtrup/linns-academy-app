// ============================================================
// Traening paa Udvikling, maaned mod maaned. Ren logik, ingen database.
//
// DEN REGEL DER STYRER DET HELE, og som Linn satte 18. august:
// en side der goer status maa ALDRIG kunne laeses som en anklage.
// Den gamle side siger "12 af 30 dage", og hun laeser 18 dage hvor hun
// ikke gjorde det. Her findes der derfor INTET MAAL at ramme ved siden
// af. Vi sammenligner hende kun med hende selv.
//
// Linns valg: M2, men i MINUTTER og ikke i dage.
//
// Minutterne er nye. Historikken gemte foer kun AT hun havde traenet, og
// entry'en gemmer ikke hvilken dag i programmet hun tog, saa laengden
// kan ikke regnes ud bagudrettet. Derfor: mangler bare én traening i
// perioden sine minutter, taeller vi traeninger i stedet. Vi blander dem
// ALDRIG, for saa ville en maaned med minutter se ud som en kaempe
// fremgang mod en maaned uden.
// ============================================================

/** Kun det Traening skal bruge om én gennemfoert traening. */
export interface TraeningKilde {
	/** YYYY-MM-DD. */
	dato: string;
	/** Hele minutter. Mangler paa alt logget foer 18. august 2026. */
	minutter?: number;
}

/** Hvad vi taeller i. Se filens hoved for hvorfor de aldrig blandes. */
export type Enhed = 'minutter' | 'traeninger';

export interface Maaned {
	/** YYYY-MM. */
	noegle: string;
	/** "august", "juli". */
	navn: string;
	/** Antal minutter eller antal traeninger, alt efter enhed. */
	vaerdi: number;
}

export interface TraeningOverblik {
	enhed: Enhed;
	/** Den maaned hun er i gang med. */
	denne: Maaned;
	/** Maaneden foer. null naar der ikke er nogen at sammenligne med. */
	forrige: Maaned | null;
	/** denne minus forrige. null naar der ikke er en forrige. */
	forskel: number | null;
	/** Er det den bedste maaned hun har haft. */
	bedste: boolean;
	/** De seneste maaneder, aeldst foerst. Til soejlerne. */
	maaneder: Maaned[];
}

const MAANEDER = [
	'januar',
	'februar',
	'marts',
	'april',
	'maj',
	'juni',
	'juli',
	'august',
	'september',
	'oktober',
	'november',
	'december'
];

/** Hvor mange maaneder der vises som soejler. */
export const ANTAL_MAANEDER = 6;

function maanedsNavn(noegle: string): string {
	const nr = Number(noegle.slice(5, 7));
	return MAANEDER[nr - 1] ?? noegle;
}

function noegleFor(d: Date): string {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Hvad vi kan taelle i.
 *
 * Minutter kraever at ALLE traeninger har dem. Mangler bare én, taeller
 * vi traeninger, for ellers ville en maaned hvor halvdelen mangler
 * minutter se ud som et fald hun ikke har haft.
 */
export function enhedFor(traeninger: TraeningKilde[]): Enhed {
	if (traeninger.length === 0) return 'traeninger';
	return traeninger.every((t) => typeof t.minutter === 'number' && t.minutter > 0)
		? 'minutter'
		: 'traeninger';
}

/**
 * Maaned mod maaned. Ingen maal, kun en retning.
 *
 * `nu` er det tidspunkt vi regner "denne maaned" ud fra, saa testene kan
 * saette et fast ur.
 */
export function traeningOverblik(traeninger: TraeningKilde[], nu: number): TraeningOverblik | null {
	if (traeninger.length === 0) return null;

	const enhed = enhedFor(traeninger);
	const tael = (t: TraeningKilde) => (enhed === 'minutter' ? (t.minutter ?? 0) : 1);

	const prMaaned = new Map<string, number>();
	for (const t of traeninger) {
		const n = t.dato.slice(0, 7);
		prMaaned.set(n, (prMaaned.get(n) ?? 0) + tael(t));
	}

	const d = new Date(nu);
	const denneNoegle = noegleFor(d);
	const forrigeNoegle = noegleFor(new Date(d.getFullYear(), d.getMonth() - 1, 1));

	const denne: Maaned = {
		noegle: denneNoegle,
		navn: maanedsNavn(denneNoegle),
		vaerdi: prMaaned.get(denneNoegle) ?? 0
	};

	// Har hun slet ikke traenet i maaneden foer, er der ikke noget at
	// sammenligne med. Vi opfinder ikke et nul, for "0 → 40" ville laese
	// som om hun havde svigtet i juli.
	const forrige = prMaaned.has(forrigeNoegle)
		? {
				noegle: forrigeNoegle,
				navn: maanedsNavn(forrigeNoegle),
				vaerdi: prMaaned.get(forrigeNoegle) as number
			}
		: null;

	// Soejlerne. Maaneder uden traening staar med nul, saa raekken ikke
	// hopper i tid, men de faar ingen tekst der peger paa dem.
	const maaneder: Maaned[] = [];
	for (let i = ANTAL_MAANEDER - 1; i >= 0; i--) {
		const n = noegleFor(new Date(d.getFullYear(), d.getMonth() - i, 1));
		maaneder.push({ noegle: n, navn: maanedsNavn(n), vaerdi: prMaaned.get(n) ?? 0 });
	}

	const alle = [...prMaaned.values()];
	const bedste = alle.length > 1 && denne.vaerdi === Math.max(...alle) && denne.vaerdi > 0;

	return {
		enhed,
		denne,
		forrige,
		forskel: forrige ? denne.vaerdi - forrige.vaerdi : null,
		bedste,
		maaneder
	};
}

/** "40 minutter" eller "3 træninger", med rigtig ental og flertal. */
export function traeningTal(vaerdi: number, enhed: Enhed): string {
	if (enhed === 'minutter') return `${vaerdi} ${vaerdi === 1 ? 'minut' : 'minutter'}`;
	return `${vaerdi} ${vaerdi === 1 ? 'træning' : 'træninger'}`;
}

/** Maaneden med stort begyndelsesbogstav, til starten af en saetning. */
function stort(navn: string): string {
	return navn.charAt(0).toUpperCase() + navn.slice(1);
}

/**
 * Linjen under soejlerne.
 *
 * Aldrig et maal, aldrig en bebrejdelse. Er det gaaet tilbage, siges det
 * roligt og uden at pege paa hende, for maaneden er ikke slut endnu.
 */
export function traeningTekst(o: TraeningOverblik | null): string {
	if (!o) return 'Når du har trænet, kan du følge det her.';

	if (o.denne.vaerdi === 0) {
		return o.forrige
			? `${stort(o.denne.navn)} er lige begyndt for dig. I ${o.forrige.navn} nåede du ${traeningTal(o.forrige.vaerdi, o.enhed)}.`
			: `${stort(o.denne.navn)} er lige begyndt for dig.`;
	}

	if (o.bedste) {
		return `Det er den bedste måned indtil nu. Du har ${traeningTal(o.denne.vaerdi, o.enhed)} i ${o.denne.navn}.`;
	}

	if (o.forskel === null || o.forskel === 0 || !o.forrige) {
		return `Du har ${traeningTal(o.denne.vaerdi, o.enhed)} i ${o.denne.navn}.`;
	}

	if (o.forskel > 0) {
		const mere = o.enhed === 'minutter' ? 'minutter mere' : 'gange mere';
		return `Du har trænet ${o.forskel} ${mere} end i ${o.forrige.navn}.`;
	}

	// Ingen anklage. Hvor hun er, og at maaneden ikke er forbi.
	return `Du har ${traeningTal(o.denne.vaerdi, o.enhed)} i ${o.denne.navn}. Der er stadig dage tilbage af måneden.`;
}

/** Hvor lang soejlen skal vaere, 0 til 100. Den laengste maaned er 100. */
export function soejleBredde(vaerdi: number, stoerst: number): number {
	if (stoerst <= 0 || vaerdi <= 0) return 0;
	return Math.max(4, Math.round((vaerdi / stoerst) * 100));
}
