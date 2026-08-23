<script lang="ts">
	// ============================================================
	// Admin: beskeder paa telefonen.
	//
	// Samme tre lag som naeringen: hvad Linn tillader pr forloeb, en
	// linje for alle medlemmer, og kundens eget valg oveni. Se
	// content/notifikation3.ts for reglen.
	//
	// KUN 3.0. Der kan ikke sendes til en kunde i den gamle app, uanset
	// hvad der staar her. Endpointet tjekker det selv.
	//
	// SEND EN ENKELT er ikke pynt: det er den eneste maade at se at hele
	// kaeden virker, fra knappen her til laaseskaermen. Bygget 23. august.
	// ============================================================

	import { getContext } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import { klientSoegeMatch } from '$lib/utils/klientSoegning';
	import {
		NOTI_NAVNE3,
		NOTI_SLAGS3,
		type NotiRegler3,
		type NotiValgSlags3
	} from '$lib/content/notifikation3';
	import { gemNotiRegler3, hentNotiRegler3 } from '$lib/firestore/notifikation3';
	import { hentAlleForlob } from '$lib/firestore/forlob';
	import {
		aktiveForlobNavne3,
		forlobKilder3,
		hentKlienter3,
		type Klient3
	} from '$lib/firestore/traeningKunde3';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import Sidehoved from '$lib/components/ny/Sidehoved.svelte';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';

	const hentUser = getContext<() => User | null>('user');
	const user = $derived(hentUser());
	const maaVaereHer = $derived(isAdmin(user));

	let henter = $state(true);
	let gemmer = $state(false);
	let fejl = $state('');
	let regler = $state<NotiRegler3>({ medlemmer: {}, forlob: {} });
	let forlob = $state<{ id: string; navn: string }[]>([]);
	let kunder = $state<Klient3[]>([]);
	let kilder = $state<ReturnType<typeof forlobKilder3>>([]);

	// Send en enkelt
	let soegeord = $state('');
	let valgt = $state<Klient3 | null>(null);
	let titel = $state('');
	let tekst = $state('');
	let kvittering = $state('');

	$effect(() => {
		if (!maaVaereHer) return;
		let afbrudt = false;
		(async () => {
			const [r, f, k] = await Promise.all([hentNotiRegler3(), hentAlleForlob(), hentKlienter3()]);
			if (afbrudt) return;
			regler = { medlemmer: r.medlemmer ?? {}, forlob: r.forlob ?? {} };
			forlob = f.map((x: Forlob) => ({ id: x.id, navn: x.navn }));
			kilder = forlobKilder3(f);
			kunder = k;
			henter = false;
		})().catch((e) => {
			console.error('[noti] kunne ikke hente skemaet', e);
			fejl = 'Kunne ikke hente skemaet.';
			henter = false;
		});
		return () => {
			afbrudt = true;
		};
	});

	const til = (v: Partial<Record<NotiValgSlags3, boolean>> | undefined, s: NotiValgSlags3) =>
		v?.[s] ?? true;

	async function skriv(ny: NotiRegler3) {
		const foer = regler;
		regler = ny;
		gemmer = true;
		fejl = '';
		try {
			await gemNotiRegler3(ny);
		} catch (e) {
			console.error('[noti] kunne ikke gemme', e);
			regler = foer;
			fejl = 'Kunne ikke gemme. Prøv igen.';
		} finally {
			gemmer = false;
		}
	}

	function skiftMedlem(s: NotiValgSlags3) {
		void skriv({ ...regler, medlemmer: { ...regler.medlemmer, [s]: !til(regler.medlemmer, s) } });
	}

	function skiftForlob(id: string, s: NotiValgSlags3) {
		const nu = regler.forlob?.[id] ?? {};
		void skriv({ ...regler, forlob: { ...regler.forlob, [id]: { ...nu, [s]: !til(nu, s) } } });
	}

	const fundne = $derived(
		soegeord.trim().length < 2
			? []
			: kunder.filter((k) => klientSoegeMatch(k.soegetekst, soegeord)).slice(0, 8)
	);

	function holdFor(k: Klient3): string {
		const navne = aktiveForlobNavne3(k, kilder, Date.now()).map((f) => f.navn);
		return navne.length ? navne.join(', ') : 'Uden forløb';
	}

	/** Sender én besked. Svaret siger HVORFOR hvis der ikke skete noget. */
	async function send() {
		const u = user;
		if (!u || !valgt || gemmer || !titel.trim()) return;
		gemmer = true;
		kvittering = '';
		fejl = '';
		try {
			const token = await u.getIdToken();
			const res = await fetch('/api/ny-noti', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
				body: JSON.stringify({
					uid: valgt.uid,
					tvang: true,
					besked: {
						titel: titel.trim(),
						tekst: tekst.trim(),
						sti: '/ny',
						slags: 'svar'
					}
				})
			});
			if (!res.ok) {
				fejl = `Det gik galt (${res.status}). Se om nøglerne er sat i Cloudflare.`;
				return;
			}
			const r = (await res.json()) as { sendt: number; sprunget: string | null };
			kvittering =
				r.sendt > 0
					? `Sendt til ${r.sendt} ${r.sendt === 1 ? 'enhed' : 'enheder'}.`
					: r.sprunget === 'ingen-telefon'
						? 'Hun har ikke sagt ja til beskeder endnu.'
						: r.sprunget === 'ingen-adgang'
							? 'Hun er ikke på 3.0, så der kan ikke sendes til hende.'
							: r.sprunget === 'slaaet-fra'
								? 'Hun har slået den slags fra.'
								: 'Der blev ikke sendt noget.';
			if (r.sendt > 0) {
				titel = '';
				tekst = '';
			}
		} catch (e) {
			console.error('[noti] kunne ikke sende', e);
			fejl = 'Kunne ikke sende.';
		} finally {
			gemmer = false;
		}
	}
