// Pure helpers til AI svar-udkast.
//
// Bygger system-prompt og user-message til Anthropic Claude. Worker-endpointet
// /api/svar-udkast orkestrerer Firestore-kald og Anthropic-kald; helperne her
// håndterer kun formatering og parsing.

export interface KlientKontekst {
	fornavn: string;
	kundeType: string | null;
	dagIForlob: number | null;
	programValg: string | null;
}

export interface FaqItem {
	titel: string;
	svar: string;
}

export interface TidligereSvar {
	spoergsmaal: string;
	svar: string;
}

export interface UdkastResultat {
	udkast: string;
	lavSikkerhed: boolean;
	skip: boolean;
	skipBegrundelse: string | null;
}

const BASE_INSTRUKTION = `Du er Linn Bildtrup — ernæringsterapeut og forløbsleder for Linns Academy. \
En klient på et af dine forløb har stillet et spørgsmål via beskeder-modulet, og du skal lave et udkast til et svar.

Stil:
- Skriv på dansk
- Vær varm, direkte og personlig — brug klientens fornavn
- Hold svaret kort (3-8 sætninger) medmindre spørgsmålet kræver mere detalje
- Brug Linns tidligere svar nedenfor som forbillede for tonen
- Hvis FAQ'en dækker spørgsmålet direkte, brug formuleringen derfra
- Skriv ikke "kære" — Linn bruger "hej {navn}"

Lav-sikkerhed (sæt lavSikkerhed: true):
- Spørgsmål om medicin, recepter eller alvorlige symptomer
- Emner langt uden for ernæring/træning/vaner
- Når FAQ ikke dækker og Linns tidligere svar ikke giver godt match
- Foreslå i såfald at klienten kontakter relevant fagperson eller venter på at Linn svarer personligt

Skip (sæt skip: true):
- Beskeden er ren tak/ros uden faktisk spørgsmål
- Beskeden bekræfter blot at klienten har modtaget tidligere svar

Returnér KUN gyldigt JSON i nøjagtigt denne form (intet andet, ingen markdown):
{"udkast":"<svartekst>","lavSikkerhed":<bool>,"skip":<bool>,"skipBegrundelse":<null eller string>}`;

const TRIVIELLE_MOENSTRE = [
	/^tak\b/i,
	/^mange tak\b/i,
	/^tusind tak\b/i,
	/^super\b/i,
	/^perfekt\b/i,
	/^fedt\b/i,
	/^godt at vide\b/i,
	/^forstået\b/i,
	/^ok\b/i,
	/^jeg prøver det\b/i
];

/**
 * Returnerer true hvis beskeden ikke kræver et substantielt svar. Bruges som
 * billig pre-skip før vi kalder Anthropic. Claude-skip i prompten håndterer
 * de tilfælde denne misser.
 */
export function erTrivielBesked(tekst: string): boolean {
	const t = tekst.trim();
	if (t.length < 12) return true;
	const linjer = t.split('\n').filter((l) => l.trim().length > 0);
	if (linjer.length === 0) return true;
	const foerste = linjer[0].trim();
	for (const m of TRIVIELLE_MOENSTRE) {
		if (m.test(foerste) && t.length < 40) return true;
	}
	return false;
}

function trimTekst(s: string, maks: number): string {
	if (s.length <= maks) return s;
	return s.slice(0, maks - 1).trimEnd() + '…';
}

export function byggFaqTekst(items: FaqItem[]): string {
	if (items.length === 0) return '(FAQ er tom for dette forløb)';
	return items
		.map((it, i) => `[${i + 1}] ${it.titel}\n${trimTekst(it.svar, 600)}`)
		.join('\n\n');
}

export function byggTidligereSvarTekst(svar: TidligereSvar[]): string {
	if (svar.length === 0) return '(Ingen tidligere svar endnu — basér stilen på FAQ og hold den varm og direkte)';
	return svar
		.map(
			(s, i) =>
				`--- Eksempel ${i + 1} ---\nKlient spurgte: ${trimTekst(s.spoergsmaal, 300)}\nLinn svarede: ${trimTekst(s.svar, 600)}`
		)
		.join('\n\n');
}

