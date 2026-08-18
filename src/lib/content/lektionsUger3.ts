// ============================================================
// Lektionerne delt op i uger. Ren logik, ingen database.
//
// HVORFOR: Kropsro har 230 lektioner over 85 dage, men kun 34 er
// forskellige. Den samme uge-video ligger paa alle syv dage. En flad
// liste er derfor 230 linjer hvor de 196 er gentagelser.
//
// Linns valg 18. august: Q&A oeverst, saa uger der kan foldes ud.
//
// ── DEN VIGTIGSTE REGEL I FILEN ─────────────────────────────
// DUBLETTER FINDES PAA FILEN, IKKE PAA TITLEN.
//
// Foerste udkast fjernede dubletter paa titlen. Det ville have skjult
// 83 lektioner: "Din 1%" hedder det samme alle 84 dage, men peger paa
// 84 FORSKELLIGE lydfiler, én ny hver dag. Alle ANDRE gentagne titler i
// Kropsro peger derimod paa praecis den samme fil.
//
// Peger to dage paa samme fil, er det én lektion. Peger de forskellige
// steder, er det to, ogsaa hvis de hedder det samme. Saa kan intet
// forsvinde, uanset hvad Linn kalder tingene.
//
// ── To ting mere der kom af de rigtige data ─────────────────
//
// 1. Naeste uges lektion udkommer dagen FOER. "Uge 3, Blodsukker"
//    ligger allerede paa dag 14, som hoerer til uge 2. Derfor placeres
//    en lektion i den uge hvor den ligger FLEST dage, ikke i den uge
//    hvor den foerst dukker op.
//
// 2. ZOOM-LINKS KOMMER SLET IKKE MED. Linns beslutning 18. august.
//    Et link til et moede der laa i maj er vaerdiloest naar man ser
//    tilbage paa forloebet, og det er den her side til. Mens forloebet
//    koerer staar linket paa dagen paa forsiden, saa der forsvinder
//    ingenting for den kunde der skal med til et kald.
//
//    Det loeste samtidig et rod: Linn bruger det samme faste Zoom-rum
//    til alle sine kald, saa url'en er ens hele forloebet igennem, og
//    regel 1 ville have slaaet otte forskellige moeder sammen til ét.
//
// 3. Q&A har intet maerke i databasen. Vi kan kun kende dem paa at der
//    staar "Q&A" i titlen. Det fanger alle 16 i Kropsro i dag, men det
//    holder kun saa laenge titlerne skrives sadan. Den holdbare loesning
//    er et flueben i admin. Se HANDOVER 9.27.
// ============================================================

import { ugeForDag } from './forlob';
import type { ListeLektion } from './lektionsliste3';

/** Formater og adresser der er et moede og ikke indhold. Se punkt 2. */
const LIVE_FORMATER = /zoom|teams|meet/i;
const LIVE_ADRESSER = /zoom\.us|teams\.microsoft|meet\.google|whereby\.com/i;

/**
 * Er lektionen et link til et live-moede.
 *
 * Vi ser baade paa formatet og paa selve adressen, for formatet er et
 * frit felt Linn selv skriver og staar tomt paa nogle lektioner.
 */
export function erLive(format: string | undefined, url: string | undefined): boolean {
	return LIVE_FORMATER.test(format ?? '') || LIVE_ADRESSER.test(url ?? '');
}

/** Kender en Q&A paa titlen. Se punkt 3 i toppen. */
export function erQa(titel: string): boolean {
	return /q\s*&\s*a/i.test(titel);
}

/** Ugens tema, traukket ud af en titel som "Uge 2, Tarmmikrobiomet". */
export function temaFraTitel(titel: string): string | null {
	const m = titel.match(/^\s*uge\s*\d+\s*[,:.-]\s*(.+)$/i);
	return m ? m[1].trim() : null;
}

/** Én lektion som den staar inde i en uge. */
export interface UgePost {
	post: ListeLektion;
	/** Alle dage den laa paa, mindste foerst. */
	dage: number[];
	/**
	 * Navnet i listen. Ligger flere med SAMME titel i den samme uge, faar
	 * de dagen med, saa der ikke staar syv ens linjer. Det sker for "Din
	 * 1%", hvor hver dag er sin egen lydfil.
	 */
	navn: string;
}

export interface Uge {
	nummer: number;
	/** "Tarmmikrobiomet". Tom naar ingen lektion navngiver ugen. */
	tema: string;
	poster: UgePost[];
}

export interface UgeOpdeling {
	/**
	 * Live Q&A, oeverst og aldrig foldet sammen. Samme dubletregel som
	 * ugerne: et replay der ligger paa to dage staar én gang.
	 */
	qa: ListeLektion[];
	uger: Uge[];
}

