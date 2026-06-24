// Admin-endpoint: opretter en gratis app-kunde manuelt (uden Simplero-køb).
// Skriver en allowedEmails-record med premium-abo-felter, så personen kan
// oprette sig selv på login-siden og få app-adgang. Til fri-/comp-konti.
//
// Sikkerhed:
// - Kalderens Firebase ID-token verificeres via Identity Toolkit REST
// - Kalderens email tjekkes mod ADMIN_EMAILS-listen
// - Findes emailen allerede (whitelist), oprettes der INTET — admin får besked

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

	let body: { email?: string; firstName?: string; lastName?: string };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Ugyldig JSON');
	}

	const email = body.email?.trim().toLowerCase();
	if (!email || !email.includes('@')) {
		throw error(400, 'Ugyldig email');
	}
	const firstName = body.firstName?.trim();
	const lastName = body.lastName?.trim();

	// Findes emailen allerede som whitelist (abo eller forløb)? Så opretter vi
	// ikke noget — admin skal gøres opmærksom for ikke at overskrive en kunde.
	const eksisterende = await hentDocsHvorFeltLig('allowedEmails', 'email', email);
	if (eksisterende.length > 0) {
		const a = eksisterende[0].data as { activeProduct?: string; accessSource?: string };
		const beskrivelse = a.activeProduct ?? a.accessSource ?? 'ukendt adgang';
		return json(
			{
				ok: false,
				status: 'findes',
				message: `${email} er allerede oprettet (${beskrivelse}). Der oprettes ikke en ny — tjek kunden i listen.`
			},
			{ status: 409 }
		);
	}

	// Premium app-abo-felter — samme som et premiumabo-køb ville sætte, men uden
	// Simplero-abonnement (ingen activeSubscription-fornyelse/fakturering).
	await opdaterBrugerEllerWhitelist(email, {
		...(firstName ? { firstName } : {}),
		...(lastName ? { lastName } : {}),
		accessLevel: 'premium',
		accessSource: 'abonnement',
		activeProduct: 'premiumabo',
		activeSubscription: true,
		updatedAt: Date.now(),
		oprettetManueltAf: adminEmail
	});

	return json({ ok: true });
};
