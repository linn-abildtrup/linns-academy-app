// ============================================================
// Data til forsiden i Linns Academy 3.0.
//
// Modulet LAESER de eksisterende collections og skriver kun to steder:
// kundens vane-svar (samme felter som den gamle app bruger) og en NY
// collection med hvilke lektioner hun har klaret. Ingen eksisterende
// fil er aendret for at faa det til at virke.
//
// Beregningerne ligger i content/forside3.ts, saa de kan testes uden
// Firestore. Her er kun hentning.
// ============================================================

import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '$lib/firebase';
import { aktivBrugerBasisPath } from '$lib/utils/adminKlient';
import { hentAlleMrsScores } from './mrs';
import { hentVaneprogramDag, hentVanedag, opdaterVaneSvar, hentAlleVanedage } from './vaner';
import {
	hentAboVaneOpsaetning,
	hentAboVanedag,
	opdaterAboVaneSvar,
	hentAlleAboVanedage
} from './aboVaner';
import { hentForlobsdag, hentAlleForlob } from './forlob';
import { hentMaaltiderForDato } from './kost';
import { hentMitProgram, hentProgramFremgang } from './mineProgrammer';
import { hentForlobsProgram, hentExercises, hentUserProduct } from './mikrotraening';
import { hentEgneSkridt3 } from './egneSkridt3';
import { hentAboMikrotraeningProgram, hentAboFremgang } from './aboMikrotraening';
import { aktuelAboDagForDato } from '$lib/content/aboMikrotraening';
import { hentHistorikForDato } from './traeningHistorik';
import { getVideoUrl, prefetchVideoer } from '$lib/utils/storage';
import { maalingerFraMrs, type Maaling } from '$lib/content/forside3';
import type { LektionItem } from '$lib/content/forlob';
import type { UserDoc } from '$lib/types';
import { dagligeMalForBruger } from '$lib/content/naering';

// ── Dit overskud ────────────────────────────────────────────

export interface Overskud {
	maalinger: Maaling[];
	/** Hvornaar hun sidst maalte. null hvis aldrig. */
	sidsteMs: number | null;
}

/**
 * Henter alle maalinger af Dit overskud.
 *
 * Kilden er de samme mrs_scores som den gamle app skriver, saa en kunde
 * der flyttes over til 3.0 tager hele sin historik med.
 */
export async function hentOverskud(uid: string): Promise<Overskud> {
	const scores = await hentAlleMrsScores(uid);
	const maalinger = maalingerFraMrs(scores);
	return {
		maalinger,
		sidsteMs: maalinger.length ? maalinger[maalinger.length - 1].ms : null
	};
}

// ── Dagens smaa skridt ──────────────────────────────────────

export type SkridtSvar = 'ja' | 'delvist' | 'nej' | null;

/**
 * Hvor skridtet kommer fra. 'egen' er et hun selv har skrevet, og det
 * faar et maerke paa dagen, saa hendes eget ikke ligner noget Linn har
 * bestemt. Se HANDOVER 9.35.
 */
export type SkridtKilde3 = 'linn' | 'egen';

export interface Skridt {
	id: string;
	label: string;
	svar: SkridtSvar;
	/** 'egen' naar hun selv har skrevet det. */
	fra: SkridtKilde3;
}

export interface SmaaSkridtIDag {
	skridt: Skridt[];
	/** Hvor svarene skal skrives hen. To spor indtil den gamle app pensioneres. */
	kilde: 'forlob' | 'medlem';
	/** Kun for forloeb. */
	produktId?: string;
	dagNummer?: number;
	/** Kun for medlem. YYYY-MM-DD. */
	dato?: string;
	/** Dagens refleksions-spoergsmaal. Kun forloeb, og kun hvis Linn har skrevet et. */
	refleksion?: string;
	/** Hendes eget svar paa refleksionen. */
	note?: string;
}