/**
 * Noeglen der afgoer om to dage viser det SAMME. Se toppen.
 *
 * Uden en url kan vi ikke sammenligne, og saa staar hver for sig.
 */
function noegleFor(p: ListeLektion): string {
	const url = (p.lektion.url ?? '').trim();
	return url ? `url:${url}` : `id:${p.lektion.id}:${p.dagNummer}`;
}

/**
 * Deler lektionerne op i Q&A og uger.
 *
 * Raekkefoelgen inde i en uge er den de laa i, altsaa efter foerste dag
 * og derefter som Linn har lagt dem ind paa dagen.
 */
export function byggUger(liste: ListeLektion[]): UgeOpdeling {
	const qaGrupper = new Map<string, ListeLektion>();
	const grupper = new Map<string, { post: ListeLektion; dage: number[] }>();

	for (const p of liste) {
		// Moedelinks hoerer til paa dagen, ikke i tilbageblikket. Punkt 2.
		if (erLive(p.lektion.format, p.lektion.url)) continue;

		const noegle = noegleFor(p);
		if (erQa(p.lektion.titel)) {
			// Et replay ligger tit paa to dage i traek. Foerste dag vinder.
			const haves = qaGrupper.get(noegle);
			if (!haves || p.dagNummer < haves.dagNummer) qaGrupper.set(noegle, p);
			continue;
		}
		const fundet = grupper.get(noegle);
		if (fundet) {
			fundet.dage.push(p.dagNummer);
			// Den foerste dag vinder, saa linket peger paa starten.
			if (p.dagNummer < fundet.post.dagNummer) fundet.post = p;
		} else {
			grupper.set(noegle, { post: p, dage: [p.dagNummer] });
		}
	}

	// Placér hver lektion i den uge hvor den ligger flest dage. Se punkt 1.
	const prUge = new Map<number, UgePost[]>();
	for (const g of grupper.values()) {
		g.dage.sort((a, b) => a - b);
		const tael = new Map<number, number>();
		for (const d of g.dage) {
			const u = ugeForDag(d);
			tael.set(u, (tael.get(u) ?? 0) + 1);
		}
		let uge = ugeForDag(g.dage[0]);
		let flest = 0;
		for (const [u, n] of [...tael].sort((a, b) => a[0] - b[0])) {
			if (n > flest) {
				flest = n;
				uge = u;
			}
		}
		prUge.set(uge, [...(prUge.get(uge) ?? []), { post: g.post, dage: g.dage, navn: '' }]);
	}

	const uger: Uge[] = [];
	for (const [nummer, poster] of [...prUge].sort((a, b) => a[0] - b[0])) {
		// Ugens eget indhold foerst, saa de daglige. En lektion der ligger
		// hele ugen er ugens tema, mens en der kun ligger én dag er dagens
		// lille ting. Uden det brød "30 planter tracker" ind midt i raekken
		// af Din 1%, fordi de begge starter paa dag 8.
		poster.sort((a, b) => {
			if (a.dage[0] !== b.dage[0]) return a.dage[0] - b.dage[0];
			return (a.dage.length > 1 ? 0 : 1) - (b.dage.length > 1 ? 0 : 1);
		});

		// Ugens tema kommer fra en lektion der hedder "Uge N, noget".
		let tema = '';
		for (const p of poster) {
			const t = temaFraTitel(p.post.lektion.titel);
			if (t) {
				tema = t;
				break;
			}
		}

		// Flere med samme titel i ugen faar dagen med.
		const antalPrTitel = new Map<string, number>();
		for (const p of poster) {
			const t = p.post.lektion.titel;
			antalPrTitel.set(t, (antalPrTitel.get(t) ?? 0) + 1);
		}
		for (const p of poster) {
			const t = p.post.lektion.titel;
			p.navn = (antalPrTitel.get(t) ?? 0) > 1 ? `${t}, dag ${p.dage[0]}` : t;
		}

		uger.push({ nummer, tema, poster });
	}

	const qa = [...qaGrupper.values()].sort((a, b) => a.dagNummer - b.dagNummer);
	return { qa, uger };
}

/** "Uge 2 · Tarmmikrobiomet", eller bare "Uge 2". Dag 0 hedder Opstart. */
export function ugeNavn(uge: Uge): string {
	if (uge.nummer === 0) return uge.tema ? `Opstart · ${uge.tema}` : 'Opstart';
	return uge.tema ? `Uge ${uge.nummer} · ${uge.tema}` : `Uge ${uge.nummer}`;
}

/** Hvor mange af ugens lektioner hun har set. */
export function seteIUge(uge: Uge, klaret: Set<string>): number {
	return uge.poster.filter((p) => klaret.has(p.post.lektion.id)).length;
}
