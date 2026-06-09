// Delt videns-motor for Linns FAKTISKE svar. Bruges af BAADE admin-svar-
// udkast (api/svar-udkast) og Linn AI kunde-chat (api/linn-ai), saa de to
// bygger paa SAMME viden — én kilde, synkroniseret.
//
// Kilder:
//  - svarHistorik: Linns redigerede svar-udkast (nye, med diff-data)
//  - klientspoergsmaal: ALLE besvarede spoergsmaal (ogsaa pre-AI-tid, ren tekst)
// svarHistorik vinder ved id-overlap (nyere/redigeret version).

import { runQuery } from '$lib/server/firestoreRest';
import type { TidligereSvar } from '$lib/content/svarUdkast';

export const MAX_SVAR_HISTORIK = 30;

interface SvarKandidat {
	spoergsmaalId: string;
	spoergsmaal: string;
	svar: string;
	tidsstempel: number;
}

// svarHistorik. Uden forlobId hentes paa tvaers (til backup-laget).
async function fraSvarHistorik(forlobId?: string): Promise<SvarKandidat[]> {
	try {
		const docs = await runQuery('svarHistorik', {
			...(forlobId ? { where: { felt: 'forlobId', vaerdi: forlobId } } : {}),
			orderBy: { felt: 'oprettet', retning: 'DESCENDING' },
			limit: MAX_SVAR_HISTORIK
		});
		return docs
			.map((d) => {
				const t = d.data.oprettet as string | undefined;
				const ms = t ? new Date(t).getTime() : 0;
				return {
					spoergsmaalId: (d.data.spoergsmaalId as string) ?? '',
					spoergsmaal: (d.data.spoergsmaalTekst as string) ?? '',
					svar: (d.data.endeligTekst as string) ?? '',
					tidsstempel: Number.isFinite(ms) ? ms : 0
				};
			})
			.filter((s) => s.spoergsmaal && s.svar);
	} catch (e) {
		console.warn('svarHistorik-query fejlede (mangler index?):', e);
		return [];
	}
}

// klientspoergsmaal for ét forloeb (kraever forlobId).
async function fraKlientspoergsmaal(forlobId: string): Promise<SvarKandidat[]> {
	try {
		const docs = await runQuery('klientspoergsmaal', {
			where: { felt: 'forlobId', vaerdi: forlobId },
			limit: 200
		});
		const ud: SvarKandidat[] = [];
		for (const d of docs) {
			const svar = d.data.svar as string | undefined;
			const sp = d.data.spoergsmaal as string | undefined;
			if (!svar || !sp) continue;
			const tStr =
				(d.data.besvaretAt as string | undefined) ?? (d.data.oprettet as string | undefined);
			const ms = tStr ? new Date(tStr).getTime() : 0;
			ud.push({
				spoergsmaalId: d.id,
				spoergsmaal: sp,
				svar,
				tidsstempel: Number.isFinite(ms) ? ms : 0
			});
		}
		return ud;
	} catch (e) {
		console.warn('klientspoergsmaal-query fejlede:', e);
		return [];
	}
}

// Kombinerer begge kilder for ét forloeb, dedup'er (svarHistorik vinder) og
// sorterer nyeste foerst.
async function kandidaterForForlob(forlobId: string): Promise<SvarKandidat[]> {
	const [h, k] = await Promise.all([fraSvarHistorik(forlobId), fraKlientspoergsmaal(forlobId)]);
	const set = new Map<string, SvarKandidat>();
	for (const s of k) set.set(s.spoergsmaalId, s);
	for (const s of h) set.set(s.spoergsmaalId, s); // overskriver
	return [...set.values()].sort((a, b) => b.tidsstempel - a.tidsstempel);
}

function tilTidligereSvar(kandidater: SvarKandidat[]): TidligereSvar[] {
	return kandidater
		.slice(0, MAX_SVAR_HISTORIK)
		.map((s) => ({ spoergsmaal: s.spoergsmaal, svar: s.svar }));
}

/**
 * Linns tidligere svar for ét forloeb. Bruges af admin-svar-udkast
 * (uaendret adfaerd fra foer udtraekket).
 */
export async function hentTidligereSvar(forlobId: string): Promise<TidligereSvar[]> {
	if (!forlobId) return [];
	return tilTidligereSvar(await kandidaterForForlob(forlobId));
}

/**
 * Linns tidligere svar til Linn AI kunde-chat: kundens EGET forloeb foerst,
 * suppleret med svarHistorik paa tvaers (backup) hvis der ikke er nok fra
 * kundens forloeb. Saa chatten altid har et rimeligt grundlag at svare ud fra.
 */
export async function hentTidligereSvarMedBackup(
	primaerForlobId: string
): Promise<TidligereSvar[]> {
	const primaer = primaerForlobId ? await kandidaterForForlob(primaerForlobId) : [];
	if (primaer.length >= MAX_SVAR_HISTORIK) return tilTidligereSvar(primaer);

	// Backup: svarHistorik paa tvaers af alle forloeb (Linns redigerede svar).
	const backup = await fraSvarHistorik();
	const haves = new Set(primaer.map((s) => s.spoergsmaalId));
	const samlet = [...primaer, ...backup.filter((s) => !haves.has(s.spoergsmaalId))];
	return tilTidligereSvar(samlet.sort((a, b) => b.tidsstempel - a.tidsstempel));
}