/**
 * Dagens smaa skridt for kunden.
 *
 * Er hun paa et forloeb, kommer de fra forloebets vaneprogram for dagens
 * dagnummer. Er hun ikke, kommer de fra de vaner hun selv har valgt.
 * Det er de to spor der findes i dag, og de smelter foerst sammen naar
 * den gamle app pensioneres. Indtil da laeser vi begge.
 */
export async function hentSmaaSkridtIDag(
	uid: string,
	forlob: { forlobId: string; produkt: string; dagNummer: number } | null,
	dato: string
): Promise<SmaaSkridtIDag> {
	if (forlob) {
		// To forskellige noegler, og de maa ikke byttes om:
		//   programmet (spoergsmaal + refleksion) ligger under FORLOEBETS id
		//   hendes svar ligger under PRODUKT-noeglen i hendes egen skuffe
		const [program, entry, produkt, egne3] = await Promise.all([
			hentVaneprogramDag(forlob.forlobId, forlob.dagNummer),
			hentVanedag(uid, forlob.dagNummer, forlob.produkt),
			hentUserProduct(uid, forlob.produkt),
			hentEgneSkridt3(uid, forlob.produkt)
		]);
		const checks = program?.checks ?? [];
		// HENDES EGNE LIGGER EFTER LINNS, og noeglen paa svaret faar
		// praefikset 'eg-'. Det er ikke en smagssag: den gamle app gemmer
		// dem under praecis den noegle, og bruger hun begge apper samme
		// dag, skal afkrydsningen vaere det samme sted. Se HANDOVER 9.35.
		//
		// Der laeses fra BEGGE skuffer: den gamle apps liste og 3.0's egen.
		// Samme tekst to steder vises én gang. Se firestore/egneSkridt3.ts
		// for hvorfor der er to.
		const gamleEgne = produkt?.egneVaner ?? [];
		const setEgne = new Set(gamleEgne.map((v) => v.label.trim().toLowerCase()));
		const egne = [
			...gamleEgne,
			...egne3.filter((n) => !setEgne.has(n.label.trim().toLowerCase()))
		].map((v) => ({
			id: `eg-${v.id}`,
			label: v.label,
			svar: (entry?.checks?.[`eg-${v.id}`] as SkridtSvar) ?? null,
			fra: 'egen' as const
		}));
		return {
			kilde: 'forlob',
			produktId: forlob.produkt,
			dagNummer: forlob.dagNummer,
			refleksion: program?.reflection?.trim() ?? '',
			note: entry?.note ?? '',
			skridt: [
				...checks.map((c) => ({
					id: c.id,
					label: c.label,
					svar: (entry?.checks?.[c.id] as SkridtSvar) ?? null,
					fra: 'linn' as const
				})),
				...egne
			]
		};
	}

	const [opsaetning, dag] = await Promise.all([
		hentAboVaneOpsaetning(uid),
		hentAboVanedag(uid, dato)
	]);
	return {
		kilde: 'medlem',
		dato,
		// Medlemmet har valgt dem alle sammen selv, saa der er ingen grund
		// til at maerke nogen af dem som hendes egne.
		skridt: (opsaetning?.valgteVaner ?? []).map((v) => ({
			id: v.id,
			label: v.label,
			svar: (dag?.checks?.[v.id] as SkridtSvar) ?? null,
			fra: 'linn' as const
		}))
	};
}

/**
 * Skriver ét svar. Kun det ene felt roeres, aldrig hele dagen.
 *
 * Grunden staar i firestore/vaner.ts: da forsiden i den gamle app sendte
 * hele dagen med, mistede 158 kunder deres refleksioner. Vi gentager ikke
 * den fejl i den nye flade.
 */
export async function saetSkridtSvar(
	uid: string,
	kontekst: SmaaSkridtIDag,
	skridtId: string,
	svar: SkridtSvar
): Promise<void> {
	if (kontekst.kilde === 'forlob' && kontekst.produktId && kontekst.dagNummer !== undefined) {
		await opdaterVaneSvar(uid, kontekst.produktId, kontekst.dagNummer, skridtId, svar);
		return;
	}
	if (kontekst.dato) {
		await opdaterAboVaneSvar(uid, kontekst.dato, skridtId, svar);
	}
}

