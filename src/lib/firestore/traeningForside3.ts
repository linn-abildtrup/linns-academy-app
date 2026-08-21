// Traenings-flisen paa forsiden. Bid 5, 15. august 2026.
//
// Flisen laeste hidtil userDoc.aktivtTraeningsprogram og pegede paa den
// GAMLE apps programmer. Her flyttes den over paa den nye model, saa
// forsiden viser det samme som Mikrotraening-siden.
//
// TRE TILSTANDE, og de skal se forskellige ud:
//   ingen    hun har ikke faaet noget. Flisen vises slet ikke
//   vaelg    hun har flere programmer og er ikke i gang med nogen
//   program  hun er i gang, eller hun har praecis ét at gaa i gang med
//
// Har hun kun ét program, springer vi "vaelg" over. Der er ikke noget at
// vaelge imellem, og "Vaelg din traening" ville vaere et ekstra tryk uden
// indhold.

import type { UserDoc } from '$lib/types';
import type { ForlobKilde } from '$lib/content/adgang3';
import { dagensMinutter } from '$lib/content/traeningsprogram3';
import { rensUdstyr3, udstyrFra } from '$lib/content/traeningKategori3';
import { programmerForKunde3, type KundeKontekst3 } from '$lib/content/traeningTildeling3';
import {
	iGangMed3,
	kundeProgrammer3,
	maaTilbydesNyRunde3,
	naesteTraening3,
	type KundeProgram3
} from '$lib/content/traeningFremgang3';
import { klaretIProgramIDag3, vaelgProgram3 } from '$lib/content/valgtProgram3';
import type { NyeKundeFelter } from '$lib/content/forside3';
import { hentKategorier3 } from './traeningKategori3';
import { hentProgram3, hentProgrammer3 } from './traeningsprogram3';
import { hentMineTildelinger3 } from './traeningTildeling3';
import { hentFremgang3 } from './traeningFremgang3';
import { harAbonnement3, isoDato3 } from './traeningKunde3';
import { videoForDag } from './forside3';

export interface DagensTraening3 {
	tilstand: 'ingen' | 'vaelg' | 'program';
	navn: string;
	undertekst: string;
	/** Hvor flisen foerer hen. Tom naar der ikke er noget at gaa til. */
	href: string;
	videoUrl: string | null;
	klaretIDag: boolean;
}

const INGEN: DagensTraening3 = {
	tilstand: 'ingen',
	navn: '',
	undertekst: '',
	href: '',
	videoUrl: null,
	klaretIDag: false
};

/**
 * Hvad flisen skal vise.
 *
 * Kaster aldrig. Gaar noget galt, viser vi ingen flise i stedet for at
 * vaelte forsiden. Traeningen er én blok blandt mange, og resten af
 * dagen skal stadig kunne ses.
 */
