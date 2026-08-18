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
// 2. ET ZOOM-LINK ER IKKE EN FIL. Linn bruger det samme faste Zoom-rum
//    til alle sine live-kald, saa url'en er ens hele forloebet igennem.
//    Reglen ovenfor ville derfor have slaaet otte forskellige moeder
//    sammen til ét. Live-links faar deres egen regel: samme link paa to
//    dage lige efter hinanden er ét moede, ellers er de forskellige.
//
// 3. Q&A har intet maerke i databasen. Vi kan kun kende dem paa at der
//    staar "Q&A" i titlen. Det fanger alle 16 i Kropsro i dag, men det
//    holder kun saa laenge titlerne skrives sadan. Den holdbare loesning
//    er et flueben i admin. Se HANDOVER 9.27.
// ============================================================

import { ugeForDag } from './forlob';
import type { ListeLektion } from './lektionsliste3';

/** Formater der er et moede og ikke en fil. Se punkt 2 i toppen. */
const LIVE_FORMATER = /zoom|teams|meet/i;

/** Er lektionen et link til et live-moede. */
export function erLive(format: string | undefined): boolean {
	return LIVE_FORMATER.test(format ?? '');
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
 * Giver hver lektion den noegle der afgoer om to dage viser det SAMME.
 *
 * Filer samles paa url'en. Live-moeder kan ikke, for de deler rum, saa de
 * samles kun naar samme link med samme titel ligger paa dage lige efter
 * hinanden. Uden url kan vi ikke sammenligne, og saa staar hver for sig.
 */
function noeglerFor(liste: ListeLektion[]): Map<ListeLektion, string> {
	const ud = new Map<ListeLektion, string>();
	const liveRaekker = new Map<string, ListeLektion[]>();

	for (const p of liste) {
		const url = (p.lektion.url ?? '').trim();
		if (!url) {
			ud.set(p, `id:${p.lektion.id}:${p.dagNummer}`);
		} else if (erLive(p.lektion.format)) {
			const n = `${url}|${p.lektion.titel}`;
			liveRaekker.set(n, [...(liveRaekker.get(n) ?? []), p]);
		} else {
			ud.set(p, `url:${url}`);
		}
	}

	for (const [n, poster] of liveRaekker) {
		poster.sort((a, b) => a.dagNummer - b.dagNummer);
		let start = poster[0].dagNummer;
		let sidste = start;
		for (const p of poster) {
			// Hul i dagene betyder et nyt moede, ikke det samme igen.
			if (p.dagNummer > sidste + 1) start = p.dagNummer;
			sidste = p.dagNummer;
			ud.set(p, `live:${n}|${start}`);
		}
	}

	return ud;
}

/**
 * Deler lektionerne op i Q&A og uger.
 *
 * Raekkefoelgen inde i en uge er den de laa i, altsaa efter foerste dag
 * og derefter som Linn har lagt dem ind paa dagen.
 */
export function byggUger(liste: ListeLektion[]): UgeOpdeling {
	const noegler = noeglerFor(liste);
	const qaGrupper = new Map<string, ListeLektion>();
	const grupper = new Map<string, { post: ListeLektion; dage: number[] }>();

	for (const p of liste) {
		const noegle = noegler.get(p) ?? `id:${p.lektion.id}:${p.dagNummer}`;
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
		poster.sort((a, b) => a.dage[0] - b.dage[0]);

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
