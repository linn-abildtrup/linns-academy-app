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

// ── Svaret fra Linn: "Samtalen" ─────────────────────────────
//
// Linns valg 23. august, forslag 1 i mockups-mail-svar.html.
//
// HENDES EGET SPOERGSMAAL STAAR OVENOVER, og det er hele grunden til at
// den vandt: der kan gaa dage mellem spoergsmaal og svar, og uden hendes
// egen tekst laeser hun et svar paa noget hun har glemt hun spurgte om.
//
// ER SVARET KORT, skifter den til den korte form. Under hundrede tegn er
// opsaetningen i vejen: rammen ville fylde mere end svaret. Det er en
// regel i koden og ikke noget Linn skal tage stilling til hver gang.

export interface SvarMail3 {
	/** Det hun selv spurgte om. Tomt naar Linn skrev foerst. */
	spoergsmaal?: string;
	svar: string;
	/** Hvornaar hun spurgte. Bruges i linjen over spoergsmaalet. */
	sendtMs?: number;
}

function datoTekst3(ms: number | undefined): string {
	if (!ms) return '';
	const d = new Date(ms);
	const m = [
		'januar','februar','marts','april','maj','juni',
		'juli','august','september','oktober','november','december'
	][d.getMonth()];
	return `${d.getDate()}. ${m}`;
}

/**
 * Emnelinjen paa et svar.
 *
 * Den naevner HVAD det handler om og ikke bare "Linn har svaret dig".
 * De foerste ord af hendes eget spoergsmaal er det bedste vi har: det er
 * hendes egne ord, og hun genkender dem.
 */
export function svarEmne3(data: SvarMail3): string {
	const spm = (data.spoergsmaal ?? '').trim();
	if (!spm) return 'Linn har skrevet til dig';
	const kort = spm.length > 42 ? `${spm.slice(0, 42).trimEnd()}…` : spm;
	return `Svar på: ${kort}`;
}

/**
 * Svaret som en samtale.
 *
 * ALTID DEN SAMME FORM, ogsaa naar svaret er kort. Der var foerst en
 * kortere udgave uden ramme til de helt korte svar, men Linn saa den og
 * fravalgte den 23. august: et svar paa to linjer uden ramme laeser som
 * om der ikke blev taget tid til hende. Bygger nogen den igen, saa laes
 * den her linje foerst.
 *
 * Skrev Linn FOERST, er der ikke noget spoergsmaal at vise. Saa falder
 * den oeverste boble vaek, og resten staar som den plejer.
 */
export function svarMail3(data: SvarMail3): Mail3 {
	const svar = data.svar.trim();
	const spm = (data.spoergsmaal ?? '').trim();
	const dato = datoTekst3(data.sendtMs);

	const spmBlok = spm
		? `<tr><td style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#a3948a;font-weight:700">Du skrev${dato ? ` ${dato}` : ''}</td></tr>
<tr><td style="padding-top:7px"><table role="presentation" width="100%"><tr><td style="background:#f1eadf;border-radius:14px;padding:12px 14px;font-family:Helvetica,Arial,sans-serif;font-size:13.5px;line-height:1.55;color:#5c4a44">${spm}</td></tr></table></td></tr>`
		: '';

	return {
		emne: svarEmne3(data),
		tekst: [
			...(spm ? [`Du skrev${dato ? ` ${dato}` : ''}:`, spm, ''] : []),
			spm ? 'Linn svarede:' : 'Linn skrev til dig:',
			svar,
			'',
			`Skriv tilbage: ${APP_URL3}/ny/beskeder?fane=linn`
		].join('\n'),
		html: `<!doctype html><html lang="da"><body style="margin:0;padding:0;background:#f1eadf">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1eadf;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fbf8f2;border-radius:16px;padding:22px 20px">
${spmBlok}
<tr><td style="padding-top:${spm ? '18px' : '0'}"><table role="presentation" width="100%"><tr>
<td width="54" valign="top"><table role="presentation" width="44" height="44" style="background:#c9a3b1;border-radius:50%"><tr><td align="center" style="font-family:Georgia,serif;font-style:italic;font-weight:700;color:#ffffff;font-size:18px">L</td></tr></table></td>
<td valign="top">
<div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#7c4f63;font-weight:700">${spm ? 'Linn svarede' : 'Linn skrev til dig'}</div>
<div style="background:#f1e5e8;border-radius:14px;padding:13px 15px;margin-top:6px;font-family:Helvetica,Arial,sans-serif;font-size:14.5px;line-height:1.62;color:#4a2c39">${svar}</div>
</td></tr></table></td></tr>
<tr><td style="padding-top:20px"><a href="${APP_URL3}/ny/beskeder?fane=linn" style="display:inline-block;background:#7c4f63;color:#ffffff;text-decoration:none;border-radius:999px;padding:13px 24px;font-family:Helvetica,Arial,sans-serif;font-size:13.5px;font-weight:700">Skriv tilbage</a></td></tr>
<tr><td style="border-top:1px solid #e8dfd1;padding-top:14px"><div style="font-family:Helvetica,Arial,sans-serif;font-size:11.5px;color:#a3948a">Du får den her mail fordi du ${spm ? 'stillede et spørgsmål' : 'bruger'} i appen.</div></td></tr>
</table></td></tr></table></body></html>`,
		medAfmeld: false
	};
}

