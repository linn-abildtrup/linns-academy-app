// ============================================================
// Vagten. Den eneste opgave: bank paa hver time.
//
// DEN VED INGENTING SELV, og det er med vilje. Alt om hvornaar der skal
// sendes, til hvem og hvad der staar, ligger i appen, hvor Linn kan
// aendre det i admin. Vagten er en vaekkeur og ikke et regelsaet.
//
// Se HANDOVER 9.45.
// ============================================================

export interface Env {
	APP_URL: string;
	/** Den samme noegle som appen kender. Uden den svarer appen ikke. */
	NOTI_VAGT_NOEGLE: string;
}

export default {
	async scheduled(_hvornaar: ScheduledController, env: Env): Promise<void> {
		try {
			const res = await fetch(`${env.APP_URL}/api/ny-noti-daglig`, {
				method: 'POST',
				headers: {
					'x-noti-noegle': env.NOTI_VAGT_NOEGLE,
					'Content-Type': 'application/json'
				},
				body: '{}'
			});
			// Logges saa man kan se i Cloudflare hvad der skete klokken 6.
			console.log(`[vagt] ${res.status} ${await res.text()}`);
		} catch (e) {
			console.error('[vagt] kunne ikke naa appen', e);
		}
	}
};
