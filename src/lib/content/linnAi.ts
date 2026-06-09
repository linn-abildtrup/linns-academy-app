// Linn AI — typer og pure-funktioner.
//
// Premium-feature der lader klienter chatte med en AI-assistent baseret
// på Linns videnbase: PDFs/slides hun har uploadet + besvarede klient-
// spørgsmål. Bruger Anthropic Claude som backend.

import type { Timestamp } from 'firebase/firestore';

// ==============================================
// Videnbase
// ==============================================

export type VidenbaseKilde = 'pdf' | 'slide' | 'klient_spoergsmaal' | 'manual';

/**
 * Et dokument i Linns videnbase. Hver fil bliver parset til ren tekst og
 * gemt som ét eller flere chunks. Søges når en klient stiller et spørgsmål.
 */
export interface VidenbaseDokument {
	id: string;
	navn: string;
	kilde: VidenbaseKilde;
	tekst: string;
	tags?: string[];
	oprettetAt?: Timestamp;
	opdateretAt?: Timestamp;
}

// ==============================================
// Samtale
// ==============================================

export type AiRolle = 'user' | 'assistant';

export interface AiBesked {
	rolle: AiRolle;
	indhold: string;
	tidspunkt: Timestamp;
}

/**
 * En samtale mellem bruger og Linn AI. Hver bruger kan have flere
 * samtaler over tid (fx én pr emne). Samtalen er multi-turn — alle
 * tidligere beskeder sendes med ved hver query for kontekst.
 */
export interface AiSamtale {
	id: string;
	titel: string;
	beskeder: AiBesked[];
	oprettetAt: Timestamp;
	opdateretAt: Timestamp;
}

// ==============================================
// Rate limiting
// ==============================================

export const MAX_QUERIES_PR_DAG = 20;

/**
 * Nøgle til rate-limit-dokument. Bruges som doc-id i
 * users/{uid}/linnAiQuotaer/{dato} så vi kan tælle queries pr dag.
 */
export function quotaNoegle(dato: Date = new Date()): string {
	const aar = dato.getFullYear();
	const m = String(dato.getMonth() + 1).padStart(2, '0');
	const d = String(dato.getDate()).padStart(2, '0');
	return `${aar}-${m}-${d}`;
}

// ==============================================
// Chunking
// ==============================================

const MAX_CHUNK_TEGN = 4000;

/**
 * Deler en lang tekst op i chunks på max 4000 tegn pr stykke. Bruges når
 * en uploadet PDF/slide-fil er for stor til ét dokument. Bryder ved
 * paragraf-grænser når muligt for at bevare semantik.
 */
export function chunkTekst(tekst: string, maks: number = MAX_CHUNK_TEGN): string[] {
	const renset = tekst.trim();
	if (renset.length <= maks) return [renset];

	const chunks: string[] = [];
	const paragraffer = renset.split(/\n\s*\n/);
	let current = '';

	for (const p of paragraffer) {
		if ((current + '\n\n' + p).length > maks && current) {
			chunks.push(current.trim());
			current = p;
		} else {
			current = current ? current + '\n\n' + p : p;
		}
	}
	if (current.trim()) chunks.push(current.trim());

	// Hvis et enkelt paragraf er længere end maks, split med hård cut
	const finalChunks: string[] = [];
	for (const c of chunks) {
		if (c.length <= maks) {
			finalChunks.push(c);
		} else {
			for (let i = 0; i < c.length; i += maks) {
				finalChunks.push(c.slice(i, i + maks));
			}
		}
	}
	return finalChunks;
}

// ==============================================
// Kontekst-samling
// ==============================================

const MAX_KONTEKST_TEGN = 100_000;

/**
 * Samler videnbase til ét stort kontekst-string der kan sendes som system-
 * prompt. Hvis videnbasen er for stor, prioriteres dokumenter ud fra deres
 * relevans (simple keyword-match for nu — RAG/embeddings kommer senere).
 */
export function byggKontekst(
	dokumenter: VidenbaseDokument[],
	brugersBesked: string,
	maksTegn: number = MAX_KONTEKST_TEGN
): string {
	const sorteret = sorterEfterRelevans(dokumenter, brugersBesked);
	const dele: string[] = [];
	let total = 0;

	for (const d of sorteret) {
		const formattet = `[${kildeLabel(d.kilde)}: ${d.navn}]\n${d.tekst}\n\n---\n`;
		if (total + formattet.length > maksTegn) break;
		dele.push(formattet);
		total += formattet.length;
	}
	return dele.join('');
}

function sorterEfterRelevans(dokumenter: VidenbaseDokument[], besked: string): VidenbaseDokument[] {
	const ord = besked
		.toLowerCase()
		.split(/\s+/)
		.filter((w) => w.length >= 3);
	if (ord.length === 0) return dokumenter;

	const score = (d: VidenbaseDokument): number => {
		const tekst = (d.navn + ' ' + d.tekst).toLowerCase();
		let s = 0;
		for (const o of ord) {
			let idx = 0;
			while ((idx = tekst.indexOf(o, idx)) !== -1) {
				s++;
				idx += o.length;
			}
		}
		return s;
	};

	return [...dokumenter].sort((a, b) => score(b) - score(a));
}

