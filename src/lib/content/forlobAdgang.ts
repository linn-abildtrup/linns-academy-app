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
	activeProduct?: 'kickstart' | 'premiumforløb' | 'basisabo' | 'premiumabo';
	activeSubscription?: boolean;
	simpleroCustomerId?: string;
	expiresAt?: number | null;
	updatedAt?: number;
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