/**
 * Gemmer dagens refleksion.
 *
 * Skriver KUN note-feltet. Refleksionssiden i den gamle app bruger samme
 * dokument, og et fuldt objekt herfra ville kunne overskrive hendes
 * vane-svar med gammel tilstand. Se firestore/vaner.ts for historien.
 */
export async function gemRefleksion(
	uid: string,
	produktId: string,
	dagNummer: number,
	note: string
): Promise<void> {
	const ref = doc(
		db,
		`${aktivBrugerBasisPath(uid)}/products/${produktId}/vanedage/dag${dagNummer}`
	);
	await setDoc(ref, { dagNummer, note, savedAt: serverTimestamp() }, { merge: true });
}

/**
 * Hvilke datoer i uge-strimlen hun har svaret paa noget.
 *
 * To spor igen: forloebskundens svar ligger pr dagnummer, medlemmets pr
 * dato. Begge oversaettes til datoer, saa strimlen kan tegnes ens.
 */
export async function hentAktiveDage(
	uid: string,
	forlob: { produkt: string; startMs: number } | null,
	fraDato: string
): Promise<Set<string>> {
	const ud = new Set<string>();
	try {
		if (forlob) {
			const alle = await hentAlleVanedage(uid, forlob.produkt);
			for (const [dagNummer, entry] of alle) {
				if (!entry.checks || Object.keys(entry.checks).length === 0) continue;
				const d = new Date(forlob.startMs);
				d.setDate(d.getDate() + dagNummer);
				ud.add(datoNoegle(d));
			}
			return ud;
		}
		const alle = await hentAlleAboVanedage(uid, fraDato);
		for (const [dato, entry] of alle) {
			if (entry.checks && Object.keys(entry.checks).length > 0) ud.add(dato);
		}
	} catch (e) {
		console.warn('[ny] kunne ikke hente aktive dage', e);
	}
	return ud;
}

/** YYYY-MM-DD i lokal tid. Samme noegle som resten af appen bruger. */
export function datoNoegle(d: Date): string {
	const m = `${d.getMonth() + 1}`.padStart(2, '0');
	const dag = `${d.getDate()}`.padStart(2, '0');
	return `${d.getFullYear()}-${m}-${dag}`;
}

// ── Dagens lektioner ────────────────────────────────────────

/**
 * Lektionerne for dagens dagnummer i forloebet, filtreret efter det
 * synlighedsvindue Linn kan saette pr lektion (visFra / skjulEfter).
 */
export async function hentDagensLektioner(
	forlobId: string,
	dagNummer: number,
	nu: number
): Promise<LektionItem[]> {
	const dag = await hentForlobsdag(forlobId, dagNummer);
	const alle = dag?.lektioner ?? [];
	return alle.filter((l) => synligNu(l, nu));
}

/** Lektionerne OG Linns note, fra ét og samme opslag. */
export interface DagensProgram {
	lektioner: LektionItem[];
	note: string;
}

/**
 * Forsiden skal bruge baade lektionerne og noten fra Linn, og de bor i
 * samme dokument. Vi henter det derfor én gang og deler det ud, i stedet
 * for at laese den samme dag to gange.
 */
export async function hentDagensProgram(
	forlobId: string,
	dagNummer: number,
	nu: number
): Promise<DagensProgram> {
	const dag = await hentForlobsdag(forlobId, dagNummer);
	const alle = dag?.lektioner ?? [];
	return {
		lektioner: alle.filter((l) => synligNu(l, nu)),
		note: dag?.noteFraLinn ?? ''
	};
}

/** Respekterer lektionens vis-fra og skjul-efter, som er lokale ISO-strenge. */
function synligNu(l: LektionItem, nu: number): boolean {
	if (l.visFra) {
		const fra = new Date(l.visFra).getTime();
		if (!Number.isNaN(fra) && nu < fra) return false;
	}
	if (l.skjulEfter) {
		const til = new Date(l.skjulEfter).getTime();
		if (!Number.isNaN(til) && nu > til) return false;
	}
	return true;
}

