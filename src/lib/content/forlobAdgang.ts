// Forløbs-adgang og whitelist — typer og pure-funktioner
//
// Et Forlob er en konkret runde af et produkt (fx "Kickstart maj 2026") med:
//   - Fælles startdato for alle deltagere
//   - Email-whitelist importeret fra Simplero som CSV
//   - Reference til et vaneProgram (versioneret indhold)
//
// AllowedEmail er en email-adgang oprettet via CSV-import. Når en bruger
// logger ind med en email der findes i allowedEmails, tilknyttes de det
// forløb der står på dokumentet.
//
// Filen er holdt adskilt fra src/lib/content/forlob.ts (mock for "Mit forløb"-
// modulet på forsiden) for at undgå type-kollision indtil den gamle mock
// erstattes af rigtig data senere.

import type { Timestamp } from 'firebase/firestore';

import { KICKSTART_PRODUCT_ID, KROPSRO_PRODUCT_ID, type ForlobProduct } from '../types';
import { BONUS_PERIODE_DAGE } from '../utils/userAdgang';

const MS_PER_DAG = 24 * 60 * 60 * 1000;

// ==============================================
// Typer
// ==============================================

/**
 * Hvilken type forløb det er. Bruges til at adskille Kickstart-runder
 * fra Kropsro-runder så vi kan vise korrekte features pr type (fx
 * buddymakker-modalen vises kun for Kropsro-deltagere).
 *
 * Tilføjet 22. maj 2026. Eksisterende forløb uden type behandles som
 * 'kickstart' for bagudkompat.
 */
export type ForlobType = 'kickstart' | 'kropsro';

export interface Forlob {
	id: string;
	navn: string;
	startDato: Timestamp;
	antalDage: number;
	vaneProgramId: string | null;
	aktiv: boolean;
	oprettet: Timestamp;
	type?: ForlobType;
	// Admin-laas: forhindrer at admin uforvarende navigerer ind paa et
	// forl0b og redigerer det. Paavirker IKKE klienterne — paavirker kun
	// admin-listens klikbarhed.
	laast?: boolean;
	// Override af default adgangs-niveau. Hvis sat, bruges denne vaerdi
	// naar nye kunder tilfoejes til forl0bet i stedet for type-baseret
	// default (kropsro=premium, kickstart=basis). Bruges fx til Kickstart
	// juni 2026 hvor alle kunder skal have premium-adgang.
	adgangsNiveau?: 'basis' | 'premium';
	// ── Byggede forløb (Fase 1, fleksible forløb admin selv opretter) ──
	// Markerer et forløb der IKKE er Kickstart/Kropsro, men frit konfigureret
	// af admin (navn, længde, indhold, niveau, features). Kickstart/Kropsro har
	// byggetForlob=undefined og er fuldstændig uændrede.
	byggetForlob?: boolean;
	// Eget data-spor for et bygget forløb: kundens svar/fremgang gemmes under
	// users/{uid}/products/{produktNoegle}/... i stedet for at låne Kickstart-
	// eller Kropsro-skuffen. Sættes = forløbets id ved oprettelse, så data
	// aldrig blandes med andre forløb. Undefined for Kickstart/Kropsro.
	produktNoegle?: string;
	// Hvilke funktioner er tændt for dette forløb (frit pr forløb). Nøgler er
	// FeatureKey-strenge (se features.ts). Kun relevant for byggede forløb —
	// Kickstart/Kropsro styres fortsat af den type-baserede feature-matrix.
	features?: Record<string, boolean>;
	// Fællesskabs-tilvalg pr forløb (Fase 2). Styrer om buddy-makker- og
	// Facebook-gruppe-spørgsmålene vises for kunderne. Når undefined falder
	// klienten tilbage på den gamle regel (kun Kropsro-forløb), så Kropsro er
	// uændret uden data-migrering.
	harBuddy?: boolean;
	harFacebookGruppe?: boolean;
	// Træning pr forløb (Fase 2B). Når false vises ingen mikrotræning for
	// forløbet (træning leveres da bare som lektioner/videoer). Når undefined
	// falder klienten tilbage på "har træning" (Kickstart/Kropsro uændret).
	// Et bygget forløb med harTraening=true skal have to programmer (med/uden
	// kettlebell) bygget under admin/forlob/[id]/traening.
	harTraening?: boolean;
	// Pause-dage-pulje (max antal nul-dage) for et bygget forløb. Sat af admin
	// ved oprettelse. Når undefined falder puljen tilbage på den prefix-baserede
	// default (Kropsro 21 / Kickstart 14), så de er uændrede.
	nulDagePulje?: number;
}