// ── Den generelle mail: opslag eller invitation ─────────────
//
// Linns valg 23. august: admin vaelger mellem de to. Opslaget til alt
// det almindelige, invitationen til det der sker paa et klokkeslaet.

export type GenerelForm3 = 'opslag' | 'invitation';

export const GENEREL_NAVNE3: Record<GenerelForm3, string> = {
	opslag: 'Opslag',
	invitation: 'Invitation'
};

export interface GenerelMail3 {
	form: GenerelForm3;
	tekst: string;
	/** Overskriften. Tom paa et opslag, hvor teksten baerer den selv. */
	overskrift?: string;
	/** Kun invitationen: "I aften kl. 19.00". */
	hvornaar?: string;
}

const FOD3 = `<tr><td align="center" style="padding-top:18px"><div style="font-family:Helvetica,Arial,sans-serif;font-size:11.5px;color:#a3948a;line-height:1.6">Du får den her mail fordi du bruger Linn's Academy.<br /><a href="${APP_URL3}/ny/profil/beskeder" style="color:#a3948a">Skru ned for mails</a></div></td></tr>`;

/** Den generelle mail i den form Linn har valgt. */
export function generelMail3(g: GenerelMail3): Mail3 {
	const tekst = g.tekst.trim();
	const overskrift = (g.overskrift ?? '').trim();
	const emne = overskrift || tekst.split(/[.!?\n]/)[0].slice(0, 60);

	if (g.form === 'invitation') {
		const hvornaar = (g.hvornaar ?? '').trim();
		return {
			emne: hvornaar ? `${hvornaar}: ${emne}` : emne,
			tekst: [hvornaar, overskrift, '', tekst, '', `Åbn appen: ${APP_URL3}/ny`, '', 'Vil du have færre mails, kan du skrue ned under Din side i appen.'].filter(Boolean).join('\n'),
			html: `<!doctype html><html lang="da"><body style="margin:0;padding:0;background:#f1eadf">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1eadf;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fbf8f2;border-radius:16px;overflow:hidden">
<tr><td align="center" style="background:#4a2e3d;padding:22px"><div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(242,233,223,.7);font-weight:700">Linn's Academy</div><div style="font-family:Georgia,serif;font-size:28px;color:#ffffff;padding-top:6px;line-height:1.15">${hvornaar || 'Snart'}</div></td></tr>
<tr><td style="padding:22px">
<div style="font-family:Georgia,serif;font-size:19px;font-weight:600;color:#382c2a;line-height:1.32">${overskrift || emne}</div>
<div style="font-family:Helvetica,Arial,sans-serif;font-size:14.5px;line-height:1.6;color:#5c4a44;padding:10px 0 18px">${tekst}</div>
<a href="${APP_URL3}/ny" style="display:inline-block;background:#7c4f63;color:#ffffff;text-decoration:none;border-radius:999px;padding:13px 26px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:700">Åbn appen</a>
</td></tr></table>
<table role="presentation" width="100%" style="max-width:520px">${FOD3}</table>
</td></tr></table></body></html>`,
			medAfmeld: true
		};
	}

	return {
		emne,
		tekst: [overskrift, '', tekst, '', `Åbn appen: ${APP_URL3}/ny`, '', 'Vil du have færre mails, kan du skrue ned under Din side i appen.'].filter(Boolean).join('\n'),
		html: `<!doctype html><html lang="da"><body style="margin:0;padding:0;background:#f1eadf">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1eadf;padding:22px 12px"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:520px"><tr><td align="center" style="padding-bottom:14px">
<span style="font-family:Georgia,serif;font-size:16px;color:#382c2a"><i>Linn's</i> Academy</span>
<div style="color:#b87b6e;font-size:14px;letter-spacing:2px;padding-top:3px">&#8734;</div>
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fbf8f2;border-radius:16px;padding:24px 22px">
${overskrift ? `<tr><td style="font-family:Georgia,serif;font-size:20px;font-weight:600;color:#382c2a;line-height:1.32">${overskrift}</td></tr>` : ''}
<tr><td style="font-family:Helvetica,Arial,sans-serif;font-size:14.5px;line-height:1.6;color:#5c4a44;padding:${overskrift ? '12px' : '0'} 0 20px">${tekst}</td></tr>
<tr><td><a href="${APP_URL3}/ny" style="display:inline-block;background:#7c4f63;color:#ffffff;text-decoration:none;border-radius:999px;padding:13px 26px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:700">Åbn appen</a></td></tr>
</table>
<table role="presentation" width="100%" style="max-width:520px">${FOD3}</table>
</td></tr></table></body></html>`,
		medAfmeld: true
	};
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
