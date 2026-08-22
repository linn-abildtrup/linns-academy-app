// ============================================================
// Henter og gemmer de skridt kunden selv har valgt.
//
// TO SPOR, TO STEDER I DATABASEN, og det er ikke noget vi har fundet
// paa: det er sadan den gamle app allerede gemmer dem, og hun kan sidde
// i begge apper samme dag.
//
//  - MEDLEM: hele valget ligger i hendes opsaetning, sammen med Linns
//    forslag hun har krydset af. Vi genbruger den gamle apps funktioner,
//    saa de to flader ikke kan drive fra hinanden.
//  - FORLOEB: kun hendes EGNE ligger paa hendes forloebs-produkt. Linns
//    skridt for dagen kommer fra forloebets plan og roeres ikke her.
//
// INGEN NY DATAMODEL. Alt herunder skriver praecis de felter den gamle
// app skriver, med de samme funktioner. Se HANDOVER 9.35.
// ============================================================

import { MAKS_SKRIDT3, type Forslag3, type ValgtSkridt3 } from '$lib/content/vaelgSkridt3';
import { hentAboVaneOpsaetning, hentAboVaneskabelon, gemAboVaneOpsaetning } from './aboVaner';
import { hentUserProduct, tilfoejEgenVane, fjernEgenVane } from './mikrotraening';

/** Alt siden skal bruge, hentet i ét kald. */
export interface SkridtValg3 {
	kilde: 'medlem' | 'forlob';
	/** Linns forslag. Tom for en forloebskunde, hun har allerede skridt. */
	forslag: Forslag3[];
	/** Det hun har valgt. For en forloebskunde kun hendes egne. */
	valgte: ValgtSkridt3[];
	/** Produktet hendes egne skridt hoerer til. Kun paa forloebs-sporet. */
	produktId?: string;
}

/**
 * Henter hendes valg.
 *
 * Kaster ikke. Kan noget ikke hentes, faar hun en tom liste og kan stadig
 * vaelge, i stedet for en side der ikke virker.
 */
export async function hentSkridtValg3(
	uid: string,
	forlob: { produkt: string } | null
): Promise<SkridtValg3> {
	if (forlob) {
		// Forslagene vises ogsaa her. Foerst gjorde de ikke, og saa skulle
		// hun skrive alt selv. Linns rettelse 22. august. Trykker hun paa et
		// forslag, bliver det til ét af HENDES egne, for det er den eneste
		// skuffe en forloebskunde har til sine egne skridt.
		const [produkt, forslag] = await Promise.all([
			hentUserProduct(uid, forlob.produkt),
			hentAboVaneskabelon('basis')
		]);
		return {
			kilde: 'forlob',
			produktId: forlob.produkt,
			forslag: forslag.map((f) => ({ id: f.id, label: f.label, kategori: f.kategori })),
			valgte: (produkt?.egneVaner ?? []).map((v) => ({
				id: v.id,
				label: v.label,
				kilde: 'egen' as const
			}))
		};
	}

	const [forslag, opsaetning] = await Promise.all([
		hentAboVaneskabelon('basis'),
		hentAboVaneOpsaetning(uid)
	]);
	return {
		kilde: 'medlem',
		forslag: forslag.map((f) => ({ id: f.id, label: f.label, kategori: f.kategori })),
		valgte: (opsaetning?.valgteVaner ?? []).map((v) => ({
			id: v.id,
			label: v.label,
			kilde: v.kilde
		}))
	};
}

/**
 * Gemmer medlemmets valg. Hele listen skrives, for det er sadan den
 * gamle apps opsaetning er bygget: ét dokument med alle tre.
 *
 * 'basis' er ikke et kundeskel. Premium findes ikke i 3.0, og feltet er
 * kun den noegle listen altid har ligget under.
 */
export async function gemMedlemsSkridt3(uid: string, valgte: ValgtSkridt3[]): Promise<void> {
	await gemAboVaneOpsaetning(
		uid,
		valgte.map((v) => ({ id: v.id, label: v.label, kilde: v.kilde })),
		'basis'
	);
}

/**
 * Laegger ét eget skridt til paa forloebs-sporet.
 *
 * Her skrives ikke hele listen. Den gamle app laeser det samme felt, og
 * to faner aabne samtidig maa ikke kunne slette hinandens skridt.
 */
export async function tilfoejEgetSkridt3(
	uid: string,
	produktId: string,
	label: string
): Promise<{ ok: true; id: string } | { ok: false; fejl: string }> {
	const r = await tilfoejEgenVane(uid, produktId, label, MAKS_SKRIDT3);
	return r.ok ? { ok: true, id: r.vane.id } : { ok: false, fejl: r.fejl };
}

/** Fjerner ét eget skridt paa forloebs-sporet. */
export async function fjernEgetSkridt3(
	uid: string,
	produktId: string,
	id: string
): Promise<void> {
	await fjernEgenVane(uid, produktId, id);
}
