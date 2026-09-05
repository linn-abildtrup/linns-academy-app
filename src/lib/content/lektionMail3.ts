// ============================================================
// Mailen med lektionen.
//
// LINNS BESLUTNING 5. september: hun kan sende en skreven lektion eller
// et dokument til sin egen mail, og faa det som pdf. Ikke som en
// download til telefonen. En fil paa en telefon er nem at miste, og en
// mail kan hun soege frem paa enhver telefon og enhver computer. Og naar
// hun ringer, kan Linn sige "soeg paa lektionens navn i din indbakke".
//
// EMNELINJEN ER LEKTIONENS NAVN. Ikke "Din pdf fra appen". Hun skimmer
// en indbakke, og hun skal kunne finde den igen om et halvt aar.
//
// DER STAAR INGEN AFMELDING NEDERST. Hun har selv bedt om den her mail,
// og saa er den ikke markedsfoering. Samme skel som i mail3.ts.
//
// Se HANDOVER-KUNDEREJSEN.md og mockups-lektion-pdf.html.
// ============================================================

export interface LektionMail3 {
	emne: string;
	tekst: string;
	html: string;
}

/**
 * Et filnavn hun kan finde igen.
 *
 * Aa, ae og oe skrives om, for et filnavn med saerlige tegn bliver
 * lavet om af den ene telefon og ikke af den anden. Saa hellere
 * "naar-sulten-ikke-er-sult.pdf" hos alle.
 */
export function filnavnFor3(titel: string): string {
	const rent = (titel || 'lektion')
		.toLowerCase()
		.replace(/æ/g, 'ae')
		.replace(/ø/g, 'oe')
		.replace(/å/g, 'aa')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60);
	return `${rent || 'lektion'}.pdf`;
}

function flugt(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/**
 * Selve mailen.
 *
 * Layoutet er bevidst gammeldags og der er altid en ren tekst-udgave ved
 * siden af, praecis som de andre mails: den skal kunne laeses i alt fra
 * Outlook til en gammel telefon. Se mail3.ts.
 */
export function lektionMail3(titel: string): LektionMail3 {
	const t = titel.trim() || 'Din lektion';
	const tekst = [
		`Her er "${t}".`,
		'',
		'Du bad om at faa lektionen tilsendt. Den ligger som pdf her i mailen, saa du kan gemme den eller printe den.',
		'',
		'Kaerlig hilsen',
		'Linn'
	].join('\n');

	const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#352318;background:#faf6f1;padding:24px">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e8ded4;border-radius:12px;padding:24px">
<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#b87b6e;font-weight:700">Linns Academy</div>
<h1 style="font-size:20px;margin:10px 0 14px;color:#352318">Her er din lektion</h1>
<p style="margin:0 0 12px;color:#6b4e42">Du bad om at f&aring; &quot;${flugt(t)}&quot; tilsendt. Den ligger som PDF her i mailen, s&aring; du kan gemme den eller printe den.</p>
<p style="margin:0 0 4px;color:#6b4e42">K&aelig;rlig hilsen</p>
<p style="margin:0;color:#352318;font-weight:600">Linn</p>
</div>
</div>`;

	return { emne: t, tekst, html };
}
