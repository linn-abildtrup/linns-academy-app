// Admin-endpoint: overskriv en app-abonnents udløbsdato (aboSlutterAt) manuelt.
// Sætter en konkret dato (tidsbegrænset) ELLER fjerner udløbet (løbende adgang).
// Skriver til BÅDE allowedEmails og userDoc (via opdaterBrugerEllerWhitelist),
// så login-sync + resolver håndhæver det holdbart.
//
// Sikkerhed: Firebase ID-token verificeres + kalderens email tjekkes mod
// ADMIN_EMAILS (samme mønster som de øvrige admin-endpoints).
//
// OBS: for BETALENDE Simplero-abonnenter kan en manuel dato blive overskrevet
// igen ved næste fornyelse-webhook — det er en bevidst afvejning (admin advares
// i UI'et).

import type { RequestHandler } from '@sveltejs/kit';
import { json, error } from '@sveltejs/kit';
import { PUBLIC_FIREBASE_API_KEY } from '$env/static/public';
import { ADMIN_EMAILS } from '$lib/admin';
import { opdaterBrugerEllerWhitelist } from '$lib/server/simpleroWebhook';
import { hentDocsHvorFeltLig } from '$lib/server/firestoreRest';

async function verificerAdminToken(idToken: string): Promise<string | null> {
	if (!PUBLIC_FIREBASE_API_KEY) {
		console.error('PUBLIC_FIREBASE_API_KEY mangler ved build-tid');
		return null;
	}
	try {
		const res = await fetch(
			`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${PUBLIC_FIREBASE_API_KEY}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ idToken })
			}
		);
		if (!res.ok) {
			console.warn('Token-verifikation HTTP-fejl:', res.status);
			return null;
		}
		const data = (await res.json()) as { users?: Array<{ email?: string }> };
		const email = data.users?.[0]?.email?.toLowerCase() ?? null;
		if (!email) return null;
		const adminListe = (ADMIN_EMAILS as readonly string[]).map((e) => e.toLowerCase());
		return adminListe.includes(email) ? email : null;
	} catch (e) {
		console.warn('Token-verifikation fejlede:', e);
		return null;
	}
}

export const POST: RequestHandler = async ({ request }) => {
	const auth = request.headers.get('Authorization');
	if (!auth?.startsWith('Bearer ')) {
		throw error(401, 'Manglende Bearer-token');
	}
	const adminEmail = await verificerAdminToken(auth.slice(7));
	if (!adminEmail) throw error(403, 'Ikke autoriseret som admin');

	let body: { email?: string; aboSlutterAt?: number | null };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Ugyldig JSON');
	}

	const email = body.email?.trim().toLowerCase();
	if (!email || !email.includes('@')) {
		throw error(400, 'Ugyldig email');
	}

	// aboSlutterAt: number (ms, i fremtiden) = sæt udløb; null = fjern (løbende).
	const nyUdloeb = body.aboSlutterAt;
	if (nyUdloeb !== null) {
		if (typeof nyUdloeb !== 'number' || !Number.isFinite(nyUdloeb) || nyUdloeb <= Date.now()) {
			throw error(400, 'Ugyldig udløbsdato — skal være et tidspunkt i fremtiden (eller null for løbende).');
		}
	}

	// Kunden skal findes som abonnent-whitelist. Vi rører kun app-abonnenter.
	const eksisterende = await hentDocsHvorFeltLig('allowedEmails', 'email', email);
	if (eksisterende.length === 0) {
		throw error(404, `${email} findes ikke som abonnent.`);
	}
	const a = eksisterende[0].data as { accessSource?: string };
	if (a.accessSource !== 'abonnement') {
		throw error(400, `${email} er ikke en app-abonnent (accessSource=${a.accessSource ?? '—'}).`);
	}

	// aboSlutterAt er kilden den dato-styrede model håndhæver. null = løbende.
	await opdaterBrugerEllerWhitelist(email, {
		aboSlutterAt: nyUdloeb,
		aboUdloebSatAf: adminEmail,
		aboUdloebSatAt: Date.now()
	});

	return json({ ok: true, aboSlutterAt: nyUdloeb });
};