/**
 * Mapper et forloeb til hvilken products/{X}-doc kundens fremgang
 * (mikrotraening, kost, vaner) er gemt under.
 *
 * Reglerne er:
 *  - adgangsNiveau='premium' -> KROPSRO_PRODUCT_ID ('premiumforloeb')
 *  - Kropsro-forloeb uden eksplicit 'basis' -> KROPSRO_PRODUCT_ID
 *  - Ellers (Kickstart-forloeb, eller udeladt adgangsNiveau) -> KICKSTART_PRODUCT_ID
 *
 * Funktionen er kritisk fordi forsiden og spil-page begge skal finde
 * det SAMME products-doc — ellers gemmes traening ét sted og laeses et
 * andet, og kundens flueben "forsvinder". Hvis logikken skal aendres,
 * skal alle kald-steder opdateres samtidigt.
 */
export function produktTypeForForlob(forlob: {
	type?: ForlobType;
	adgangsNiveau?: 'basis' | 'premium';
	byggetForlob?: boolean;
	produktNoegle?: string;
}): ForlobProduct | string {
	// Byggede forløb har deres EGET data-spor (= produktNoegle), så en kundes
	// svar aldrig blandes med Kickstart/Kropsro-skufferne. Falder tilbage til
	// den gamle type-regel hvis produktNoegle mangler (defensivt).
	if (forlob.byggetForlob && forlob.produktNoegle) return forlob.produktNoegle;
	const erPremium =
		forlob.adgangsNiveau === 'premium' ||
		(forlob.adgangsNiveau !== 'basis' && forlob.type === 'kropsro');
	return erPremium ? KROPSRO_PRODUCT_ID : KICKSTART_PRODUCT_ID;
}

/**
 * Udleder de adgangs-felter en forløbskunde skal have ud fra forløbets EGNE
 * felter. Ren funktion — ingen Firestore. Eneste sandhedskilde for niveau +
 * data-skuffe, så CSV-import (adgangsFelterForForlob i firestore/forlob.ts) og
 * /koeb-webhooken aldrig divergerer. Byggede forløb: niveau = admins eksplicitte
 * adgangsNiveau-valg. Kickstart/Kropsro: niveau følger produkt-typen.
 */
export function forlobAdgangFelter(forlob: {
	type?: ForlobType;
	adgangsNiveau?: 'basis' | 'premium';
	byggetForlob?: boolean;
	produktNoegle?: string;
}): {
	activeProduct: ForlobProduct | string;
	accessLevel: 'basis' | 'premium';
	accessSource: 'forløb';
	activeSubscription: false;
} {
	const activeProduct = produktTypeForForlob(forlob);
	const erPremium = forlob.byggetForlob
		? forlob.adgangsNiveau === 'premium'
		: activeProduct === KROPSRO_PRODUCT_ID;
	return {
		activeProduct,
		accessLevel: erPremium ? 'premium' : 'basis',
		accessSource: 'forløb',
		activeSubscription: false
	};
}

export type AllowedEmailStatus = 'invited' | 'registered';

export interface AllowedEmail {
	email: string;
	// CSV-felter — kun sat ved manuel forløbs-import. Ikke sat når webhook
	// opretter en allowedEmail som whitelist for et abonnement-køb.
	firstName?: string;
	lastName?: string;
	forlobId?: string;
	status?: AllowedEmailStatus;
	oprettet?: Timestamp;
	registreret?: Timestamp;
	// Adgangs-felter sat af Simplero-webhook. Kopieres over på userDoc
	// første gang brugeren logger ind.
	accessLevel?: 'none' | 'basis' | 'premium';
	accessSource?: 'abonnement' | 'forløb';
	// For byggede forløb er activeProduct forløbets egen produktNoegle (en fri
	// streng), derfor (string & {}) ud over de faste produkt-id'er.
	activeProduct?: 'kickstart' | 'premiumforløb' | 'basisabo' | 'premiumabo' | (string & {});
	activeSubscription?: boolean;
	simpleroCustomerId?: string;
	expiresAt?: number | null;
	// Abo-køb: købsdato + periode-slutdato fra Simplero (ms) + bevaret produkt/niveau.
	aboKoebtAt?: number;
	aboSlutterAt?: number;
	aboProdukt?: string;
	aboAccessLevel?: 'basis' | 'premium';
	updatedAt?: number;
	// Betalings-status sat af Simplero-webhooks. Skrives til allowedEmails
	// sammen med userDoc via opdaterBrugerEllerWhitelist.
	paymentFailedAt?: number | null;
	cancelledAt?: number;
	// Hvis sat, ignorerer sync abo-felterne (accessLevel/activeProduct/etc)
	// indtil tidspunktet er passeret. Bruges fx når kunden har købt basis-abo
	// men adgangen først skal aktiveres når et eksisterende forløb udløber.
	adgangFra?: number;
}

