<script lang="ts">
	// ============================================================
	// Skallen til Linns Academy 3.0. Se SPEC-3.0.md afsnit 5.2.
	//
	// Denne rute er HELT adskilt fra /app. Der er bevidst INGEN
	// omdirigering fra det gamle layout hertil, fordi den eksisterende
	// app ikke maa aendres. Kunder med flaget faar linket direkte.
	//
	// Skallen genbruger alle eksisterende lib-moduler ved at LAESE dem.
	// Ingen af dem er aendret.
	// ============================================================

	import { goto } from '$app/navigation';
	import { onMount, setContext } from 'svelte';
	import { page } from '$app/state';
	import { onAuthStateChanged, type User } from 'firebase/auth';
	import { auth } from '$lib/firebase';
	import { getUserDoc, lytTilUserDoc } from '$lib/userDoc';
	import { hentForlob } from '$lib/firestore/forlob';
	import { produktTypeForForlob } from '$lib/content/forlobAdgang';
	import { harTestAdgang } from '$lib/utils/userAdgang';
	import { isAdmin } from '$lib/admin';
	import type { UserDoc } from '$lib/types';
	import {
		adgangsbilledeFor,
		type Adgangsbillede,
		type ForlobKilde,
		type NulDageKilde
	} from '$lib/content/adgang3';
	import { hentNulDage } from '$lib/firestore/nulDage3';
	import { vurderSpaerring, naadeTekst } from '$lib/content/spaerring3';
	import { APP_KOB_URL } from '$lib/content/abonnement';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import './ny.css';

	let { children } = $props();

	/** Flag-noeglen der giver adgang til 3.0. Saettes pr kunde. */
	const FLAG = 'ny-app';

	let user = $state<User | null>(null);
	let userDoc = $state<UserDoc | null>(null);
	let forlob = $state<ForlobKilde[]>([]);
	/** Kundens pause-dage pr produkt. Tom for alle andre end Kropsro. */
	let nulDage = $state<NulDageKilde>({});
	let loading = $state(true);

	const maaSeNyApp = $derived(isAdmin(user) || harTestAdgang(userDoc, FLAG));

	// Adgangsbilledet udledes af de felter der allerede staar paa kunden.
	// Ingen skrivninger, ingen migrering. Se SPEC-3.0.md afsnit 2.2.1.
	const adgang = $derived<Adgangsbillede>(
		adgangsbilledeFor(
			Date.now(),
			{
				forlobIds: userDoc?.forlobIds,
				aboKoebtAt: userDoc?.aboKoebtAt,
				aboSlutterAt: userDoc?.aboSlutterAt,
				aboProdukt: userDoc?.aboProdukt,
				activeProduct: userDoc?.activeProduct,
				activeSubscription: userDoc?.activeSubscription,
				accessSource: userDoc?.accessSource,
				bonusPeriodEndsAt: userDoc?.bonusPeriodEndsAt,
				createdAt: userDoc?.createdAt
			},
			forlob,
			nulDage
		)
	);

	// Spaerring naar abonnementet er udloebet. Den ligger HER og kun her,
	// saa der er ét sted at kigge, og ingen underside kan komme til at
	// slippe nogen ind ad en bagdoer. Se spaerring3.ts for reglerne.
	//
	// Admin spaerres aldrig. Ellers kunne Linn laase sig selv ude af sit
	// eget vaerktoej med en forkert dato paa sin egen konto.
	const spaerring = $derived(
		vurderSpaerring(
			{
				harApp: adgang.harApp,
				harAktivtForlob: adgang.aktiveForlob.length > 0,
				aboSlutterAt: userDoc?.aboSlutterAt ?? null
			},
			Date.now()
		)
	);

	const erSpaerret = $derived(!isAdmin(user) && spaerring.spaerret);

	setContext('userDoc', () => userDoc);
	setContext('user', () => user);
	setContext('adgang', () => adgang);
	// Forsiden bruger de raa forloebs-dokumenter til at tegne baandene paa
	// kurven, saa den ikke skal hente dem igen.
	setContext('forlob', () => forlob);

	/** Henter de forloebs-dokumenter kunden er tilmeldt. Kun laesning. */
	async function indlaesForlob(ids: string[]): Promise<ForlobKilde[]> {
		const hentet = await Promise.all(
			ids.map(async (id) => {
				try {
					const f = await hentForlob(id);
					if (!f?.startDato) return null;
					return {
						id: f.id,
						navn: f.navn,
						startMs: f.startDato.toDate().getTime(),
						antalDage: f.antalDage,
						produkt: produktTypeForForlob(f)
					} satisfies ForlobKilde;
				} catch (e) {
					console.warn('[ny] kunne ikke hente forloeb', id, e);
					return null;
				}
			})
		);
		return hentet.filter((f): f is ForlobKilde => f !== null);
	}

	onMount(() => {
		let userDocUnsubscribe: (() => void) | null = null;

		const authUnsubscribe = onAuthStateChanged(auth, async (u) => {
			if (!u) {
				userDocUnsubscribe?.();
				userDocUnsubscribe = null;
				await goto('/login');
				return;
			}

			user = u;
			const doc = await getUserDoc(u.uid);
			userDoc = doc;

			if (doc?.forlobIds?.length) {
				forlob = await indlaesForlob(doc.forlobIds);
				// Pause-dage skal med, ellers staar dagnummeret forkert for
				// den kunde der har holdt fri. Kun Kropsro kan holde pause,
				// saa for alle andre koster det her nul opslag.
				nulDage = await hentNulDage(
					u.uid,
					forlob.map((f) => f.produkt)
				);
			}

			loading = false;

			userDocUnsubscribe?.();
			userDocUnsubscribe = lytTilUserDoc(u.uid, (ny) => {
				if (ny) userDoc = ny;
			});
		});

		return () => {
			authUnsubscribe();
			userDocUnsubscribe?.();
		};
	});

	const faner = [
		{ href: '/ny', navn: 'Forside' },
		{ href: '/ny/30-30', navn: '30-30' },
		{ href: '/ny/snak', navn: 'Snak' },
		{ href: '/ny/udvikling', navn: 'Udvikling' },
		{ href: '/ny/profil', navn: 'Profil' }
	];

	function erAktiv(href: string): boolean {
		return href === '/ny' ? page.url.pathname === '/ny' : page.url.pathname.startsWith(href);
	}
