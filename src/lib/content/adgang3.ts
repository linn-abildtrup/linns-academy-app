// ============================================================
// Adgangs-model for Linns Academy 3.0. Se SPEC-3.0.md afsnit 2.
//
// KERNEPRINCIP: kunden ejer sine adgange som RAEKKER med fra/til.
// Ingen raekke overskriver en anden. En kunde kan have abonnement OG
// forloeb aktivt samtidig. Det er forskellen fra den gamle model, hvor
// "aktivt forloeb vinder" (se adgangResolver.ts linje 49).
//
// VIGTIGT: dette modul er NYT og staar ved siden af adgangResolver.ts.
// Den gamle app bruger fortsat adgangResolver.ts, og den maa ikke roeres.
// De to lever side om side indtil den gamle flade pensioneres.
//
// Raekkerne UDLEDES i denne omgang af de felter der allerede staar paa
// kunden (se SPEC-3.0.md afsnit 2.2.1). Simplero-webhooken skriver dem
// ikke, fordi den ikke maa aendres. Naar den gamle app pensioneres kan
// udledningen erstattes af rigtige skrevne data.
//
// Rene funktioner uden Firestore, saa alle overgange kan testes.
// ============================================================

import { forlobSlutMs, bibliotekBonusSlutMs, dageSidenStart } from './forlobAdgang';
import { dagNummerMedNulDage, forlobSlutMedNulDage, produktHarNulDage } from './nulDage3';

/**
 * Kundens pause-dage, som datoer paa formen YYYY-MM-DD, slaaet op pr
 * produkt. Tom hvis hun ingen har, og det er langt det almindeligste:
 * 12 ud af 615 kunder havde brugt nul-dage den 9. august 2026.
 *
 * Kun Kropsro kan holde pause. Se nulDage3.ts.
 */
export type NulDageKilde = Record<string, string[]>;

function nulDageFor(kilde: NulDageKilde, produkt: string): string[] {
	if (!produktHarNulDage(produkt)) return [];
	return kilde[produkt] ?? [];
}

/** Hvad en adgangs-raekke daekker. */
export type AdgangArt = 'abo' | 'forlob' | 'bonus';

/**
 * Hvor raekken kommer fra. 'udledt' bruges saa laenge raekkerne beregnes
 * af de gamle felter i stedet for at vaere skrevet af en webhook.
 */
export type AdgangKilde = 'simplero' | 'manuel' | 'bonus' | 'udledt';

/**
 * En adgangs-raekke. Bliver aldrig overskrevet eller slettet. En opsigelse
 * saetter `til`, den fjerner ikke raekken.
 */
export interface Adgang {
	art: AdgangArt;
	/** Produktet: 'app', 'kickstart', 'kropsro' eller et bygget forloebs-id. */
	produkt: string;
	/** Kun for art='forlob'. Hvilket hold hun er tilmeldt. */
	forlobId?: string;
	/** Hvornaar adgangen begynder (ms). */
	fra: number;
	/** Hvornaar den slutter (ms). null = loebende uden slutdato. */
	til: number | null;
	kilde: AdgangKilde;
}

/** Et forloeb, som udledningen har brug for at kende. */
export interface ForlobKilde {
	id: string;
	navn: string;
	/** Forloebets startdato i ms. Dag 0 = baseline = denne dato. */
	startMs: number;
	antalDage: number;
	/** 'kickstart' | 'kropsro' | bygget forloebs-produktnoegle. */
	produkt: string;
}

/**
 * De felter paa den eksisterende UserDoc som udledningen laeser. Bevidst
 * en smal type i stedet for hele UserDoc, saa det er tydeligt praecis
 * hvilke gamle felter 3.0 afhaenger af.
 */
export interface KundeFelter {
	forlobIds?: string[];
	/**
	 * Gennemfoerte forloeb der er taget ud af forlobIds. Skal med i
	 * udledningen, ellers mister kunden adgangen til sit gamle materiale.
	 */
	afsluttedeForlobIds?: string[];
	aboKoebtAt?: number;
	aboSlutterAt?: number;
	aboProdukt?: string;
	activeProduct?: string;
	activeSubscription?: boolean;
	accessSource?: string;
	bonusPeriodEndsAt?: number | null;
	createdAt?: number;
}

/** Et aktivt forloeb, opgjort for et bestemt tidspunkt. */
export interface AktivtForlob {
	forlobId: string;
	navn: string;
	produkt: string;
	/** 0-baseret. Dag 0 = startdato = baseline. Se forlobAdgang.dageSidenStart. */
	dagNummer: number;
	antalDage: number;
	startMs: number;
	slutMs: number;
}