export interface CsvRow {
	email: string;
	firstName: string;
	lastName: string;
}

export interface CsvParseResult {
	rows: CsvRow[];
	skippedCanceled: number;
	skippedInvalid: number;
	fejl: string | null;
}

// ==============================================
// CSV-parsing — porteret fra reference/index.html
// Linn paster Simplero-CSV direkte i admin-UI'et.
// Auto-detekt af separator (tab/semikolon/komma) er nødvendigt fordi
// copy-paste fra Simplero ofte giver tab-separeret output mens en
// gemt fil typisk er komma-separeret.
// ==============================================

/**
 * Auto-detekter CSV-separator ud fra header-linjen.
 * Vælger den separator der har flest forekomster (tab > semikolon > komma).
 */
export function detectSeparator(headerLine: string): string {
	const tabs = (headerLine.match(/\t/g) ?? []).length;
	const semis = (headerLine.match(/;/g) ?? []).length;
	const commas = (headerLine.match(/,/g) ?? []).length;
	if (tabs >= semis && tabs >= commas && tabs > 0) return '\t';
	if (semis >= commas && semis > 0) return ';';
	return ',';
}

/**
 * Parser én CSV-linje med respekt for citationstegn.
 * Håndterer escaped quotes ("") inde i quoted fields.
 */
export function parseCsvLine(line: string, sep: string = ','): string[] {
	const out: string[] = [];
	let cur = '';
	let inQuote = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (inQuote) {
			if (ch === '"' && line[i + 1] === '"') {
				cur += '"';
				i++;
			} else if (ch === '"') {
				inQuote = false;
			} else {
				cur += ch;
			}
		} else {
			if (ch === '"') {
				inQuote = true;
			} else if (ch === sep) {
				out.push(cur);
				cur = '';
			} else {
				cur += ch;
			}
		}
	}
	out.push(cur);
	return out;
}

/**
 * Sætter første bogstav stort og resten små i hvert ord.
 */
export function capitalizeName(s: string): string {
	const t = (s ?? '').trim();
	if (!t) return '';
	return t
		.split(/\s+/)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
		.join(' ');
}

/**
 * Splitter "Name"-feltet i fornavn og efternavn.
 * Fornavn = første ord, efternavn = resten samlet.
 */
export function splitFullName(full: string): { firstName: string; lastName: string } {
	const clean = (full ?? '').trim().replace(/\s+/g, ' ');
	if (!clean) return { firstName: '', lastName: '' };
	const parts = clean.split(' ');
	if (parts.length === 1) {
		return { firstName: capitalizeName(parts[0]), lastName: '' };
	}
	return {
		firstName: capitalizeName(parts[0]),
		lastName: capitalizeName(parts.slice(1).join(' '))
	};
}

/**
 * Parser hele Simplero-CSV-indholdet til en liste af gyldige rækker.
 * Springer rækker over hvor "Canceled at" er udfyldt.
 * Fejler hvis "Email"-kolonnen ikke findes i header.
 */
export function parseSimpleroCsv(raw: string): CsvParseResult {
	const tom: CsvParseResult = {
		rows: [],
		skippedCanceled: 0,
		skippedInvalid: 0,
		fejl: null
	};

	const trimmed = (raw ?? '').trim();
	if (!trimmed) return { ...tom, fejl: 'CSV-indholdet er tomt.' };

	const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
	if (lines.length < 2) return { ...tom, fejl: 'CSV skal have mindst header + én række.' };

	lines[0] = lines[0].replace(/^﻿/, '');
	const sep = detectSeparator(lines[0]);
	const header = parseCsvLine(lines[0], sep).map((h) => h.trim().toLowerCase());

	const emailIdx = header.indexOf('email');
	const firstIdx = header.indexOf('first name');
	const lastIdx = header.indexOf('last name');
	const nameIdx = header.indexOf('name');
	const canceledIdx = header.indexOf('canceled at');

	if (emailIdx === -1) {
		return {
			...tom,
			fejl: `Kunne ikke finde "Email"-kolonne. Fundne kolonner: ${header.join(', ')}`
		};
	}

	const rows: CsvRow[] = [];
	let skippedCanceled = 0;
	let skippedInvalid = 0;

	for (let i = 1; i < lines.length; i++) {
		const cells = parseCsvLine(lines[i], sep);
		const email = (cells[emailIdx] ?? '').trim().toLowerCase();
		if (!email || !email.includes('@')) {
			skippedInvalid++;
			continue;
		}
		const canceled = canceledIdx >= 0 ? (cells[canceledIdx] ?? '').trim() : '';
		if (canceled) {
			skippedCanceled++;
			continue;
		}

		let firstName = '';
		let lastName = '';
		if (firstIdx >= 0 || lastIdx >= 0) {
			firstName = firstIdx >= 0 ? capitalizeName(cells[firstIdx] ?? '') : '';
			lastName = lastIdx >= 0 ? capitalizeName(cells[lastIdx] ?? '') : '';
		} else if (nameIdx >= 0) {
			const split = splitFullName(cells[nameIdx] ?? '');
			firstName = split.firstName;
			lastName = split.lastName;
		}

		rows.push({ email, firstName, lastName });
	}

	return { rows, skippedCanceled, skippedInvalid, fejl: null };
}

