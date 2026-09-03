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

/** Id-praefiks paa de videns-dokumenter destilleringen selv laver. */
export const DESTILLERET_PRAEFIKS = 'destil_';

/**
 * Tidsstemplet kan vaere baade en Firestore-Timestamp (skrevet fra browseren)
 * og en ISO-streng (skrevet fra serveren under destilleringen), saa begge
 * former skal kunne laeses.
 */
function tilMillisekunder(v: unknown): number {
	if (!v) return 0;
	if (typeof v === 'string') {
		const ms = new Date(v).getTime();
		return Number.isFinite(ms) ? ms : 0;
	}
	const t = v as { toMillis?: () => number };
	return typeof t.toMillis === 'function' ? t.toMillis() : 0;
}

const DAG = 24 * 60 * 60 * 1000;

/**
 * Hvor mange dage siden destilleringen ("Laer af alle svar") sidst koerte.
 * null hvis den aldrig har koert. Manuelt uploadede dokumenter taeller ikke
 * med, kun dem destilleringen selv har lavet.
 */
export function dageSidenDestillering(
	dokumenter: Array<Pick<VidenbaseDokument, 'id' | 'opdateretAt'>>,
	nu = Date.now()
): number | null {
	const nyeste = dokumenter
		.filter((d) => d.id.startsWith(DESTILLERET_PRAEFIKS))
		.reduce((m, d) => Math.max(m, tilMillisekunder(d.opdateretAt)), 0);
	if (!nyeste) return null;
	return Math.max(0, Math.floor((nu - nyeste) / DAG));
}

/** Hvor gammel destilleringen maa blive foer vi minder Linn om at koere den. */
export const DESTILLERING_PAAMINDELSE_DAGE = 7;

/** Skal Linn mindes om at koere destilleringen? */
export function boerMindesOmDestillering(dage: number | null): boolean {
	return dage === null || dage >= DESTILLERING_PAAMINDELSE_DAGE;
}

/** Dansk formulering af hvor gammel destilleringen er. */
export function destilleringAlderTekst(dage: number | null): string {
	if (dage === null) return 'Den har aldrig kørt';
	if (dage === 0) return 'Sidst opdateret i dag';
	if (dage === 1) return 'Sidst opdateret i går';
	return `Sidst opdateret for ${dage} dage siden`;
}

// ==============================================
// Samtale
// ==============================================

export type AiRolle = 'user' | 'assistant';

