// Loginskaermens opslag. Kunden skriver sin email paa skaerm 1, og vi svarer
// hvad skaerm 2 skal vise: log ind, opret adgang, eller "vi kan ikke finde et
// koeb".
//
// Hvorfor det ligger paa serveren: koebslisten (allowedEmails) kan med vilje
// kun laeses af den kunde der allerede er logget ind — og her er hun jo netop
// ikke logget ind endnu. Serveren har service-account-adgang og kan derfor
// svare paa spoergsmaalet uden at aabne listen for alle.
//
// Sikkerhed: endpointet kan i sagens natur fortaelle en fremmed om en email er
// kunde her. Det daemper vi paa to maader — der vises aldrig et navn, og der er
// en graense for hvor mange emails der kan proeves fra samme sted i timen.

import type { RequestHandler } from '@sveltejs/kit';
import { json, error } from '@sveltejs/kit';
import { findUidByEmail } from '$lib/server/authRest';
import { hentDoc, gemDocMerge } from '$lib/server/firestoreRest';
import { afgoerUdfald, normaliserEmail, seromEmailUd } from '$lib/content/loginOpslag';

/** Hoejst saa mange opslag fra samme IP pr time. En aegte kunde bruger 1-3. */
const MAX_OPSLAG_PR_TIME = 30;

function timeNoegle(nu: number): string {
	// yyyy-mm-dd-hh i UTC. Taelleren nulstiller sig selv naar timen skifter,
	// saa der ikke skal ryddes op i gamle dokumenter.
	return new Date(nu).toISOString().slice(0, 13);
}

/**
 * Taeller opslag pr IP pr time. Fejler taellingen (fx skrivefejl mod
 * Firestore), lader vi kunden komme videre — en loginskaerm der gaar i staa
 * er vaerre end et opslag for meget.
 */
async function overGraensen(ip: string, nu: number): Promise<boolean> {
	if (!ip) return false;
	// Punktum og kolon kan ikke staa i et dokument-id.
	const sikkerIp = ip.replace(/[.:]/g, '-').slice(0, 60);
	const path = `loginOpslagQuota/${sikkerIp}_${timeNoegle(nu)}`;
	try {
		const doc = (await hentDoc(path)) as { antal?: number } | null;
		const antal = doc?.antal ?? 0;
		if (antal >= MAX_OPSLAG_PR_TIME) return true;
		await gemDocMerge(path, { antal: antal + 1, senest: nu });
		return false;
	} catch (e) {
		console.warn('[login-opslag] kunne ikke taelle forsoeg', e);
		return false;
	}
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	let raaEmail = '';
	try {
		const body = (await request.json()) as { email?: string };
		raaEmail = body.email ?? '';
	} catch {
		throw error(400, 'Ugyldig forespørgsel');
	}

	const email = normaliserEmail(raaEmail);
	if (!seromEmailUd(email)) {
		throw error(400, 'Email-adressen ser ikke ud til at være gyldig.');
	}

	let ip = '';
	try {
		ip = getClientAddress();
	} catch {
		ip = '';
	}
	if (await overGraensen(ip, Date.now())) {
		throw error(429, 'Der er prøvet for mange gange herfra. Vent lidt og prøv igen.');
	}

	// De to opslag er uafhaengige, saa de koerer samtidig.
	const [uid, allowed] = await Promise.all([
		findUidByEmail(email).catch((e) => {
			console.warn('[login-opslag] auth-opslag fejlede', e);
			throw error(503, 'Vi kunne ikke slå din email op lige nu. Prøv igen om lidt.');
		}),
		hentDoc(`allowedEmails/${email}`).catch((e) => {
			console.warn('[login-opslag] koebs-opslag fejlede', e);
			throw error(503, 'Vi kunne ikke slå din email op lige nu. Prøv igen om lidt.');
		})
	]);

	const koeb = allowed as { forlobId?: string; activeProduct?: string } | null;

	// Forloebets navn hentes kun naar der faktisk er et koeb uden konto —
	// ellers bruger vi det alligevel ikke.
	let forlobNavn: string | null = null;
	if (!uid && koeb?.forlobId) {
		try {
			const f = (await hentDoc(`forlob/${koeb.forlobId}`)) as { navn?: string } | null;
			forlobNavn = f?.navn ?? null;
		} catch (e) {
			console.warn('[login-opslag] kunne ikke hente forløbsnavn', e);
		}
	}

	return json(
		afgoerUdfald({
			harKonto: uid !== null,
			harKoeb: koeb !== null,
			forlobNavn,
			activeProduct: koeb?.activeProduct ?? null
		})
	);
};
