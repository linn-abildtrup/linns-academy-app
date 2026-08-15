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
	naesteTraening3,
	type KundeProgram3
} from '$lib/content/traeningFremgang3';
import { hentKategorier3 } from './traeningKategori3';
import { hentProgram3, hentProgrammer3 } from './traeningsprogram3';
import { hentMineTildelinger3 } from './traeningTildeling3';
import { hentFremgang3 } from './traeningFremgang3';
import { harAbonnement3, isoDato3 } from './traeningKunde3';
import { hentHistorikForDato } from './traeningHistorik';
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
	nu: number,
	dato: string
): Promise<DagensTraening3> {
	try {
		const [programmer, kategorier, tildelinger, fremgang, historik] = await Promise.all([
			hentProgrammer3(),
			hentKategorier3(),
			hentMineTildelinger3(uid),
			hentFremgang3(uid),
			hentHistorikForDato(uid, dato).catch(() => [])
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

		const klaretIDag = historik.length > 0;
		const liste = kundeProgrammer3(mine, fremgang);
		const valgt: KundeProgram3 | null = iGangMed3(liste) ?? (liste.length === 1 ? liste[0] : null);

		if (!valgt) {
			return {
				tilstand: 'vaelg',
				navn: 'Vælg din træning',
				undertekst: `${liste.length} programmer er klar til dig`,
				href: '/ny/traening',
				videoUrl: null,
				klaretIDag
			};
		}

		// Selve traeningen hentes for sig, saa flisen kan vise navnet selv
		// om dagene ikke naar frem. Uden det ville en langsom forbindelse
		// give en tom flise i stedet for en halv.
		const data = await hentProgram3(valgt.program.id).catch(() => null);
		const nr =
			naesteTraening3(valgt.fremgang, valgt.program.antalDage, valgt.program.starterForfra) ?? 1;
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
			href: `/ny/traening/${valgt.program.id}`,
			videoUrl: traening
				? await videoForDag(traening.exercises.map((e) => e.exerciseId))
				: null,
			klaretIDag
		};
	} catch (e) {
		console.warn('[ny] kunne ikke hente dagens traening', e);
		return INGEN;
	}
}
