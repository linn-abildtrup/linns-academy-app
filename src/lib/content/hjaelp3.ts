// ============================================================
// Hjaelp i 3.0. Ren logik, ingen database.
//
// Hjaelp er ét sted for alle spoergsmaal. Linns beslutning 18. august:
// FAQ og links flytter fra det gamle Bibliotek ind under Hjaelp, saa
// AI-en svarer oeverst og opslaget staar lige nedenunder.
//
// Det svaere er HVILKE forloeb der skal med. FAQ og links hoerer til ét
// forloeb i databasen, men en kunde kan have vaeret paa flere. Reglen er
// den samme som paa hendes lektioner: hun ser materialet fra de forloeb
// hun stadig har adgang til, og ikke fra dem hvor de 90 dage er gaaet.
//
// Har hun kun ét forloeb, skal navnet IKKE staa nogen steder. Saa er der
// ikke noget at skelne mellem, og en overskrift med holdets navn over
// hvert eneste spoergsmaal ville bare stoeje.
// ============================================================

import type { AktivtForlob, GennemfoertForlob } from './adgang3';
import { forlobAdgang, type AdgangVilkaar } from './lektionsliste3';

/** Ét forloeb som Hjaelp skal hente FAQ og links fra. */
export interface HjaelpKilde {
	forlobId: string;
	navn: string;
}

/**
 * De forloeb hvis FAQ og links hun stadig maa se.
 *
 * Aktive forloeb foerst, saa de gennemfoerte hun har adgang til. Et
 * forloeb hvor bonussen er loebet ud kommer ikke med: der er Linns
 * materiale lukket, og det gaelder ogsaa spoergsmaalene.
 */
export function hjaelpKilder(
	aktive: AktivtForlob[],
	gennemfoerte: GennemfoertForlob[],
	vilkaar: AdgangVilkaar
): HjaelpKilde[] {
	const ud: HjaelpKilde[] = [];
	const set = new Set<string>();

	for (const a of aktive) {
		if (set.has(a.forlobId)) continue;
		set.add(a.forlobId);
		ud.push({ forlobId: a.forlobId, navn: a.navn });
	}

	for (const g of gennemfoerte) {
		if (set.has(g.forlobId)) continue;
		if (forlobAdgang(false, vilkaar) === 'lukket') continue;
		set.add(g.forlobId);
		ud.push({ forlobId: g.forlobId, navn: g.navn });
	}

	return ud;
}

/**
 * Skal holdets navn staa over indholdet.
 *
 * Kun naar hun har mere end ét forloeb. Ellers er navnet stoej.
 */
export function visKildeNavn(kilder: HjaelpKilde[]): boolean {
	return kilder.length > 1;
}

// ── Fletning paa tvaers af forloeb ──────────────────────────

/** Én gruppe paa skaermen: en kategori inden for ét forloeb. */
export interface HjaelpGruppe<T> {
	/** Unik paa tvaers af forloeb, saa to hold kan have samme kategorinavn. */
	noegle: string;
	kategoriNavn: string;
	/** Holdets navn. Tom naar der kun er ét forloeb. */
	kildeNavn: string;
	poster: T[];
}

/** Det fletningen skal vide om ét forloebs indhold. */
export interface KildeIndhold<T> {
	kilde: HjaelpKilde;
	/** Kategorierne, allerede sorteret af kalderen. */
	kategorier: { id: string; navn: string }[];
	/** Posterne, allerede filtreret til de udgivne og sorteret. */
	poster: T[];
}

/**
 * Fletter flere forloebs indhold til én liste af grupper.
 *
 * Raekkefoelgen er forloebenes, og inden i hvert forloeb kategoriernes.
 * Tomme kategorier falder ud, saa hun aldrig moeder en overskrift uden
 * noget under.
 */
export function fletHjaelp<T extends { kategoriId: string }>(
	indhold: KildeIndhold<T>[],
	medKildeNavn: boolean
): HjaelpGruppe<T>[] {
	const ud: HjaelpGruppe<T>[] = [];

	for (const i of indhold) {
		for (const kat of i.kategorier) {
			const poster = i.poster.filter((p) => p.kategoriId === kat.id);
			if (poster.length === 0) continue;
			ud.push({
				noegle: `${i.kilde.forlobId}__${kat.id}`,
				kategoriNavn: kat.navn,
				kildeNavn: medKildeNavn ? i.kilde.navn : '',
				poster
			});
		}
	}

	return ud;
}