// ── Hvad hun har klaret ─────────────────────────────────────
//
// NY collection: users/{uid}/nyKlaret/{id}. Den findes ikke i den gamle
// app og roerer ingenting der. Bruges til at rykke den naeste lektion op
// som stor flise, naar den foerste er klaret.

function klaretCol(uid: string) {
	return collection(db, 'users', uid, 'nyKlaret');
}

export async function hentKlaret(uid: string): Promise<Set<string>> {
	try {
		const snap = await getDocs(klaretCol(uid));
		return new Set(snap.docs.map((d) => d.id));
	} catch (e) {
		// Mangler Firestore-reglerne endnu, skal forsiden stadig virke.
		console.warn('[ny] kunne ikke hente klaret-status', e);
		return new Set();
	}
}

/**
 * Saetter eller fjerner fluebenet.
 *
 * Der skrives ÉN noegle pr id i listen: lektionens eget id, og noeglen
 * for videoen hvis der er en. Det er den anden der goer at fluebenet
 * foelger den samme film til de andre dage i ugen. Linns beslutning 22.
 * august, se HANDOVER 9.37.
 */
export async function saetKlaret(
	uid: string,
	noegler: string | string[],
	klaret: boolean
): Promise<void> {
	const liste = typeof noegler === 'string' ? [noegler] : noegler;
	await Promise.all(
		liste.map((n) => {
			const ref = doc(klaretCol(uid), n);
			return klaret ? setDoc(ref, { klaretAt: Date.now() }) : deleteDoc(ref);
		})
	);
}

// ── Dagens tal ──────────────────────────────────────────────

export interface DagensTal {
	protein: number;
	fiber: number;
	proteinMaal: number;
	fiberMaal: number;
	/** De tre udvidede. Regnes altid, vises kun hvis hun har slaaet dem til. */
	kh: number;
	fedt: number;
	kcal: number;
	khMaal: number;
	fedtMaal: number;
	kcalMaal: number;
}

/**
 * Summerer dagens maaltider og holder dem op mod hendes egne maal.
 *
 * MAALENE FALDER TILBAGE PAA STANDARDEN og ikke paa nul. Stod der nul,
 * skrev forsiden "56 af 0 g" og kaldte dagen "i hus" for en kunde der
 * aldrig har sat et maal. Fundet 22. august.
 */
export async function hentDagensTal(uid: string, dato: string, userDoc: UserDoc | null) {
	const maaltider = await hentMaaltiderForDato(uid, dato);
	const sum = (f: (m: (typeof maaltider)[number]) => number | undefined) =>
		Math.round(maaltider.reduce((s, m) => s + (f(m) ?? 0), 0));
	const maal = dagligeMalForBruger(userDoc?.dagligeMaal);
	return {
		protein: sum((m) => m.totalP),
		fiber: sum((m) => m.totalF),
		kh: sum((m) => m.totalKh),
		fedt: sum((m) => m.totalFedt),
		kcal: sum((m) => m.totalKcal),
		proteinMaal: maal.protein,
		fiberMaal: maal.fiber,
		khMaal: maal.kh,
		fedtMaal: maal.fedt,
		kcalMaal: maal.kcal
	} satisfies DagensTal;
}

// ── Dagens traening ─────────────────────────────────────────
//
// Doc-id'erne paa mikrotraenings-programmerne i de gamle data. De hedder
// 'premium' og 'basis', men det er IKKE et kundeskel i 3.0. Alle faar det
// fulde program. Navnene her siger hvad de er, ikke hvem de er til.
const FULDT_PROGRAM = 'premium';
const RESERVE_PROGRAM = 'basis';

export interface DagensTraening {
	navn: string;
	undertekst: string;
	klaretIDag: boolean;
	/** Kort video af dagens foerste oevelse. Koerer lydloest i loop paa flisen. */
	videoUrl: string | null;
}