/** Et forloeb hun har gennemfoert. Vises som diplom paa forsiden. */
export interface GennemfoertForlob {
	forlobId: string;
	navn: string;
	/** Aarstallet forloebet sluttede. Staar paa diplomet. */
	aar: number;
	slutMs: number;
}

/**
 * Hvad kunden har adgang til lige nu. Erstatter den gamle models enkelte
 * `state`-vaerdi ('forlobskunde' | 'modulbruger' | 'udlobet'), som kun
 * kunne rumme én ting ad gangen.
 */
export interface Adgangsbillede {
	/** Maa hun bruge app-funktionerne. Sand ved aktivt abo ELLER aktivt forloeb. */
	harApp: boolean;
	/** Alle aktive forloeb. Ikke kun det ene der "vinder". */
	aktiveForlob: AktivtForlob[];
	/** Forloebs-id'er hun har gennemfoert. Til biblioteket. */
	tidligereForlob: string[];
	/** App-adgang eller loebende bonus-perionde efter et forloeb. */
	harBibliotek: boolean;
	/** Samlet tid med adgang, abo og forloeb lagt sammen. Pauser taelles ikke med. */
	medlemstidMs: number;
	/** Gennemfoerte forloeb, nyeste foerst. */
	gennemfoerte: GennemfoertForlob[];
	/**
	 * Datoer hvor hun har sat forloebet paa pause, YYYY-MM-DD. Bruges af
	 * datostrimlen til at maerke dagen som Pause. Tom for alle andre end
	 * Kropsro-kunder, hvilket er langt de fleste.
	 */
	nulDatoer: Set<string>;
}

/** Er raekken aktiv paa tidspunktet `nu`. Halvaabent interval [fra, til). */
export function erAktiv(a: Adgang, nu: number): boolean {
	if (nu < a.fra) return false;
	return a.til === null || nu < a.til;
}

/**
 * Udleder adgangs-raekkerne af de felter der allerede staar paa kunden.
 *
 * `forlob` er de forloebs-dokumenter der matcher kundens forlobIds. Mangler
 * et forloeb i listen, springes det over i stedet for at gaette paa datoer.
 */
export function udledAdgange(
	felter: KundeFelter,
	forlob: ForlobKilde[],
	nulDage: NulDageKilde = {}
): Adgang[] {
	const raekker: Adgang[] = [];
	const forlobPrId = new Map(forlob.map((f) => [f.id, f]));

	// ── Forloebs-raekker ────────────────────────────────────────────
	// Én raekke pr forloeb kunden nogensinde har vaeret paa. forlobIds var
	// oprindeligt append-only og dermed en komplet historik, men
	// symptomcheck-rettelsen flyttede udloebne forloeb til
	// afsluttedeForlobIds. Begge felter skal derfor med — ellers falder et
	// gennemfoert forloeb ud af billedet og kunden mister sit materiale.
	const forlobHistorik = Array.from(
		new Set([...(felter.forlobIds ?? []), ...(felter.afsluttedeForlobIds ?? [])])
	);
	for (const id of forlobHistorik) {
		const f = forlobPrId.get(id);
		if (!f || f.startMs <= 0 || f.antalDage <= 0) continue;
		// Har hun holdt pause, slutter forloebet tilsvarende senere.
		// Uden det ville en Kropsro-kunde med 21 pause-dage miste
		// adgangen tre uger for tidligt. Se nulDage3.ts.
		const pause = nulDageFor(nulDage, f.produkt);
		const slut =
			pause.length > 0
				? forlobSlutMedNulDage(f.startMs, f.antalDage, pause)
				: forlobSlutMs(f.startMs, f.antalDage);
		if (slut <= 0) continue;
		raekker.push({
			art: 'forlob',
			produkt: f.produkt,
			forlobId: f.id,
			fra: f.startMs,
			til: slut,
			kilde: 'udledt'
		});
	}

	// ── Abo-raekke ─────────────────────────────────────────────────
	// aboProdukt er skyggefeltet den gamle model brugte til at huske
	// abonnementet mens et forloeb overskrev activeProduct. Netop derfor
	// er det den mest paalidelige kilde til "har hun et abonnement".
	const aboProdukt =
		felter.aboProdukt ??
		(felter.accessSource === 'abonnement' ? felter.activeProduct : undefined) ??
		(felter.activeSubscription ? 'app' : undefined);

	if (aboProdukt) {
		raekker.push({
			art: 'abo',
			produkt: aboProdukt,
			// Mangler koebsdato (gamle konti oprettet foer feltet fandtes) falder
			// vi tilbage paa kontoens oprettelse, saa raekken ikke starter i 1970.
			fra: felter.aboKoebtAt ?? felter.createdAt ?? 0,
			// undefined slutdato = comp- eller manuel konto med loebende adgang.
			til: felter.aboSlutterAt ?? null,
			kilde: 'udledt'
		});
	}

	// ── Bonus-raekke ───────────────────────────────────────────────
	// 90 dages bibliotek-bonus efter et forloeb. Egen art, fordi bonus KUN
	// giver bibliotek. Ville den vaere art='abo', ville harApp faelagtigt
	// blive sand i bonus-perioden.
	const bonusSlut = felter.bonusPeriodEndsAt ?? null;
	if (bonusSlut && bonusSlut > 0) {
		// Bonus begynder naar det seneste forloeb slutter. Kan vi ikke regne
		// det ud, lader vi den begynde ved bonus-slut minus 90 dage via
		// bibliotekBonusSlutMs' modstykke: vi bruger seneste forloebs slut.
		const senesteForlobSlut = raekker
			.filter((r) => r.art === 'forlob' && r.til !== null)
			.reduce((maks, r) => Math.max(maks, r.til as number), 0);
		raekker.push({
			art: 'bonus',
			produkt: 'bibliotek',
			fra: senesteForlobSlut > 0 ? senesteForlobSlut : bonusSlut,
			til: bonusSlut,
			kilde: 'bonus'
		});
	}

	return raekker;
}

