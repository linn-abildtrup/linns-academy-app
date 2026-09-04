// ============================================================
// Skrivningen naar Linn retter en foedevares naeringstal.
//
// DER SKRIVES PAA SELVE FOEDEVAREN, se begrundelsen i
// content/ingrediensRettelse3.ts. Begge apper laeser den samme samling,
// saa rettelsen virker for kunderne uden at der aendres én linje i det
// de bruger.
//
// OG OPSKRIFTERNE REGNES OM I SAMME KOERSEL. De er regnet ud paa forhaand
// og gemt, og de regner sig ikke om af sig selv. Det gik galt 24. august,
// hvor foedevarerne fik nye tal kl 16.48 og opskrifterne foerst kl 16.59.
// I de elleve minutter sagde de to kilder forskellige ting om den samme
// mad. Raekkefoelgen her er derfor: skriv varen, hent friske varer, regn
// ALLE opskrifter om, gem. Fejler omregningen, siger vi det HOEJT, for
// saa staar de to ting og er uenige.
//
// Reglerne tillader admin at skrive begge steder, saa der skal intet
// udgives i Firebase.
// ============================================================

import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { Fodevare } from '$lib/content/kost';
import type { Opskrift } from '$lib/content/opskrifter';
import {
	skrivefelter,
	fortrydFelter,
	opgoerAendringer,
	type Aendring,
	type RettbarVare,
	type RettedeTal
} from '$lib/content/ingrediensRettelse3';
import { afrund, regnOpskrift, type KoblingsOpslag } from '$lib/content/opskriftMakro3';
import { nyMakroLinje } from '$lib/content/opskriftTal3';
import { ryFodevarer3Cache } from './fodevarer3';
import {
	gemBeregninger,
	hentBeregninger,
	ryBeregningerCache,
	type Beregninger
} from './opskriftBeregning3';

/** Skriver de rettede felter paa foedevaren og rydder begge cacher. */
async function skrivVare(id: string, felter: Record<string, unknown>): Promise<void> {
	await setDoc(doc(db, 'fodevarer', id), { ...felter, rettetAt: serverTimestamp() }, { merge: true });
	// Begge cacher SKAL ryddes. Den gamle apps og 3.0's er to forskellige,
	// og glemmes den ene, viser den ene app det nye tal og den anden det
	// gamle indtil siden hentes forfra. Se noten i fodevarer3.
	ryFodevarer3Cache();
}

export interface OmregningResultat {
	aendrede: Aendring[];
	antalOpskrifter: number;
	/** Hvor mange makro-linjer i opskrifternes tekst der blev skrevet om. */
	linjerSkrevet: number;
}

/**
 * Skriver de nye tal ind i makro-linjen nederst i opskrifternes tekst.
 *
 * Regnemaskinen blev bygget 13. august med den regel at opskrifterne
 * aldrig maa roeres. LINN AENDREDE DEN 4. SEPTEMBER 2026. Den gamle app
 * viser nu de beregnede tal, men linjen bliver staaende som
 * sikkerhedsnet, og staar den med gamle tal, er der igen to svar paa den
 * samme mad. Derfor skrives den om i samme koersel som beregningen.
 *
 * Kun de fem tal roeres. Resten af teksten, ogsaa Tid-delen, staar som
 * Linn har skrevet den.
 *
 * Fejler en enkelt skrivning, stopper vi ikke. Beregningen er allerede
 * gemt, og en linje der halter er bedre end en halv omregning.
 */
async function skrivMakroLinjer(
	opskrifter: Opskrift[],
	nyt: Beregninger
): Promise<number> {
	let n = 0;
	for (const o of opskrifter) {
		const b = nyt[o.id];
		if (!b) continue;
		const tekst = nyMakroLinje(o.instruktioner ?? '', b);
		if (!tekst) continue;
		try {
			await updateDoc(doc(db, 'opskrifter', o.id), { instruktioner: tekst });
			n++;
		} catch (e) {
			console.warn('[3.0] kunne ikke skrive makro-linjen paa', o.id, e);
		}
	}
	return n;
}

/**
 * Regner ALLE opskrifter om og gemmer resultatet.
 *
 * Alle og ikke kun dem der bruger varen. Det koster ingenting, vi har
 * alt i hukommelsen i forvejen, og det bringer samtidig noget paa plads
 * der maatte have drevet siden sidst. Til gengaeld skal Linn se HELE
 * listen over hvad der flyttede sig, ikke kun det hun selv roerte.
 */
export async function regnOpskrifterOm(
	opskrifter: Opskrift[],
	koblinger: Record<string, KoblingsOpslag>,
	varer: Map<string, Fodevare>,
	af: string
): Promise<OmregningResultat> {
	const foer = await hentBeregninger();
	const nyt: Beregninger = {};
	const titler: Record<string, string> = {};

	for (const o of opskrifter) {
		const b = regnOpskrift(o, koblinger, varer);
		const pr = afrund(b.prPortion);
		nyt[o.id] = {
			protein: pr.protein,
			fiber: pr.fiber,
			kh: pr.kh,
			fedt: pr.fedt,
			kalorier: pr.kalorier,
			daekning: b.daekning,
			kalorierPaalidelige: b.kalorierPaalidelige
		};
		titler[o.id] = o.titel;
	}

	const aendrede = opgoerAendringer(foer, nyt, titler);
	await gemBeregninger(nyt, af);
	ryBeregningerCache();
	// Teksten skrives om EFTER beregningen er gemt. Gaar det galt her,
	// staar beregningen stadig rigtigt, og den er den kunden ser.
	const linjerSkrevet = await skrivMakroLinjer(opskrifter, nyt);
	return { aendrede, antalOpskrifter: opskrifter.length, linjerSkrevet };
}

/**
 * Retter en foedevares tal OG regner opskrifterne om.
 *
 * `varer` skal vaere det kort siden allerede har. Den rettede vare
 * laegges ind i kortet foer omregningen, saa der ikke skal hentes 2.268
 * raekker en gang til for at faa ét nyt tal med.
 */
export async function retFodevare(
	vare: RettbarVare,
	tal: RettedeTal,
	note: string,
	opskrifter: Opskrift[],
	koblinger: Record<string, KoblingsOpslag>,
	varer: Map<string, Fodevare>,
	af: string
): Promise<OmregningResultat> {
	const felter = skrivefelter(vare, tal, note);
	await skrivVare(vare.id, felter);
	varer.set(vare.id, { ...vare, ...felter } as Fodevare);
	return regnOpskrifterOm(opskrifter, koblinger, varer, af);
}

/** Saetter en rettelse tilbage til det oprindelige og regner om. */
export async function fortrydRettelse(
	vare: RettbarVare,
	opskrifter: Opskrift[],
	koblinger: Record<string, KoblingsOpslag>,
	varer: Map<string, Fodevare>,
	af: string
): Promise<OmregningResultat | null> {
	const felter = fortrydFelter(vare);
	if (!felter) return null;
	await skrivVare(vare.id, felter);
	const ny = { ...vare, ...felter } as Record<string, unknown>;
	delete ny.foerRettelse;
	varer.set(vare.id, ny as unknown as Fodevare);
	return regnOpskrifterOm(opskrifter, koblinger, varer, af);
}
