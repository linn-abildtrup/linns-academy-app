// ============================================================
// Vagten. Vaekkes udefra hver time og gaar listen igennem.
//
// HVORFOR HVER TIME OG IKKE ÉN GANG. Sommertid. Klokken 6.15 i Danmark
// er ikke det samme klokkeslaet hele aaret, og en fast tid ude hos
// vagten ville rykke sig en time om vinteren uden at nogen opdagede
// det. Vi vaekkes hver time og svarer kun ja i den ene, regnet i dansk
// tid. Se erMorgen3.
//
// TO BESKEDER, OG HOEJST ÉN PR KUNDE PR MORGEN:
//   1. "Dag 12 er klar", hvis der er noget nyt hun ikke har set
//   2. Ellers et savn, hvis der er gaaet for laenge
//
// RAEKKEFOELGEN ER MED VILJE. Er der noget nyt i dag, er DET den bedste
// grund til at aabne appen. Et savn oveni ville vaere to beskeder om
// det samme, og to beskeder er én for mange.
//
// DEN GAAR UD FRA TELEFONERNE og ikke fra kundelisten: kun dem der har
// sagt ja kan naas, og de er faa. Se notiHold.
//
// Bygget 23. august 2026, se HANDOVER 9.45.
// ============================================================

import type { RequestHandler } from '@sveltejs/kit';
import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { hentDoc, hentHeleCollection } from '$lib/server/firestoreRest';
import { noeglerFra3 } from '$lib/server/notiSend';
import { medTelefon3, sendTilFlere3 } from '$lib/server/notiHold';
import { dagNoti3, erMorgen3, medStandard3, savnBesked3, skalSavne3 } from '$lib/content/notifikation3';
import type { NotiIndstillinger3 } from '$lib/content/notifikation3';

/** Timen i dansk tid lige nu. Klarer sommertid af sig selv. */
function timeIDanmark(nu: Date): number {
	const s = new Intl.DateTimeFormat('da-DK', {
		timeZone: 'Europe/Copenhagen',
		hour: 'numeric',
		hour12: false
	}).format(nu);
	return Number(s.replace(/\D/g, ''));
}

const DAG_MS = 86_400_000;

/** Hendes dagnummer paa forloebet, med pauser trukket fra. */
function dagNummerFor(startMs: number, nu: number, nulDage: number): number {
	const start = new Date(startMs);
	start.setHours(6, 0, 0, 0);
	const idag = new Date(nu);
	idag.setHours(6, 0, 0, 0);
	return Math.floor((idag.getTime() - start.getTime()) / DAG_MS) - nulDage;
}

export const POST: RequestHandler = async ({ request }) => {
	// Vagten kender en noegle. Uden den kan hvem som helst faa os til at
	// sende til alle.
	const noegle = request.headers.get('x-noti-noegle');
	if (!env.NOTI_VAGT_NOEGLE || noegle !== env.NOTI_VAGT_NOEGLE) {
		throw error(403, 'Ikke vagten');
	}

	const noegler = noeglerFra3(env);
	if (!noegler) throw error(500, 'Noeglerne mangler i miljoeet');

	const nu = Date.now();
	const ind = medStandard3(
		((await hentDoc('notiAdgang3/indstillinger')) ?? null) as Partial<NotiIndstillinger3> | null
	);

	if (!erMorgen3(timeIDanmark(new Date(nu)), ind.morgenTid)) {
		return json({ sprunget: 'ikke-tid', time: timeIDanmark(new Date(nu)) });
	}

	// Forloebene laeses ÉN gang og ikke pr kunde. De fleste paa et hold
	// deler forloeb, og uden det her ville den samme dag blive hentet
	// tredive gange.
	const forlobCache = new Map<string, { startMs: number; dage: Map<number, string[]> } | null>();

	async function forlobFor(forlobId: string) {
		if (forlobCache.has(forlobId)) return forlobCache.get(forlobId)!;
		const f = await hentDoc(`forlob/${forlobId}`);
		if (!f) {
			forlobCache.set(forlobId, null);
			return null;
		}
		const start = f.startDato;
		const startMs = typeof start === 'string' ? new Date(start).getTime() : 0;
		const dage = new Map<number, string[]>();
		for (const d of await hentHeleCollection(`forlob/${forlobId}/forlobsdage`)) {
			const nr = Number(d.data.dagNummer ?? -1);
			const lek = d.data.lektioner;
			if (nr >= 0 && Array.isArray(lek)) {
				dage.set(
					nr,
					lek.map((l) => String((l as { id?: string })?.id ?? ''))
				);
			}
		}
		const svar = { startMs, dage };
		forlobCache.set(forlobId, svar);
		return svar;
	}

	const uids = await medTelefon3();

	const udfald = await sendTilFlere3(
		uids,
		async (uid, bruger) => {
			const forlobIds = Array.isArray(bruger.forlobIds) ? bruger.forlobIds.map(String) : [];

			// 1. Er der noget nyt i dag.
			for (const fid of forlobIds) {
				const f = await forlobFor(fid);
				if (!f?.startMs) continue;
				const nulDage = 0; // Pauser: se noten i HANDOVER 9.45
				const dag = dagNummerFor(f.startMs, nu, nulDage);
				const lektioner = f.dage.get(dag) ?? [];
				if (lektioner.length === 0) continue;

				const klaret = new Set(
					(await hentHeleCollection(`users/${uid}/nyKlaret`)).map((k) => k.id)
				);
				const usete = lektioner.filter((id) => id && !klaret.has(id));
				if (usete.length > 0) return dagNoti3(dag, usete.length, false);
			}

			// 2. Ellers et savn, hvis der er gaaet for laenge.
			const sidst = typeof bruger.sidstAktiv3 === 'number' ? bruger.sidstAktiv3 : null;
			const timer = forlobIds.length > 0 ? ind.forlobTimer : ind.medlemTimer;
			if (skalSavne3(sidst, nu, timer)) return savnBesked3(forlobIds.length > 0, ind);

			return null;
		},
		noegler
	);

	return json({ koert: true, ...udfald });
};