const DOEGN_MS = 24 * 60 * 60 * 1000;

/**
 * Hvor laenge kunden i alt har vaeret med, opgjort paa `nu`.
 *
 * Abo- og forloebs-raekker laegges sammen, og perioder der overlapper
 * taelles kun én gang. Har hun meldt sig ud og er kommet med igen,
 * taelles pausen IKKE med: der staar den tid hun har haft adgang, ikke
 * tiden siden hun foerste gang koebte.
 *
 * Bonus-raekker taeller ikke. Bonus giver kun bibliotek, og de 90 dage er
 * ikke et medlemskab.
 */
export function samletAdgangstidMs(adgange: Adgang[], nu: number): number {
	// Klip hver raekke til fortiden. En loebende raekke (til=null) slutter
	// ved nu, og fremtidige raekker giver ingen tid.
	const perioder = adgange
		.filter((a) => a.art === 'abo' || a.art === 'forlob')
		.map((a) => ({ fra: a.fra, til: Math.min(a.til ?? nu, nu) }))
		.filter((p) => p.til > p.fra)
		.sort((a, b) => a.fra - b.fra);

	let sum = 0;
	let aabenFra = 0;
	let aabenTil = 0;

	for (const p of perioder) {
		if (aabenTil === 0) {
			aabenFra = p.fra;
			aabenTil = p.til;
		} else if (p.fra <= aabenTil) {
			// Overlapper eller stoeder op til den aabne periode: slaa sammen.
			aabenTil = Math.max(aabenTil, p.til);
		} else {
			// Hul imellem. Den aabne periode laegges til, pausen springes over.
			sum += aabenTil - aabenFra;
			aabenFra = p.fra;
			aabenTil = p.til;
		}
	}
	if (aabenTil > 0) sum += aabenTil - aabenFra;

	return sum;
}

/**
 * Medlemstiden som den staar paa forsiden. Under et aar i maaneder,
 * derefter aar og maaneder, og fra to aar kun hele aar, saa linjen ikke
 * bliver lang. Returnerer tom streng under en maaned, saa en helt ny
 * kunde ikke faar at vide at hun har vaeret med i nul maaneder.
 */
export function formatMedlemstid(ms: number): string {
	const maanederIAlt = Math.floor(ms / (DOEGN_MS * 30.44));
	if (maanederIAlt < 1) return '';
	if (maanederIAlt < 12) return `${maanederIAlt} ${maanederIAlt === 1 ? 'måned' : 'måneder'}`;

	const aar = Math.floor(maanederIAlt / 12);
	const rest = maanederIAlt % 12;
	const aarTekst = `${aar} år`;
	if (aar >= 2 || rest === 0) return aarTekst;
	return `${aarTekst} og ${rest} ${rest === 1 ? 'måned' : 'måneder'}`;
}

