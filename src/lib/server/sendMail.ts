// ============================================================
// Afsendelse af mail. Reserven naar telefonen ikke kan naas.
//
// HVORFOR EN TJENESTE OG IKKE OS SELV. En mail der skal frem og ikke i
// spam kraever at modtagerens server kan se at vi har lov at sende paa
// linnsacademy.dk. Det er et par linjer hos domaenet plus en afsender
// der har ry for at opfoere sig ordentligt. Det bygger man ikke selv.
//
// Linns valg 23. august: vores egen afsender og ikke Simplero, saa
// mailen kan sige praecis hvad den handler om og komme med det samme.
//
// DEN FEJLER ALDRIG OPAD. Kan mailen ikke sendes, er beskeden der
// stadig i appen. En mail der ikke kom frem maa aldrig kunne vaelte
// noget andet.
//
// Se HANDOVER 9.47.
// ============================================================

import type { Mail3 } from '$lib/content/mail3';

export interface MailOpsaetning3 {
	apiNoegle: string;
	/** Afsenderen, fx "Linn <linn@linnsacademy.dk>". */
	fra: string;
}

/** Opsaetningen fra miljoeet, eller null hvis mailen ikke er sat op endnu. */
export function mailOpsaetning3(
	env: Record<string, string | undefined>
): MailOpsaetning3 | null {
	const apiNoegle = env.RESEND_API_KEY;
	if (!apiNoegle) return null;
	return { apiNoegle, fra: env.MAIL_FRA || 'Linn <linn@linnsacademy.dk>' };
}

export interface MailResultat3 {
	ok: boolean;
	status: number;
}

/** Sender én mail. Kaster ikke. */
export async function sendMail3(
	til: string,
	mail: Mail3,
	ops: MailOpsaetning3
): Promise<MailResultat3> {
	if (!til.includes('@')) return { ok: false, status: 0 };
	try {
		const res = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${ops.apiNoegle}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				from: ops.fra,
				to: [til],
				subject: mail.emne,
				text: mail.tekst,
				html: mail.html
			})
		});
		if (!res.ok) {
			console.error('[mail] afvist', res.status, await res.text());
		}
		return { ok: res.ok, status: res.status };
	} catch (e) {
		console.error('[mail] kunne ikke sende', e);
		return { ok: false, status: 0 };
	}
}
