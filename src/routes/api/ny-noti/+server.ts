// ============================================================
// Sender beskeder til telefoner. Kun admin maa kalde den.
//
// KUN 3.0. Linns krav 23. august: der maa ALDRIG sendes til en kunde i
// den gamle app. Adgangen tjekkes her, lige foer der sendes, uanset hvad
// kalderen har bedt om. Det er den anden af de to laase, se
// service-worker.ts for den foerste.
//
// KOERER I CLOUDFLARES WORKERS, saa alt mod databasen gaar gennem
// firestoreRest. firebase-admin virker ikke der.
//
// DEN RYDDER OP EFTER SIG. Svarer en push-tjeneste at telefonen ikke
// findes mere, slettes adressen. Ellers ville listen vokse for evigt med
// telefoner der er skiftet ud.
//
// Bygget 23. august 2026, se HANDOVER 9.39.
// ============================================================

import type { RequestHandler } from '@sveltejs/kit';
import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { PUBLIC_FIREBASE_API_KEY } from '$env/static/public';
import { ADMIN_EMAILS } from '$lib/admin';
import { hentDoc, hentHeleCollection, gemDocMerge } from '$lib/server/firestoreRest';
import { sendPush, type PushAdresse } from '$lib/server/webPush';
import {
	maaSende3,
	udenforKarantaene3,
	type Noti3,
	type NotiRegler3,
	type NotiSlags3,
	type NotiValg3
} from '$lib/content/notifikation3';

async function verificerAdmin(idToken: string): Promise<boolean> {
	if (!PUBLIC_FIREBASE_API_KEY) return false;
	try {
		const res = await fetch(
			`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${PUBLIC_FIREBASE_API_KEY}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ idToken })
			}
		);
		if (!res.ok) return false;
		const data = (await res.json()) as { users?: Array<{ email?: string }> };
		const email = data.users?.[0]?.email?.toLowerCase() ?? null;
		if (!email) return false;
		return (ADMIN_EMAILS as readonly string[]).map((e) => e.toLowerCase()).includes(email);
	} catch {
		return false;
	}
}

interface Krop {
	/** Hvem. Én kunde ad gangen, saa afsendelsen kan foelges. */
	uid: string;
	besked: Noti3;
	/** Send selvom karantaenen ikke er udloebet. Kun til proeven. */
	tvang?: boolean;
}

/** Hvad der skete med én kunde. Vises i admin. */
interface Udfald {
	uid: string;
	sendt: number;
	sprunget: 'ingen-adgang' | 'slaaet-fra' | 'karantaene' | 'ingen-telefon' | null;
	ryddet: number;
}

export const POST: RequestHandler = async ({ request }) => {
	const auth = request.headers.get('Authorization');
	if (!auth?.startsWith('Bearer ')) throw error(401, 'Manglende Bearer-token');
	if (!(await verificerAdmin(auth.slice(7)))) throw error(403, 'Ikke autoriseret som admin');

	const offentlig = env.NOTI_NOEGLE_OFFENTLIG;
	const privat = env.NOTI_NOEGLE_PRIVAT;
	if (!offentlig || !privat) {
		throw error(500, 'Noeglerne til beskeder mangler i miljoeet. Se HANDOVER 9.39.');
	}
	const noegler = {
		offentlig,
		privat,
		kontakt: env.NOTI_KONTAKT || 'mailto:kontakt@linnsacademy.dk'
	};

	const krop = (await request.json().catch(() => null)) as Krop | null;
	if (!krop?.uid || !krop.besked?.titel) throw error(400, 'Mangler uid eller besked');

	const { uid, besked } = krop;
	const nu = Date.now();
	const udfald: Udfald = { uid, sendt: 0, sprunget: null, ryddet: 0 };

	// 1. Maa hun overhovedet. Den her linje er hele reglen om at den
	//    gamle app aldrig maa faa noget.
	const bruger = await hentDoc(`users/${uid}`);
	const testFlag = (bruger?.testerFeatures ?? []) as string[];
	const erAdmin = ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(
		String(bruger?.email ?? '').toLowerCase()
	);
	if (!erAdmin && !(Array.isArray(testFlag) && testFlag.includes('ny-app'))) {
		udfald.sprunget = 'ingen-adgang';
		return json(udfald);
	}

	// 2. Har hun slaaet den slags fra, eller har Linn.
	const regler = ((await hentDoc('notiAdgang3/regler')) ?? {}) as NotiRegler3;
	const valg = (bruger?.notiValg3 ?? {}) as NotiValg3;
	const forlobIds = (bruger?.forlobIds ?? []) as string[];
	const forlobId = Array.isArray(forlobIds) && forlobIds.length ? forlobIds[0] : null;
	if (!maaSende3(besked.slags as NotiSlags3, regler, valg, forlobId)) {
		udfald.sprunget = 'slaaet-fra';
		return json(udfald);
	}

	// 3. Karantaenen. En travl formiddag i admin maa ikke give fem beskeder.
	const sidst = (bruger?.notiSidst3 ?? {}) as Record<string, number>;
	if (!krop.tvang && !udenforKarantaene3(besked.slags, sidst[besked.slags], nu)) {
		udfald.sprunget = 'karantaene';
		return json(udfald);
	}

	// 4. Hendes telefoner.
	const telefoner = await hentHeleCollection(`users/${uid}/pushTelefon3`);
	if (!telefoner.length) {
		udfald.sprunget = 'ingen-telefon';
		return json(udfald);
	}

	for (const { id, data } of telefoner) {
		// En telefon der allerede er meldt doed proever vi ikke igen.
		if (data.doed === true) continue;
		const adresse = data as unknown as PushAdresse;
		if (!adresse.endpoint || !adresse.p256dh || !adresse.auth) continue;

		const r = await sendPush(adresse, besked, noegler);
		if (r.ok) udfald.sendt += 1;
		if (r.doed) {
			// Telefonen findes ikke mere, fx fordi appen er slettet. Vi
			// maerker den i stedet for at slette den: saa kan man se paa
			// kunden at hun HAR haft beskeder slaaet til.
			await gemDocMerge(`users/${uid}/pushTelefon3/${id}`, { doed: true, doedMs: nu });
			udfald.ryddet += 1;
		}
	}

	if (udfald.sendt > 0) {
		await gemDocMerge(`users/${uid}`, { notiSidst3: { ...sidst, [besked.slags]: nu } });
	}

	return json(udfald);
};