export function byggVidenbaseTekst(uddrag: string[]): string {
	if (uddrag.length === 0) return '(Ingen videnbase-uddrag)';
	return uddrag.map((u, i) => `[${i + 1}] ${trimTekst(u, 800)}`).join('\n\n');
}

export function byggKlientKontekstTekst(k: KlientKontekst): string {
	const dele: string[] = [`Fornavn: ${k.fornavn}`];
	if (k.kundeType) dele.push(`Kundetype: ${k.kundeType}`);
	if (k.dagIForlob !== null) dele.push(`Dag i forløbet: ${k.dagIForlob}`);
	if (k.programValg) dele.push(`Valgt program: ${k.programValg}`);
	return dele.join(' · ');
}

interface SystemBlock {
	type: 'text';
	text: string;
	cache_control?: { type: 'ephemeral' };
}

/**
 * Bygger Anthropic system-prompten som content-blocks med cache_control på
 * den store statiske del. Alt før cache-markeren cacheres i 5 minutter.
 */
export function byggSystemBlocks(args: {
	faqTekst: string;
	videnbaseTekst: string;
	tidligereSvarTekst: string;
}): SystemBlock[] {
	const statiskKontekst = [
		'## FAQ for forløbet (autoritativt indhold)',
		args.faqTekst,
		'',
		'## Videnbase-uddrag',
		args.videnbaseTekst,
		'',
		"## Linns tidligere svar (stemme-eksempler)",
		args.tidligereSvarTekst
	].join('\n');

	return [
		{ type: 'text', text: BASE_INSTRUKTION },
		{ type: 'text', text: statiskKontekst, cache_control: { type: 'ephemeral' } }
	];
}

export function byggUserMessage(args: {
	klientKontekstTekst: string;
	sidsteBeskeder: string[];
	spoergsmaalTekst: string;
}): string {
	const dele: string[] = [];
	dele.push(`Klient: ${args.klientKontekstTekst}`);
	if (args.sidsteBeskeder.length > 0) {
		dele.push('');
		dele.push('Tidligere udveksling med denne klient:');
		dele.push(args.sidsteBeskeder.join('\n'));
	}
	dele.push('');
	dele.push('Nyt spørgsmål fra klienten:');
	dele.push(args.spoergsmaalTekst);
	dele.push('');
	dele.push('Lav et svar-udkast (eller skip hvis beskeden ikke kræver svar). Returnér JSON.');
	return dele.join('\n');
}

/**
 * Parser model-output som JSON. Claude bedes returnere ren JSON, men hvis den
 * indpakker i ```json eller tilføjer prosa rundt om, prøver vi at trække JSON
 * ud. Hvis vi ikke kan parse, returneres null og caller'en falder tilbage
 * til at vise rå tekst som lav-sikkerhed udkast.
 */
export function parseModelOutput(raw: string): UdkastResultat | null {
	const trimmet = raw.trim();
	const kandidater: string[] = [trimmet];
	const fence = trimmet.match(/```(?:json)?\s*([\s\S]*?)```/);
	if (fence) kandidater.push(fence[1].trim());
	const objMatch = trimmet.match(/\{[\s\S]*\}/);
	if (objMatch) kandidater.push(objMatch[0]);

	for (const k of kandidater) {
		try {
			const parsed = JSON.parse(k) as Partial<UdkastResultat>;
			if (typeof parsed.udkast !== 'string') continue;
			return {
				udkast: parsed.udkast,
				lavSikkerhed: parsed.lavSikkerhed === true,
				skip: parsed.skip === true,
				skipBegrundelse:
					typeof parsed.skipBegrundelse === 'string' ? parsed.skipBegrundelse : null
			};
		} catch {
			continue;
		}
	}
	return null;
}
