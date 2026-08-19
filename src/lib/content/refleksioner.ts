// Refleksionssvar — klienternes egne skriftlige svar paa dagens
// refleksionsspoergsmaal i et forloeb.
//
// Spoergsmaalet staar paa forloebet (forlob/{id}/vaneprogram/{dag}.reflection).
// Svaret staar hos kunden (users/{uid}/products/{skuffe}/vanedage/{dag}.note).
// Den her fil samler de to og laver alt det rene arbejde: afgraensning,
// gruppering og CSV. Ingen Firestore, saa den kan testes direkte.

/** Ét svar fra én klient paa én dag. */
export interface Refleksionssvar {
	uid: string;
	navn: string;
	email: string;
	dagNummer: number;
	/** Spoergsmaalet klienten svarede paa. Tom hvis dagen ingen havde. */
	spoergsmaal: string;
	svar: string;
	/** Hvornaar klienten gemte svaret. Null paa gamle svar uden tidsstempel. */
	gemtMs: number | null;
}

export interface DagGruppe {
	dagNummer: number;
	spoergsmaal: string;
	/** Holdets kalenderdato for dagen, udledt af forloebets start. */
	dato: string | null;
	svar: Refleksionssvar[];
}

export interface KlientGruppe {
	uid: string;
	navn: string;
	email: string;
	svar: Refleksionssvar[];
}

export type Afgraensning = 'dag' | 'dato';