</script>

<div class="ny-pad noti-admin">
	<Sidehoved
		titel="Notifikationer"
		tilbage="/ny/admin"
		tilbageTekst="Admin"
		under="Hvad appen må sige til om, og til hvem."
		kant={false}
	/>

	{#if !maaVaereHer}
		<div class="kort rolig">Siden er kun for admin.</div>
	{:else if henter}
		<div class="lektion-venter">
			<Ventetegn variant="lille" />
			<span>Henter skemaet</span>
		</div>
	{:else}
		{#if fejl}<div class="kort rolig nm-fejl">{fejl}</div>{/if}

		<div class="lab"><h2>Alle medlemmer</h2></div>
		<section class="kort">
			<div class="na-raekke">
				<div class="na-navn">Medlemmer uden forløb</div>
				<div class="na-sub">Gælder også de forløb du ikke selv har sat.</div>
				<div class="na-knapper">
					{#each NOTI_SLAGS3 as s (s)}
						<button class="na-k" onclick={() => skiftMedlem(s)} disabled={gemmer}>
							<span class="na-sw" class:on={til(regler.medlemmer, s)}><i></i></span>
							{NOTI_NAVNE3[s].navn}
						</button>
					{/each}
				</div>
			</div>
		</section>

		<div class="lab"><h2>Forløb</h2></div>
		<section class="kort">
			{#each forlob as f (f.id)}
				{@const r = regler.forlob?.[f.id]}
				<div class="na-raekke">
					<div class="na-navn">{f.navn}</div>
					<div class="na-knapper">
						{#each NOTI_SLAGS3 as s (s)}
							<button class="na-k" onclick={() => skiftForlob(f.id, s)} disabled={gemmer}>
								<span class="na-sw" class:on={til(r, s)}><i></i></span>
								{NOTI_NAVNE3[s].navn}
							</button>
						{/each}
					</div>
				</div>
			{/each}
		</section>

		<div class="lab"><h2>Send et prik</h2></div>
		<div class="kort rolig" style="margin-bottom:10px">
			Det her er kun en notifikation. Der bliver ikke skrevet noget i hendes app, så hun kan ikke
			læse den igen. Skal hun kunne det, så brug <b>Skriv til en kunde</b> i stedet.
		</div>
		<section class="kort">
			{#if !valgt}
				<input class="na-soeg" type="search" placeholder="Søg efter en kunde…" bind:value={soegeord} />
				{#each fundne as k (k.uid)}
					<button class="nt-fund" onclick={() => (valgt = k)}>
						<span>
							<span class="na-fund-n">{k.navn}</span>
							<span class="na-fund-s">{holdFor(k)}</span>
						</span>
						<span class="ds-pil">›</span>
					</button>
				{/each}
			{:else}
				<div class="nt-valgt">
					<div>
						<div class="na-fund-n">{valgt.navn}</div>
						<div class="na-fund-s">{holdFor(valgt)}</div>
					</div>
					<button class="na-x" onclick={() => (valgt = null)} aria-label="Vælg en anden">×</button>
				</div>
				<input class="na-soeg" type="text" placeholder="Overskrift" bind:value={titel} />
				<input class="na-soeg" type="text" placeholder="Linjen under" bind:value={tekst} />
				<button class="nt-knap" disabled={gemmer || !titel.trim()} onclick={send}>
					{gemmer ? 'Sender' : 'Send nu'}
				</button>
			{/if}
			{#if kvittering}<div class="nt-kvittering">{kvittering}</div>{/if}
		</section>

		<div class="kort rolig na-forklaring">
			Rækkefølgen: kunden kan altid slå fra, ellers gælder forløbet, ellers linjen for alle
			medlemmer. Hun får kun noget hvis hun har sagt ja på sin telefon, og der sendes aldrig til en
			kunde i den gamle app.
		</div>
	{/if}
</div>
