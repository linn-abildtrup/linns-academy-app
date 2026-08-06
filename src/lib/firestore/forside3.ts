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
import { hentForlobsProgram, hentExercises } from './mikrotraening';
import { hentAboMikrotraeningProgram, hentAboFremgang } from './aboMikrotraening';
import { aktuelAboDagForDato } from '$lib/content/aboMikrotraening';
import { hentHistorikForDato } from './traeningHistorik';
import { getVideoUrl, prefetchVideoer } from '$lib/utils/storage';
import { maalingerFraMrs, type Maaling } from '$lib/content/forside3';
import type { LektionItem } from '$lib/content/forlob';
import type { UserDoc } from '$lib/types';

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

export interface Skridt {
	id: string;
	label: string;
	svar: SkridtSvar;
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
		const [program, entry] = await Promise.all([
			hentVaneprogramDag(forlob.forlobId, forlob.dagNummer),
			hentVanedag(uid, forlob.dagNummer, forlob.produkt)
		]);
		const checks = program?.checks ?? [];
		return {
			kilde: 'forlob',
			produktId: forlob.produkt,
			dagNummer: forlob.dagNummer,
			refleksion: program?.reflection?.trim() ?? '',
			note: entry?.note ?? '',
			skridt: checks.map((c) => ({
				id: c.id,
				label: c.label,
				svar: (entry?.checks?.[c.id] as SkridtSvar) ?? null
			}))
		};
	}

	const [opsaetning, dag] = await Promise.all([
		hentAboVaneOpsaetning(uid),
		hentAboVanedag(uid, dato)
	]);
	return {
		kilde: 'medlem',
		dato,
		skridt: (opsaetning?.valgteVaner ?? []).map((v) => ({
			id: v.id,
			label: v.label,
			svar: (dag?.checks?.[v.id] as SkridtSvar) ?? null
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

/**
 * Hvor mange dage siden hun sidst gjorde noget. Bruges af inspiratoren.
 *
 * Vi kigger paa hvad hun FAKTISK har gjort, ikke paa hvornaar hun sidst
 * loggede ind. Login-tidspunkter lyver, det har vi laert foer.
 */
export function dageSidenAktiv(aktiveDage: Set<string>, iDag: Date): number {
	if (aktiveDage.size === 0) return 999;
	let bedst = 999;
	for (const noegle of aktiveDage) {
		const [aar, maaned, dag] = noegle.split('-').map(Number);
		if (!aar || !maaned || !dag) continue;
		const d = new Date(aar, maaned - 1, dag);
		d.setHours(0, 0, 0, 0);
		const nu = new Date(iDag);
		nu.setHours(0, 0, 0, 0);
		const dage = Math.floor((nu.getTime() - d.getTime()) / 86400000);
		if (dage >= 0 && dage < bedst) bedst = dage;
	}
	return bedst;
}

/** Gemmer at hun sagde "ikke nu" til inspiratoren i dag. */
export async function gemInspiratorAfvist(uid: string, dato: string): Promise<void> {
	await setDoc(doc(db, 'users', uid), { nyInspiratorAfvist: dato }, { merge: true });
}

/** Gemmer dagens tekst, saa vi ikke spoerger AI'en igen ved hver indlaesning. */
export async function gemInspiratorTekst(
	uid: string,
	dato: string,
	tekst: string
): Promise<void> {
	await setDoc(doc(db, 'users', uid), { nyInspirator: { dato, tekst } }, { merge: true });
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

export async function saetKlaret(uid: string, id: string, klaret: boolean): Promise<void> {
	const ref = doc(klaretCol(uid), id);
	if (klaret) {
		await setDoc(ref, { klaretAt: Date.now() });
	} else {
		await deleteDoc(ref);
	}
}

// ── Dagens tal ──────────────────────────────────────────────

export interface DagensTal {
	protein: number;
	fiber: number;
	proteinMaal: number;
	fiberMaal: number;
}

/** Summerer dagens maaltider og holder dem op mod hendes egne maal. */
export async function hentDagensTal(uid: string, dato: string, userDoc: UserDoc | null) {
	const maaltider = await hentMaaltiderForDato(uid, dato);
	const protein = maaltider.reduce((sum, m) => sum + (m.totalP ?? 0), 0);
	const fiber = maaltider.reduce((sum, m) => sum + (m.totalF ?? 0), 0);
	return {
		protein: Math.round(protein),
		fiber: Math.round(fiber),
		proteinMaal: userDoc?.dagligeMaal?.protein ?? 0,
		fiberMaal: userDoc?.dagligeMaal?.fiber ?? 0
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
async function videoForDag(exerciseIds: string[]): Promise<string | null> {
	if (exerciseIds.length === 0) return null;
	const exercises = await hentExercises(exerciseIds);
	const foerste = exercises.get(exerciseIds[0]);
	if (!foerste?.videoPath) return null;
	const url = await getVideoUrl(foerste.videoPath);
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
 * Hvilket traeningsprogram hun er i gang med.
 *
 * Kilden er det samme felt som den gamle app bruger, `aktivtTraeningsprogram`,
 * saa hun ser det samme program de to steder. Har hun ikke valgt noget,
 * er det mikrotraeningen.
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
