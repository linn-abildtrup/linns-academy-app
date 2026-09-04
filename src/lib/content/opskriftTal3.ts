// ============================================================
// Broen mellem 3.0's regnemaskine og den gamle apps opskrift-side.
//
// Linns beslutning 4. september 2026: uanset hvilken opskrift eller
// ingrediens man slaar op, skal de to apper vise det samme. Baade
// teksten, makrotallene forneden og beregningen.
//
// Teksten var ens i forvejen, for begge apper laeser det samme
// dokument. Opslag paa en enkelt foedevare var ogsaa ens, for begge
// bruger gramForEnhed og effektivKcal.
//
// Det eneste der skilte sig var opskrift-regnestykket. 3.0 bruger sit
// koblingskort og sin vaegttabel. Den gamle app ledte selv i
// foedevaredatabasen og ramte fx Soltoerrede tomater naar der stod
// "200 g Tomater", altsaa 282 kcal pr 100 g i stedet for 21.
//
// Filen her lader den gamle app bruge 3.0's svar. Den regner ikke selv.
// ============================================================

import type { Fodevare, MaaltidsItem } from './kost';
import { getEnheder } from './kost';
import type { Opskrift } from './opskrifter';
import { regnOpskrift, type KoblingsOpslag } from './opskriftMakro3';

/**
 * Deler instruktioner-teksten i broedtekst og den makro-linje der staar
 * nederst.
 *
 * Linjen bliver staaende i dokumentet som sikkerhedsnet, hvis en
 * opskrift en dag ikke kan regnes helt igennem, men den skal ikke vises
 * to gange naar tallene ogsaa staar i deres egen boks.
 *
 * `tid` returneres for sig, for den hoerer til opskriften og ikke til
 * regnestykket. Den staar altid sidst paa linjen.
 */
export function delInstruktioner(tekst: string): { broedtekst: string; tid: string } {
	const t = tekst ?? '';
	const m = t.match(
		/\n*Protein:\s*[\d.,]+\s*g\s*\|\s*Fiber:\s*[\d.,]+\s*g\s*\|\s*Kulhydrater?:\s*[\d.,]+\s*g\s*\|\s*Fedt:\s*[\d.,]+\s*g\s*\|\s*Kalorier:\s*[\d.,]+\s*kcal(\s*\|\s*Tid:\s*([^\n|]*))?/
	);
	if (!m) return { broedtekst: t.trim(), tid: '' };
	return {
		broedtekst: (t.slice(0, m.index ?? 0) + t.slice((m.index ?? 0) + m[0].length)).trim(),
		tid: (m[2] ?? '').trim()
	};
}

/**
 * Bygger listen til byg-maaltid ud fra 3.0's regnestykke.
 *
 * Hver linje 3.0 kunne regne bliver et koblet item, og resten bliver
 * manuelle items der bevarer navnet, saa ingen ingrediens forsvinder.
 *
 * ENHEDEN BEHOLDES HVOR VAREN KENDER DEN. Linns valg 4. september:
 * kunden skal stadig se "1 spsk olivenolie" og ikke "14 g".
 *
 * MEN KUN NAAR DEN GIVER SAMME VAEGT. De to apper har hver sin
 * vaegttabel, og de er ikke altid enige. 3.0 regner et aeg som 55 g,
 * mens varen selv siger 58. Beholdt vi enheden dér, ville byg-maaltid
 * vise 29,7 g protein hvor opskriften siger 28,6, og saa var hele
 * pointen tabt. Er de uenige, vinder gram, for tallet er vigtigere end
 * ordet.
 */
export function byggeItemsFraBeregning(
	opskrift: Opskrift,
	koblinger: Record<string, KoblingsOpslag>,
	varer: Map<string, Fodevare>,
	portioner: number
): { items: MaaltidsItem[]; ikkeKoblede: string[] } {
	const b = regnOpskrift(opskrift, koblinger, varer);
	// regnOpskrift regner paa HELE listen. Skal kunden bruge et andet
	// antal portioner end listen er skrevet til, skaleres bagefter.
	const skala = portioner / Math.max(1, opskriftensPortioner(opskrift));
	const items: MaaltidsItem[] = [];
	const ikkeKoblede: string[] = [];

	for (const l of b.linjer) {
		if (l.uden_betydning && !l.vare) continue;
		if (!l.vare) {
			ikkeKoblede.push(l.navn);
			items.push({
				foodId: '',
				portion: rund2(l.maengde * skala),
				manuel: { navn: l.navn, enhed: l.enhed }
			});
			continue;
		}
		const enhedId = kendtEnhed(l.vare, l.enhed, l.maengde, l.gram);
		items.push(
			enhedId
				? { foodId: l.vare.id, portion: rund2(l.maengde * skala), enhedId }
				: { foodId: l.vare.id, portion: rund2(l.gram * skala) }
		);
	}
	return { items, ikkeKoblede };
}

/** Antal portioner ingredienslisten er skrevet til. */
function opskriftensPortioner(o: Opskrift): number {
	const n = Number(o.defaultPortioner);
	return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * Returnerer varens eget enheds-id hvis den kender enheden fra
 * opskriften OG vejer det samme som 3.0 regnede med. Ellers undefined,
 * saa linjen bliver i gram. Gram og ml er ikke enheder her, de er selve
 * vaegten.
 */
function kendtEnhed(
	vare: Fodevare,
	enhed: string,
	maengde: number,
	gram: number
): string | undefined {
	const e = (enhed ?? '').trim().toLowerCase();
	if (!e || e === 'g' || e === 'gram' || e === 'ml') return undefined;
	const u = getEnheder(vare).find((x) => x.u.toLowerCase() === e);
	if (!u) return undefined;
	// En halv gram fra eller til er afrunding, ikke uenighed.
	return Math.abs(u.g * maengde - gram) < 0.5 ? u.u : undefined;
}

function rund2(n: number): number {
	return Math.round(n * 100) / 100;
}