/**
 * De forloeb hun har gennemfoert, nyeste foerst. Bliver til diplomer paa
 * forsiden. Et forloeb taeller som gennemfoert naar slutdatoen er passeret,
 * uanset hvor meget af indholdet hun naaede. Det er en anerkendelse af at
 * hun var med, ikke en karakter.
 */
export function gennemfoerteForlob(
	adgange: Adgang[],
	forlob: ForlobKilde[],
	nu: number
): GennemfoertForlob[] {
	const forlobPrId = new Map(forlob.map((f) => [f.id, f]));
	return adgange
		.filter((a) => a.art === 'forlob' && a.til !== null && nu >= a.til && a.forlobId)
		.map((a) => {
			const slutMs = a.til as number;
			return {
				forlobId: a.forlobId as string,
				navn: forlobPrId.get(a.forlobId as string)?.navn ?? a.produkt,
				aar: new Date(slutMs).getFullYear(),
				slutMs
			};
		})
		.sort((a, b) => b.slutMs - a.slutMs);
}

/**
 * Opgoer hvad kunden har adgang til paa tidspunktet `nu`.
 *
 * Modsat den gamle resolver vaelger denne IKKE én vinder. Et aktivt forloeb
 * laegger sig oven paa app-adgangen i stedet for at erstatte den.
 */
export function resolverAdgangsbillede(
	nu: number,
	adgange: Adgang[],
	forlob: ForlobKilde[] = [],
	nulDage: NulDageKilde = {}
): Adgangsbillede {
	const forlobPrId = new Map(forlob.map((f) => [f.id, f]));

	const aktiveForlobsraekker = adgange.filter((a) => a.art === 'forlob' && erAktiv(a, nu));

	const aktiveForlob: AktivtForlob[] = aktiveForlobsraekker.map((a) => {
		const f = a.forlobId ? forlobPrId.get(a.forlobId) : undefined;
		const antalDage = f?.antalDage ?? 0;
		return {
			forlobId: a.forlobId ?? '',
			navn: f?.navn ?? a.produkt,
			produkt: a.produkt,
			// Samme 0-baserede konvention og samme kl 06:00-normalisering som
			// den gamle app, saa dagnummeret aldrig afviger et doegn.
			//
			// Har hun holdt pause, staar dagnummeret stille de dage. Uden
			// det ville en Kropsro-kunde med 21 pause-dage faa dag 63 hvor
			// hun skulle have dag 42, altsaa tre ugers forkert indhold.
			dagNummer: dagNummerMedNulDage(
				Math.min(antalDage, Math.max(0, dageSidenStart(new Date(a.fra), new Date(nu)))),
				antalDage,
				nulDageFor(nulDage, a.produkt),
				nu
			),
			antalDage,
			startMs: a.fra,
			slutMs: a.til ?? 0
		};
	});

	const harAktivtAbo = adgange.some((a) => a.art === 'abo' && erAktiv(a, nu));
	// Forloebskunden faar app-adgang mens forloebet koerer. Se SPEC-3.0.md 2.4.
	const harApp = harAktivtAbo || aktiveForlob.length > 0;

	const tidligereForlob = adgange
		.filter((a) => a.art === 'forlob' && a.til !== null && nu >= a.til)
		.map((a) => a.forlobId ?? '')
		.filter((id) => id !== '');

	const harAktivBonus = adgange.some((a) => a.art === 'bonus' && erAktiv(a, nu));

	return {
		harApp,
		aktiveForlob,
		tidligereForlob,
		harBibliotek: harApp || harAktivBonus,
		medlemstidMs: samletAdgangstidMs(adgange, nu),
		gennemfoerte: gennemfoerteForlob(adgange, forlob, nu),
		// Samlet paa tvaers af hendes aktive forloeb, saa strimlen kan
		// slaa en dato op uden at vide hvilket produkt den hoerer til.
		nulDatoer: new Set(aktiveForlob.flatMap((f) => nulDageFor(nulDage, f.produkt)))
	};
}

/**
 * Bekvemmelighed: udled raekkerne og opgoer billedet i ét kald.
 */
export function adgangsbilledeFor(
	nu: number,
	felter: KundeFelter,
	forlob: ForlobKilde[],
	nulDage: NulDageKilde = {}
): Adgangsbillede {
	return resolverAdgangsbillede(nu, udledAdgange(felter, forlob, nulDage), forlob, nulDage);
}

/** Genbrugt saa kaldere ikke skal importere fra to moduler. */
export { forlobSlutMs, bibliotekBonusSlutMs };