/**
 * Finder videoen til dagens foerste oevelse, saa flisen viser hvad hun
 * gaar ind til i stedet for et farvet felt.
 *
 * Én video pr dag, cirka 1,2 MB. Resten af dagens videoer hentes i
 * baggrunden, saa de ligger klar naar hun trykker start.
 */
/**
 * Giver op efter et stykke tid i stedet for at vente i det uendelige.
 * Bruges om video-hentningen, saa en langsom forbindelse aldrig kan
 * spaerre hele forsiden.
 */
function medFrist<T>(arbejde: Promise<T>, ms: number, opgiv: T): Promise<T> {
	return Promise.race([
		arbejde,
		new Promise<T>((klar) => setTimeout(() => klar(opgiv), ms))
	]);
}

/** Fire sekunder. Kommer videoen ikke inden, viser flisen bare farven. */
const VIDEO_FRIST_MS = 4000;

/**
 * Eksporteret siden bid 5, saa den nye traenings-flise kan bruge noejagtig
 * den samme video-hentning med den samme frist. To udgaver ville betyde at
 * den ene kunne blokere forsiden mens den anden gav op.
 */
export async function videoForDag(exerciseIds: string[]): Promise<string | null> {
	if (exerciseIds.length === 0) return null;
	const exercises = await medFrist(hentExercises(exerciseIds), VIDEO_FRIST_MS, new Map());
	const foerste = exercises.get(exerciseIds[0]);
	if (!foerste?.videoPath) return null;
	const url = await medFrist<string | null>(
		getVideoUrl(foerste.videoPath),
		VIDEO_FRIST_MS,
		null
	);
	if (!url) return null;
	// Resten hentes i baggrunden. Fejler det, gaar det ud over ingenting.
	void prefetchVideoer(
		exerciseIds
			.map((id) => exercises.get(id)?.videoPath)
			.filter((p): p is string => !!p)
			.slice(1)
	);
	return url;
}

/**
 * ERSTATTET 15. august 2026 af hentDagensTraening3 i traeningForside3.ts.
 * INGEN KALDER DEN LAENGERE.
 *
 * Den bliver staaende nogle dage som fortryd-mulighed: bid 5 aendrede hvad
 * hver eneste bruger med ny-app-flaget ser paa forsiden, og skulle det vise
 * sig forkert, er vejen tilbage ét linjeskift paa forsiden. Viser den nye
 * flise sig at holde, skal alt herunder slettes sammen med DagensTraening,
 * FULDT_PROGRAM og RESERVE_PROGRAM.
 *
 * Den gamle beskrivelse: hvilket traeningsprogram hun er i gang med, laest
 * af det samme felt som den gamle app bruger, `aktivtTraeningsprogram`.
 */
