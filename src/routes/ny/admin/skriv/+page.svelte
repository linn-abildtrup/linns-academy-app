<script lang="ts">
	// ============================================================
	// Admin: skriv til én kunde.
	//
	// Beskeden lander i hendes Beskeder som en traad, og hun kan svare
	// paa den. Svaret havner i Linns almindelige liste over spoergsmaal,
	// hvor hun svarer som hun plejer. Der er ikke en ny indbakke.
	//
	// DER ER INGEN OVERSKRIFT AT SKRIVE. Notifikationen siger altid "Linn
	// har skrevet til dig", og de foerste ord af beskeden staar under.
	// Ét felt faerre at tage stilling til. Linns valg 23. august.
	//
	// DEN KAN IKKE KALDES TILBAGE, og det staar paa skaermen inden hun
	// trykker. En besked paa forsiden kan rettes, den her er afleveret.
	//
	// Se HANDOVER 9.43.
	// ============================================================

	import { getContext } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import { klientSoegeMatch } from '$lib/utils/klientSoegning';
	import { hentAlleForlob } from '$lib/firestore/forlob';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import {
		aktiveForlobNavne3,
		forlobKilder3,
		hentKlienter3,
		type Klient3
	} from '$lib/firestore/traeningKunde3';
	import Sidehoved from '$lib/components/ny/Sidehoved.svelte';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';

	const hentUser = getContext<() => User | null>('user');
	const user = $derived(hentUser());
	const maaVaereHer = $derived(isAdmin(user));

	let henter = $state(true);
	let sender = $state(false);
	let fejl = $state('');
	let kvittering = $state('');
	let kunder = $state<Klient3[]>([]);
	let kilder = $state<ReturnType<typeof forlobKilder3>>([]);
	let soegeord = $state('');
	let valgt = $state<Klient3 | null>(null);
	let tekst = $state('');

	$effect(() => {
		if (!maaVaereHer) return;
		let afbrudt = false;
		(async () => {
			const [k, f] = await Promise.all([hentKlienter3(), hentAlleForlob()]);
			if (afbrudt) return;
			kunder = k;
			kilder = forlobKilder3(f as Forlob[]);
			henter = false;
		})().catch((e) => {
			console.error('[noti] kunne ikke hente kunderne', e);
			fejl = 'Kunne ikke hente kunderne.';
			henter = false;
		});
		return () => {
			afbrudt = true;
		};
	});

	const fundne = $derived(
		soegeord.trim().length < 2
			? []
			: kunder.filter((k) => klientSoegeMatch(k.soegetekst, soegeord)).slice(0, 8)
	);

	function holdFor(k: Klient3): string {
		const navne = aktiveForlobNavne3(k, kilder, Date.now()).map((f) => f.navn);
		return navne.length ? navne.join(', ') : 'Uden forløb';
	}

	async function send() {
		const u = user;
		if (!u || !valgt || sender || !tekst.trim()) return;
		sender = true;
		fejl = '';
		kvittering = '';
		try {
			const token = await u.getIdToken();
			const res = await fetch('/api/ny-skriv', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
				body: JSON.stringify({ uid: valgt.uid, tekst: tekst.trim() })
			});
			if (!res.ok) {
				fejl = `Det gik galt (${res.status}). Beskeden blev ikke sendt.`;
				return;
			}
			const r = (await res.json()) as {
				sendt: number;
				sprunget: string | null;
				mail?: boolean;
			};
			// Beskeden ligger i hendes app uanset hvad. Prikket er en ekstra
			// tjeneste, og linjen her siger hvad der faktisk skete.
			kvittering =
				r.sendt > 0
					? 'Sendt. Hun har den i Beskeder, og hun blev prikket på telefonen.'
					: r.mail
						? 'Sendt. Hun har den i Beskeder, og hun fik en mail — telefonen kunne ikke nås.'
						: r.sprunget === 'ingen-telefon'
							? 'Sendt. Hun har den i Beskeder, men hun kunne hverken nås på telefon eller mail.'
							: r.sprunget === 'slaaet-fra'
								? 'Sendt. Hun har den i Beskeder, men hun har slået notifikationer fra.'
								: 'Sendt. Hun har den i Beskeder.';
			tekst = '';
		} catch (e) {
			console.error('[noti] kunne ikke skrive', e);
			fejl = 'Kunne ikke sende.';
		} finally {
			sender = false;
		}
	}
</script>

<div class="ny-pad noti-admin">
	<Sidehoved
		titel="Skriv til en kunde"
		tilbage="/ny/admin"
		tilbageTekst="Admin"
		under="Beskeden lander i hendes Beskeder, og hun kan svare på den."
		kant={false}
	/>

	{#if !maaVaereHer}
		<div class="kort rolig">Siden er kun for admin.</div>
	{:else if henter}
		<div class="lektion-venter">
			<Ventetegn variant="lille" />
			<span>Henter kunderne</span>
		</div>
	{:else}
		{#if fejl}<div class="kort rolig nm-fejl">{fejl}</div>{/if}

		<section class="kort">
			{#if !valgt}
				<input
					class="na-soeg"
					type="search"
					placeholder="Søg efter en kunde…"
					bind:value={soegeord}
				/>
				{#each fundne as k (k.uid)}
					<button class="nt-fund" onclick={() => (valgt = k)}>
						<span>
							<span class="na-fund-n">{k.navn}</span>
							<span class="na-fund-s">{holdFor(k)}</span>
						</span>
						<span class="ds-pil">›</span>
					</button>
				{/each}
				{#if soegeord.trim().length >= 2 && fundne.length === 0}
					<div class="na-tom">Ingen med det navn.</div>
				{/if}
			{:else}
				<div class="nt-valgt">
					<div>
						<div class="na-fund-n">{valgt.navn}</div>
						<div class="na-fund-s">{holdFor(valgt)}</div>
					</div>
					<button class="na-x" onclick={() => (valgt = null)} aria-label="Vælg en anden">×</button>
				</div>

				<textarea
					class="skriv-felt"
					rows="5"
					placeholder="Skriv din besked til hende…"
					bind:value={tekst}
				></textarea>

				<div class="skriv-advarsel">
					Beskeden kan ikke kaldes tilbage. Skal det være noget alle skal se, og som du kan rette
					igen, så brug Besked på forsiden i stedet.
				</div>

				<button class="nt-knap" disabled={sender || !tekst.trim()} onclick={send}>
					{sender ? 'Sender' : 'Send besked'}
				</button>
			{/if}

			{#if kvittering}<div class="nt-kvittering">{kvittering}</div>{/if}
		</section>
	{/if}
</div>
