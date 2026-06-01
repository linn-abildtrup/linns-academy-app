// Admin-endpoint: sætter en midlertidig adgangskode på en abonnent.
// Returnerer kun adgangskoden i selve response — admin skal selv sende
// den til kunden manuelt (fx Messenger, SMS).
//
// Sikkerhed:
// - Kalderens Firebase ID-token verificeres via Identity Toolkit REST
// - Kalderens email tjekkes mod ADMIN_EMAILS-listen
// - Mål-brugeren skal eksistere i Firebase Auth (slås op via email)

import type { RequestHandler } from '@sveltejs/kit';
import { json, error } from '@sveltejs/kit';
import { PUBLIC_FIREBASE_API_KEY } from '$env/static/public';
import { ADMIN_EMAILS } from '$lib/admin';
import { findUidByEmail, setUserPassword, genererTempPassword } from '$lib/server/authRest';

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
	const idToken = auth.slice(7);
	const adminEmail = await verificerAdminToken(idToken);
	if (!adminEmail) throw error(403, 'Ikke autoriseret som admin');

	let body: { email?: string };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Ugyldig JSON');
	}

	const targetEmail = body.email?.trim().toLowerCase();
	if (!targetEmail || !targetEmail.includes('@')) {
		throw error(400, 'Ugyldig email');
	}

	// Sikkerhedsbælte: admin må ikke nulstille sit eget password ad denne vej
	// — admin skal selv bruge "Glemt adgangskode"-flowet.
	if (targetEmail === adminEmail) {
		throw error(400, 'Du kan ikke sætte midlertidig adgangskode på din egen konto');
	}

	const uid = await findUidByEmail(targetEmail);
	if (!uid) {
		throw error(404, `Ingen Firebase Auth-konto fundet for ${targetEmail}`);
	}

	const tempPassword = genererTempPassword();
	try {
		await setUserPassword(uid, tempPassword);
	} catch (e) {
		console.error('Kunne ikke sætte password:', e);
		throw error(500, 'Kunne ikke sætte midlertidig adgangskode. Prøv igen.');
	}

	return json({ ok: true, tempPassword });
};
