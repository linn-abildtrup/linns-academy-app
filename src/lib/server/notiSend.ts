// ============================================================
// Ét sted der sender en besked til én kunde.
//
// HVORFOR DEN LIGGER FOR SIG. To endpoints sender: det Linn trykker paa
// i haanden, og det der skriver en besked til en kunde. Laa reglerne
// begge steder, ville de drive fra hinanden, og saa ville "kun 3.0"
// eller karantaenen kun gaelde det ene sted.
//
// FIRE SPOERGSMAAL, ALTID I DEN RAEKKEFOELGE:
//   1. Maa hun overhovedet. Det er reglen om at den gamle app aldrig
//      maa faa noget
//   2. Har hun eller Linn slaaet den slags fra
//   3. Er karantaenen udloebet
//   4. Har hun en telefon
//
// Hvert nej har sit eget svar tilbage, saa admin kan se HVORFOR der
// ikke skete noget i stedet for at gaette.
//
// Bygget 23. august 2026, se HANDOVER 9.43.
// ============================================================

import { ADMIN_EMAILS } from '$lib/admin';
import { hentDoc, hentHeleCollection, gemDocMerge } from './firestoreRest';
import { sendPush, type PushAdresse, type PushNoegler } from './webPush';
import {
	maaSende3,
	udenforKarantaene3,
	type Noti3,
	type NotiRegler3,
	type NotiSlags3,
	type NotiValg3
} from '$lib/content/notifikation3';

export const PROEVE3 = 'proeve';

export interface SendUdfald3 {
	uid: string;
	sendt: number;
	sprunget: 'ingen-adgang' | 'slaaet-fra' | 'karantaene' | 'ingen-telefon' | null;
	ryddet: number;
}

export interface SendValg3 {
	/** Spring karantaenen over. Bruges naar Linn selv trykker send. */
	tvang?: boolean;
	/** Proeven i opstarten spoerger ikke om lov. */
	erProeve?: boolean;
}

export async function sendTilKunde3(
	uid: string,
	besked: Noti3,
	noegler: PushNoegler,
	valg: SendValg3 = {}
): Promise<SendUdfald3> {
	const nu = Date.now();
	const udfald: SendUdfald3 = { uid, sendt: 0, sprunget: null, ryddet: 0 };

	const bruger = await hentDoc(`users/${uid}`);
	const testFlag = bruger?.testerFeatures;
	const erAdmin = ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(
		String(bruger?.email ?? '').toLowerCase()
	);
	if (!erAdmin && !(Array.isArray(testFlag) && testFlag.includes('ny-app'))) {
		udfald.sprunget = 'ingen-adgang';
		return udfald;
	}

	const regler = ((await hentDoc('notiAdgang3/regler')) ?? {}) as NotiRegler3;
	const kundensValg = (bruger?.notiValg3 ?? {}) as NotiValg3;
	const forlobIds = bruger?.forlobIds;
	const forlobId = Array.isArray(forlobIds) && forlobIds.length ? String(forlobIds[0]) : null;
	if (
		!valg.erProeve &&
		!maaSende3(besked.slags as Exclude<NotiSlags3, 'proeve'>, regler, kundensValg, forlobId)
	) {
		udfald.sprunget = 'slaaet-fra';
		return udfald;
	}

	const sidst = (bruger?.notiSidst3 ?? {}) as Record<string, number>;
	if (valg.erProeve) {
		// Proeven har sin egen, korte karantaene: den skal kunne gentages
		// hvis hun ikke saa den, men ikke fyres af i en uendelighed.
		if (nu - (sidst[PROEVE3] ?? 0) < 60_000) {
			udfald.sprunget = 'karantaene';
			return udfald;
		}
	} else if (
		!valg.tvang &&
		!udenforKarantaene3(besked.slags as Exclude<NotiSlags3, 'proeve'>, sidst[besked.slags], nu)
	) {
		udfald.sprunget = 'karantaene';
		return udfald;
	}

	const telefoner = await hentHeleCollection(`users/${uid}/pushTelefon3`);
	const levende = telefoner.filter((t) => t.data.doed !== true);
	if (!levende.length) {
		udfald.sprunget = 'ingen-telefon';
		return udfald;
	}

	for (const { id, data } of levende) {
		const adresse = data as unknown as PushAdresse;
		if (!adresse.endpoint || !adresse.p256dh || !adresse.auth) continue;
		const r = await sendPush(adresse, besked, noegler);
		if (r.ok) udfald.sendt += 1;
		if (r.doed) {
			// Telefonen findes ikke mere, fx fordi appen er slettet. Vi
			// maerker den i stedet for at slette den, saa man stadig kan se
			// at hun HAR haft beskeder slaaet til.
			await gemDocMerge(`users/${uid}/pushTelefon3/${id}`, { doed: true, doedMs: nu });
			udfald.ryddet += 1;
		}
	}

	// UR'ET STILLES KUN AF DET DER SKER AF SIG SELV.
	//
	// Trykker Linn selv send, springer vi karantaenen over — men foer
	// stillede vi ogsaa uret, og saa var den AUTOMATISKE besked lukket
	// ude i seks timer bagefter. Linn skrev til test-Mette, svarede
	// hende et kvarter senere, og kunden hoerte ingenting.
	//
	// Hendes eget tryk er hendes beslutning. Det skal ikke goere appen
	// tavs. Fundet 23. august, se HANDOVER 9.46.
	if (udfald.sendt > 0 && !valg.tvang) {
		await gemDocMerge(`users/${uid}`, { notiSidst3: { ...sidst, [besked.slags]: nu } });
	}
	return udfald;
}

/** Noeglerne fra miljoeet, eller null hvis de mangler. */
export function noeglerFra3(env: Record<string, string | undefined>): PushNoegler | null {
	const offentlig = env.NOTI_NOEGLE_OFFENTLIG;
	const privat = env.NOTI_NOEGLE_PRIVAT;
	if (!offentlig || !privat) return null;
	return { offentlig, privat, kontakt: env.NOTI_KONTAKT || 'mailto:kontakt@linnsacademy.dk' };
}

/** Hvem sidder der i den anden ende. Bruges af begge endpoints. */
export async function hvemErDet3(
	idToken: string,
	apiKey: string
): Promise<{ uid: string; erAdmin: boolean } | null> {
	if (!apiKey) return null;
	try {
		const res = await fetch(
			`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ idToken })
			}
		);
		if (!res.ok) return null;
		const data = (await res.json()) as { users?: Array<{ email?: string; localId?: string }> };
		const bruger = data.users?.[0];
		if (!bruger?.localId) return null;
		const email = bruger.email?.toLowerCase() ?? '';
		return {
			uid: bruger.localId,
			erAdmin: (ADMIN_EMAILS as readonly string[]).map((e) => e.toLowerCase()).includes(email)
		};
	} catch {
		return null;
	}
}
