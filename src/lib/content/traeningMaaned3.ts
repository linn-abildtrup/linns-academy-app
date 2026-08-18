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

import { maanedOverblik, stortNavn, type MaanedOverblik } from './maanedTal3';

/** Kun det Traening skal bruge om én gennemfoert traening. */
export interface TraeningKilde {
	/** YYYY-MM-DD. */
	dato: string;
	/** Hele minutter. Mangler paa alt logget foer 18. august 2026. */
	minutter?: number;
}

/** Hvad vi taeller i. Se filens hoved for hvorfor de aldrig blandes. */
export type Enhed = 'minutter' | 'traeninger';

export type { Maaned, MaanedOverblik } from './maanedTal3';
export { ANTAL_MAANEDER, soejleBredde, stoersteMaaned } from './maanedTal3';

export interface TraeningOverblik extends MaanedOverblik {
	enhed: Enhed;
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
	const punkter = traeninger.map((t) => ({
		dato: t.dato,
		vaerdi: enhed === 'minutter' ? (t.minutter ?? 0) : 1
	}));
	// Traening laegges SAMMEN. Fire korte traeninger er mere end én lang
	// halv, og det skal taelle.
	const o = maanedOverblik(punkter, nu, 'sum');
	return o ? { ...o, enhed } : null;
}

/** "40 minutter" eller "3 træninger", med rigtig ental og flertal. */
export function traeningTal(vaerdi: number, enhed: Enhed): string {
	if (enhed === 'minutter') return `${vaerdi} ${vaerdi === 1 ? 'minut' : 'minutter'}`;
	return `${vaerdi} ${vaerdi === 1 ? 'træning' : 'træninger'}`;
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
			? `${stortNavn(o.denne.navn)} er lige begyndt for dig. I ${o.forrige.navn} nåede du ${traeningTal(o.forrige.vaerdi, o.enhed)}.`
			: `${stortNavn(o.denne.navn)} er lige begyndt for dig.`;
	}

	if (o.bedste) {
		return `Det er den bedste måned indtil nu. Du har ${traeningTal(o.denne.vaerdi, o.enhed)} i ${o.denne.navn}.`;
	}

	if (o.forskel === null || o.forskel === 0 || !o.forrigeSammeTid) {
		return `Du har ${traeningTal(o.denne.vaerdi, o.enhed)} i ${o.denne.navn}.`;
	}

	// Der sammenlignes med SAMME TID i maaneden foer, ikke med hele
	// maaneden. Ellers ville en halv maaned altid tabe til en hel.
	if (o.forskel > 0) {
		const mere = o.enhed === 'minutter' ? 'minutter mere' : 'gange mere';
		return `Du har trænet ${o.forskel} ${mere} end på samme tid i ${o.forrigeSammeTid.navn}.`;
	}

	// Ingen anklage. Hvor hun er, og at maaneden ikke er forbi.
	return `Du har ${traeningTal(o.denne.vaerdi, o.enhed)} i ${o.denne.navn}. Der er stadig dage tilbage af måneden.`;
}