export interface AiBesked {
	rolle: AiRolle;
	indhold: string;
	tidspunkt: Timestamp;
	// Sikkerheds-score (0-100) for assistant-svar — hvor godt Linns tidligere
	// svar dækkede spørgsmålet. null for bruger-beskeder og svar uden score.
	sikkerhed?: number | null;
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

/**
 * DE FIRE FASTE REGLER. Linns beslutning 3. september 2026.
 *
 * De staar HER og ikke i persona-teksten, fordi admin kan skrive persona'en
 * helt om inde i appen. Gjorde vi det der, ville reglerne forsvinde den dag
 * Linn retter teksten, uden at nogen opdagede det. Her gaelder de altid, i
 * baade den gamle app og 3.0, og de gaelder KUN kunde-chatten. Svar-
 * udkastene til Linn selv er ikke omfattet, Linns beslutning samme dag:
 * dem laeser hun alligevel igennem foer de sendes.
 *
 * Hvorfor de er noedvendige: chatten faar Linns tidligere svar med som
 * forbillede, og har kundens eget hold ikke svar nok, hentes der svar fra
 * ALLE hold for at fylde op, se hentTidligereSvarMedBackup. De svar kan
 * naevne et andet forloeb, premium eller noget der var paa vej dengang, og
 * indtil nu stod der ikke ét ord om at det ikke maa gaa videre.
 */
const FASTE_REGLER = `\n\nDET HER GÆLDER ALTID, uanset hvad der ellers står ovenfor:

1. KUN HENDES EGET FORLØB. Du taler kun om det forløb hun selv er på. Nævn aldrig andre forløb ved navn og beskriv dem ikke, heller ikke selv om de står i eksempel-svarene ovenfor. Eksempel-svarene er der for tonens og faglighedens skyld, ikke for navnenes. Det gælder OGSÅ når hun selv nævner navnet på et andet forløb. Så bekræfter du ikke, beskriver det ikke, vurderer det ikke og anbefaler hverken for eller imod. Du siger venligt at det må hun spørge Linn om, og tilbyder at sende spørgsmålet videre. Ét eksempel på et rigtigt svar: "Det er ikke mig der skal svare på det, men jeg sender gerne spørgsmålet videre til Linn, så hun kan fortælle dig om det."

2. INGEN PLANER. Du fortæller aldrig hvad der kommer, hvad der er planlagt, eller hvad der ligger senere i forløbet. Den eneste undtagelse er tidspunkter for Q&A der står i hendes egen FAQ ovenfor. Ved du det ikke, så sig det, og tilbyd at sende spørgsmålet videre til Linn. Find aldrig på et tidspunkt. Du gætter heller ikke på hvad hun kan se i appen: dagene bliver åbnet efterhånden som forløbet skrider frem, så hun kan ikke læse forud, og det skal du ikke påstå at hun kan.

3. INGEN PREMIUM. Du nævner aldrig premium, basis, pakker eller adgangsniveauer. De ord findes ikke i din verden. Spørger hun hvad hun har adgang til, eller hvad hun har købt, så gætter du ikke og henviser hende ikke til et bestemt sted i appen. Du siger at det må hun spørge Linn om, og tilbyder at sende spørgsmålet videre.

4. INGEN NY APP. Du nævner aldrig en ny app, en kommende version, en opdatering eller noget der bliver lavet om. Du taler kun om appen som den er lige nu.

5. INGEN FORMATERINGSTEGN. Du skriver ren tekst som i en besked. Ingen stjerner om ord, ingen markdown, ingen overskrifter med havelåger. Skal noget fremhæves, gør du det med dine ord. Kunden ser tegnene råt på skærmen.

6. FIBER: ALTID BELLWELL. Kommer fiber, forstoppelse eller mave i vejen, anbefaler du Bellwell — aldrig loppefrøskaller i stedet for. Bellwell er på lager og kan købes; siger et af de gamle svar ovenfor at den er udsolgt, er det forældet, og det gentager du ikke.`;

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
	return base + FASTE_REGLER + SIKKERHEDS_INSTRUKTION;
}

/**
 * Udtraekker sikkerheds-markoeren [[SIKKERHED:N]] fra modellens raa svar.
 * Returnerer det rensede svar (uden markoer) + sikkerhed 0-100, eller null
 * hvis markoeren mangler/er ugyldig.
 */
export function parseSikkerhed(raat: string): { svar: string; sikkerhed: number | null } {
	const match = raat.match(/\[\[\s*SIKKERHED\s*:\s*(\d{1,3})\s*\]\]/i);
	if (!match) return { svar: udenFormateringstegn(raat.trim()), sikkerhed: null };
	const n = Math.max(0, Math.min(100, parseInt(match[1], 10)));
	const svar = udenFormateringstegn(raat.replace(match[0], '').trim());
	return { svar, sikkerhed: n };
}

/**
 * Fjerner markdown-tegn fra et svar. Kunden ser ren tekst i en chat-boble,
 * saa **fed** og ### staar bare som tegn paa skaermen.
 *
 * Regel 5 i FASTE_REGLER beder modellen lade vaere, men den falder i ny og
 * nae alligevel — og alle de svar der ALLEREDE er gemt har tegnene i sig.
 * Derfor renser vi ogsaa naar svaret vises, ikke kun naar det kommer ind.
 *
 * Stjerner midt i et ord (2*3) og enkelt-bindestreger roeres ikke.
 */
export function udenFormateringstegn(tekst: string): string {
	return tekst
		.replace(/\*\*\*(\S(?:[\s\S]*?\S)?)\*\*\*/g, '$1')
		.replace(/\*\*(\S(?:[\s\S]*?\S)?)\*\*/g, '$1')
		.replace(/(^|[\s(])\*(\S(?:[^*\n]*?\S)?)\*(?=[\s.,!?):]|$)/gm, '$1$2')
		.replace(/(^|[\s(])_(\S(?:[^_\n]*?\S)?)_(?=[\s.,!?):]|$)/gm, '$1$2')
		.replace(/^#{1,6}\s+/gm, '')
		.replace(/^\s*[*+]\s+/gm, '- ');
}