</script>

<div class="ny-app">
	{#if loading}
		<div class="ny-besked">
			<Ventetegn variant="fuld" />
			<p class="vente-linje">Et øjeblik, jeg lukker dig ind.</p>
		</div>
	{:else if !maaSeNyApp}
		<div class="ny-besked">
			<h1>Ikke åben endnu</h1>
			<p>
				Den nye app er under opbygning og er kun åben for udvalgte testere. Du finder din
				sædvanlige app på det vante sted.
			</p>
			<a class="btn" href="/app">Gå til appen</a>
		</div>
	{:else if erSpaerret}
		<!-- Roligt, ikke en fejlmeddelelse. Hun har ikke gjort noget
		     forkert, abonnementet er bare loebet ud. Se spaerring3.ts. -->
		<div class="ny-besked">
			<h1>Din adgang er udløbet</h1>
			<p>
				Dit abonnement er ikke længere aktivt, så appen er lukket for nu. Alt hvad du har
				registreret, ligger stadig og venter på dig, og det kommer tilbage i samme øjeblik du
				fornyer.
			</p>
			<a class="btn" href={APP_KOB_URL} target="_blank" rel="noopener">Forny dit abonnement</a>
			<p class="spaer-hjaelp">
				Har du lige fornyet, så giv det et øjeblik og hent siden igen. Passer det ikke, så skriv
				til Linn, så retter hun det.
			</p>
		</div>
	{:else}
		<div class="ny-shell">
			{#if spaerring.iNaade}
				<!-- Hun er inde paa naade. Hun skal vide det, saa hun naar at
				     forny, men hun skal ikke spaerres midt i det hun laver. -->
				<div class="naade-baand">
					<span>{naadeTekst(spaerring.dageTilbageAfNaade)}</span>
					<a href={APP_KOB_URL} target="_blank" rel="noopener">Forny</a>
				</div>
			{/if}
			<div class="ny-scroll">
				{@render children()}
			</div>

			<nav class="ny-nav" aria-label="Hovedmenu">
				{#each faner as fane (fane.href)}
					<a
						href={fane.href}
						class:active={erAktiv(fane.href)}
						aria-current={erAktiv(fane.href) ? 'page' : undefined}
					>
						{#if fane.navn === 'Forside'}
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.9"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<path d="M3 10.5L12 4l9 6.5" /><path d="M5 9.5V20h14V9.5" />
							</svg>
						{:else if fane.navn === '30-30'}
							<!-- En skaal med damp. 30-30 handler om mad, ikke om moduler,
							     saa firkanterne fra Moduler passede ikke laengere. -->
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.9"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<path d="M3.5 11.5h17a8.5 8.5 0 0 1-8.5 8.5 8.5 8.5 0 0 1-8.5-8.5Z" />
								<path d="M9 7.5c0-1.2 1.2-1.6 1.2-2.8S9 3 9 3" />
								<path d="M14.2 7.5c0-1.2 1.2-1.6 1.2-2.8s-1.2-1.7-1.2-1.7" />
							</svg>
						{:else if fane.navn === 'Snak'}
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.9"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<path
									d="M6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4 3v-3h-.5A2.5 2.5 0 0 1 4 13.5v-7A2.5 2.5 0 0 1 6.5 4Z"
								/>
							</svg>
						{:else if fane.navn === 'Udvikling'}
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.9"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<path
									d="M12 3c1 3-1 5-2 6.5C8.5 11 8 12.5 8 14a4 4 0 0 0 8 0c0-1.2-.4-2.3-1-3 .2 1.2-.6 2-1.3 2 .8-2 .3-4-1.7-6.5-.3 1-1 1.6-2 2 1-2.2.3-4.5 0-5.5z"
								/>
							</svg>
						{:else}
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.9"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<circle cx="12" cy="8" r="4" /><path d="M5 21c0-3.87 3.13-7 7-7s7 3.13 7 7" />
							</svg>
						{/if}
						{fane.navn}
					</a>
				{/each}
			</nav>
		</div>
	{/if}
</div>