function kildeLabel(kilde: VidenbaseKilde): string {
	switch (kilde) {
		case 'pdf':
			return 'PDF';
		case 'slide':
			return 'Præsentation';
		case 'klient_spoergsmaal':
			return 'Tidligere klient-spørgsmål';
		case 'manual':
			return 'Notat';
	}
}

// ==============================================
// System-prompt
// ==============================================

/**
 * Default persona-tekst. Admin kan redigere via linnAiKonfiguration/aktiv-doc.
 * Hvis admin har skrevet en custom version, bruges den i stedet for default.
 *
 * VIDENBASE-placeholder inkluderes automatisk når kontekst sendes til Claude.
 */
export const DEFAULT_SYSTEM_PROMPT = `Du er Linn AI — en virtuel assistent der bygger på Linns ekspertise inden for ernæring, træning, motivation, livsstil, overgangsalder, hormoner, mental sundhed, stress og søvn. Du svarer som om du var Linn selv: varmt, personligt, jordnært og opmuntrende, og bruger 'jeg' når det giver mening.

VIGTIGT — sådan svarer du:
- Brug Linns egne tidligere svar og materialer som primær kilde (se VIDENBASE nedenfor).
- Hvis videnbasen ikke dækker spørgsmålet, må du svare ud fra almen viden, men gør det tydeligt at det er generelt.
- Hold svarene konkrete og praktiske — ingen uendelige bullet-lister.
- Ved specifikke medicinske diagnoser, symptomer eller medicin: henvis VENLIGT til at brugeren tager kontakt til egen læge. Du må gerne forklare almen viden om tilstande, men ikke stille diagnoser eller anbefale specifik medicin.
- Ved psykiske kriser eller alvorlige tilstande: henvis til professionel hjælp.
- Skriv på dansk.

Når du svarer, skriv direkte og personligt — ikke 'Som AI vil jeg...'. Tal som Linn ville tale med en klient.`;

/**
 * Bygger den endelige system-prompt ved at kombinere persona-tekst med
 * videnbase-kontekst. Hvis customPrompt er givet, bruges den som persona;
 * ellers bruges DEFAULT_SYSTEM_PROMPT.
 */
/**
 * Fast instruktion (uafhaengig af admin's custom persona) der beder modellen
 * afslutte hvert svar med en sikkerheds-markoer. Tallet angiver hvor godt
 * Linns tidligere svar daekkede spoergsmaalet — bruges af kunde-UI'et til at
 * vise hvor sikker svaret er, og til at opfordre til at spoerge Linn ved tvivl.
 * Markoeren parses ud og vises ALDRIG til brugeren (se parseSikkerhed).
 */
const SIKKERHEDS_INSTRUKTION = `\n\nAFSLUT ALTID dit svar med en sikkerheds-markør på en helt ny linje i præcis dette format: [[SIKKERHED:N]] — hvor N er et tal fra 0 til 100 der angiver hvor godt LINNS TIDLIGERE SVAR ovenfor dækkede spørgsmålet. 100 = der fandtes et meget tæt matchende svar fra Linn. Lavt tal = du måtte gætte eller bruge almen viden. Skriv kun markøren én gang, til sidst.`;

export function byggSystemPrompt(
	videnbaseKontekst: string,
	customPrompt?: string,
	tidligereSvarTekst?: string
): string {
	const persona = customPrompt?.trim() || DEFAULT_SYSTEM_PROMPT;
	// Linns FAKTISKE tidligere svar (samme kilde som admin-svar-vaerktoejet) —
	// brug som forbillede for baade tone og indhold. Etape 1.
	const svar =
		tidligereSvarTekst && tidligereSvarTekst.trim()
			? `\n\nLINNS TIDLIGERE SVAR (dit vigtigste grundlag — svar som Linn ville, i tone og indhold):\n${tidligereSvarTekst}`
			: '';
	const videnbase = videnbaseKontekst
		? `\n\nVIDENBASE (Linns materialer):\n${videnbaseKontekst}`
		: '';
	const grundlag = svar + videnbase;
	const base = grundlag
		? persona + svar + videnbase
		: persona +
			'\n\n(Intet videns-grundlag endnu — brug din almene viden indtil Linn har svaret på spørgsmål.)';
	return base + SIKKERHEDS_INSTRUKTION;
}

/**
 * Udtraekker sikkerheds-markoeren [[SIKKERHED:N]] fra modellens raa svar.
 * Returnerer det rensede svar (uden markoer) + sikkerhed 0-100, eller null
 * hvis markoeren mangler/er ugyldig.
 */
export function parseSikkerhed(raat: string): { svar: string; sikkerhed: number | null } {
	const match = raat.match(/\[\[\s*SIKKERHED\s*:\s*(\d{1,3})\s*\]\]/i);
	if (!match) return { svar: raat.trim(), sikkerhed: null };
	const n = Math.max(0, Math.min(100, parseInt(match[1], 10)));
	const svar = raat.replace(match[0], '').trim();
	return { svar, sikkerhed: n };
}