export async function hentDagensTraening3(
	uid: string,
	userDoc: UserDoc | null,
	forlob: ForlobKilde[],
	aktiveForlob: { forlobId: string; dagNummer: number }[],
	nu: number
): Promise<DagensTraening3> {
	try {
		const [programmer, kategorier, tildelinger, fremgang] = await Promise.all([
			hentProgrammer3(),
			hentKategorier3(),
			hentMineTildelinger3(uid),
			hentFremgang3(uid)
		]);

		const kontekst: KundeKontekst3 = {
			uid,
			forlob: aktiveForlob.map((f) => ({ id: f.forlobId, dag: f.dagNummer })),
			harAbonnement: harAbonnement3(userDoc, forlob, nu),
			udstyr: rensUdstyr3(udstyrFra(userDoc), kategorier),
			idag: isoDato3(nu)
		};

		const mine = programmerForKunde3(programmer, tildelinger, kategorier, kontekst)
			.filter((x) => x.vises)
			.map((x) => x.program);
		if (mine.length === 0) return INGEN;

		const liste = kundeProgrammer3(mine, fremgang);

		// DET GEMTE VALG VINDER. Foer blev det gaettet ud fra hvad hun
		// senest havde traenet i, og saa kunne hun ikke skifte til noget
		// hun ikke havde roert endnu. Se content/valgtProgram3.
		const valgtId = (userDoc as NyeKundeFelter | null)?.valgtTraeningsprogram3 ?? null;
		const valgt: KundeProgram3 | null = vaelgProgram3(liste, valgtId, iGangMed3(liste));

		if (!valgt) {
			return {
				tilstand: 'vaelg',
				navn: 'Vælg din træning',
				undertekst: `${liste.length} programmer er klar til dig`,
				href: '/ny/traening',
				videoUrl: null,
				// Hun har ikke valgt endnu, saa der er intet program at maale
				// fluebenet paa. Kortet skal staa aabent, saa hun kan vaelge.
				klaretIDag: false
			};
		}

		// FLUEBENET FOELGER PROGRAMMET og ikke dagen. Linns beslutning 21.
		// august. Foer spurgte vi "har hun traenet i dag" uden at skele til
		// hvilket program, saa efter et skift foldede forsiden traeningen
		// sammen med et flueben, selv om hun ikke havde roert det nye.
		const klaretIDag = klaretIProgramIDag3(valgt.fremgang.senestAt, nu);

		// ER HUN IGENNEM, maa flisen ikke love "Træning 1". Det er ikke
		// sandt endnu: hun skal foerst sige ja til en runde mere, eller
		// vaelge noget andet. Flisen foerer derfor til programsiden, hvor
		// spoergsmaalet staar. Se maaTilbydesNyRunde3 og Linns beslutning
		// 20. august.
		//
		// Ingen video paa den flise. Der er ingen naeste traening at vise,
		// og et tilfaeldigt klip ville love noget bestemt.
		if (valgt.faerdig) {
			return {
				tilstand: 'program',
				navn: `Du er igennem ${valgt.program.navn}`,
				undertekst: maaTilbydesNyRunde3(valgt.fremgang, valgt.program)
					? 'Vælg hvad du vil nu'
					: 'Vælg et nyt program',
				href: `/ny/traening/${valgt.program.id}`,
				videoUrl: null,
				klaretIDag
			};
		}

		// Selve traeningen hentes for sig, saa flisen kan vise navnet selv
		// om dagene ikke naar frem. Uden det ville en langsom forbindelse
		// give en tom flise i stedet for en halv.
		const data = await hentProgram3(valgt.program.id).catch(() => null);
		const nr = naesteTraening3(valgt.fremgang, valgt.program.antalDage) ?? 1;
		const traening = data?.dage.find((d) => d.dagNummer === nr) ?? null;

		const dele: string[] = [`Træning ${nr}`];
		if (traening && traening.exercises.length > 0) {
			dele.push(
				traening.exercises.length === 1 ? '1 øvelse' : `${traening.exercises.length} øvelser`
			);
			const minutter = dagensMinutter(traening);
			if (minutter > 0) dele.push(`ca. ${minutter} min`);
		}

		return {
			tilstand: 'program',
			navn: valgt.program.navn,
			undertekst: dele.join(' · '),
			// DIREKTE IND PAA TRAENINGEN, og ikke paa listen over dage.
			// Linns valg 18. august: kunden har allerede valgt sit program,
			// saa de to mellemled er spildte tryk. Hun lander paa
			// klar-skaermen med videoen og trykker selv Start.
			//
			// fra=forside maerker hvilken DOER hun kom ind ad. Der er to,
			// den her og fanen Traening, og afspilleren vidste det ikke.
			// Uden maerket sendte den hende ud paa traeningens forside
			// bagefter, altsaa et sted hun aldrig havde bedt om at komme.
			// Se kommentaren over udgang() i afspilleren.
			href: `/ny/traening/${valgt.program.id}/${nr}?fra=forside`,
			videoUrl: traening ? await videoForDag(traening.exercises.map((e) => e.exerciseId)) : null,
			klaretIDag
		};
	} catch (e) {
		console.warn('[ny] kunne ikke hente dagens traening', e);
		return INGEN;
	}
}