export async function hentDagensTraening(
	uid: string,
	userDoc: UserDoc | null,
	nu: number,
	dato: string
): Promise<DagensTraening> {
	const aktivt = userDoc?.aktivtTraeningsprogram;

	try {
		if (aktivt?.kilde === 'eget' && aktivt.programId) {
			const [program, fremgang] = await Promise.all([
				hentMitProgram(uid, aktivt.programId),
				hentProgramFremgang(uid, 'eget', aktivt.programId)
			]);
			const naaet = fremgang?.gennemforteDage ?? [];
			const dage = program?.dage ?? [];
			// Foerste dag hun ikke har taget endnu, ellers den foerste.
			const dag = dage.find((d) => !naaet.includes(d.dagNummer)) ?? dage[0];
			// Gamle programmer har oevelserne direkte paa programmet.
			const oevelser = dag?.oevelser ?? program?.oevelser ?? [];
			return {
				navn: program?.navn ?? 'Din træning',
				undertekst: 'Dit eget program',
				klaretIDag: erSammeDag(fremgang?.senestGennemfort ?? null, nu),
				videoUrl: await videoForDag(oevelser.map((e) => e.exerciseId))
			};
		}

		if (aktivt?.kilde === 'tildelt' && aktivt.programId && aktivt.forlobId) {
			const [program, fremgang] = await Promise.all([
				hentForlobsProgram(aktivt.forlobId, aktivt.programId),
				hentProgramFremgang(uid, 'tildelt', aktivt.programId, aktivt.forlobId)
			]);
			const naaet = fremgang?.gennemforteDage ?? [];
			const dage = program?.dage ?? [];
			const dag = dage.find((d) => !naaet.includes(d.dagNummer)) ?? dage[0];
			return {
				navn: program?.program.navn ?? 'Din træning',
				undertekst: 'Dit program fra Linn',
				klaretIDag: erSammeDag(fremgang?.senestGennemfort ?? null, nu),
				videoUrl: await videoForDag((dag?.exercises ?? []).map((e) => e.exerciseId))
			};
		}

		// Ingen valgt: mikrotraeningen, som alle har.
		//
		// Der findes IKKE premium i 3.0. Alle har den samme app og faar det
		// samme program. Noeglen nedenfor er ikke et kundeskel, det er blot
		// doc-id'et paa det fulde program i de gamle data. Naar den gamle
		// app pensioneres, kan de to docs slaas sammen til ét.
		const variant = userDoc?.mikrotraeningVariant ?? 'no_kettlebell';
		const [program, fremgang] = await Promise.all([
			hentAboMikrotraeningProgram(FULDT_PROGRAM, variant).then(
				(p) => p ?? hentAboMikrotraeningProgram(RESERVE_PROGRAM, variant)
			),
			hentAboFremgang(uid)
		]);
		if (!program) {
			return {
				navn: 'Mikrotræning',
				undertekst: 'Dagens korte program',
				klaretIDag: false,
				videoUrl: null
			};
		}
		const dagNummer = aktuelAboDagForDato(fremgang, dato, program.program.antalDage);
		const dag = program.dage.find((d) => d.dagNummer === dagNummer);
		// Gennemfoert i dag laeses af traenings-historikken, som er den
		// eneste kilde der er bundet til en dato.
		const historik = await hentHistorikForDato(uid, dato);
		return {
			navn: dag?.titel || 'Dagens mikrotræning',
			undertekst: `Dag ${dagNummer} · ${dag?.exercises?.length ?? 0} øvelser`,
			klaretIDag: historik.length > 0,
			videoUrl: await videoForDag((dag?.exercises ?? []).map((e) => e.exerciseId))
		};
	} catch (e) {
		console.warn('[ny] kunne ikke hente traeningsprogram', e);
	}

	return {
		navn: 'Mikrotræning',
		undertekst: 'Dagens korte program',
		klaretIDag: false,
		videoUrl: null
	};
}

function erSammeDag(ms: number | null, nu: number): boolean {
	if (!ms) return false;
	const a = new Date(ms);
	const b = new Date(nu);
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

// ── Naeste hold ─────────────────────────────────────────────

export interface NaesteHold {
	id: string;
	navn: string;
	startMs: number;
	type: string;
}

/**
 * Det foerste hold der endnu ikke er startet, og som hun ikke allerede er
 * tilmeldt. Har hun gennemfoert Kickstart, foretraekkes et hold af en anden
 * type, saa en Kickstart-veteran faar Kropsro at se og ikke Kickstart igen.
 */
export async function hentNaesteHold(
	mineForlobIds: string[],
	gennemfoerteProdukter: string[],
	nu: number
): Promise<NaesteHold | null> {
	let alle;
	try {
		alle = await hentAlleForlob();
	} catch (e) {
		console.warn('[ny] kunne ikke hente hold', e);
		return null;
	}

	const kommende = alle
		.filter((f) => f.aktiv !== false && !mineForlobIds.includes(f.id))
		.map((f) => ({
			id: f.id,
			navn: f.navn,
			startMs: f.startDato?.toDate?.().getTime() ?? 0,
			type: f.type ?? 'kickstart'
		}))
		.filter((f) => f.startMs > nu)
		.sort((a, b) => a.startMs - b.startMs);

	if (kommende.length === 0) return null;
	const nyType = kommende.find((f) => !gennemfoerteProdukter.includes(f.type));
	return nyType ?? kommende[0];
}
