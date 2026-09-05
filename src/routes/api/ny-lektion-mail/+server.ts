// ============================================================
// Kunden sender en lektion til sin egen mail.
//
// LINNS BESLUTNING 5. september: hun skal kunne faa en skreven lektion
// eller et dokument som pdf, og det skal komme paa mail og ikke som en
// download til telefonen. En fil paa en telefon er nem at miste. En mail
// kan hun soege frem paa enhver telefon og enhver computer, og naar hun
// ringer, kan Linn sige "soeg paa lektionens navn i din indbakke".
//
// HVORFOR DET SKER PAA SERVEREN, og ikke i telefonen:
//
//   En skreven lektion ligger paa et andet domaene. Browseren maa ikke
//   laese den. Serveren maa.
//
//   Adressen paa mailen tages fra hendes login og ikke fra det siden
//   sender med. Ellers kunne enhver sende en lektion til en fremmed.
//
//   Adgangen tjekkes her. Siden skjuler en lektion hun ikke maa se, men
//   en skjult knap er ikke en laas.
//
// KUN TO SLAGS INDHOLD kan sendes: en side skrevet som html, som bliver
// sat om til en pdf i Linns design, og en fil der allerede ER en pdf,
// som sendes som den er. Video, lyd og links har ingen knap, og videoen
// naevnes ikke i filen, heller ikke som et link.
//
// Bygget 5. september 2026. Se HANDOVER-KUNDEREJSEN.md og
// mockups-lektion-pdf.html.
// ============================================================

import type { RequestHandler } from '@sveltejs/kit';
import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { PUBLIC_FIREBASE_API_KEY } from '$env/static/public';
import { hentDoc } from '$lib/server/firestoreRest';
import { hvemErDet3 } from '$lib/server/notiSend';
import { mailOpsaetning3, sendMail3 } from '$lib/server/sendMail';
import { byggLektionPdf3, tilBase64 } from '$lib/server/lektionPdf3';
import { blokkeFraHtml, harNokIndhold, udenDobbeltTitel } from '$lib/content/lektionHtml3';
import { filnavnFor3, lektionMail3 } from '$lib/content/lektionMail3';
import { artFor } from '$lib/content/lektion3';

interface Krop {
	forlobId: string;
	dag: number;
	lektionId: string;
	/** Datoen som hun ser den paa skaermen. Staar under titlen i filen. */
	dato?: string;
}

interface RaaLektion {
	id?: string;
	titel?: string;
	url?: string;
	beskrivelse?: string;
}

/** Otte megabyte. Over det er en mail alligevel ikke vejen. */
const MAKS_BYTES = 8 * 1024 * 1024;

/**
 * En adresse vi har lov at hente.
 *
 * Lektionerne oprettes kun af Linn, saa det her er ikke en mistanke mod
 * kunderne. Det er en spaerre mod at en tastefejl i admin kan faa
 * serveren til at hente noget inde i vores eget net.
 */
function maaHentes(url: string): boolean {
	let u: URL;
	try {
		u = new URL(url);
	} catch {
		return false;
	}
	if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
	const v = u.hostname.toLowerCase();
	if (v === 'localhost' || v.endsWith('.local') || v.endsWith('.internal')) return false;
	if (/^(127\.|10\.|169\.254\.|192\.168\.|0\.)/.test(v)) return false;
	if (/^172\.(1[6-9]|2\d|3[01])\./.test(v)) return false;
	if (v === '[::1]' || v === '::1') return false;
	return true;
}

export const POST: RequestHandler = async ({ request }) => {
	const auth = request.headers.get('Authorization');
	if (!auth?.startsWith('Bearer ')) throw error(401, 'Manglende Bearer-token');
	const kalder = await hvemErDet3(auth.slice(7), PUBLIC_FIREBASE_API_KEY);
	if (!kalder) throw error(401, 'Kunne ikke genkende dig');
	if (!kalder.email) throw error(400, 'Der er ingen mailadresse på din konto');

	const krop = (await request.json().catch(() => null)) as Krop | null;
	const forlobId = krop?.forlobId?.trim() ?? '';
	const lektionId = krop?.lektionId?.trim() ?? '';
	const dag = Number(krop?.dag);
	if (!forlobId || !lektionId || !Number.isFinite(dag)) throw error(400, 'Mangler lektionen');

	// HUN SKAL HAVE VAERET PAA HOLDET. Samme krav som siden stiller, se
	// lektion/[dag]/[id]. Uden det kunne enhver skrive et fremmed
	// forloebs-id og faa materialet tilsendt.
	const kunde = await hentDoc(`users/${kalder.uid}`);
	const forlobIds = Array.isArray(kunde?.forlobIds) ? (kunde.forlobIds as string[]) : [];
	if (!forlobIds.includes(forlobId)) throw error(403, 'Du har ikke adgang til det forløb');

	const dagDoc = await hentDoc(`forlob/${forlobId}/forlobsdage/dag${dag}`);
	const lektioner = Array.isArray(dagDoc?.lektioner) ? (dagDoc.lektioner as RaaLektion[]) : [];
	const lektion = lektioner.find((l) => l?.id === lektionId) ?? null;
	if (!lektion?.url) throw error(404, 'Lektionen findes ikke');

	const art = artFor(lektion.url);
	if (art !== 'side' && art !== 'pdf') throw error(400, 'Den her lektion kan ikke sendes');
	if (!maaHentes(lektion.url)) throw error(400, 'Lektionen kan ikke hentes');

	const titel = (lektion.titel || '').trim() || 'Din lektion';
	const ops = mailOpsaetning3(env as Record<string, string | undefined>);
	if (!ops) throw error(503, 'Mailen er ikke sat op endnu');

	let base64: string;
	try {
		const svar = await fetch(lektion.url);
		if (!svar.ok) throw new Error(`hentning fejlede (${svar.status})`);

		if (art === 'pdf') {
			// DEN ER ALLEREDE EN PDF. Saa er der intet at lave om, og den
			// beholder det udseende Linn selv har givet den.
			const bytes = new Uint8Array(await svar.arrayBuffer());
			if (bytes.byteLength > MAKS_BYTES) throw error(413, 'Filen er for stor til en mail');
			base64 = tilBase64(bytes);
		} else {
			const html = await svar.text();
			// Titlen staar allerede oeverst i filen, saa sidens egen
			// overskrift skal ikke staa lige under den én gang til.
			const blokke = udenDobbeltTitel(blokkeFraHtml(html), titel);
			// EN TOM SIDE BLIVER IKKE TIL EN PDF med en overskrift og
			// ingenting under. Saa er det bedre at sige det ligeud.
			if (!harNokIndhold(blokke)) throw error(422, 'Der er ikke nok tekst til en pdf');
			base64 = tilBase64(byggLektionPdf3({ titel, dato: krop?.dato?.trim() ?? '', blokke }));
		}
	} catch (e) {
		// error() fra SvelteKit har status paa sig. Den skal ud som den er,
		// saa siden kan sige noget praecist.
		if (e && typeof e === 'object' && 'status' in e) throw e;
		console.error('[ny] kunne ikke lave lektionens pdf', e);
		throw error(502, 'Lektionen kunne ikke hentes');
	}

	const mail = lektionMail3(titel);
	const res = await sendMail3(kalder.email, { ...mail, medAfmeld: false }, ops, [
		{ filnavn: filnavnFor3(titel), base64 }
	]);
	if (!res.ok) throw error(502, 'Mailen kunne ikke sendes');

	return json({ ok: true, til: kalder.email });
};