/** Lokal ISO-dato (yyyy-mm-dd). Aldrig toISOString — den giver UTC. */
export function isoDato(d: Date): string {
	const p = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Holdets kalenderdato for en forloebsdag. Dag 0 er startdagen (baseline),
 * dag N er N kalenderdage efter. Kunder med pauser rykker sig i forhold til
 * det her, og derfor viser hvert svar ogsaa sin egen gemt-dato.
 */
export function datoForDag(startMs: number, dagNummer: number): string {
	const start = new Date(startMs);
	const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
	d.setDate(d.getDate() + dagNummer);
	return isoDato(d);
}

/** Dansk visning af en lokal ISO-dato: 2026-08-16 bliver 16. august. */
const MAANEDER = [
	'januar',
	'februar',
	'marts',
	'april',
	'maj',
	'juni',
	'juli',
	'august',
	'september',
	'oktober',
	'november',
	'december'
];

export function datoTekst(iso: string): string {
	const [aar, m, d] = iso.split('-').map(Number);
	if (!aar || !m || !d) return iso;
	return `${d}. ${MAANEDER[m - 1]} ${aar}`;
}

/** Kort visning med klokkeslaet: 16/8 kl. 09.14. */
export function tidspunktTekst(ms: number | null): string {
	if (!ms) return '';
	const d = new Date(ms);
	const p = (n: number) => String(n).padStart(2, '0');
	return `${d.getDate()}/${d.getMonth() + 1} kl. ${p(d.getHours())}.${p(d.getMinutes())}`;
}

/**
 * Afgraenser svarene. 'dag' bruger forloebsdagen, 'dato' bruger hvornaar
 * klienten faktisk skrev. De to giver forskellige resultater for kunder med
 * pauser, og det er hele pointen med at kunne vaelge.
 *
 * Tomme fra/til betyder ingen graense i den ende.
 */
export function afgraensSvar(
	svar: Refleksionssvar[],
	afgraensning: Afgraensning,
	fra: string,
	til: string
): Refleksionssvar[] {
	if (afgraensning === 'dag') {
		const fraDag = fra.trim() === '' ? null : Number(fra);
		const tilDag = til.trim() === '' ? null : Number(til);
		return svar.filter((s) => {
			if (fraDag !== null && Number.isFinite(fraDag) && s.dagNummer < fraDag) return false;
			if (tilDag !== null && Number.isFinite(tilDag) && s.dagNummer > tilDag) return false;
			return true;
		});
	}
	const fraIso = fra.trim();
	const tilIso = til.trim();
	return svar.filter((s) => {
		// Svar uden tidsstempel kan ikke placeres paa en dato. De falder ud af
		// dato-afgraensningen, men er stadig med naar man afgraenser paa dag.
		if (!s.gemtMs) return false;
		const iso = isoDato(new Date(s.gemtMs));
		if (fraIso && iso < fraIso) return false;
		if (tilIso && iso > tilIso) return false;
		return true;
	});
}

/** Grupperer pr forloebsdag, stigende. Spoergsmaalet tages fra foerste svar. */
export function grupperPrDag(svar: Refleksionssvar[], startMs: number | null): DagGruppe[] {
	const map = new Map<number, Refleksionssvar[]>();
	for (const s of svar) {
		const liste = map.get(s.dagNummer);
		if (liste) liste.push(s);
		else map.set(s.dagNummer, [s]);
	}
	return [...map.entries()]
		.sort((a, b) => a[0] - b[0])
		.map(([dagNummer, liste]) => ({
			dagNummer,
			spoergsmaal: liste.find((s) => s.spoergsmaal)?.spoergsmaal ?? '',
			dato: startMs === null ? null : datoForDag(startMs, dagNummer),
			svar: [...liste].sort((a, b) => a.navn.localeCompare(b.navn, 'da'))
		}));
}

/** Grupperer pr klient, flest svar foerst. Hendes svar staar i dag-orden. */
export function grupperPrKlient(svar: Refleksionssvar[]): KlientGruppe[] {
	const map = new Map<string, KlientGruppe>();
	for (const s of svar) {
		const fundet = map.get(s.uid);
		if (fundet) fundet.svar.push(s);
		else map.set(s.uid, { uid: s.uid, navn: s.navn, email: s.email, svar: [s] });
	}
	return [...map.values()]
		.map((k) => ({ ...k, svar: [...k.svar].sort((a, b) => a.dagNummer - b.dagNummer) }))
		.sort((a, b) => b.svar.length - a.svar.length || a.navn.localeCompare(b.navn, 'da'));
}

/** Ét felt i en semikolon-separeret CSV. Samme regler som Spoergsmaal-siden. */
export function csvFelt(vaerdi: string): string {
	const tekst = (vaerdi ?? '').toString();
	if (/[";\n\r]/.test(tekst)) return '"' + tekst.replace(/"/g, '""') + '"';
	return tekst;
}

/**
 * Bygger CSV-teksten. Semikolon som skilletegn og BOM foran, saa Excel og
 * Numbers aabner den med korrekte danske tegn uden at man skal importere.
 */
export function byggCsv(
	svar: Refleksionssvar[],
	forlobNavn: string,
	startMs: number | null
): string {
	const header = ['Forløb', 'Dag', 'Dato', 'Klient', 'Mail', 'Spørgsmål', 'Svar'];
	const raekker = svar.map((s) => [
		forlobNavn,
		String(s.dagNummer),
		s.gemtMs ? isoDato(new Date(s.gemtMs)) : startMs === null ? '' : datoForDag(startMs, s.dagNummer),
		s.navn,
		s.email,
		s.spoergsmaal,
		s.svar
	]);
	const linjer = [header, ...raekker].map((r) => r.map(csvFelt).join(';'));
	return '﻿' + linjer.join('\r\n');
}

/** Filnavn til download: refleksioner-kropsro-16-aug-20260819.csv */
export function csvFilnavn(forlobNavn: string, nu: Date): string {
	const p = (n: number) => String(n).padStart(2, '0');
	const slug =
		forlobNavn
			.toLowerCase()
			.replace(/æ/g, 'ae')
			.replace(/ø/g, 'oe')
			.replace(/å/g, 'aa')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'forloeb';
	return `refleksioner-${slug}-${nu.getFullYear()}${p(nu.getMonth() + 1)}${p(nu.getDate())}.csv`;
}
