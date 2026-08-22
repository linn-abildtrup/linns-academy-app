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
//  - FORLOEB: kun hendes EGNE. De skrives i 3.0's egen skuffe, se
//    egneSkridt3.ts for hvorfor, men der LAESES ogsaa fra den gamle apps
//    plads, saa intet hun har skrevet foer forsvinder. Linns skridt for
//    dagen kommer fra forloebets plan og roeres ikke her.
//
// INGEN NY DATAMODEL. Alt herunder skriver praecis de felter den gamle
// app skriver, med de samme funktioner. Se HANDOVER 9.35.
// ============================================================

import { MAKS_SKRIDT3, type Forslag3, type ValgtSkridt3 } from '$lib/content/vaelgSkridt3';
import { hentAboVaneOpsaetning, hentAboVaneskabelon, gemAboVaneOpsaetning } from './aboVaner';
import { hentUserProduct, fjernEgenVane } from './mikrotraening';
import {
	gemEgneSkridt3,
	hentEgneSkridt3,
	nytEgetSkridtId3,
	type EgetSkridt3
} from './egneSkridt3';

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
		const [produkt, forslag, egne3] = await Promise.all([
			hentUserProduct(uid, forlob.produkt),
			hentAboVaneskabelon('basis'),
			hentEgneSkridt3(uid, forlob.produkt)
		]);
		return {
			kilde: 'forlob',
			produktId: forlob.produkt,
			forslag: forslag.map((f) => ({ id: f.id, label: f.label, kategori: f.kategori })),
			valgte: flet3(produkt?.egneVaner ?? [], egne3)
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
 * Fletter den gamle apps liste med 3.0's egen.
 *
 * De gamle staar foerst, for de er skrevet foerst. Er den samme tekst
 * begge steder, vinder den gamle: saa peger fjern-knappen paa det sted
 * hvor teksten ogsaa er synlig i den gamle app.
 */
function flet3(
	gamle: { id: string; label: string }[],
	nye: EgetSkridt3[]
): ValgtSkridt3[] {
	const set = new Set(gamle.map((g) => g.label.trim().toLowerCase()));
	return [
		...gamle.map((g) => ({ id: g.id, label: g.label, kilde: 'egen' as const })),
		...nye
			.filter((n) => !set.has(n.label.trim().toLowerCase()))
			.map((n) => ({ id: n.id, label: n.label, kilde: 'egen' as const }))
	];
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
	const [gamle, nye] = await Promise.all([
		hentUserProduct(uid, produktId),
		hentEgneSkridt3(uid, produktId)
	]);
	const ialt = (gamle?.egneVaner ?? []).length + nye.length;
	if (ialt >= MAKS_SKRIDT3) {
		return { ok: false, fejl: `Du kan højst have ${MAKS_SKRIDT3} egne skridt. Fjern ét først.` };
	}
	const id = nytEgetSkridtId3();
	await gemEgneSkridt3(uid, produktId, [
		...nye,
		{ id, label: label.trim(), oprettetMs: Date.now() }
	]);
	return { ok: true, id };
}

/**
 * Fjerner ét eget skridt paa forloebs-sporet.
 *
 * Skridtet kan ligge to steder. Er id'et 3.0's eget, skriver vi vores
 * egen liste. Ellers er det skrevet i den gamle app, og saa skal det
 * fjernes der, hvor hun ogsaa kan se det.
 */
export async function fjernEgetSkridt3(uid: string, produktId: string, id: string): Promise<void> {
	if (id.startsWith('es3-')) {
		const nye = await hentEgneSkridt3(uid, produktId);
		await gemEgneSkridt3(
			uid,
			produktId,
			nye.filter((n) => n.id !== id)
		);
		return;
	}
	await fjernEgenVane(uid, produktId, id);
}