// ==============================================
// Forløb-status-helpers
// ==============================================

/**
 * Beregner hvor mange dage der er gået siden forløbet startede.
 *  0 = på selve startdagen (baseline / dag 0)
 *  1+ = dage efter start
 * -1 hvis dagen er før startdatoen (forløbet ikke startet endnu).
 *
 * Begge datoer normaliseres til kl 06:00 lokal tid før diff beregnes,
 * så et forløb der starter mandag tæller som dag 0 hele mandagen.
 */
export function dageSidenStart(startDato: Date, idag: Date = new Date()): number {
	const start = new Date(startDato);
	start.setHours(6, 0, 0, 0);
	const dag = new Date(idag);
	dag.setHours(6, 0, 0, 0);
	const ms = dag.getTime() - start.getTime();
	return Math.floor(ms / (24 * 60 * 60 * 1000));
}

/**
 * Returnerer hvor mange dage af forløbet der er låst op.
 *  -1 = forløbet er ikke startet endnu (eller startDato er null)
 *   0 = kun baseline-dag er åben
 *   N = dag N er åben (mellem 0 og antalDage)
 */
export function unlockedDays(
	startDato: Date | null,
	antalDage: number,
	idag: Date = new Date()
): number {
	if (!startDato) return -1;
	const dage = dageSidenStart(startDato, idag);
	if (dage < 0) return -1;
	return Math.min(antalDage, dage);
}

/**
 * Returnerer den dato dag N falder på i et forløb.
 * Dag 0 = startDato, dag 1 = startDato + 1 dag, osv.
 */
export function dagDato(startDato: Date, dagNummer: number): Date {
	const d = new Date(startDato);
	d.setHours(12, 0, 0, 0);
	d.setDate(d.getDate() + dagNummer);
	return d;
}

// ==============================================
// Forløbs-slut og bibliotek-bonus (90 dage)
//
// ÉN fælles kilde til hvornår et forløb slutter, så login-sync og
// (fremtidige) webhooks aldrig regner forskelligt. Slutdatoen udledes af
// startdato + antal dage og er FÆLLES for alle deltagere. Individuelle
// pause-/nul-dage rykker den IKKE (besluttet 9. juni 2026 for at holde
// reglen enkel).
// ==============================================

/**
 * Forløbets slut-tidspunkt i millisekunder: tidspunktet hvor adgangen
 * lukker, dvs. ved slutningen af forløbets sidste dag. Returnerer 0 hvis
 * forløbet mangler gyldig startdato eller antal dage, så kalderen kan
 * springe udløbs-beregningen over.
 *
 * Formlen (antalDage + 1) giver kunden hele sin sidste dag: er sidste
 * lektion på dag N (= start + N dage), lukker adgangen først ved
 * start + (N + 1) dage. Bevaret uændret fra den hidtidige login-sync så
 * ingen eksisterende kundes udløbsdato flytter sig.
 */
export function forlobSlutMs(startMs: number, antalDage: number): number {
	if (startMs <= 0 || antalDage <= 0) return 0;
	return startMs + (antalDage + 1) * MS_PER_DAG;
}

/**
 * Hvornår bibliotek-bonus-perioden slutter: forløbets slutdato plus 90
 * dage (BONUS_PERIODE_DAGE). Returnerer 0 hvis forløbets slut ikke kan
 * beregnes.
 */
export function bibliotekBonusSlutMs(startMs: number, antalDage: number): number {
	const slut = forlobSlutMs(startMs, antalDage);
	return slut > 0 ? slut + BONUS_PERIODE_DAGE * MS_PER_DAG : 0;
}
