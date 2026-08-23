// ============================================================
// Mailen. Reserven, ikke en kopi.
//
// LINNS REGEL 23. august: kan hun naas paa telefonen, sender vi KUN
// dér. Kan hun ikke, sender vi en mail i stedet. Ellers ville hun faa
// alting to gange og slaa begge dele fra.
//
// DEN RAMMER DEM VI ELLERS IKKE KAN NAA: kunder uden appen paa
// hjemmeskaermen, dem der har sagt nej til beskeder, og dem der sidder
// ved en computer.
//
// TO SLAGS MAIL, og forskellen er ikke pynt:
//
//   Et svar fra Linn er noget hun har BEDT om. Det er en almindelig
//   besked, og der skal ikke staa afmeld nederst.
//
//   Et savn er taettere paa markedsfoering. Der SKAL staa en vej ud,
//   og den skal vaere let at faa oeje paa. Det er baade reglerne og
//   almindelig anstaendighed.
//
// Bygget 23. august 2026, se HANDOVER 9.47.
// ============================================================

import type { Noti3 } from './notifikation3';

export interface Mail3 {
	emne: string;
	/** Ren tekst. Nogle laeser mail uden billeder og uden layout. */
	tekst: string;
	html: string;
	/** Skal der staa en afmelde-linje nederst. */
	medAfmeld: boolean;
}

/** Hvor mailen peger hen. Sat ét sted, saa de fire tekster er enige. */
export const APP_URL3 = 'https://app.linnsacademy.dk';

/**
 * Emnelinjen.
 *
 * Den siger HVAD det handler om og ikke "Ny besked fra appen". Hun
 * skimmer en indbakke, og en emnelinje uden indhold bliver ikke aabnet.
 */
export function emneFor3(noti: Noti3): string {
	if (noti.slags === 'savn') return noti.titel;
	if (noti.slags === 'dag') return noti.titel;
	return 'Linn har svaret dig';
}

function html3(overskrift: string, brodtekst: string, knap: string, sti: string, afmeld: boolean) {
	// Bevidst gammeldags og enkel. En mail skal kunne laeses i alt fra
	// Outlook til en telefon fra 2019, og et layout der er for smart er
	// et layout der knaekker et sted.
	return `<!doctype html>
<html lang="da"><body style="margin:0;padding:0;background:#f1eadf">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1eadf;padding:28px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fbf8f2;border-radius:18px;padding:28px 26px;font-family:Georgia,serif;color:#382c2a">
<tr><td style="font-size:21px;font-weight:600;padding-bottom:10px">${overskrift}</td></tr>
<tr><td style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#5c4a44;padding-bottom:22px">${brodtekst}</td></tr>
<tr><td><a href="${APP_URL3}${sti}" style="display:inline-block;background:#7c4f63;color:#fff;text-decoration:none;border-radius:999px;padding:12px 24px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:700">${knap}</a></td></tr>
<tr><td style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#a3948a;padding-top:26px">Kærlig hilsen Linn</td></tr>
${
	afmeld
		? `<tr><td style="font-family:Helvetica,Arial,sans-serif;font-size:11.5px;color:#a3948a;padding-top:14px;border-top:1px solid #e8dfd1">Vil du ikke have de her mails, kan du slå dem fra under Din side i appen.</td></tr>`
		: ''
}
</table>
</td></tr></table>
</body></html>`;
}

/** Mailen der svarer til én besked paa telefonen. */
export function mailFor3(noti: Noti3): Mail3 {
	const erSavn = noti.slags === 'savn';
	const knap = noti.slags === 'svar' ? 'Læs svaret' : 'Åbn appen';
	const brod = noti.tekst.trim();
	return {
		emne: emneFor3(noti),
		tekst: [
			noti.titel,
			'',
			brod,
			'',
			`${knap}: ${APP_URL3}${noti.sti}`,
			'',
			'Kærlig hilsen Linn',
			...(erSavn
				? ['', 'Vil du ikke have de her mails, kan du slå dem fra under Din side i appen.']
				: [])
		].join('\n'),
		html: html3(noti.titel, brod, knap, noti.sti, erSavn),
		medAfmeld: erSavn
	};
}
