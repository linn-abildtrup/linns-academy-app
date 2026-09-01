// ============================================================
// Hvad AI'en skal vide om kundens eget forloeb.
//
// DELT AF BEGGE APPER. /api/ny-ai fik det 1. september 2026, og
// /api/linn-ai samme dag. Der maa kun vaere ÉN udgave af den her:
// to steder der udleder kundens dagnummer eller finder hendes FAQ ville
// drive fra hinanden, og saa ville de to apper svare forskelligt paa det
// samme spoergsmaal.
//
// Selve TEKSTEN AI'en faar bygges i content/forlobKontekst3.ts. Her
// hentes kun tallene og materialet.
//
// FILEN LAESER KUN.
// ============================================================

import { hentDoc, hentAlleDocs } from './firestoreRest';
import type { FaqPunkt, Lektion } from '$lib/content/forlobKontekst3';
import { nulDatoer, dagNummerMedNulDage, produktHarNulDage } from '$lib/content/nulDage3';
import type { UserDoc } from '$lib/types';

export interface ForlobVidenResultat {
	forlobNavn: string;
	dagNummer: number;
	antalDage: number;
	faq: FaqPunkt[];
	lektioner: Lektion[];
}

const MS_PER_DAG = 86400000;

/**
 * Hvad AI'en skal vide om kundens eget forloeb.
 *
 * TRE FAELDER I firestoreRest, alle tre fundet 16. august, og alle tre
 * ligger i den her funktion:
 *  - hentAlleDocs giver { id, data } og IKKE dokumentet selv
 *  - et tidsstempel kommer som en ISO-STRENG, ikke som _seconds
 *  - forloebene staar paa BRUGER-dokumentet som forlobIds. Samlingen
 *    products er TOM for forloebskunder
 *
 * Fejler noget her, svarer AI'en som foer i stedet for slet ikke. Et
 * manglende forloebs-afsnit er daarligere svar, en fejl er intet svar.
 */
export async function hentForlobViden(
	uid: string,
	userDoc: UserDoc | null
): Promise<ForlobVidenResultat | null> {
	try {
		const ids = (userDoc as unknown as { forlobIds?: string[] })?.forlobIds ?? [];
		if (ids.length === 0) return null;

		const nu = Date.now();
		let valgt: { id: string; navn: string; start: number; antalDage: number } | null = null;

		for (const id of ids) {
			const f = (await hentDoc(`forlob/${id}`)) as Record<string, unknown> | null;
			if (!f) continue;
			// ISO-streng, ikke _seconds. Se fael­den ovenfor.
			const start = new Date(String(f.startDato ?? '')).getTime();
			const antalDage = Number(f.antalDage) || 0;
			if (!Number.isFinite(start) || start <= 0 || antalDage <= 0) continue;
			// Det AKTIVE forloeb, altsaa det hun staar midt i lige nu.
			const slut = start + (antalDage + 1) * MS_PER_DAG;
			if (nu >= start && nu <= slut) {
				valgt = { id, navn: String(f.navn ?? id), start, antalDage };
				break;
			}
		}
		if (!valgt) return null;

		const raat = Math.floor((nu - valgt.start) / MS_PER_DAG) + 1;
		let dagNummer = Math.min(valgt.antalDage, Math.max(1, raat));

		// Pause. Kun Kropsro kan holde pause, se nulDage3. Uden det ville
		// AI'en sige et andet dagnummer end resten af appen.
		if (produktHarNulDage(valgt.id)) {
			const p = (await hentDoc(`users/${uid}/products/${valgt.id}`)) as Record<
				string,
				unknown
			> | null;
			const intervaller = (p?.nulDage as { intervaller?: [] } | undefined)?.intervaller ?? [];
			if (intervaller.length > 0) {
				dagNummer = dagNummerMedNulDage(raat, valgt.antalDage, nulDatoer(intervaller), nu);
			}
		}

		// FAQ hoerer til forloebet, og kategorien staar i sin egen samling.
		const [punkter, kategorier] = await Promise.all([
			hentAlleDocs(`forlob/${valgt.id}/faqItems`),
			hentAlleDocs(`forlob/${valgt.id}/faqKategorier`)
		]);
		const katNavn: Record<string, string> = {};
		for (const k of kategorier) katNavn[k.id] = String(k.data.navn ?? '');

		const faq: FaqPunkt[] = punkter
			// Kun det UDGIVNE. Et svar Linn stadig arbejder paa maa ikke
			// komme ud af munden paa AI'en foer hun har udgivet det.
			.filter((d) => d.data.udgivet === true)
			.map((d) => ({
				spoergsmaal: String(d.data.spoergsmaal ?? ''),
				svar: String(d.data.svar ?? ''),
				kategori: katNavn[String(d.data.kategoriId ?? '')] || undefined
			}))
			.filter((p) => p.spoergsmaal && p.svar);

		// Lektionerne, KUN til og med i dag. Se noten paa ForlobViden.
		const dage = await hentAlleDocs(`forlob/${valgt.id}/forlobsdage`);
		const lektioner: Lektion[] = [];
		for (const d of dage) {
			const nr = Number(d.data.dagNummer ?? String(d.id).replace(/\D/g, ''));
			if (!Number.isFinite(nr) || nr > dagNummer) continue;
			for (const l of (d.data.lektioner ?? []) as Record<string, unknown>[]) {
				const titel = String(l.titel ?? '').trim();
				if (!titel) continue;
				lektioner.push({
					dag: nr,
					titel,
					beskrivelse: String(l.beskrivelse ?? '').trim() || undefined
				});
			}
		}

		return { forlobNavn: valgt.navn, dagNummer, antalDage: valgt.antalDage, faq, lektioner };
	} catch (e) {
		console.warn('[forlobViden] kunne ikke hente', e);
		return null;
	}
}

